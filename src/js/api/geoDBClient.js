// Cliente para GeoDB Cities API
export class GeoDBClient {
    constructor(apiKey, apiHost, baseUrl) {
        this.apiKey = apiKey;
        this.apiHost = apiHost;
        this.baseUrl = baseUrl;
    }

    async findCities(offset = 0, limit = 10, namePrefix = '') {
        const params = new URLSearchParams({
            offset: offset.toString(),
            limit: limit.toString(),
            sort: '-population',
            types: 'CITY'
        });

        if (namePrefix) {
            params.append('namePrefix', namePrefix);
        }

        const url = `${this.baseUrl}/cities?${params.toString()}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': this.apiKey,
                'X-RapidAPI-Host': this.apiHost
            }
        });

        if (!response.ok) {
            if (response.status === 429) {
                throw new Error('RATE_LIMIT');
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    }

    async getCityById(cityId) {
        const url = `${this.baseUrl}/cities/${cityId}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': this.apiKey,
                'X-RapidAPI-Host': this.apiHost
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    }
}