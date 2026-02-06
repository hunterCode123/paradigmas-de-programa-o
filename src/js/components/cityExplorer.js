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
        if (cities.length === 0) {
            this.container.innerHTML = '<div class="no-results">Nenhuma cidade encontrada</div>';
            return;
        }

        this.container.innerHTML = cities.map(city => `
            <div class="city-card" data-city-id="${city.id}">
                <h3>${city.name}</h3>
                <p><strong>País:</strong> ${city.country}</p>
                <p><strong>Região:</strong> ${city.region || 'N/A'}</p>
                <p><strong>População:</strong> ${(city.population || 0).toLocaleString()}</p>
                <p><strong>Coordenadas:</strong> ${city.latitude.toFixed(4)}, ${city.longitude.toFixed(4)}</p>
                <button class="add-btn" data-city='${JSON.stringify(city)}'>
                    ➕ Adicionar
                </button>
            </div>
        `).join('');

        this.container.querySelectorAll('.add-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const city = JSON.parse(btn.dataset.city);
                this.onCitySelect(city);
                btn.textContent = '✓ Adicionada';
                btn.disabled = true;
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
            nextBtn.disabled = !metadata || metadata.currentOffset + this.citiesPerPage >= 1000;
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