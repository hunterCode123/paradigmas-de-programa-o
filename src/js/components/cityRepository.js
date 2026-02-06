// Componente de repositório de cidades selecionadas
export class CityRepository {
    constructor(containerId, counterId) {
        this.container = document.getElementById(containerId);
        this.counter = document.getElementById(counterId);
        this.selectedCities = new Map();
    }

    addCity(city) {
        if (this.selectedCities.has(city.id)) {
            return false;
        }

        this.selectedCities.set(city.id, city);
        this.render();
        return true;
    }

    removeCity(cityId) {
        this.selectedCities.delete(cityId);
        this.render();
    }

    clearAll() {
        this.selectedCities.clear();
        this.render();
    }

    getCities() {
        return Array.from(this.selectedCities.values());
    }

    getCount() {
        return this.selectedCities.size;
    }

    render() {
        this.counter.textContent = this.selectedCities.size;

        if (this.selectedCities.size === 0) {
            this.container.innerHTML = '<p style="text-align: center; color: #94a3b8;">Nenhuma cidade selecionada</p>';
            return;
        }

        this.container.innerHTML = Array.from(this.selectedCities.values())
            .map(city => `
                <div class="selected-city-tag">
                    <span>${city.name}, ${city.country}</span>
                    <button class="remove-btn" data-city-id="${city.id}">×</button>
                </div>
            `).join('');

        this.container.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const cityId = parseInt(btn.dataset.cityId);
                this.removeCity(cityId);
            });
        });
    }
}