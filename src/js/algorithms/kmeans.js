import { SharedClusterBuffer } from '../utils/sharedBuffer.js';

export class KMeans {
    constructor(k, maxIterations, convergenceThreshold, numWorkers = 4) {
        this.k = k;
        this.maxIterations = maxIterations;
        this.convergenceThreshold = convergenceThreshold;
        this.numWorkers = numWorkers;
        this.workers = [];
        this.clusterBuffer = new SharedClusterBuffer(k);
    }

    async fit(sharedCityBuffer, totalCities) {
        const minMax = this.calculateMinMax(sharedCityBuffer, totalCities);

        let currentCentroids = this.initializeCentroids(sharedCityBuffer, totalCities, minMax);

        await this.initWorkers(sharedCityBuffer, totalCities, minMax);

        let iterations = 0;
        let converged = false;

        while (iterations < this.maxIterations && !converged) {
            const partialResults = await this.runIterationStep(currentCentroids, totalCities);

            const newCentroids = this.aggregateCentroids(partialResults);

            converged = this.checkConvergence(currentCentroids, newCentroids);
            
            currentCentroids = newCentroids;
            iterations++;
        }

        this.updateCentroidsBuffer(currentCentroids);

        await this.runFinalizeStep(totalCities);

        this.terminateWorkers();

        return {
            buffer: this.clusterBuffer,
            iterations: iterations,
            centroids: currentCentroids
        };
    }

    calculateMinMax(sharedBuffer, totalCities) {
        let minLat = Infinity, maxLat = -Infinity;
        let minLon = Infinity, maxLon = -Infinity;
        let minPop = Infinity, maxPop = -Infinity;

        const view = new Float64Array(sharedBuffer.getBuffer());
        const fields = 155;

        for (let i = 0; i < totalCities; i++) {
            const offset = i * fields;
            const lat = view[offset + 1];
            const lon = view[offset + 2];
            const pop = view[offset + 3];

            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
            if (lon < minLon) minLon = lon;
            if (lon > maxLon) maxLon = lon;
            if (pop < minPop) minPop = pop;
            if (pop > maxPop) maxPop = pop;
        }

        return { minLat, maxLat, minLon, maxLon, minPop, maxPop };
    }

    initializeCentroids(cityBuffer, totalCities, minMax) {
        const centroids = [];
        const view = new Float64Array(cityBuffer.getBuffer());
        const fields = 155;
        
        for (let i = 0; i < this.k; i++) {
            const randIdx = Math.floor(Math.random() * totalCities);
            const offset = randIdx * fields;
            centroids.push({
                latitude: view[offset + 1],
                longitude: view[offset + 2],
                population: view[offset + 3]
            });
        }
        return centroids;
    }

    async initWorkers(cityBuffer, totalCities, minMax) {
        const promises = [];
        for (let i = 0; i < this.numWorkers; i++) {
            const worker = new Worker('/js/workers/clusterWorker.js', { type: 'module' });
            this.workers.push(worker);
            
            promises.push(new Promise(resolve => {
                worker.onmessage = (e) => {
                    if (e.data.type === 'initialized') resolve();
                };
                worker.postMessage({
                    type: 'init',
                    data: {
                        cityBuffer: cityBuffer.getBuffer(),
                        totalCities: totalCities,
                        k: this.k,
                        minMax: minMax
                    }
                });
            }));
        }
        await Promise.all(promises);
    }

    runIterationStep(centroids, totalCities) {
        const batchSize = Math.ceil(totalCities / this.numWorkers);
        const promises = this.workers.map((worker, index) => {
            return new Promise(resolve => {
                const handler = (e) => {
                    if (e.data.type === 'iterationComplete') {
                        worker.removeEventListener('message', handler);
                        resolve(new Float64Array(e.data.partialSums));
                    }
                };
                worker.addEventListener('message', handler);
                worker.postMessage({
                    type: 'iterate',
                    data: {
                        centroids: centroids,
                        startOffset: index * batchSize,
                        endOffset: Math.min((index + 1) * batchSize, totalCities)
                    }
                });
            });
        });
        return Promise.all(promises);
    }

    aggregateCentroids(partialResults) {
        const sums = new Float64Array(this.k * 4);

        partialResults.forEach(partial => {
            for (let i = 0; i < sums.length; i++) {
                sums[i] += partial[i];
            }
        });

        const newCentroids = [];
        for (let i = 0; i < this.k; i++) {
            const base = i * 4;
            const count = sums[base];
            
            if (count > 0) {
                newCentroids.push({
                    latitude: sums[base + 1] / count,
                    longitude: sums[base + 2] / count,
                    population: sums[base + 3] / count
                });
            } else {
                newCentroids.push({ latitude: 0, longitude: 0, population: 0 });
            }
        }
        return newCentroids;
    }

    checkConvergence(oldCentroids, newCentroids) {
        for (let i = 0; i < this.k; i++) {
            const dist = Math.sqrt(
                Math.pow(oldCentroids[i].latitude - newCentroids[i].latitude, 2) +
                Math.pow(oldCentroids[i].longitude - newCentroids[i].longitude, 2) +
                Math.pow(oldCentroids[i].population - newCentroids[i].population, 2)
            );
            if (dist > this.convergenceThreshold) return false;
        }
        return true;
    }

    async runFinalizeStep(totalCities) {
        this.clusterBuffer.resetCounters();
        
        const batchSize = Math.ceil(totalCities / this.numWorkers);
        const promises = this.workers.map((worker, index) => {
            return new Promise(resolve => {
                const handler = (e) => {
                    if (e.data.type === 'finalizeComplete') {
                        worker.removeEventListener('message', handler);
                        resolve();
                    }
                };
                worker.addEventListener('message', handler);
                
                worker.postMessage({
                    type: 'finalize',
                    data: {
                        clusterBuffer: this.clusterBuffer.getCitiesBuffer(),
                        countersBuffer: this.clusterBuffer.getCountersBuffer(),
                        maxCitiesPerCluster: 5000,
                        startOffset: index * batchSize,
                        endOffset: Math.min((index + 1) * batchSize, totalCities)
                    }
                });
            });
        });
        return Promise.all(promises);
    }

    updateCentroidsBuffer(centroids) {
        centroids.forEach((c, i) => {
            this.clusterBuffer.writeCentroid(i, c.latitude, c.longitude, c.population);
        });
    }

    terminateWorkers() {
        this.workers.forEach(w => w.terminate());
        this.workers = [];
    }
}