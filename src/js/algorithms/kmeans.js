// js/algorithms/kmeans.js
import { SharedClusterBuffer } from '../utils/sharedBuffer.js';

export class KMeans {
    constructor(k, maxIterations, convergenceThreshold, numWorkers = 4) {
        this.k = k;
        this.maxIterations = maxIterations;
        this.convergenceThreshold = convergenceThreshold;
        this.numWorkers = numWorkers;
        this.workers = [];
        this.clusterBuffer = new SharedClusterBuffer(k); // Cria buffer para resultado
    }

    async fit(sharedCityBuffer, totalCities) {
        console.log("Iniciando K-Means Paralelo...");
        
        // 1. Inicializa Centróides Aleatórios (leitura direta do buffer de cidades)
        this.initializeCentroids(sharedCityBuffer, totalCities);

        // 2. Inicializa Workers
        await this.initWorkers(sharedCityBuffer, totalCities);

        let iterations = 0;
        let converged = false;

        while (iterations < this.maxIterations && !converged) {
            // Reset contadores de cluster para nova iteração
            this.clusterBuffer.resetCounters();

            // Etapa 1: Atribuição (Paralela)
            await this.runAssignmentStep(totalCities);

            // Etapa 2: Atualização de Centróides (Paralela/Híbrida)
            const newCentroids = await this.runUpdateStep();

            // Verifica Convergência
            converged = this.checkConvergence(newCentroids);
            
            // Atualiza centróides para próxima iteração
            this.updateCentroidsBuffer(newCentroids);
            
            iterations++;
            
            // Opcional: Notificar progresso para UI
            console.log(`Iteração ${iterations} concluída.`);
        }

        this.terminateWorkers();

        return {
            buffer: this.clusterBuffer,
            iterations: iterations,
            centroids: this.getCentroidsFromBuffer()
        };
    }

    initializeCentroids(cityBuffer, totalCities) {
        // Pega K cidades aleatórias como centróides iniciais
        const view = new Float64Array(cityBuffer.getBuffer());
        const fields = 155;
        
        for (let i = 0; i < this.k; i++) {
            const randIdx = Math.floor(Math.random() * totalCities);
            const offset = randIdx * fields;
            this.clusterBuffer.writeCentroid(i, 
                view[offset + 1], // lat
                view[offset + 2], // lon
                view[offset + 3]  // pop
            );
        }
    }

    async initWorkers(cityBuffer, totalCities) {
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
                        cityBuffer: cityBuffer.getBuffer(), // Passa buffer bruto
                        clusterBuffer: this.clusterBuffer.getCitiesBuffer(),
                        clusterCounters: this.clusterBuffer.getCountersBuffer(),
                        centroidBuffer: this.clusterBuffer.getCentroidBuffer(),
                        totalCities: totalCities,
                        k: this.k
                    }
                });
            }));
        }
        await Promise.all(promises);
    }

    runAssignmentStep(totalCities) {
        const batchSize = Math.ceil(totalCities / this.numWorkers);
        const promises = this.workers.map((worker, index) => {
            return new Promise(resolve => {
                worker.onmessage = (e) => {
                    if (e.data.type === 'assignComplete') resolve();
                };
                worker.postMessage({
                    type: 'assignClusters',
                    data: {
                        startIndex: index * batchSize,
                        endIndex: Math.min((index + 1) * batchSize, totalCities),
                        workerId: index
                    }
                });
            });
        });
        return Promise.all(promises);
    }

    runUpdateStep() {
        // Distribui o cálculo dos K clusters entre os workers
        // Ex: Cluster 0 -> Worker 0, Cluster 1 -> Worker 1...
        const newCentroids = new Array(this.k).fill(null);
        const promises = [];
        
        for (let i = 0; i < this.k; i++) {
            const worker = this.workers[i % this.numWorkers];
            promises.push(new Promise(resolve => {
                const tempHandler = (e) => {
                    if (e.data.type === 'centroidCalculated' && e.data.clusterIndex === i) {
                        worker.removeEventListener('message', tempHandler);
                        resolve(e.data.centroid);
                    }
                };
                worker.addEventListener('message', tempHandler);
                
                worker.postMessage({
                    type: 'calculateCentroids',
                    data: { clusterIndex: i, workerId: i % this.numWorkers }
                });
            }));
        }

        return Promise.all(promises).then(results => {
            return results.map(r => {
                if (r.count === 0) return { latitude: 0, longitude: 0, population: 0 }; // Tratamento simples
                return {
                    latitude: r.lat / r.count,
                    longitude: r.lon / r.count,
                    population: r.pop / r.count
                };
            });
        });
    }

    checkConvergence(newCentroids) {
        const currentCentroids = this.getCentroidsFromBuffer();
        for (let i = 0; i < this.k; i++) {
            const dist = Math.sqrt(
                Math.pow(currentCentroids[i].latitude - newCentroids[i].latitude, 2) +
                Math.pow(currentCentroids[i].longitude - newCentroids[i].longitude, 2) +
                Math.pow(currentCentroids[i].population - newCentroids[i].population, 2)
            );
            if (dist > this.convergenceThreshold) return false;
        }
        return true;
    }

    updateCentroidsBuffer(newCentroids) {
        newCentroids.forEach((c, i) => {
            this.clusterBuffer.writeCentroid(i, c.latitude, c.longitude, c.population);
        });
    }

    getCentroidsFromBuffer() {
        const centroids = [];
        for (let i = 0; i < this.k; i++) {
            centroids.push(this.clusterBuffer.readCentroid(i));
        }
        return centroids;
    }

    terminateWorkers() {
        this.workers.forEach(w => w.terminate());
        this.workers = [];
    }
}