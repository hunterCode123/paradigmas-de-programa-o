// Componente para visualização de clusters
export class ClusterViewer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.clusters = [];
    }

    setResults(clusters, centroids, iterations) {
        this.clusters = clusters;
        this.centroids = centroids;
        this.iterations = iterations;
        this.render();
    }

    render() {
        if (this.clusters.length === 0) {
            this.container.innerHTML = '<p>Nenhum cluster gerado ainda.</p>';
            return;
        }

        const colors = [
            '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', 
            '#10b981', '#06b6d4', '#6366f1', '#f43f5e',
            '#14b8a6', '#a855f7', '#ef4444', '#84cc16'
        ];

        this.container.innerHTML = `
            <div style="margin-bottom: 2rem; padding: 1rem; background: #f1f5f9; border-radius: 0.5rem;">
                <h3>Convergência após ${this.iterations} iterações</h3>
            </div>
            ${this.clusters.map((cluster, index) => {
                const color = colors[index % colors.length];
                const cities = cluster.cities;

                const avgLat = cities.reduce((sum, c) => sum + c.latitude, 0) / cities.length;
                const avgLon = cities.reduce((sum, c) => sum + c.longitude, 0) / cities.length;
                const avgPop = cities.reduce((sum, c) => sum + (c.population || 0), 0) / cities.length;
                const totalPop = cities.reduce((sum, c) => sum + (c.population || 0), 0);

                return `
                    <div class="cluster-card" style="border-left: 5px solid ${color};">
                        <h3 style="color: ${color};">Cluster ${index + 1}</h3>
                        
                        <div class="cluster-stats">
                            <div class="stat-item">
                                <div class="stat-label">Cidades</div>
                                <div class="stat-value">${cities.length}</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-label">População Média</div>
                                <div class="stat-value">${Math.round(avgPop).toLocaleString()}</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-label">População Total</div>
                                <div class="stat-value">${Math.round(totalPop).toLocaleString()}</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-label">Lat Média</div>
                                <div class="stat-value">${avgLat.toFixed(2)}°</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-label">Lon Média</div>
                                <div class="stat-value">${avgLon.toFixed(2)}°</div>
                            </div>
                        </div>

                        <details>
                            <summary style="cursor: pointer; padding: 0.5rem; background: #f8fafc; border-radius: 0.25rem; margin-top: 1rem;">
                                <strong>Ver ${cities.length} cidades</strong>
                            </summary>
                            <div class="cluster-cities">
                                ${cities.slice(0, 100).map(city => `
                                    <div class="cluster-city-item">
                                        <strong>${city.name}</strong><br>
                                        <small>${city.country} • Pop: ${(city.population || 0).toLocaleString()}</small>
                                    </div>
                                `).join('')}
                                ${cities.length > 100 ? `<div class="cluster-city-item"><em>... e mais ${cities.length - 100} cidades</em></div>` : ''}
                            </div>
                        </details>
                    </div>
                `;
            }).join('')}
        `;
    }

    show() {
        document.querySelector('.results-section').style.display = 'block';
    }

    hide() {
        document.querySelector('.results-section').style.display = 'none';
    }
}