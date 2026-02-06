FROM nginx:alpine

# Copiar configuração customizada do nginx
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copiar arquivos da aplicação
COPY src/ /usr/share/nginx/html/

# Copiar .env
COPY .env /usr/share/nginx/html/.env

# Expor porta
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]