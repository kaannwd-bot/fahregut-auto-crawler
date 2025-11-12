# 🚀 Dockerfile für Fly.io – Chromium + Puppeteer-Core
FROM node:20-slim

# Installiere notwendige Pakete
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libatk-bridge2.0-0 \
    libnss3 \
    libxss1 \
    libgtk-3-0 \
    libasound2 \
    libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

# Arbeitsverzeichnis
WORKDIR /app

# Projektdateien kopieren
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

# Exponiere Port
EXPOSE 8080

# Starte App
CMD ["node", "server.js"]
