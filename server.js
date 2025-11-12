// 🚗 Fahregut Auto-Crawler – Version 9.5 (Fly.io Stable + WS Heartbeat + Auto-Recovery)
// Puppeteer-Core + Chromium – 2025 Optimiert & Resilient

import express from "express";
import puppeteer from "puppeteer-core";
import cors from "cors";
import axios from "axios";
import http from "http";
import { WebSocketServer } from "ws";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;
const HEALTH_URL = process.env.HEALTH_URL || "https://fahregut-auto-crawler.fly.dev/health";
const EXEC_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium";

// 🧠 Speicher
let seenUrls = new Set();
let lastUpdate = 0;
let isUpdating = false;
let browser = null;
let page = null;

// 🕒 Zeitparser Kleinanzeigen
function parseKleinanzeigenTime(str) {
  if (!str) return null;
  const now = new Date();
  if (str.includes("Heute")) {
    const m = str.match(/(\d{1,2}):(\d{2})/);
    if (m) {
      const d = new Date(now);
      d.setHours(+m[1], +m[2], 0, 0);
      return d;
    }
  }
  if (str.includes("Gestern")) {
    const m = str.match(/(\d{1,2}):(\d{2})/);
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    if (m) d.setHours(+m[1], +m[2], 0, 0);
    return d;
  }
  const match = str.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (match) return new Date(`${match[3]}-${match[2]}-${match[1]}T00:00:00`);
  return null;
}

// 🧭 Browser starten (mit Auto-Recovery)
async function initBrowser(forceRestart = false) {
  try {
    if (browser && !forceRestart) return;
    if (browser) {
      await browser.close().catch(() => {});
      browser = null;
    }

    console.log("🧭 Starte Chromium...");
    browser = await puppeteer.launch({
      args: [
        "--no-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-setuid-sandbox",
        "--disable-infobars",
        "--disable-software-rasterizer",
        "--disable-extensions",
        "--window-size=1280,720",
        "--single-process",
        "--no-zygote"
      ],
      headless: true,
      executablePath: EXEC_PATH
    });

    page = await browser.newPage();
    console.log("✅ Chromium erfolgreich gestartet.");

    // Auto-close listener
    browser.on("disconnected", async () => {
      console.warn("⚠️ Chromium wurde unerwartet geschlossen. Neustart in 5s...");
      await new Promise((r) => setTimeout(r, 5000));
      await initBrowser(true);
    });
  } catch (err) {
    console.error("❌ Browser konnte nicht gestartet werden:", err.message);
    setTimeout(() => initBrowser(true), 10000);
  }
}

// 🔗 Filterbasierte Such-URL
function buildSearchUrl(filters = {}) {
  const {
    marke = "",
    modell = "",
    preis_von = "",
    preis_bis = "",
    km_von = "",
    km_bis = "",
    ez_von = "",
    ez_bis = "",
    ps_von = "",
    ps_bis = "",
    kraftstoff = "",
    getriebe = "",
    zustand = "",
    typ = "",
    farbe = "",
    bundesland = "",
    anbieter = "",
    angebot = ""
  } = filters;

  let query = [marke, modell].filter(Boolean).join(" ");
  let url = `https://www.kleinanzeigen.de/s-autos/${encodeURIComponent(query)}/k0?sorting=date-desc`;

  if (preis_von || preis_bis) url += `&price=${preis_von || 0}:${preis_bis || ""}`;
  if (km_von || km_bis) url += `&mileage=${km_von || 0}:${km_bis || ""}`;
  if (ez_von || ez_bis) url += `&firstRegistrationDate=${ez_von || 0}:${ez_bis || ""}`;
  if (ps_von || ps_bis) url += `&power=${ps_von || 0}:${ps_bis || ""}`;
  if (kraftstoff) url += `&fuel=${encodeURIComponent(kraftstoff.toLowerCase())}`;
  if (getriebe) url += `&transmission=${encodeURIComponent(getriebe.toLowerCase())}`;
  if (zustand.includes("Unbesch")) url += "&condition=unbeschädigt";
  if (zustand.includes("Besch")) url += "&condition=beschädigt";
  if (typ) url += `&carType=${encodeURIComponent(typ.toLowerCase())}`;
  if (farbe) url += `&color=${encodeURIComponent(farbe.toLowerCase())}`;
  if (anbieter) url += anbieter === "Privat" ? "&adType=private" : "&adType=business";
  if (angebot) url += angebot === "Gesuch" ? "&offerType=search" : "&offerType=sell";
  if (bundesland) url += `&geo=${encodeURIComponent(bundesland.toLowerCase())}`;

  return url;
}

// 🚀 Anzeigen abrufen
async function fetchAds(filters = {}) {
  await initBrowser();
  const url = buildSearchUrl(filters);
  console.log("🌍 Suche:", url);

  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });

    // Cookies akzeptieren
    try {
      const cookie = await page.$('button[aria-label="Alle akzeptieren"]');
      if (cookie) {
        await cookie.click();
        await new Promise((r) => setTimeout(r, 800));
        console.log("🍪 Cookies akzeptiert");
      }
    } catch {}

    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight));
      await new Promise((r) => setTimeout(r, 400));
    }

    await page.waitForSelector("article.aditem", { timeout: 15000 });

    const ads = await page.$$eval("article.aditem", (items) =>
      items
        .filter((i) => !i.className.includes("featured"))
        .slice(0, 50)
        .map((item) => {
          const title =
            item.querySelector(".aditem-main--middle--title")?.textContent.trim() ||
            item.querySelector("h2")?.textContent.trim() ||
            "Kein Titel";
          const price =
            item.querySelector(".aditem-main--middle--price-shipping--price")?.textContent.trim() || "";
          const location = item.querySelector(".aditem-main--top--left")?.textContent.trim() || "";
          const time = item.querySelector(".aditem-main--top--right")?.textContent.trim() || "";
          const image = item.querySelector("img")?.src || "";
          const url = item.querySelector("a")?.href || "";
          const details = item.querySelector(".aditem-main--middle--description")?.textContent.trim() || "";
          return { title, price, location, image, url, details, time };
        })
    );

    return ads
      .map((a) => ({ ...a, parsedDate: parseKleinanzeigenTime(a.time) || new Date(0) }))
      .sort((a, b) => b.parsedDate - a.parsedDate);
  } catch (err) {
    console.error("⚠️ fetchAds Fehler:", err.message);
    return [];
  }
}

// 🔁 Live-Update
async function updateAds(filters = {}) {
  const now = Date.now();
  if (isUpdating || now - lastUpdate < 4000) return [];
  isUpdating = true;

  try {
    const all = await fetchAds(filters);
    const fresh = all.filter((a) => a.url && !seenUrls.has(a.url));
    fresh.forEach((a) => seenUrls.add(a.url));

    if (fresh.length > 0) {
      console.log(`🆕 ${fresh.length} neue Anzeigen.`);
      [...clients].forEach((ws) => {
        if (ws.readyState === 1) ws.send(JSON.stringify(fresh));
      });
    } else {
      console.log("🟢 Keine neuen Anzeigen.");
    }

    lastUpdate = now;
    return fresh;
  } catch (err) {
    console.error("⚠️ Update Fehler:", err.message);
    return [];
  } finally {
    isUpdating = false;
  }
}

// 🌍 HTTP API
app.get("/crawl", async (req, res) => {
  try {
    const filters = req.query || {};
    const data = await updateAds(filters);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 💓 Healthcheck
app.get("/health", (_, res) =>
  res.send("✅ Fahregut Auto-Crawler läuft (Version 9.5 – Fly.io Stable ✅)")
);

// 🔁 Keepalive
setInterval(() => axios.get(HEALTH_URL).catch(() => {}), 60000);

// 🧠 HTTP + WS
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const clients = new Set();

// 💓 WS Heartbeat
function heartbeat() {
  this.isAlive = true;
}

wss.on("connection", (ws) => {
  clients.add(ws);
  ws.isAlive = true;
  ws.on("pong", heartbeat);

  console.log("📡 WS-Client verbunden");
  let filters = {};

  ws.send(JSON.stringify([{ title: "✅ Live verbunden", details: "Warte auf neue Anzeigen ..." }]));

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === "filter") {
        filters = { ...data };
        console.log("🎯 Neue Filter erhalten:", filters);
        updateAds(filters);
      }
    } catch (e) {
      console.error("❌ WS parse error:", e.message);
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log("❌ WS-Client getrennt");
  });
});

// 🔄 WS-Ping alle 15s (Fly.io aktiv halten)
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 15000);

// 🔄 Dauer-Update alle 6 Sekunden
setInterval(() => updateAds({}), 6000);

// 🚀 Start IPv4 + IPv6
server.listen(PORT, ["0.0.0.0", "::"], () =>
  console.log(`🚗 Server läuft auf Port ${PORT} – Version 9.5 Stable ✅`)
);
