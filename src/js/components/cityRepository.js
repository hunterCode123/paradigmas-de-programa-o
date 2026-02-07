export class CityRepository {
    constructor(storageKey = 'selectedCities', countElementId = 'selectedCount') {
        this.storageKey = storageKey;
        this.countElementId = countElementId;
        this.cities = this.loadFromStorage();
        this.updateCount();
        this.render();
    }

    addCity(city) {
        // Evita duplicatas verificando o ID
        if (this.cities.some(c => c.id === city.id)) {
            return false;
        }

        this.cities.push(city);
        this.saveToStorage();
        this.updateCount();
        this.render();
        return true;
    }

    removeCity(cityId) {
        this.cities = this.cities.filter(c => c.id !== cityId);
        this.saveToStorage();
        this.updateCount();
        this.render();
    }

    getCities() {
        return this.cities;
    }

    clearAll() {
        this.cities = [];
        this.saveToStorage();
        this.updateCount();
        this.render();
    }

    // --- Métodos Internos de Storage (LocalStorage) ---

    saveToStorage() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.cities));
    }

    loadFromStorage() {
        const stored = localStorage.getItem(this.storageKey);
        return stored ? JSON.parse(stored) : [];
    }

    updateCount() {
        const element = document.getElementById(this.countElementId);
        if (element) {
            element.textContent = this.cities.length;
        }
    }

    render() {
        const container = document.getElementById('selectedCities');
        if (!container) return;

        container.innerHTML = '';

        if (this.cities.length === 0) {
            container.innerHTML = '<p class="empty-msg">Nenhuma cidade selecionada.</p>';
            return;
        }

        this.cities.forEach(city => {
            const card = document.createElement('div');
            card.className = 'city-card mini';
            card.innerHTML = `
                <div class="city-info">
                    <h4>${city.name}</h4>
                    <p>${city.country}</p>
                </div>
                <button class="remove-btn" data-id="${city.id}">×</button>
            `;

            const removeBtn = card.querySelector('.remove-btn');
            removeBtn.addEventListener('click', () => {
                this.removeCity(city.id);
            });

            container.appendChild(card);
        });
    }

    // --- NOVOS MÉTODOS PARA CACHE.JSON (O que estava faltando) ---

    saveToCache() {
        const cities = this.getCities();
        
        if (cities.length === 0) {
            alert('Não há cidades selecionadas para salvar.');
            return;
        }

        // Converte as cidades para texto JSON
        const dataStr = JSON.stringify(cities, null, 2);
        
        // Cria um "arquivo virtual" no navegador
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Cria um link falso e clica nele para baixar
        const a = document.createElement('a');
        a.href = url;
        a.download = 'cache.json';
        document.body.appendChild(a);
        a.click();
        
        // Limpeza
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    loadFromCache(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const cities = JSON.parse(e.target.result);
                    
                    if (!Array.isArray(cities)) {
                        throw new Error('Formato do cache.json inválido.');
                    }

                    let count = 0;
                    cities.forEach(city => {
                        if (this.addCity(city)) {
                            count++;
                        }
                    });
                    
                    resolve(count);
                } catch (error) {
                    reject(error);
                }
            };

            reader.readAsText(file);
        });
    }
}