// 🚗 Fahregut Auto-Crawler – Version 8.0 (Incremental + Title Fix ✅)
// Puppeteer-Core + System Chromium (Fly.io Verified Build)

import express from "express";
import puppeteer from "puppeteer-core";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;

// 🧠 Speicher (nur neue Anzeigen)
let seenUrls = new Set(); // sadece yeni ilan kontrolü için
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
      await new Promise((r) => setTimeout(r, 1200));
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

    // 🕒 Anzeigen-Container warten
    await page.waitForSelector("article.aditem, .aditem--featured, .aditem--galleryitem", { timeout: 15000 });

    // 📦 Anzeigen erfassen (inkl. Featured + Gallery)
    const ads = await page.$$eval(
      "article.aditem, .aditem--featured, .aditem--galleryitem",
      (items) =>
        items.slice(0, 40).map((item) => {
          const titleEl =
            item.querySelector(".aditem-main--middle--title") ||
            item.querySelector("h2") ||
            item.querySelector("a");
          const title = titleEl ? titleEl.textContent.trim().replace(/\s+/g, " ") : "Kein Titel";

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

          const timeEl = item.querySelector(".aditem-main--top--right");
          const time = timeEl ? timeEl.textContent.trim() : "";

          return { title, price, location, image, url, details, time };
        })
    );

    console.log(`📦 ${ads.length} Anzeigen gefunden.`);
    await browser.close();
    return ads;
  } catch (err) {
    console.error("⚠️ Fehler beim Abrufen:", err.message);
    await browser.close();
    return [];
  }
}

// 🔁 Nur neue Anzeigen abrufen
async function updateAds() {
  const now = Date.now();
  if (isUpdating || now - lastUpdate < 10000) return [];
  isUpdating = true;

  console.log("🔄 Suche nach neuen Anzeigen...");

  try {
    const allAds = await fetchAds("");
    const newOnes = allAds.filter((a) => a.url && !seenUrls.has(a.url));

    // Neue URLs speichern
    newOnes.forEach((a) => seenUrls.add(a.url));

    console.log(`🆕 ${newOnes.length} neue Anzeigen gefunden.`);
    lastUpdate = now;
    return newOnes;
  } catch (err) {
    console.error("⚠️ Update-Fehler:", err.message);
    return [];
  } finally {
    isUpdating = false;
  }
}

// 🌍 API: Nur neue Anzeigen zurückgeben
app.get("/crawl", async (req, res) => {
  try {
    const newAds = await updateAds();
    res.json(newAds);
  } catch (err) {
    res.status(500).json({ error: "Crawler-Fehler", details: err.message });
  }
});

// 💓 Healthcheck
app.get("/health", (req, res) => {
  res.send("✅ Fahregut Auto-Crawler läuft (Version 8.0 – Incremental + Title Fix ✅)");
});

// 🔁 Fly wach halten (alle 20 Sekunden)
setInterval(() => {
  axios.get("https://fahregut-auto-crawler.fly.dev/health").catch(() => {});
}, 20000);

// 🌐 Server starten
app.listen(PORT, () => {
  console.log(`🚗 Server läuft auf Port ${PORT} – Version 8.0 ✅`);
});
