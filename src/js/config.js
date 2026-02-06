// Configuração global da aplicação
class Config {
    constructor() {
        this.settings = {};
        this.loaded = false;
    }

    async load() {
        try {
            const response = await fetch('/.env');
            const text = await response.text();
            
            text.split('\n').forEach(line => {
                line = line.trim();
                if (line && !line.startsWith('#')) {
                    const [key, ...valueParts] = line.split('=');
                    const value = valueParts.join('=').trim();
                    this.settings[key.trim()] = value;
                }
            });
            
            this.loaded = true;
            return this.settings;
        } catch (error) {
            console.error('Erro ao carregar configurações:', error);
            // Configurações padrão caso falhe
            this.settings = {
                GEODB_API_KEY: '',
                GEODB_API_HOST: 'wft-geo-db.p.rapidapi.com',
                GEODB_BASE_URL: 'https://wft-geo-db.p.rapidapi.com/v1/geo',
                CITIES_PER_PAGE: '10',
                MASSIVE_FETCH_TOTAL: '10000',
                NUM_WORKERS: '4',
                DEFAULT_K_CLUSTERS: '5',
                MAX_ITERATIONS: '100',
                CONVERGENCE_THRESHOLD: '0.001',
                REQUEST_DELAY_MS: '1000',
                ERROR_RETRY_DELAY_MS: '5000',
                RATE_LIMIT_RETRY_MS: '10000'
            };
            this.loaded = true;
            return this.settings;
        }
    }

    get(key) {
        return this.settings[key];
    }

    getNumber(key) {
        return Number(this.settings[key]);
    }
}

export const config = new Config();