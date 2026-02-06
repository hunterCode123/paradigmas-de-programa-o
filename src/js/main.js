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
        this.workers = []; // Workers de busca (Fetch)
        this.sharedCityBuffer = null;
        this.mutexManager = null;
        this.massiveFetchInProgress = false;
    }

    async init() {
        try {
            // Carrega configuração
            await config.load();
            
            console.log('✅ Configuração carregada:', config.settings);

            // Inicializa componentes
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

            // Event listeners
            this.setupEventListeners();
        } catch (error) {
            console.error('❌ Erro ao inicializar app:', error);
            this.showMessage('Erro ao inicializar: ' + error.message, 'error');
        }
    }

    setupEventListeners() {
        // Busca
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

        // Paginação
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.explorer.prevPage());
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.explorer.nextPage());
        }

        // Limpar seleção
        const clearBtn = document.getElementById('clearSelectedBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (confirm('Deseja limpar todas as cidades selecionadas?')) {
                    this.repository.clearAll();
                }
            });
        }

        // Busca massiva
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
        this.showLoading('Iniciando busca massiva...');
        this.updateProgress(0, 'Preparando workers...');

        try {
            const totalCities = config.getNumber('MASSIVE_FETCH_TOTAL');
            const numWorkers = config.getNumber('NUM_WORKERS');
            const citiesPerPage = config.getNumber('CITIES_PER_PAGE');

            // Inicializa SharedArrayBuffer
            this.sharedCityBuffer = new SharedCityBuffer(totalCities);
            this.mutexManager = new MutexManager(1);

            // Cria workers de busca (Fetch Workers)
            this.workers = [];
            for (let i = 0; i < numWorkers; i++) {
                const worker = new Worker('/js/workers/fetchWorker.js');
                this.workers.push(worker);
            }

            // Inicializa workers
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

            // Distribui trabalho entre workers
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

                    // Inicia busca
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

            // Aguarda todos os workers de busca terminarem
            await Promise.all(workerPromises);

            const fetchedCount = this.sharedCityBuffer.getCounter();
            console.log(`✅ Busca massiva concluída: ${fetchedCount} cidades`);

            this.updateProgress(100, `${fetchedCount.toLocaleString()} cidades carregadas! Iniciando clusterização...`);

            // Pequena pausa para a UI atualizar e encerrar os workers de fetch antes de iniciar os de cluster
            await this.sleep(1000);
            
            // Encerra workers de fetch para liberar recursos antes do k-means
            this.workers.forEach(w => w.terminate());
            this.workers = [];

            // Inicia clusterização
            await this.startClustering(k);

        } catch (error) {
            console.error('❌ Erro na busca massiva:', error);
            this.showMessage('Erro na busca massiva: ' + error.message, 'error');
        } finally {
            this.massiveFetchInProgress = false;
            this.hideLoading();
            
            // Garantia de limpeza
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
            // Verifica quantas cidades temos no buffer (atômico)
            const totalCities = this.sharedCityBuffer.getCounter();
            
            if (totalCities === 0) {
                throw new Error('Nenhuma cidade foi carregada no buffer.');
            }

            console.log(`🎯 Clusterizando ${totalCities} cidades em ${k} clusters`);

            // Instancia o KMeans (agora gerenciador de workers)
            const kmeans = new KMeans(
                k,
                config.getNumber('MAX_ITERATIONS'),
                config.getNumber('CONVERGENCE_THRESHOLD'),
                config.getNumber('NUM_WORKERS') // Passa número de workers para o cluster
            );

            this.updateProgress(10, 'Calculando clusters...');

            // Executa K-means passando o BUFFER COMPARTILHADO, não o array gigante
            // O retorno contém o buffer de clusters, iterações e os centroides finais
            const result = await kmeans.fit(this.sharedCityBuffer, totalCities);

            this.updateProgress(100, 'Organizando visualização...');

            // Reconstrói a estrutura para o visualizador lendo do buffer de resposta
            const clusters = [];
            for (let i = 0; i < k; i++) {
                // SharedClusterBuffer tem método readCluster que retorna { centroid, cities: [...] }
                const clusterData = result.buffer.readCluster(i);
                
                clusters.push({
                    centroid: result.centroids[i],
                    cities: clusterData.cities
                });
            }

            // Exibe resultados
            this.clusterViewer.setResults(clusters, result.centroids, result.iterations);
            this.clusterViewer.show();

            this.showMessage(`✅ Clusterização concluída em ${result.iterations} iterações!`, 'success');

        } catch (error) {
            console.error('❌ Erro na clusterização:', error);
            this.showMessage('Erro na clusterização: ' + error.message, 'error');
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

// Inicializa aplicação
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Iniciando aplicação...');
    const app = new App();
    app.init().catch(error => {
        console.error('❌ Erro fatal:', error);
        alert('Erro ao inicializar aplicação. Verifique o console (F12).');
    });
});