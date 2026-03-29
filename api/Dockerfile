FROM node:18-alpine

WORKDIR /app

# Dependencias primero para aprovechar caché de capas
COPY package*.json ./
RUN npm install --production

# Código y datos
COPY src/       ./src/
COPY data/      ./data/
COPY template/  ./template/

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "src/server.js"]
```

**`api/.dockerignore`:**
```
node_modules
deprecated
.env
*.log