// Configuração global da aplicação
class Config {
    constructor() {
        this.settings = {};
        this.loaded = false;
    }

    async load() {
        try {
            // Tenta buscar o arquivo .env na raiz do servidor
            const response = await fetch('/.env');
            
            // Verifica se o arquivo existe (status 200-299)
            if (!response.ok) {
                throw new Error(`Arquivo .env não encontrado (${response.status})`);
            }

            const text = await response.text();
            
            // Verificação de segurança: Se o conteúdo começar com '<', é HTML (erro 404 do Nginx)
            if (text.trim().startsWith('<')) {
                throw new Error('O conteúdo retornado parece ser HTML, não um arquivo .env válido');
            }
            
            // Processa o arquivo linha por linha
            text.split('\n').forEach(line => {
                line = line.trim();
                // Ignora linhas vazias ou comentários (#)
                if (line && !line.startsWith('#')) {
                    const [key, ...valueParts] = line.split('=');
                    const value = valueParts.join('=').trim();
                    this.settings[key.trim()] = value;
                }
            });
            
            console.log('✅ Configuração carregada via .env');
            this.loaded = true;
            return this.settings;

        } catch (error) {
            console.warn('⚠️ Usando configurações padrão. Motivo:', error.message);
            
            // Configurações de fallback (Produção)
            this.settings = {
                GEODB_API_KEY: 'fb427f5b38mshc2cc15c80d3bdf7p176f89jsnaf7f6edd75aa', 
                GEODB_API_HOST: 'wft-geo-db.p.rapidapi.com',
                GEODB_BASE_URL: 'https://wft-geo-db.p.rapidapi.com/v1/geo',
                
                CITIES_PER_PAGE: '10',
                MASSIVE_FETCH_TOTAL: '10000', 
                
                DEFAULT_K_CLUSTERS: '5',
                MAX_ITERATIONS: '100',
                CONVERGENCE_THRESHOLD: '0.001',

                NUM_WORKERS: '4',
                REQUEST_DELAY_MS: '2000',
                ERROR_RETRY_DELAY_MS: '5000',
                RATE_LIMIT_RETRY_MS: '15000'
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