// 🚗 Fahregut Auto-Crawler – Version 7.4 (Scroll + Cookie Fix ✅)
// Fly.io + Puppeteer-Core + Chromium Integration + Nur neue Inserate seit letztem Check

import express from "express";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import cors from "cors";
import axios from "axios";
import fs from "fs";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;
const CHROMIUM_PATH = await chromium.executablePath;

chromium.setHeadlessMode = true;
chromium.setGraphicsMode = false;

// 🧠 Speicher
let latestAds = [];
let lastSeenUrls = new Map();
let lastUpdate = 0;
let isUpdating = false;

// 🚀 Anzeigen abrufen
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

  try {
    await page.goto(url, {
      waitUntil: ["domcontentloaded", "networkidle2"],
      timeout: 60000,
    });

    // 🍪 Cookie-Banner schließen
    try {
      await page.waitForSelector('button[aria-label="Alle akzeptieren"]', { timeout: 7000 });
      await page.click('button[aria-label="Alle akzeptieren"]');
      console.log("🍪 Cookie-Banner akzeptiert");
      await new Promise((r) => setTimeout(r, 1500));
    } catch {
      console.log("➡️ Kein Cookie-Banner gefunden (weiter).");
    }

    // ⏳ Scrollen, um dynamische Anzeigen zu laden
    await page.evaluate(async () => {
      for (let i = 0; i < 5; i++) {
        window.scrollBy(0, document.body.scrollHeight);
        await new Promise((r) => setTimeout(r, 1000));
      }
    });

    // ⏳ Warten bis Anzeigen sichtbar
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

    // Screenshot (zur Fehlersuche)
    if (ads.length === 0) {
      await page.screenshot({ path: "/tmp/leer.png", fullPage: true });
      console.log("📸 Screenshot gespeichert (leer.png) – keine Anzeigen erkannt.");
    }

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
      fresh.forEach((a, i) => console.log(`  ${i + 1}. ${a.title} – ${a.price}`));

      latestAds = [...fresh, ...latestAds].slice(0, 30);
      fresh.forEach((a) => lastSeenUrls.set(a.url, now));
    } else {
      console.log("🟢 Keine neuen Inserate seit letztem Check.");
    }

    const cutoff = now - 12 * 60 * 60 * 1000;
    for (const [url, ts] of lastSeenUrls.entries()) {
      if (ts < cutoff) lastSeenUrls.delete(url);
    }

    console.log("💾 Bekannte Anzeigen:", lastSeenUrls.size);
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
  res.send("✅ Fahregut Auto-Crawler läuft (Version 7.4 – Scroll + Cookie Fix ✅)");
});

// 🕒 Intervall 10 Sek.
setInterval(updateAds, 10000);

// 🔁 Fly warm halten
async function autoPing() {
  try {
    const res = await axios.get("https://fahregut-auto-crawler.fly.dev/crawl");
    console.log("🔄 Live-Check:", res.data.length, "Anzeigen geladen");
  } catch (err) {
    console.log("⚠️ Auto-Update-Fehler:", err.message);
  }
}
setInterval(autoPing, 10000);

app.listen(PORT, () =>
  console.log(`🚗 Server läuft auf Port ${PORT} – Version 7.4 ✅`)
);
