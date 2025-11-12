# 🚀 Fahregut Auto-Crawler Dockerfile – Chromium + Puppeteer-Core (Fly.io Stable Build)
FROM node:20-slim

# System-Updates und benötigte Pakete
RUN apt-get update && apt-get install -y \
    chromium \
    ca-certificates \
    fonts-liberation \
    fonts-dejavu-core \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libgtk-3-0 \
    xdg-utils \
    wget \
    locales \
    && rm -rf /var/lib/apt/lists/*

# UTF-8 Locale aktivieren (für Kleinanzeigen.de mit Umlauten)
RUN sed -i '/de_DE.UTF-8/s/^# //g' /etc/locale.gen && locale-gen
ENV LANG=de_DE.UTF-8
ENV LANGUAGE=de_DE:de
ENV LC_ALL=de_DE.UTF-8

# Arbeitsverzeichnis
WORKDIR /app

# Nur package.json zuerst kopieren (Cache-Vorteil)
COPY package*.json ./
RUN npm install --omit=dev

# Projektdateien
COPY . .

# Chromium-Pfad für Puppeteer-Core
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production
ENV PORT=8080

# Fly.io erwartet SIGTERM → korrektes Shutdown-Verhalten aktivieren
STOPSIGNAL SIGTERM

# Port öffnen
EXPOSE 8080

# Startkommando
CMD ["node", "server.js"]
