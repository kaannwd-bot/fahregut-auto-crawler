// 🚗 Fahregut Auto-Crawler – Version 7.2 (Realtime Smart Fix ✅)
// Fly.io + Puppeteer-Core + Chromium Integration + Nur neue Inserate seit letztem Check

import express from "express";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;
const CHROMIUM_PATH = await chromium.executablePath;

chromium.setHeadlessMode = true;
chromium.setGraphicsMode = false;

// 🧠 Zwischenspeicher
let latestAds = [];
let lastSeenUrls = new Map(); // url → timestamp
let lastUpdate = 0;
let isUpdating = false;

// 🚀 Anzeigen abrufen (mit verbesserten Selektoren + Timeout-Strategie)
async function fetchAds(query = "") {
  console.log("🌍 Abruf gestartet:", query || "Alle Autos");

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: CHROMIUM_PATH,
    headless: chromium.headless,
  });

  const page = await browser.newPage();

  const url = `https://www.kleinanzeigen.de/s-autos/${encodeURIComponent(
    query
  )}/k0?sorting=date-desc`;

  // ⏳ Warte bis alles fertig ist
  await page.goto(url, { waitUntil: ["domcontentloaded", "networkidle2"], timeout: 60000 });

  // 🧩 Kleine Pause (manchmal lädt Kleinanzeigen nach)
  await new Promise((r) => setTimeout(r, 2000));

  const ads = await page.$$eval("article.aditem, .aditem", (items) =>
    items.slice(0, 20).map((item) => {
      const title = item.querySelector(".aditem-main--middle--title")?.innerText.trim();
      const price = item.querySelector(".aditem-main--middle--price-shipping--price")?.innerText.trim();
      const location = item.querySelector(".aditem-main--top--left")?.innerText.trim();
      const image = item.querySelector("img")?.src || "";
      const url = item.querySelector("a")?.href || "";
      const details = item.querySelector(".aditem-main--middle--description")?.innerText.trim();
      return { title, price, location, image, url, details };
    })
  );

  console.log(`📦 ${ads.length} Anzeigen geladen.`);
  await browser.close();
  return ads;
}

// 🔁 Automatische Realtime-Aktualisierung (nur neue Inserate)
async function updateAds() {
  const now = Date.now();
  if (isUpdating || now - lastUpdate < 10000) return; // alle 10 Sek.
  isUpdating = true;

  console.log("🔄 Suche nach neuesten Anzeigen...");
  try {
    const newAds = await fetchAds("");

    // Nur neue URLs speichern
    const fresh = newAds.filter((a) => a.url && !lastSeenUrls.has(a.url));

    if (fresh.length > 0) {
      console.log(`🆕 ${fresh.length} neue Anzeigen gefunden!`);
      fresh.slice(0, 5).forEach((a, i) =>
        console.log(`  ${i + 1}. ${a.title} – ${a.price}`)
      );

      latestAds = [...fresh, ...latestAds].slice(0, 30);
      fresh.forEach((a) => lastSeenUrls.set(a.url, now));
    } else {
      console.log("🟢 Keine neuen Inserate seit letztem Check.");
    }

    // 🧹 Alte (>12h) entfernen
    const cutoff = now - 12 * 60 * 60 * 1000;
    for (const [url, ts] of lastSeenUrls.entries()) {
      if (ts < cutoff) lastSeenUrls.delete(url);
    }

    console.log("💾 Bekannte Anzeigen im Speicher:", lastSeenUrls.size);
    lastUpdate = now;
  } catch (err) {
    console.error("⚠️ Crawler-Fehler:", err.message);
  } finally {
    isUpdating = false;
  }
}

// 🌍 API: Nur neueste Anzeigen liefern
app.get("/crawl", async (req, res) => {
  try {
    if (latestAds.length === 0) await updateAds();
    res.json(latestAds);
  } catch (err) {
    res.status(500).json({ error: "Crawler-Fehler", details: err.message });
  }
});

// 💓 Healthcheck
app.get("/health", (req, res) => {
  res.send("✅ Fahregut Auto-Crawler läuft (Version 7.2 – Realtime Smart Fix ✅)");
});

// 🕒 Alle 10 Sek. neue Anzeigen prüfen
setInterval(updateAds, 10000);

// 🔁 Externer Ping – hält Fly.io wach
async function autoPing() {
  try {
    const url = "https://fahregut-auto-crawler.fly.dev/crawl";
    const res = await axios.get(url);
    console.log("🔄 Live-Check:", res.data.length, "Anzeigen geladen");
  } catch (err) {
    console.log("⚠️ Auto-Update-Fehler:", err.message);
  }
}
setInterval(autoPing, 10000);

console.log("🕒 Live-Auto-Update aktiv (Intervall 10 Sek., neue Inserate werden geloggt)");
app.listen(PORT, () => console.log(`🚗 Server läuft auf Port ${PORT} – Version 7.2 ✅`));
