# 🚗 Fahregut Auto-Crawler – Fly.io Stable Build (Version 6.8)
FROM node:18-slim

# 🧰 Update & Chromium installieren
RUN apt-get update && \
    apt-get install -y chromium && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# 🔧 Arbeitsverzeichnis setzen
WORKDIR /app

# 🔹 Abhängigkeiten installieren
COPY package*.json ./
RUN npm install

# 🔹 Code kopieren
COPY . .

# 🌍 Umgebungsvariablen
ENV PORT=8080
ENV NODE_ENV=production
ENV CHROMIUM_PATH=/usr/bin/chromium

# ⚙️ Startkommando
CMD ["node", "server.js"]
