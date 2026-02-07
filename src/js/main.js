import { config } from './config.js';
import { CityExplorer } from './components/cityExplorer.js';
import { CityRepository } from './components/cityRepository.js';
import { ClusterViewer } from './components/clusterViewer.js';
import { SharedCityBuffer } from './utils/sharedBuffer.js';
import { MutexManager } from './utils/mutex.js';
import { KMeans } from './algorithms/kmeans.js';

class App {
    constructor() {
        this.explorer = null;
        this.repository = null;
        this.clusterViewer = null;
        this.workers = []; 
        this.sharedCityBuffer = null;
        this.mutexManager = null;
        this.massiveFetchInProgress = false;
    }

    async init() {
        try {
            await config.load();
            
            console.log('✅ Configuração carregada:', config.settings);

            this.repository = new CityRepository('selectedCities', 'selectedCount');
            this.clusterViewer = new ClusterViewer('clustersContainer');
            
            this.explorer = new CityExplorer('citiesGrid', (city) => {
                if (this.repository.addCity(city)) {
                    this.showMessage('Cidade adicionada!', 'success');
                } else {
                    this.showMessage('Cidade já está na seleção', 'warning');
                }
            });

            await this.explorer.init();
            
            console.log('✅ App inicializado com sucesso');

            this.setupEventListeners();
        } catch (error) {
            console.error('❌ Erro ao inicializar app:', error);
            this.showMessage('Erro ao inicializar: ' + error.message, 'error');
        }
    }

    setupEventListeners() {
        // Busca e Navegação
        const searchBtn = document.getElementById('searchBtn');
        const searchInput = document.getElementById('searchInput');
        
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                const query = searchInput.value;
                this.explorer.search(query);
            });
        }

        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.explorer.search(e.target.value);
                }
            });
        }

        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.explorer.prevPage());
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.explorer.nextPage());
        }

        const clearBtn = document.getElementById('clearSelectedBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (confirm('Deseja limpar todas as cidades selecionadas?')) {
                    this.repository.clearAll();
                }
            });
        }

        // Cache Manual (Repositório)
        const btnSave = document.getElementById('btnSaveCache');
        const btnLoad = document.getElementById('btnLoadCache');
        const fileInput = document.getElementById('fileInputCache');

        if (btnSave) {
            btnSave.addEventListener('click', () => this.repository.saveToCache());
        }

        if (btnLoad) {
            btnLoad.addEventListener('click', () => fileInput.click());
        }

        if (fileInput) {
            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                try {
                    const count = await this.repository.loadFromCache(file);
                    this.showMessage(`✅ ${count} cidades recuperadas do cache!`, 'success');
                    fileInput.value = ''; 
                } catch (error) {
                    console.error(error);
                    this.showMessage('❌ Erro ao ler arquivo: ' + error.message, 'error');
                }
            });
        }

        // Cache da Busca Massiva
        const btnSaveMassive = document.getElementById('btnSaveMassive');
        const btnLoadMassive = document.getElementById('btnLoadMassive');
        const fileInputMassive = document.getElementById('fileInputMassive');
        const btnRunKmeansOnly = document.getElementById('btnRunKmeansOnly');

        // Salvar buffer massivo
        if (btnSaveMassive) {
            btnSaveMassive.addEventListener('click', () => {
                if (!this.sharedCityBuffer || this.sharedCityBuffer.getCounter() === 0) {
                    this.showMessage('Nada para salvar. Realize uma busca primeiro.', 'warning');
                    return;
                }

                this.showLoading('Gerando arquivo de cache...');

                setTimeout(() => {
                    try {
                        const allCities = this.sharedCityBuffer.readAllCities();
                        
                        const jsonString = JSON.stringify(allCities, null, 2);
                        const blob = new Blob([jsonString], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `geo_backup_${allCities.length}_cidades.json`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);

                        this.showMessage(`✅ Cache salvo com ${allCities.length} cidades!`, 'success');
                    } catch (error) {
                        console.error(error);
                        this.showMessage('Erro ao salvar cache: ' + error.message, 'error');
                    } finally {
                        this.hideLoading();
                    }
                }, 100);
            });
        }

        // Carregar buffer massivo
        if (btnLoadMassive) {
            btnLoadMassive.addEventListener('click', () => {
                fileInputMassive.click();
            });
        }

        if (fileInputMassive) {
            fileInputMassive.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                this.showLoading('Lendo arquivo de cache...');
                
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const cities = JSON.parse(event.target.result);
                        if (!Array.isArray(cities)) throw new Error('Formato inválido.');

                        const totalCapacity = Math.max(cities.length, config.getNumber('MASSIVE_FETCH_TOTAL'));
                        this.sharedCityBuffer = new SharedCityBuffer(totalCapacity);
                        this.mutexManager = new MutexManager(1);

                        console.log(`📥 Carregando ${cities.length} cidades no buffer...`);
                        
                        cities.forEach((city, index) => {
                            this.sharedCityBuffer.writeCity(city, index);
                            this.sharedCityBuffer.incrementCounter();
                        });

                        this.updateProgress(100, `${cities.length} cidades carregadas do cache! Pronto para clusterizar.`);
                        this.showMessage(`✅ ${cities.length} cidades carregadas na memória!`, 'success');

                        if (btnSaveMassive) btnSaveMassive.disabled = false;

                        fileInputMassive.value = '';

                    } catch (error) {
                        console.error(error);
                        this.showMessage('Erro ao carregar cache: ' + error.message, 'error');
                    } finally {
                        this.hideLoading();
                    }
                };
                reader.readAsText(file);
            });
        }

        // Rodar apenas K-Means (sem busca)
        if (btnRunKmeansOnly) {
            btnRunKmeansOnly.addEventListener('click', () => {
                if (!this.sharedCityBuffer || this.sharedCityBuffer.getCounter() === 0) {
                    this.showMessage('Carregue um cache ou faça uma busca primeiro!', 'warning');
                    return;
                }
                const k = parseInt(document.getElementById('kClusters').value);
                this.startClustering(k);
            });
        }

        // Iniciar busca massiva completa
        const massiveBtn = document.getElementById('startMassiveFetchBtn');
        if (massiveBtn) {
            massiveBtn.addEventListener('click', () => this.startMassiveFetch());
        }
    }

    async startMassiveFetch() {
        if (this.massiveFetchInProgress) {
            this.showMessage('Busca massiva já em andamento!', 'warning');
            return;
        }

        const k = parseInt(document.getElementById('kClusters').value);
        if (k < 2 || k > 20) {
            this.showMessage('O valor de K deve estar entre 2 e 20', 'error');
            return;
        }

        this.massiveFetchInProgress = true;
        
        const totalCities = config.getNumber('MASSIVE_FETCH_TOTAL');
        const numWorkers = config.getNumber('NUM_WORKERS');
        const citiesPerPage = config.getNumber('CITIES_PER_PAGE');

        console.log(`🚀 Iniciando busca massiva: Alvo = ${totalCities} cidades | Workers = ${numWorkers}`);

        this.showLoading(`Iniciando busca de ${totalCities} cidades...`);
        this.updateProgress(0, 'Preparando workers...');

        try {
            this.sharedCityBuffer = new SharedCityBuffer(totalCities);
            this.mutexManager = new MutexManager(1);

            this.workers = [];
            for (let i = 0; i < numWorkers; i++) {
                const worker = new Worker('/js/workers/fetchWorker.js');
                this.workers.push(worker);
            }

            await Promise.all(this.workers.map((worker) => {
                return new Promise((resolve) => {
                    worker.postMessage({
                        type: 'init',
                        data: {
                            config: config.settings,
                            mutexBuffer: this.mutexManager.getSharedBuffer(),
                            sharedBuffer: this.sharedCityBuffer.getBuffer(),
                            counterBuffer: this.sharedCityBuffer.getCounterBuffer()
                        }
                    });

                    worker.onmessage = (e) => {
                        if (e.data.type === 'initialized') {
                            resolve();
                        }
                    };
                });
            }));

            console.log('✅ Workers de busca inicializados');

            const citiesPerWorker = Math.ceil(totalCities / numWorkers);
            
            const workerPromises = this.workers.map((worker, index) => {
                return new Promise((resolve, reject) => {
                    const startOffset = index * citiesPerWorker;
                    const endOffset = Math.min((index + 1) * citiesPerWorker, totalCities);

                    let completed = false;

                    worker.onmessage = (e) => {
                        const { type, workerId, total, message, error } = e.data;

                        switch (type) {
                            case 'progress':
                                console.log(message);
                                break;

                            case 'fetched':
                                const progress = (total / totalCities) * 100;
                                this.updateProgress(
                                    progress,
                                    `${total.toLocaleString()} / ${totalCities.toLocaleString()} cidades buscadas`
                                );
                                break;

                            case 'warning':
                                console.warn(message);
                                break;

                            case 'error':
                                console.error(`Worker ${workerId} erro:`, error);
                                break;

                            case 'complete':
                                if (!completed) {
                                    completed = true;
                                    console.log(`✅ Worker ${workerId} concluído`);
                                    resolve();
                                }
                                break;
                        }
                    };

                    worker.onerror = (error) => {
                        console.error(`❌ Worker ${index} error:`, error);
                        if (!completed) {
                            completed = true;
                            reject(error);
                        }
                    };

                    worker.postMessage({
                        type: 'fetch',
                        data: {
                            startOffset,
                            endOffset,
                            limit: citiesPerPage,
                            workerId: index
                        }
                    });
                });
            });

            await Promise.all(workerPromises);

            const fetchedCount = this.sharedCityBuffer.getCounter();
            console.log(`✅ Busca massiva concluída: ${fetchedCount} cidades`);

            const btnSaveMassive = document.getElementById('btnSaveMassive');
            if (btnSaveMassive) btnSaveMassive.disabled = false;

            this.updateProgress(100, `${fetchedCount.toLocaleString()} cidades carregadas! Iniciando clusterização...`);

            await this.sleep(1000);
            
            this.workers.forEach(w => w.terminate());
            this.workers = [];

            await this.startClustering(k);

        } catch (error) {
            console.error('❌ Erro na busca massiva:', error);
            this.showMessage('Erro na busca massiva: ' + error.message, 'error');
        } finally {
            this.massiveFetchInProgress = false;
            this.hideLoading();
            
            if (this.workers.length > 0) {
                this.workers.forEach(w => w.terminate());
                this.workers = [];
            }
        }
    }

    async startClustering(k) {
        this.showLoading('Executando K-means (Paralelo)...');
        this.updateProgress(0, 'Inicializando workers de clusterização...');

        try {
            const totalCities = this.sharedCityBuffer.getCounter();
            
            if (totalCities === 0) {
                throw new Error('Nenhuma cidade foi carregada no buffer.');
            }

            console.log(`🎯 Clusterizando ${totalCities} cidades em ${k} clusters`);

            const kmeans = new KMeans(
                k,
                config.getNumber('MAX_ITERATIONS'),
                config.getNumber('CONVERGENCE_THRESHOLD'),
                config.getNumber('NUM_WORKERS')
            );

            this.updateProgress(10, 'Calculando clusters...');

            const result = await kmeans.fit(this.sharedCityBuffer, totalCities);

            this.updateProgress(100, 'Organizando visualização...');

            const clusters = [];
            for (let i = 0; i < k; i++) {
                const clusterData = result.buffer.readCluster(i);
                clusters.push({
                    centroid: result.centroids[i],
                    cities: clusterData.cities
                });
            }

            this.clusterViewer.setResults(clusters, result.centroids, result.iterations);
            this.clusterViewer.show();

            this.showMessage(`✅ Clusterização concluída em ${result.iterations} iterações!`, 'success');

        } catch (error) {
            console.error('❌ Erro na clusterização:', error);
            this.showMessage('Erro na clusterização: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    updateProgress(percent, text) {
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');

        if (progressFill) {
            progressFill.style.width = `${Math.min(100, percent)}%`;
        }

        if (progressText) {
            progressText.textContent = text;
        }
    }

    showLoading(text) {
        const overlay = document.getElementById('loadingOverlay');
        const loadingText = document.getElementById('loadingText');
        
        if (overlay) overlay.style.display = 'flex';
        if (loadingText) loadingText.textContent = text;
    }

    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.style.display = 'none';
    }

    showMessage(message, type = 'info') {
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };

        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type]};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideIn 0.3s ease;
            font-weight: 500;
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.3s';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Iniciando aplicação...');
    const app = new App();
    app.init().catch(error => {
        console.error('❌ Erro fatal:', error);
        alert('Erro ao inicializar aplicação. Verifique o console (F12).');
    });
});