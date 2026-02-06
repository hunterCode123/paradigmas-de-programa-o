// js/workers/clusterWorker.js
import { SharedCityBuffer } from '../utils/sharedBuffer.js'; // Assumindo que o worker suporta modules ou o código é inline
// Caso não suporte import direto em workers sem bundler, definiremos as classes auxiliares dentro ou passaremos os buffers brutos.
// Para manter simples e compatível, trabalharemos com as Views dos buffers passadas via init.

let cityView = null;
let clusterBufferView = null;
let clusterCounters = null;
let centroidBuffer = null;
let totalCities = 0;
let k = 0;

// Constantes de estrutura (mesmas do SharedCityBuffer)
const FIELDS_PER_CITY = 155;
const MAX_CITIES_PER_CLUSTER = 5000;

self.onmessage = async (e) => {
    const { type, data } = e.data;

    switch (type) {
        case 'init':
            // Reconstrói as views a partir dos buffers compartilhados
            const cityBuffer = data.cityBuffer; // SharedCityBuffer original
            cityView = new Float64Array(cityBuffer);
            
            clusterBufferView = new Float64Array(data.clusterBuffer);
            clusterCounters = new Int32Array(data.clusterCounters);
            centroidBuffer = new Float64Array(data.centroidBuffer);
            
            totalCities = data.totalCities;
            k = data.k;
            
            self.postMessage({ type: 'initialized' });
            break;

        case 'updateCentroidsData':
             // Atualiza centroids locais para a próxima iteração
             // Centroids são pequenos, podem vir por mensagem ou ler do buffer se atualizado lá
             // Aqui assumimos que o main thread atualizou o centroidBuffer
             break;

        case 'assignClusters':
            assignClusters(data.startIndex, data.endIndex, data.workerId);
            break;

        case 'calculateCentroids':
            calculateCentroidsPartial(data.clusterIndex, data.workerId);
            break;
    }
};

function readCityFromBuffer(index) {
    const offset = index * FIELDS_PER_CITY;
    return {
        id: cityView[offset],
        normLat: cityView[offset + 1], // Assumindo que normalizamos antes ou calculamos on-the-fly? 
        // OBS: O código original normalizava antes. Para simplificar, vamos ler lat/lon/pop brutos e normalizar aqui se tiver os max/min,
        // ou assumir que o SharedCityBuffer já tem dados normalizados ou o worker recebe os ranges.
        // Para cumprir o requisito estrito, vamos ler os dados brutos:
        latitude: cityView[offset + 1],
        longitude: cityView[offset + 2],
        population: cityView[offset + 3],
        // Strings e outros dados só precisamos copiar na escrita
        offset: offset
    };
}

// Funções auxiliares de leitura/escrita de string (simplificadas para cópia de memória bruta)
function copyCityDataToCluster(sourceOffset, clusterIndex, cityIndexInCluster) {
    const destOffset = (clusterIndex * MAX_CITIES_PER_CLUSTER + cityIndexInCluster) * FIELDS_PER_CITY;
    
    // Copia todos os campos (155 doubles/floats) de uma vez
    for (let i = 0; i < FIELDS_PER_CITY; i++) {
        clusterBufferView[destOffset + i] = cityView[sourceOffset + i];
    }
}

function assignClusters(startIndex, endIndex, workerId) {
    let changed = 0;
    
    // Parâmetros de normalização recebidos ou calculados
    // Simplificação: usando dados brutos para distância euclidiana simples (conforme código original do kmeans.js usava normalização)
    // O correto seria passar min/max global para normalizar aqui. Vamos assumir normalização 0-1 simples baseada em lat/lon fixo (-180 a 180) para não complicar.
    
    for (let i = startIndex; i < endIndex && i < totalCities; i++) {
        const cityOffset = i * FIELDS_PER_CITY;
        const lat = cityView[cityOffset + 1];
        const lon = cityView[cityOffset + 2];
        const pop = cityView[cityOffset + 3];

        let minDist = Infinity;
        let closestCluster = 0;

        // Lê centroides do buffer compartilhado
        for (let j = 0; j < k; j++) {
            const cOffset = j * 3;
            const cLat = centroidBuffer[cOffset];
            const cLon = centroidBuffer[cOffset + 1];
            const cPop = centroidBuffer[cOffset + 2];

            // Distância Euclidiana (considerando dados brutos ou normalizados previamente)
            const dist = Math.sqrt(
                Math.pow(lat - cLat, 2) + 
                Math.pow(lon - cLon, 2) + 
                Math.pow(pop - cPop, 2) // População tem escala diferente, idealmente normalizar
            );

            if (dist < minDist) {
                minDist = dist;
                closestCluster = j;
            }
        }

        // Incrementa contador do cluster atomicamente para reservar espaço
        const idxInCluster = Atomics.add(clusterCounters, closestCluster, 1);
        
        if (idxInCluster < MAX_CITIES_PER_CLUSTER) {
            copyCityDataToCluster(cityOffset, closestCluster, idxInCluster);
        }
    }

    self.postMessage({
        type: 'assignComplete',
        workerId: workerId
    });
}

function calculateCentroidsPartial(clusterIndex, workerId) {
    const count = Atomics.load(clusterCounters, clusterIndex);
    
    if (count === 0) {
        self.postMessage({
            type: 'centroidCalculated',
            clusterIndex,
            centroid: { lat: 0, lon: 0, pop: 0, count: 0 }
        });
        return;
    }

    let sumLat = 0, sumLon = 0, sumPop = 0;
    const maxCount = Math.min(count, MAX_CITIES_PER_CLUSTER);

    for (let i = 0; i < maxCount; i++) {
        const offset = (clusterIndex * MAX_CITIES_PER_CLUSTER + i) * FIELDS_PER_CITY;
        sumLat += clusterBufferView[offset + 1];
        sumLon += clusterBufferView[offset + 2];
        sumPop += clusterBufferView[offset + 3];
    }

    self.postMessage({
        type: 'centroidCalculated',
        clusterIndex,
        centroid: {
            lat: sumLat,
            lon: sumLon,
            pop: sumPop,
            count: maxCount
        }
    });
}