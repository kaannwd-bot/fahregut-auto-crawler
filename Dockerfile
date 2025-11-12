# -------------------------------------------------------------
# 🚀 Fahregut Auto-Crawler Dockerfile – Optimized Multi-Layer
# Chromium + Puppeteer-Core (Fly.io Fast Build)
# -------------------------------------------------------------

# 🧱 Stage 1: System layer (Chromium & dependencies)
FROM debian:bookworm-slim AS chromium-base

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
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
    locales && \
    sed -i '/de_DE.UTF-8/s/^# //g' /etc/locale.gen && locale-gen && \
    rm -rf /var/lib/apt/lists/*

ENV LANG=de_DE.UTF-8
ENV LANGUAGE=de_DE:de
ENV LC_ALL=de_DE.UTF-8

# -------------------------------------------------------------
# ⚙️ Stage 2: Node.js runtime
FROM node:20-slim

# Chromium & libs from base layer (cached)
COPY --from=chromium-base /usr/bin/chromium /usr/bin/chromium
COPY --from=chromium-base /usr/lib /usr/lib
COPY --from=chromium-base /lib /lib
COPY --from=chromium-base /usr/share/locale /usr/share/locale

# Arbeitsverzeichnis
WORKDIR /app

# Nur package.json zuerst (cache-vorteil)
COPY package*.json ./
RUN npm install --omit=dev

# Projektdateien
COPY . .

# Environment
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production
ENV PORT=8080
STOPSIGNAL SIGTERM

EXPOSE 8080

# Healthcheck (Fly.io)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -fs http://localhost:8080/health || exit 1

CMD ["node", "server.js"]
