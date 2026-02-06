// Gerenciador de SharedArrayBuffer para armazenar cidades
export class SharedCityBuffer {
    constructor(maxCities = 10000) {
        this.maxCities = maxCities;
        
        // Estrutura de cada cidade (em Float64Array):
        // [0] = id (número)
        // [1] = latitude
        // [2] = longitude
        // [3] = population
        // [4] = elevation
        // [5-54] = name (50 chars em UTF-16, 2 bytes cada = 100 bytes)
        // [55-104] = country (50 chars)
        // [105-154] = region (50 chars)
        
        this.fieldsPerCity = 155; // Campos numéricos + strings
        this.bytesPerCity = this.fieldsPerCity * 8; // Float64 = 8 bytes
        
        const totalBytes = this.maxCities * this.bytesPerCity;
        this.buffer = new SharedArrayBuffer(totalBytes);
        this.view = new Float64Array(this.buffer);
        
        // Contador de cidades escritas
        this.counterBuffer = new SharedArrayBuffer(4);
        this.counter = new Int32Array(this.counterBuffer);
        Atomics.store(this.counter, 0, 0);
    }

    getBuffer() {
        return this.buffer;
    }

    getCounterBuffer() {
        return this.counterBuffer;
    }

    // Escreve uma cidade no buffer
    writeCity(city, index) {
        if (index >= this.maxCities) {
            throw new Error('Índice de cidade excede capacidade do buffer');
        }

        const offset = index * this.fieldsPerCity;
        
        // Campos numéricos
        this.view[offset] = city.id || 0;
        this.view[offset + 1] = city.latitude || 0;
        this.view[offset + 2] = city.longitude || 0;
        this.view[offset + 3] = city.population || 0;
        this.view[offset + 4] = city.elevationMeters || 0;
        
        // Strings (convertidas para códigos de caracteres)
        this.writeString(city.name || '', offset + 5, 50);
        this.writeString(city.country || '', offset + 55, 50);
        this.writeString(city.region || '', offset + 105, 50);
    }

    // Lê uma cidade do buffer
    readCity(index) {
        if (index >= this.maxCities) {
            return null;
        }

        const offset = index * this.fieldsPerCity;
        
        return {
            id: this.view[offset],
            latitude: this.view[offset + 1],
            longitude: this.view[offset + 2],
            population: this.view[offset + 3],
            elevationMeters: this.view[offset + 4],
            name: this.readString(offset + 5, 50),
            country: this.readString(offset + 55, 50),
            region: this.readString(offset + 105, 50)
        };
    }

    // Escreve string no buffer
    writeString(str, offset, maxLength) {
        const trimmed = (str || '').substring(0, maxLength);
        for (let i = 0; i < maxLength; i++) {
            this.view[offset + i] = i < trimmed.length ? trimmed.charCodeAt(i) : 0;
        }
    }

    // Lê string do buffer
    readString(offset, maxLength) {
        let result = '';
        for (let i = 0; i < maxLength; i++) {
            const code = this.view[offset + i];
            if (code === 0) break;
            result += String.fromCharCode(code);
        }
        return result;
    }

    // Incrementa contador atômicamente
    incrementCounter() {
        return Atomics.add(this.counter, 0, 1);
    }

    // Obtém contador atual
    getCounter() {
        return Atomics.load(this.counter, 0);
    }

    // Reseta contador
    resetCounter() {
        Atomics.store(this.counter, 0, 0);
    }

    // Lê todas as cidades armazenadas
    readAllCities() {
        const count = this.getCounter();
        const cities = [];
        
        for (let i = 0; i < count; i++) {
            cities.push(this.readCity(i));
        }
        
        return cities;
    }
}

// Buffer para clusters
export class SharedClusterBuffer {
    constructor(maxClusters = 20, maxCitiesPerCluster = 5000) {
        this.maxClusters = maxClusters;
        this.maxCitiesPerCluster = maxCitiesPerCluster;
        
        // Estrutura similar ao SharedCityBuffer
        this.fieldsPerCity = 155;
        this.bytesPerCity = this.fieldsPerCity * 8;
        
        // Buffer para centroides (k clusters * 3 valores: lat, lon, pop)
        this.centroidBuffer = new SharedArrayBuffer(maxClusters * 3 * 8);
        this.centroids = new Float64Array(this.centroidBuffer);
        
        // Buffer para cidades de cada cluster
        const citiesBufferSize = maxClusters * maxCitiesPerCluster * this.bytesPerCity;
        this.citiesBuffer = new SharedArrayBuffer(citiesBufferSize);
        this.citiesView = new Float64Array(this.citiesBuffer);
        
        // Contadores de cidades por cluster
        this.countersBuffer = new SharedArrayBuffer(maxClusters * 4);
        this.counters = new Int32Array(this.countersBuffer);
    }

    getCentroidBuffer() {
        return this.centroidBuffer;
    }

    getCitiesBuffer() {
        return this.citiesBuffer;
    }

    getCountersBuffer() {
        return this.countersBuffer;
    }

    writeCentroid(clusterIndex, latitude, longitude, population) {
        const offset = clusterIndex * 3;
        this.centroids[offset] = latitude;
        this.centroids[offset + 1] = longitude;
        this.centroids[offset + 2] = population;
    }

    readCentroid(clusterIndex) {
        const offset = clusterIndex * 3;
        return {
            latitude: this.centroids[offset],
            longitude: this.centroids[offset + 1],
            population: this.centroids[offset + 2]
        };
    }

    writeCity(clusterIndex, city, cityIndexInCluster) {
        const baseOffset = (clusterIndex * this.maxCitiesPerCluster + cityIndexInCluster) * this.fieldsPerCity;
        
        this.citiesView[baseOffset] = city.id || 0;
        this.citiesView[baseOffset + 1] = city.latitude || 0;
        this.citiesView[baseOffset + 2] = city.longitude || 0;
        this.citiesView[baseOffset + 3] = city.population || 0;
        this.citiesView[baseOffset + 4] = city.elevationMeters || 0;
        
        this.writeString(city.name || '', baseOffset + 5, 50);
        this.writeString(city.country || '', baseOffset + 55, 50);
        this.writeString(city.region || '', baseOffset + 105, 50);
    }

    readCity(clusterIndex, cityIndexInCluster) {
        const baseOffset = (clusterIndex * this.maxCitiesPerCluster + cityIndexInCluster) * this.fieldsPerCity;
        
        return {
            id: this.citiesView[baseOffset],
            latitude: this.citiesView[baseOffset + 1],
            longitude: this.citiesView[baseOffset + 2],
            population: this.citiesView[baseOffset + 3],
            elevationMeters: this.citiesView[baseOffset + 4],
            name: this.readString(baseOffset + 5, 50),
            country: this.readString(baseOffset + 55, 50),
            region: this.readString(baseOffset + 105, 50)
        };
    }

    writeString(str, offset, maxLength) {
        const trimmed = (str || '').substring(0, maxLength);
        for (let i = 0; i < maxLength; i++) {
            this.citiesView[offset + i] = i < trimmed.length ? trimmed.charCodeAt(i) : 0;
        }
    }

    readString(offset, maxLength) {
        let result = '';
        for (let i = 0; i < maxLength; i++) {
            const code = this.citiesView[offset + i];
            if (code === 0) break;
            result += String.fromCharCode(code);
        }
        return result;
    }

    incrementClusterCounter(clusterIndex) {
        return Atomics.add(this.counters, clusterIndex, 1);
    }

    getClusterCounter(clusterIndex) {
        return Atomics.load(this.counters, clusterIndex);
    }

    resetCounters() {
        for (let i = 0; i < this.maxClusters; i++) {
            Atomics.store(this.counters, i, 0);
        }
    }

    readCluster(clusterIndex) {
        const count = this.getClusterCounter(clusterIndex);
        const cities = [];
        
        for (let i = 0; i < count; i++) {
            cities.push(this.readCity(clusterIndex, i));
        }
        
        return {
            centroid: this.readCentroid(clusterIndex),
            cities: cities
        };
    }
}