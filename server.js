// 🚗 Fahregut Auto-Crawler – Version 9.0 (Full Filter Support + Fly.io Single-Port WS)
// Puppeteer-Core + Chromium – 2025 Stable

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

// 🧠 Speicher
let seenUrls = new Set();
let lastUpdate = 0;
let isUpdating = false;
let browser = null;
let page = null;

// 🔍 Zeitparser Kleinanzeigen
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

// 🧭 Browser starten
async function initBrowser() {
  if (browser) return;
  const executablePath = "/usr/bin/chromium";
  browser = await puppeteer.launch({
    args: [
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-setuid-sandbox",
      "--disable-infobars",
      "--window-size=1280,720",
      "--single-process",
      "--no-zygote",
    ],
    headless: true,
    executablePath,
  });
  page = await browser.newPage();
  console.log("🧭 Browser geöffnet (persistent session).");
}

// 🔗 URL Builder für Filter
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
    angebot = "",
  } = filters;

  let query = [marke, modell].filter(Boolean).join(" ");
  let url = `https://www.kleinanzeigen.de/s-autos/${encodeURIComponent(query)}/k0?sorting=date-desc`;

  // Preis
  if (preis_von || preis_bis)
    url += `&price=${preis_von || 0}:${preis_bis || ""}`;
  // Kilometer
  if (km_von || km_bis) url += `&mileage=${km_von || 0}:${km_bis || ""}`;
  // Erstzulassung
  if (ez_von || ez_bis)
    url += `&firstRegistrationDate=${ez_von || 0}:${ez_bis || ""}`;
  // Leistung
  if (ps_von || ps_bis) url += `&power=${ps_von || 0}:${ps_bis || ""}`;
  // Kraftstoff
  if (kraftstoff)
    url += `&fuel=${encodeURIComponent(kraftstoff.toLowerCase())}`;
  // Getriebe
  if (getriebe)
    url += `&transmission=${encodeURIComponent(getriebe.toLowerCase())}`;
  // Zustand
  if (zustand.includes("Unbesch")) url += "&condition=unbeschädigt";
  if (zustand.includes("Besch")) url += "&condition=beschädigt";
  // Typ
  if (typ) url += `&carType=${encodeURIComponent(typ.toLowerCase())}`;
  // Farbe
  if (farbe) url += `&color=${encodeURIComponent(farbe.toLowerCase())}`;
  // Anbieter
  if (anbieter)
    url +=
      anbieter === "Privat"
        ? "&adType=private"
        : "&adType=business";
  // Angebotstyp
  if (angebot)
    url += angebot === "Gesuch" ? "&offerType=search" : "&offerType=sell";
  // Ort / Bundesland (Filter nur symbolisch, Kleinanzeigen nutzt PLZ/Geo)
  if (bundesland)
    url += `&geo=${encodeURIComponent(bundesland.toLowerCase())}`;

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

    // Scroll
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
            item.querySelector(".aditem-main--middle--price-shipping--price")
              ?.textContent.trim() || "";
          const location =
            item.querySelector(".aditem-main--top--left")?.textContent.trim() ||
            "";
          const time =
            item.querySelector(".aditem-main--top--right")?.textContent.trim() ||
            "";
          const image = item.querySelector("img")?.src || "";
          const url = item.querySelector("a")?.href || "";
          const details =
            item.querySelector(".aditem-main--middle--description")
              ?.textContent.trim() || "";
          return { title, price, location, image, url, details, time };
        })
    );

    const sorted = ads
      .map((a) => ({
        ...a,
        parsedDate: parseKleinanzeigenTime(a.time) || new Date(0),
      }))
      .sort((a, b) => b.parsedDate - a.parsedDate);

    return sorted;
  } catch (err) {
    console.error("⚠️ fetchAds Fehler:", err.message);
    return [];
  }
}

// 🔁 Live-Update
async function updateAds(filters = {}) {
  const now = Date.now();
  if (isUpdating || now - lastUpdate < 2000) return [];
  isUpdating = true;

  try {
    const all = await fetchAds(filters);
    const fresh = all.filter((a) => a.url && !seenUrls.has(a.url));
    fresh.forEach((a) => seenUrls.add(a.url));

    if (fresh.length > 0) {
      console.log(`🆕 ${fresh.length} neue Anzeigen.`);
      [...clients].forEach((ws) => {
        if (ws.readyState === 1)
          ws.send(JSON.stringify(fresh));
      });
    } else console.log("🟢 Keine neuen Anzeigen.");
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
  res.send("✅ Fahregut Auto-Crawler läuft (Version 9.0 – Full Filter WS ✅)")
);

// 🔁 Keepalive
setInterval(() => {
  axios.get("https://fahregut-auto-crawler.fly.dev/health").catch(() => {});
}, 20000);

// 🧠 HTTP + WS
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const clients = new Set();

wss.on("connection", (ws, req) => {
  clients.add(ws);
  console.log("📡 WS-Client verbunden");

  // 🔍 URL params + message listener
  const url = new URL(req.url, `http://${req.headers.host}`);
  let filters = Object.fromEntries(url.searchParams.entries());

  ws.send(JSON.stringify([{ title: "✅ Live verbunden", details: "Warte auf neue Anzeigen ..." }]));

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === "filter") {
        filters = { ...filters, ...data };
        console.log("🎯 Neue Filter erhalten:", filters);
      }
    } catch {}
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log("❌ WS-Client getrennt");
  });
});

// 🔄 Dauer-Update
setInterval(() => updateAds({}), 2000);

// 🚀 Start IPv4+IPv6
server.listen(PORT, ["0.0.0.0", "::"], () =>
  console.log(`🚗 Server läuft auf Port ${PORT} – HTTP + WS aktiv ✅`)
);
