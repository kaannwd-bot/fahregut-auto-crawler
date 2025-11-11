# Dockerfile für Fahregut Auto-Crawler v6.8 – Fly.io

FROM node:18-slim

# 🧠 System-Updates & Chromium installieren
RUN apt-get update && \
    apt-get install -y chromium && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# 🔧 Arbeitsverzeichnis
WORKDIR /app

# 🔹 Dateien kopieren
COPY package*.json ./
RUN npm install

COPY . .

# 🌍 Umgebungsvariablen
ENV PORT=8080
ENV NODE_ENV=production
ENV CHROMIUM_PATH=/usr/bin/chromium-browser

# 🚀 App starten
CMD ["node", "server.js"]
