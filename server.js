// 🚗 Fahregut Auto-Crawler – Version 6.8 (Realtime & Neueste Inserate ✅)
// Fly.io + Puppeteer-Core + Chromium Integration

import express from "express";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || chromium.executablePath;

chromium.setHeadlessMode = true;
chromium.setGraphicsMode = false;

// 🧠 Zwischenspeicher für neue Anzeigen
let latestAds = [];
let lastUpdate = 0;

// 🚀 Hauptfunktion: Anzeigen abrufen
async function fetchAds(query = "") {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await CHROMIUM_PATH(),
    headless: chromium.headless,
  });

  const page = await browser.newPage();
  const url = `https://www.kleinanzeigen.de/s-autos/${encodeURIComponent(
    query
  )}/k0?sorting=date-desc`;

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

  const ads = await page.$$eval("article.aditem", (items) =>
    items.slice(0, 15).map((item) => {
      const title = item.querySelector(".aditem-main--middle--title")?.innerText.trim();
      const price = item.querySelector(".aditem-main--middle--price-shipping--price")?.innerText.trim();
      const location = item.querySelector(".aditem-main--top--left")?.innerText.trim();
      const image = item.querySelector("img")?.src || "";
      const url = item.querySelector("a")?.href || "";
      const details = item.querySelector(".aditem-main--middle--description")?.innerText.trim();
      return { title, price, location, image, url, details };
    })
  );

  await browser.close();
  return ads;
}

// 🔁 Automatische Realtime-Aktualisierung alle 10 Sekunden
async function updateAds() {
  const now = Date.now();
  if (now - lastUpdate < 10000) return; // alle 10 Sek.

  console.log("🔄 Suche nach neuesten Anzeigen...");
  try {
    const newAds = await fetchAds("");
    const diff = newAds.filter(
      (a) => !latestAds.some((old) => old.url === a.url)
    );

    if (diff.length > 0) {
      console.log(`🆕 ${diff.length} neue Anzeigen gefunden!`);
      latestAds = [...diff, ...latestAds].slice(0, 30);
    } else {
      console.log("ℹ️ Keine neuen Anzeigen.");
    }

    lastUpdate = now;
  } catch (err) {
    console.error("⚠️ Crawler-Fehler:", err.message);
  }
}

// 🌍 API-Route / Crawl – liefert nur neueste Anzeigen
app.get("/crawl", async (req, res) => {
  try {
    if (latestAds.length === 0) {
      await updateAds();
    }
    res.json(latestAds);
  } catch (err) {
    res.status(500).json({ error: "Crawler-Fehler", details: err.message });
  }
});

// 💓 Healthcheck
app.get("/health", (req, res) => {
  res.send("✅ Fahregut Auto-Crawler läuft (Version 6.8 – Realtime OK)");
});

// 🕒 Intervall alle 10 Sekunden
setInterval(updateAds, 10000);

// 🌐 Server starten
app.listen(PORT, () => console.log(`🚗 Server läuft auf Port ${PORT}`));

// 🔁 Auto-Refresh: ruft alle 10 Sekunden automatisch den Crawler auf
const axios = await import("axios");

async function autoUpdate() {
  try {
    const url = "https://fahregut-auto-crawler.fly.dev/crawl";
    const res = await axios.default.get(url);
    console.log("🔄 Live-Check:", res.data.length, "Anzeigen geladen");
  } catch (err) {
    console.log("⚠️ Auto-Update-Fehler:", err.message);
  }
}

// alle 10 Sekunden automatisch starten
setInterval(autoUpdate, 10000);
console.log("🕒 Live-Auto-Update aktiviert (Intervall 10 Sekunden)");

