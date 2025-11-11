# Basis: Node.js 20 + Chromium Support
FROM node:20-bullseye

# Chromium installieren
RUN apt-get update && \
    apt-get install -y chromium && \
    rm -rf /var/lib/apt/lists/*

# Arbeitsverzeichnis setzen
WORKDIR /app

# Dateien kopieren
COPY . .

# Abhängigkeiten installieren
RUN npm install

# Port setzen (Fly.io erwartet 8080)
ENV PORT=8080
ENV CHROMIUM_PATH=/usr/bin/chromium
ENV NODE_ENV=production

# App starten
CMD ["node", "server.js"]
