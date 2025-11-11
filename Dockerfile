# 🚗 Fahregut Auto-Crawler - Dockerfile mit voller Kontrolle

# Verwende Node.js 20 mit Alpine (klein & stabil)
FROM node:20-alpine

# Setze Arbeitsverzeichnis
WORKDIR /app

# Kopiere package.json und installiere Dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Kopiere restliche Dateien
COPY . .

# Chromium-Setup (wichtig für Puppeteer-Core + @sparticuz/chromium)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Setze Umgebungsvariablen
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PORT=10000
ENV NODE_ENV=production

# Port öffnen
EXPOSE 10000

# App starten
CMD ["node", "server.js"]
