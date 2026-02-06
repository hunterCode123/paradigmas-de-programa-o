// Worker para busca massiva de cidades
let config = {};
let mutex = null;
let sharedBuffer = null;
let counterBuffer = null;
let counter = null;
let cityBuffer = null;

// Mutex simples usando Atomics
class WorkerMutex {
    constructor(buffer) {
        this.buffer = new Int32Array(buffer);
    }

    lock() {
        while (true) {
            const oldValue = Atomics.compareExchange(this.buffer, 0, 0, 1);
            if (oldValue === 0) {
                return;
            }
            Atomics.wait(this.buffer, 0, 1, 100);
        }
    }

    unlock() {
        Atomics.store(this.buffer, 0, 0);
        Atomics.notify(this.buffer, 0, 1);
    }
}

self.onmessage = async (e) => {
    const { type, data } = e.data;

    switch (type) {
        case 'init':
            config = data.config;
            mutex = new WorkerMutex(data.mutexBuffer);
            sharedBuffer = data.sharedBuffer;
            counterBuffer = data.counterBuffer;
            counter = new Int32Array(counterBuffer);
            
            // View do buffer de cidades
            cityBuffer = new Float64Array(sharedBuffer);
            
            self.postMessage({ type: 'initialized' });
            break;

        case 'fetch':
            await fetchCitiesRange(data.startOffset, data.endOffset, data.limit, data.workerId);
            break;
    }
};

async function fetchCitiesRange(startOffset, endOffset, limit, workerId) {
    const apiKey = config.GEODB_API_KEY;
    const apiHost = config.GEODB_API_HOST;
    const baseUrl = config.GEODB_BASE_URL;
    const requestDelay = parseInt(config.REQUEST_DELAY_MS);
    const errorRetryDelay = parseInt(config.ERROR_RETRY_DELAY_MS);
    const rateLimitRetryDelay = parseInt(config.RATE_LIMIT_RETRY_MS);

    let currentOffset = startOffset;
    const fieldsPerCity = 155;

    while (currentOffset < endOffset) {
        // Adquire lock antes de fazer requisição
        mutex.lock();
        
        try {
            const params = new URLSearchParams({
                offset: currentOffset.toString(),
                limit: limit.toString(),
                sort: '-population',
                types: 'CITY'
            });

            const url = `${baseUrl}/cities?${params.toString()}`;
            
            self.postMessage({
                type: 'progress',
                workerId: workerId,
                offset: currentOffset,
                message: `Worker ${workerId}: Buscando offset ${currentOffset}`
            });

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-RapidAPI-Key': apiKey,
                    'X-RapidAPI-Host': apiHost
                }
            });

            if (!response.ok) {
                if (response.status === 429) {
                    self.postMessage({
                        type: 'warning',
                        workerId: workerId,
                        message: `Worker ${workerId}: Rate limit atingido, aguardando...`
                    });
                    
                    mutex.unlock();
                    await sleep(rateLimitRetryDelay);
                    continue;
                }
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            
            if (!data.data || data.data.length === 0) {
                self.postMessage({
                    type: 'warning',
                    workerId: workerId,
                    message: `Worker ${workerId}: Dados vazios no offset ${currentOffset}, aguardando...`
                });
                
                mutex.unlock();
                await sleep(errorRetryDelay);
                currentOffset += limit;
                continue;
            }

            // Escreve cidades no SharedArrayBuffer
            data.data.forEach(city => {
                const currentIndex = Atomics.add(counter, 0, 1);
                const offset = currentIndex * fieldsPerCity;
                
                // Escreve dados numéricos
                cityBuffer[offset] = city.id || 0;
                cityBuffer[offset + 1] = city.latitude || 0;
                cityBuffer[offset + 2] = city.longitude || 0;
                cityBuffer[offset + 3] = city.population || 0;
                cityBuffer[offset + 4] = city.elevationMeters || 0;
                
                // Escreve strings
                writeString(city.name || '', offset + 5, 50);
                writeString(city.country || '', offset + 55, 50);
                writeString(city.region || '', offset + 105, 50);
            });

            const totalFetched = Atomics.load(counter, 0);
            self.postMessage({
                type: 'fetched',
                workerId: workerId,
                count: data.data.length,
                total: totalFetched,
                offset: currentOffset
            });

            currentOffset += limit;
            
            // Libera lock
            mutex.unlock();
            
            // Delay entre requisições
            await sleep(requestDelay);

        } catch (error) {
            mutex.unlock();
            
            self.postMessage({
                type: 'error',
                workerId: workerId,
                error: error.message,
                offset: currentOffset
            });
            
            await sleep(errorRetryDelay);
            currentOffset += limit;
        }
    }

    self.postMessage({
        type: 'complete',
        workerId: workerId
    });
}

function writeString(str, offset, maxLength) {
    const trimmed = (str || '').substring(0, maxLength);
    for (let i = 0; i < maxLength; i++) {
        cityBuffer[offset + i] = i < trimmed.length ? trimmed.charCodeAt(i) : 0;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}