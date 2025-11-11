# Basis-Image mit Node.js 20
FROM node:20-bullseye

# Chromium installieren
RUN apt-get update && \
    apt-get install -y chromium && \
    rm -rf /var/lib/apt/lists/*

# Arbeitsverzeichnis setzen
WORKDIR /app

# Projektdateien kopieren
COPY . .

# Abhängigkeiten installieren
RUN npm install

# Standardumgebungsvariablen
ENV PORT=8080
ENV CHROMIUM_PATH=/usr/bin/chromium
ENV NODE_ENV=production

# Server starten
CMD ["node", "server.js"]
