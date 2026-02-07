🌍 GeoDB Cities Clustering
Aplicação web de alta performance para exploração e agrupamento (clustering) de dados geográficos. O projeto demonstra o uso avançado de Processamento Paralelo no navegador para analisar milhares de cidades simultaneamente.

🚀 Tecnologias e Conceitos
Frontend: HTML5, CSS3, JavaScript (ES6 Modules).

Concorrência: Web Workers (4 threads simultâneas).

Memória Compartilhada: SharedArrayBuffer e Atomics (Leitura/Escrita segura).

Algoritmo: K-Means (Implementação própria, paralelizada).

Infraestrutura: Docker & Nginx (Configurado com headers de segurança COOP/COEP).

📋 Pré-requisitos
Docker e Docker Compose instalados.

Uma chave de API gratuita da GeoDB Cities.

🔧 Como Rodar o Projeto
1. Configuração
Crie um arquivo .env na raiz do projeto e adicione sua chave:

Snippet de código
GEODB_API_KEY=sua_chave_aqui
GEODB_API_HOST=wft-geo-db.p.rapidapi.com
GEODB_BASE_URL=https://wft-geo-db.p.rapidapi.com/v1/geo

# Configurações de Execução
CITIES_PER_PAGE=10
MASSIVE_FETCH_TOTAL=10000
NUM_WORKERS=4
REQUEST_DELAY_MS=2000
2. Execução
Utilize o Docker para subir o servidor com os headers de segurança necessários para o SharedArrayBuffer:

Bash
docker-compose up --build
3. Acesso
Abra o navegador em: http://localhost:8080

📦 Funcionalidades Principais
Exploração Manual: Busca paginada de cidades com filtro por nome.

Busca Massiva (Paralela):

Coleta de 10.000 cidades utilizando 4 Workers simultâneos.

Respeita o Rate Limit da API (pausas automáticas).

Armazenamento em memória binária compartilhada.

Clusterização K-Means:

Agrupamento baseado em Latitude, Longitude e População.

Cálculo distribuído entre workers.

Sistema de Cache:

Salvar: Exporte os dados buscados para um arquivo .json (Backup).

Carregar: Importe o arquivo para retomar a análise sem consumir a API novamente.

⚠️ Notas Importantes
A busca massiva de 10.000 cidades pode levar alguns minutos devido aos limites da API gratuita (delay de 2s por requisição).

Use os botões de Salvar/Carregar Cache para agilizar os testes.

Desenvolvido para fins acadêmicos sobre Sistemas Distribuídos e Programação Funcional.