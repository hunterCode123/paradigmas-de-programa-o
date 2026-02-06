# GeoDB Cities Clustering

Sistema de exploração e clusterização de cidades usando a GeoDB Cities API, com processamento paralelo através de Web Workers e algoritmo K-means.

## 🚀 Tecnologias

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **API**: GeoDB Cities API (RapidAPI)
- **Concorrência**: Web Workers, SharedArrayBuffer, Atomics
- **Containerização**: Docker, Docker Compose

## 📋 Pré-requisitos

- Docker e Docker Compose instalados
- Chave da API GeoDB Cities (obtenha em https://rapidapi.com/wirefreethought/api/geodb-cities)

## 🔧 Instalação e Execução

### 1. Clone o repositório ou crie a estrutura de pastas
```bash
mkdir geodb-clustering
cd geodb-clustering
```

### 2. Configure o arquivo `.env`

Edite o arquivo `.env` na raiz do projeto e adicione sua chave da API:
```env
GEODB_API_KEY=sua_chave_aqui
```

### 3. Execute com Docker
```bash
docker-compose up --build
```

### 4. Acesse a aplicação

Abra seu navegador em: `http://localhost:8080`

## 📚 Funcionalidades

### 1. Exploração de Cidades
- Busca paginada de cidades
- Filtro por nome
- Seleção de cidades para análise

### 2. Busca Massiva
- Coleta paralela de ~10.000 cidades
- Uso de Web Workers para paralelização
- Controle de taxa de requisições (rate limiting)
- SharedArrayBuffer para armazenamento eficiente

### 3. Clusterização K-means
- Algoritmo K-means implementado do zero
- Processamento paralelo com Workers
- Métricas: latitude, longitude, população
- Visualização interativa dos resultados

## 🏗️ Arquitetura
```
- Interface HTML/CSS
- Componentes JavaScript (ES6 Modules)
- Web Workers para processamento paralelo
- SharedArrayBuffer para memória compartilhada
- Mutex com Atomics para sincronização
- Docker para containerização
```

## ⚙️ Configurações (`.env`)

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `GEODB_API_KEY` | Chave da API | - |
| `CITIES_PER_PAGE` | Cidades por página | 10 |
| `MASSIVE_FETCH_TOTAL` | Total de cidades na busca massiva | 10000 |
| `NUM_WORKERS` | Número de workers paralelos | 4 |
| `DEFAULT_K_CLUSTERS` | Valor padrão de K | 5 |
| `REQUEST_DELAY_MS` | Delay entre requisições | 1000 |
| `ERROR_RETRY_DELAY_MS` | Delay após erro | 5000 |
| `RATE_LIMIT_RETRY_MS` | Delay após rate limit | 10000 |

## 🔒 Segurança e Concorrência

- **Mutex**: Controle de acesso exclusivo à API
- **Atomics**: Operações atômicas no SharedArrayBuffer
- **Rate Limiting**: Respeito aos limites da API
- **Error Handling**: Retry com backoff exponencial

## 🎯 Paradigma Funcional

O código segue princípios de programação funcional:
- Imutabilidade quando possível
- Funções puras
- Composição de funções
- Evita efeitos colaterais globais

## 📊 Algoritmo K-means

1. **Inicialização**: K-means++ para centroides iniciais
2. **Atribuição**: Cada cidade ao cluster mais próximo
3. **Atualização**: Recálculo dos centroides
4. **Convergência**: Iteração até threshold ou max iterations

## 🐳 Docker

A aplicação é servida via Nginx com headers específicos para SharedArrayBuffer:
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

## 🤝 Contribuindo

Este é um projeto acadêmico demonstrando conceitos de:
- Programação assíncrona
- Concorrência e paralelismo
- Programação funcional
- Algoritmos de clustering

## 📝 Licença

Projeto educacional - livre para uso acadêmico.