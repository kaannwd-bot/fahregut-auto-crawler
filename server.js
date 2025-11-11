// 🚗 Fahregut Auto-Crawler – Version 7.1 (Realtime Smart Fix ✅)
// Fly.io + Puppeteer-Core + Chromium Integration + Memory-Limit

import express from "express";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import cors from "cors";
import axios from "axios"; // ✅ normaler Import (kein await import mehr)

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;
const CHROMIUM_PATH = await chromium.executablePath; // ✅ direkt von chromium holen

chromium.setHeadlessMode = true;
chromium.setGraphicsMode = false;

// 🧠 Zwischenspeicher für Anzeigen
let latestAds = [];
let lastSeenUrls = new Map(); // url → timestamp
let lastUpdate = 0;
let isUpdating = false;

// 🚀 Hauptfunktion: Anzeigen abrufen
async function fetchAds(query = "") {
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

// 🔁 Realtime-Aktualisierung: nur neue Anzeigen
async function updateAds() {
  const now = Date.now();
  if (isUpdating || now - lastUpdate < 10000) return; // max. alle 10 Sek.
  isUpdating = true;

  console.log("🔄 Suche nach neuesten Anzeigen...");
  try {
    const newAds = await fetchAds("");

    // Neue URLs herausfiltern
    const fresh = newAds.filter((a) => !lastSeenUrls.has(a.url));

    if (fresh.length > 0) {
      console.log(`🆕 ${fresh.length} neue Anzeigen gefunden!`);
      fresh.slice(0, 5).forEach((a, i) =>
        console.log(`  ${i + 1}. ${a.title} – ${a.price}`)
      );

      latestAds = [...fresh, ...latestAds].slice(0, 30);

      // Zeitstempel speichern
      fresh.forEach((a) => lastSeenUrls.set(a.url, now));
    } else {
      console.log("🟢 Keine neuen Inserate seit dem letzten Check.");
    }

    // 🧹 Alte Einträge (> 12 Stunden) löschen
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

// 🌍 API-Route /crawl – liefert nur neueste Anzeigen
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
  res.send("✅ Fahregut Auto-Crawler läuft (Version 7.1 – Realtime Smart Fix ✅)");
});

// 🕒 Automatischer Realtime-Check alle 10 Sekunden
setInterval(updateAds, 10000);

// 🔁 Externer Ping: Fly hält die App wach
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
console.log("🕒 Live-Auto-Update aktiviert (Intervall 10 Sekunden, nur neue Inserate werden geloggt)");

// 🌐 Server starten
app.listen(PORT, () =>
  console.log(`🚗 Server läuft auf Port ${PORT} – Version 7.1 (Realtime Smart Fix)`)
);
