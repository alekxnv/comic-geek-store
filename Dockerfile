FROM node:20-alpine

WORKDIR /app

# Instala dependências primeiro (cache eficiente)
COPY package*.json ./
RUN npm ci --only=production

# Copia o servidor
COPY server.js ./

# Copia os arquivos do site para a pasta public
ARG CACHEBUST=1
COPY index.html ./public/
COPY pages/ ./public/pages/
COPY css/ ./public/css/
COPY js/ ./public/js/
COPY img/ ./public/img/

EXPOSE 3000

CMD ["node", "server.js"]
