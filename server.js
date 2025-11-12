// 🚗 Fahregut Auto-Crawler – Version 7.8 (Fly Chromium Full Compatible ✅)
// Puppeteer-Core + System Chromium (Fly.io Verified Build)

import express from "express";
import puppeteer from "puppeteer-core";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;

// 🧠 Zwischenspeicher
let latestAds = [];
let lastSeenUrls = new Map();
let lastUpdate = 0;
let isUpdating = false;

// 🚀 Funktion: Anzeigen abrufen
async function fetchAds(query = "") {
  console.log("🌍 Abruf gestartet:", query || "Alle Autos");

  const executablePath = "/usr/bin/chromium";

  const browser = await puppeteer.launch({
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

  try {
    const page = await browser.newPage();
    const url = `https://www.kleinanzeigen.de/s-autos/${encodeURIComponent(
      query
    )}/k0?sorting=date-desc`;

    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    // 🍪 Cookie-Banner automatisch akzeptieren
    try {
      await page.waitForSelector('button[aria-label="Alle akzeptieren"]', { timeout: 7000 });
      await page.click('button[aria-label="Alle akzeptieren"]');
      console.log("🍪 Cookie-Banner akzeptiert");
      await new Promise((r) => setTimeout(r, 1500));
    } catch {
      console.log("➡️ Kein Cookie-Banner gefunden (weiter).");
    }

    // 🔄 Scrollen (mehr Anzeigen laden)
    await page.evaluate(async () => {
      for (let i = 0; i < 4; i++) {
        window.scrollBy(0, document.body.scrollHeight);
        await new Promise((r) => setTimeout(r, 800));
      }
    });

    // 🕒 Auf Anzeige warten
    await page.waitForSelector("article.aditem, .aditem--featured, .aditem--galleryitem", { timeout: 15000 });

    // 📦 Alle Varianten (inkl. Featured + Gallery)
    const ads = await page.$$eval(
      "article.aditem, .aditem--featured, .aditem--galleryitem",
      (items) =>
        items.slice(0, 30).map((item) => {
          const titleEl = item.querySelector(".aditem-main--middle--title");
          const title = titleEl ? titleEl.textContent.trim() : "Unbekanntes Fahrzeug";

          const priceEl = item.querySelector(".aditem-main--middle--price-shipping--price");
          const price = priceEl ? priceEl.textContent.trim() : "";

          const locationEl = item.querySelector(".aditem-main--top--left");
          const location = locationEl ? locationEl.textContent.trim() : "";

          const imageEl = item.querySelector("img");
          const image = imageEl ? imageEl.src : "";

          const urlEl = item.querySelector("a");
          const url = urlEl ? urlEl.href : "";

          const detailsEl = item.querySelector(".aditem-main--middle--description");
          const details = detailsEl ? detailsEl.textContent.trim() : "";

          return { title, price, location, image, url, details };
        })
    );

    console.log(`📦 ${ads.length} Anzeigen gefunden.`);
    if (ads[0]) console.log("🔍 Erste Anzeige:", ads[0].title);

    await browser.close();
    return ads;
  } catch (err) {
    console.error("⚠️ Fehler beim Abrufen:", err.message);
    await browser.close();
    return [];
  }
}

// 🔁 Realtime-Update
async function updateAds() {
  const now = Date.now();
  if (isUpdating || now - lastUpdate < 10000) return;
  isUpdating = true;

  console.log("🔄 Suche nach neuesten Anzeigen...");
  try {
    const newAds = await fetchAds("");
    const fresh = newAds.filter((a) => a.url && !lastSeenUrls.has(a.url));

    if (fresh.length > 0) {
      console.log(`🆕 ${fresh.length} neue Anzeigen gefunden!`);
      latestAds = [...fresh, ...latestAds].slice(0, 40);
      fresh.forEach((a) => lastSeenUrls.set(a.url, now));
    } else {
      console.log("🟢 Keine neuen Inserate seit letztem Check.");
    }

    // Alte löschen (>12h)
    const cutoff = now - 12 * 60 * 60 * 1000;
    for (const [url, ts] of lastSeenUrls.entries()) {
      if (ts < cutoff) lastSeenUrls.delete(url);
    }

    lastUpdate = now;
  } catch (err) {
    console.error("⚠️ Update-Fehler:", err.message);
  } finally {
    isUpdating = false;
  }
}

// 🌍 API-Route
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
  res.send("✅ Fahregut Auto-Crawler läuft (Version 7.8 – Full Compatible ✅)");
});

// 🕒 Intervall
setInterval(updateAds, 10000);

// 🔁 Fly wach halten
setInterval(() => {
  axios.get("https://fahregut-auto-crawler.fly.dev/crawl").catch(() => {});
}, 10000);

// 🌐 Server starten
app.listen(PORT, () => {
  console.log(`🚗 Server läuft auf Port ${PORT} – Version 7.8 ✅`);
});
