// 🚗 Fahregut Auto-Crawler – Version 8.8 (Single-Port WebSocket + Instant Push + Perfect Sorting ✅)
// Puppeteer-Core + System Chromium (Fly.io Fully Compatible Build)

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

// 🧠 Speicher (nur neue Anzeigen)
let seenUrls = new Set();
let lastUpdate = 0;
let isUpdating = false;

// 🌐 Global browser & page (tek seferde başlatılır)
let browser = null;
let page = null;

// 🔍 Kleinanzeigen tarih çözümü
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

// 🧭 Puppeteer başlat (tek sefer)
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

// 🚀 İlanları çek (tek sayfa reload)
async function fetchAds(filters = {}) {
  await initBrowser();
  const { marke = "", modell = "", preis_von = "", preis_bis = "" } = filters;
  const queryString = [marke, modell].filter(Boolean).join(" ");
  let url = `https://www.kleinanzeigen.de/s-autos/${encodeURIComponent(queryString)}/k0?sorting=date-desc`;
  if (preis_von || preis_bis) url += `&price=${preis_von || 0}:${preis_bis || ""}`;

  console.log("🌍 Suche:", url);

  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });

    // 🍪 Cookie banner
    try {
      const cookie = await page.$('button[aria-label="Alle akzeptieren"]');
      if (cookie) {
        await cookie.click();
        await new Promise((r) => setTimeout(r, 800));
        console.log("🍪 Cookies akzeptiert");
      }
    } catch {}

    // 🔄 Scroll (daha fazla ilan)
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight));
      await new Promise((r) => setTimeout(r, 500));
    }

    await page.waitForSelector("article.aditem", { timeout: 15000 });

    const ads = await page.$$eval("article.aditem", (items) =>
      items
        .filter((i) => !i.className.includes("featured")) // sponsorları atla
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
          const details =
            item.querySelector(".aditem-main--middle--description")?.textContent.trim() || "";
          return { title, price, location, image, url, details, time };
        })
    );

    // 🔄 Tarihe göre sıralama (yeni → eski)
    const sortedAds = ads
      .map((a) => ({ ...a, parsedDate: parseKleinanzeigenTime(a.time) || new Date(0) }))
      .sort((a, b) => b.parsedDate - a.parsedDate);

    return sortedAds;
  } catch (err) {
    console.error("⚠️ fetchAds Fehler:", err.message);
    return [];
  }
}

// 🔁 Yalnızca yeni ilanları getir (her 3 saniye)
async function updateAds(filters = {}) {
  const now = Date.now();
  if (isUpdating || now - lastUpdate < 3000) return [];
  isUpdating = true;

  try {
    const allAds = await fetchAds(filters);
    const fresh = allAds.filter((a) => a.url && !seenUrls.has(a.url));
    fresh.forEach((a) => seenUrls.add(a.url));

    if (fresh.length > 0) {
      console.log(`🆕 ${fresh.length} neue Anzeigen gefunden.`);
      // WebSocket Push
      for (const client of clients) {
        if (client.readyState === 1) {
          client.send(JSON.stringify(fresh));
        }
      }
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

// 🌍 API: manuel tetikleme
app.get("/crawl", async (req, res) => {
  try {
    const filters = req.query || {};
    const newAds = await updateAds(filters);
    res.json(newAds);
  } catch (err) {
    res.status(500).json({ error: "Crawler-Fehler", details: err.message });
  }
});

// 💓 Healthcheck
app.get("/health", (req, res) => {
  res.send("✅ Fahregut Auto-Crawler läuft (Version 8.8 – Single-Port WebSocket ✅)");
});

// 🔁 Keepalive (Fly)
setInterval(() => {
  axios.get("https://fahregut-auto-crawler.fly.dev/health").catch(() => {});
}, 20000);

// 🧠 HTTP + WebSocket aynı portta
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const clients = new Set();

wss.on("connection", (ws) => {
  clients.add(ws);
  console.log("📡 Neuer WebSocket-Client verbunden");
  ws.send(JSON.stringify([{ title: "✅ Live verbunden", details: "Warte auf neue Anzeigen ..." }]));
  ws.on("close", () => {
    clients.delete(ws);
    console.log("❌ WS-Client getrennt");
  });
});

// 🔄 Sürekli kontrol (her 3 saniye)
setInterval(() => updateAds({}), 3000);

// 🚀 Start
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚗 Server läuft auf Port ${PORT} – WebSocket + HTTP aktiv ✅`);
});
