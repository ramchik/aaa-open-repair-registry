# Vascular Registry – Backend
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/
COPY frontend/ ./frontend/

RUN npm run build

EXPOSE 5000
CMD ["node", "dist/index.js"]
