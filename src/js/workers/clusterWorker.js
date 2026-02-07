const FIELDS_PER_CITY = 155;
const IDX_LAT = 1;
const IDX_LON = 2;
const IDX_POP = 3;

let cityView = null;
let localAssignments = null;
let totalCities = 0;
let k = 0;

let minMax = {
    minLat: -90, maxLat: 90,
    minLon: -180, maxLon: 180,
    minPop: 0, maxPop: 50000000
};

self.onmessage = async (e) => {
    const { type, data } = e.data;

    switch (type) {
        case 'init':
            init(data);
            break;

        case 'iterate':
            iterate(data.centroids, data.startOffset, data.endOffset);
            break;

        case 'finalize':
            finalize(data.clusterBuffer, data.countersBuffer, data.maxCitiesPerCluster, data.startOffset, data.endOffset);
            break;
    }
};

function init(data) {
    cityView = new Float64Array(data.cityBuffer);
    totalCities = data.totalCities;
    k = data.k;

    localAssignments = new Int32Array(totalCities);
    localAssignments.fill(-1);

    if (data.minMax) {
        minMax = data.minMax;
    }

    self.postMessage({ type: 'initialized' });
}

function iterate(centroids, startOffset, endOffset) {
    const partialSums = new Float64Array(k * 4);

    for (let i = startOffset; i < endOffset; i++) {
        if (i >= totalCities) break;

        const offset = i * FIELDS_PER_CITY;
        
        const lat = cityView[offset + IDX_LAT];
        const lon = cityView[offset + IDX_LON];
        const pop = cityView[offset + IDX_POP];

        const nLat = normalize(lat, minMax.minLat, minMax.maxLat);
        const nLon = normalize(lon, minMax.minLon, minMax.maxLon);
        const nPop = normalize(pop, minMax.minPop, minMax.maxPop);

        let minDist = Infinity;
        let closestCluster = 0;

        for (let j = 0; j < k; j++) {
            const cLat = normalize(centroids[j].latitude, minMax.minLat, minMax.maxLat);
            const cLon = normalize(centroids[j].longitude, minMax.minLon, minMax.maxLon);
            const cPop = normalize(centroids[j].population, minMax.minPop, minMax.maxPop);

            const dist = (nLat - cLat) ** 2 + (nLon - cLon) ** 2 + (nPop - cPop) ** 2;

            if (dist < minDist) {
                minDist = dist;
                closestCluster = j;
            }
        }

        localAssignments[i] = closestCluster;

        const baseIdx = closestCluster * 4;
        partialSums[baseIdx + 0] += 1;
        partialSums[baseIdx + 1] += lat;
        partialSums[baseIdx + 2] += lon;
        partialSums[baseIdx + 3] += pop;
    }

    self.postMessage({
        type: 'iterationComplete',
        partialSums: partialSums.buffer
    }, [partialSums.buffer]);
}

function finalize(clusterBuffer, countersBuffer, maxCitiesPerCluster, startOffset, endOffset) {
    const clusterView = new Float64Array(clusterBuffer);
    const counters = new Int32Array(countersBuffer);

    let writtenCount = 0;

    for (let i = startOffset; i < endOffset; i++) {
        if (i >= totalCities) break;

        const clusterIndex = localAssignments[i];
        
        if (clusterIndex === -1) continue;

        const idxInCluster = Atomics.add(counters, clusterIndex, 1);

        if (idxInCluster < maxCitiesPerCluster) {
            const srcStart = i * FIELDS_PER_CITY;
            const srcEnd = srcStart + FIELDS_PER_CITY;
            
            const destStart = (clusterIndex * maxCitiesPerCluster + idxInCluster) * FIELDS_PER_CITY;

            clusterView.set(cityView.subarray(srcStart, srcEnd), destStart);
            
            writtenCount++;
        }
    }

    self.postMessage({
        type: 'finalizeComplete',
        writtenCount: writtenCount
    });
}

function normalize(val, min, max) {
    return (val - min) / (max - min || 1);
}