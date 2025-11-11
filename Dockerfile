# 🚗 Fahregut Auto-Crawler – Fly.io Stable (Version 6.9)
FROM node:18-slim

# 🧰 Systempakete + Chromium installieren
RUN apt-get update && \
    apt-get install -y chromium && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# 🔧 Arbeitsverzeichnis
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
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# 🚀 App starten
CMD ["node", "server.js"]
