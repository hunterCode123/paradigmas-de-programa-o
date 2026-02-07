// Componente de exploração de cidades
import { config } from '../config.js';
import { GeoDBClient } from '../api/geoDBClient.js';

export class CityExplorer {
    constructor(containerId, onCitySelect) {
        this.container = document.getElementById(containerId);
        this.onCitySelect = onCitySelect;
        this.currentPage = 0;
        this.currentSearch = '';
        this.client = null;
        this.citiesPerPage = 10;
        this.loading = false;
    }

    async init() {
        this.citiesPerPage = config.getNumber('CITIES_PER_PAGE');
        
        this.client = new GeoDBClient(
            config.get('GEODB_API_KEY'),
            config.get('GEODB_API_HOST'),
            config.get('GEODB_BASE_URL')
        );

        await this.loadCities();
    }

    async loadCities(search = '') {
        if (this.loading) return;
        
        this.loading = true;
        this.currentSearch = search;
        
        try {
            this.container.innerHTML = '<div class="loading">Carregando cidades...</div>';
            
            const offset = this.currentPage * this.citiesPerPage;
            const response = await this.client.findCities(offset, this.citiesPerPage, search);
            
            this.renderCities(response.data || []);
            this.updatePagination(response.metadata);
            
        } catch (error) {
            console.error('Erro ao carregar cidades:', error);
            this.container.innerHTML = `<div class="error">Erro ao carregar cidades: ${error.message}</div>`;
        } finally {
            this.loading = false;
        }
    }

    renderCities(cities) {
        // Verificação de segurança extra para array vazio ou nulo
        if (!cities || cities.length === 0) {
            this.container.innerHTML = '<div class="no-results">Nenhuma cidade encontrada</div>';
            return;
        }

        // Mapeia as cidades criando o HTML
        this.container.innerHTML = cities.map(city => {
            // --- CORREÇÃO DE SEGURANÇA (CRUCIAL) ---
            // Substitui aspas simples (') por &#39; para não quebrar o atributo data-city do HTML
            // Isso resolve o erro "Unterminated string in JSON"
            const safeCityData = JSON.stringify(city).replace(/'/g, "&#39;");

            return `
            <div class="city-card" data-city-id="${city.id}">
                <div class="card-header">
                    <h3>${city.name}</h3>
                </div>
                <div class="card-body">
                    <p><strong>País:</strong> ${city.country}</p>
                    <p><strong>Região:</strong> ${city.region || 'N/A'}</p>
                    <p><strong>População:</strong> ${(city.population || 0).toLocaleString()}</p>
                    <p><strong>Coordenadas:</strong> ${city.latitude.toFixed(4)}, ${city.longitude.toFixed(4)}</p>
                </div>
                <button class="add-btn primary-btn" data-city='${safeCityData}'>
                    ➕ Adicionar
                </button>
            </div>
            `;
        }).join('');

        // Reatacha os eventos aos botões
        this.container.querySelectorAll('.add-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                try {
                    // Recupera o JSON seguro
                    const city = JSON.parse(btn.dataset.city);
                    this.onCitySelect(city);
                    
                    // Feedback visual
                    btn.textContent = '✓ Adicionada';
                    btn.disabled = true;
                    btn.style.backgroundColor = '#10b981'; // Verde sucesso
                    btn.style.cursor = 'default';
                } catch (e) {
                    console.error("Erro ao processar cidade selecionada:", e);
                }
            });
        });
    }

    updatePagination(metadata) {
        if (!metadata) return;
        
        const pageInfo = document.getElementById('pageInfo');
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');

        if (pageInfo) {
            pageInfo.textContent = `Página ${this.currentPage + 1}`;
        }

        if (prevBtn) {
            prevBtn.disabled = this.currentPage === 0;
        }

        if (nextBtn) {
            // GeoDB Free tier tem um limite de offset (geralmente não deixa passar de certos valores)
            // Essa lógica evita tentar paginar infinitamente se a API bloquear
            const totalCount = metadata.totalCount || 10000; 
            const nextOffset = metadata.currentOffset + this.citiesPerPage;
            nextBtn.disabled = nextOffset >= totalCount;
        }
    }

    nextPage() {
        this.currentPage++;
        this.loadCities(this.currentSearch);
    }

    prevPage() {
        if (this.currentPage > 0) {
            this.currentPage--;
            this.loadCities(this.currentSearch);
        }
    }

    search(query) {
        this.currentPage = 0;
        this.loadCities(query);
    }
}