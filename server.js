// 🚗 Fahregut Auto-Crawler – Version 7.6 (Fly Chromium Native ✅)
// Puppeteer-Core + Chromium (System Installation)

import express from "express";
import puppeteer from "puppeteer-core";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;

// 🧠 Speicher
let latestAds = [];
let lastSeenUrls = new Map();
let lastUpdate = 0;
let isUpdating = false;

// 🚀 Anzeigen abrufen
async function fetchAds(query = "") {
  console.log("🌍 Abruf gestartet:", query || "Alle Autos");

  // 🔧 Pfad zu systemweitem Chromium auf Fly.io
  const executablePath = "/usr/bin/chromium-browser";

  const browser = await puppeteer.launch({
    args: [
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-setuid-sandbox",
      "--disable-infobars",
      "--window-size=1280,720",
    ],
    headless: true,
    executablePath,
  });

  const page = await browser.newPage();
  const url = `https://www.kleinanzeigen.de/s-autos/${encodeURIComponent(
    query
  )}/k0?sorting=date-desc`;

  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    // 🍪 Cookie-Banner schließen
    try {
      await page.waitForSelector('button[aria-label="Alle akzeptieren"]', { timeout: 7000 });
      await page.click('button[aria-label="Alle akzeptieren"]');
      console.log("🍪 Cookie-Banner akzeptiert");
      await new Promise((r) => setTimeout(r, 1500));
    } catch {
      console.log("➡️ Kein Cookie-Banner gefunden (weiter).");
    }

    // 🔄 Scrollen für mehr Anzeigen
    await page.evaluate(async () => {
      for (let i = 0; i < 5; i++) {
        window.scrollBy(0, document.body.scrollHeight);
        await new Promise((r) => setTimeout(r, 800));
      }
    });

    await page.waitForSelector("article.aditem, .aditem", { timeout: 15000 });

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

// 🔁 Realtime Update
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
      latestAds = [...fresh, ...latestAds].slice(0, 30);
      fresh.forEach((a) => lastSeenUrls.set(a.url, now));
    } else {
      console.log("🟢 Keine neuen Inserate seit letztem Check.");
    }

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

// 🌍 API
app.get("/crawl", async (req, res) => {
  try {
    if (latestAds.length === 0) await updateAds();
    res.json(latestAds);
  } catch (err) {
    res.status(500).json({ error: "Crawler-Fehler", details: err.message });
  }
});

// 💓 Health
app.get("/health", (req, res) => {
  res.send("✅ Fahregut Auto-Crawler läuft (Version 7.6 – Fly Chromium Native ✅)");
});

// 🔁 Warm halten
setInterval(updateAds, 10000);
setInterval(() => axios.get("https://fahregut-auto-crawler.fly.dev/crawl").catch(() => {}), 10000);

app.listen(PORT, () =>
  console.log(`🚗 Server läuft auf Port ${PORT} – Version 7.6 ✅`)
);
