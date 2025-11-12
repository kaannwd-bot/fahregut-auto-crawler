// 🚗 Fahregut Auto-Crawler – Version 8.3 (Correct Date Sorting + Stable Filter ✅)
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
let seenUrls = new Set();
let lastUpdate = 0;
let isUpdating = false;

// 🔍 Kleinanzeigen tarihini çöz
function parseKleinanzeigenTime(str) {
  if (!str) return null;
  const now = new Date();
  if (str.includes("Heute")) {
    const match = str.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      const d = new Date(now);
      d.setHours(+match[1], +match[2], 0, 0);
      return d;
    }
  }
  if (str.includes("Gestern")) {
    const match = str.match(/(\d{1,2}):(\d{2})/);
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    if (match) d.setHours(+match[1], +match[2], 0, 0);
    return d;
  }
  const m = str.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00`);
  return null;
}

// 🚀 Anzeigen abrufen (filtrelerle)
async function fetchAds(filters = {}) {
  const { marke = "", modell = "", preis_von = "", preis_bis = "" } = filters;
  const queryString = [marke, modell].filter(Boolean).join(" ");
  console.log("🌍 Abruf gestartet:", queryString || "Alle Autos");

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
    let url = `https://www.kleinanzeigen.de/s-autos/${encodeURIComponent(
      queryString
    )}/k0?sorting=date-desc`;

    if (preis_von || preis_bis) {
      url += `&price=${preis_von || 0}:${preis_bis || ""}`;
    }

    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    try {
      await page.waitForSelector('button[aria-label="Alle akzeptieren"]', { timeout: 7000 });
      await page.click('button[aria-label="Alle akzeptieren"]');
      await new Promise((r) => setTimeout(r, 1000));
    } catch {
      console.log("➡️ Kein Cookie-Banner gefunden.");
    }

    await page.evaluate(async () => {
      for (let i = 0; i < 3; i++) {
        window.scrollBy(0, document.body.scrollHeight);
        await new Promise((r) => setTimeout(r, 800));
      }
    });

    await page.waitForSelector("article.aditem, .aditem--featured, .aditem--galleryitem", { timeout: 15000 });

    const ads = await page.$$eval(
      "article.aditem, .aditem--featured, .aditem--galleryitem",
      (items) =>
        items.slice(0, 50).map((item) => {
          const title =
            item.querySelector(".aditem-main--middle--title")?.textContent.trim() ||
            item.querySelector("h2")?.textContent.trim() ||
            "Kein Titel";

          const price = item.querySelector(".aditem-main--middle--price-shipping--price")?.textContent.trim() || "";
          const location = item.querySelector(".aditem-main--top--left")?.textContent.trim() || "";
          const time = item.querySelector(".aditem-main--top--right")?.textContent.trim() || "";
          const image = item.querySelector("img")?.src || "";
          const url = item.querySelector("a")?.href || "";
          const details = item.querySelector(".aditem-main--middle--description")?.textContent.trim() || "";

          return { title, price, location, image, url, details, time };
        })
    );

    // 🔄 Doğru sıralama (en yeni en üste)
    const sortedAds = ads
      .map((a) => ({
        ...a,
        parsedDate: parseKleinanzeigenTime(a.time) || new Date(0),
      }))
      .sort((a, b) => b.parsedDate - a.parsedDate);

    await browser.close();
    console.log(`📦 ${sortedAds.length} Anzeigen gefunden (sortiert).`);
    return sortedAds;
  } catch (err) {
    console.error("⚠️ Fehler beim Abrufen:", err.message);
    await browser.close();
    return [];
  }
}

// 🔁 Nur neue Anzeigen abrufen
async function updateAds(filters = {}) {
  const now = Date.now();
  if (isUpdating || now - lastUpdate < 10000) return [];
  isUpdating = true;

  console.log("🔄 Suche nach neuen Anzeigen...");

  try {
    const allAds = await fetchAds(filters);
    const newOnes = allAds.filter((a) => a.url && !seenUrls.has(a.url));

    const cutoff = new Date(Date.now() - 60 * 60 * 1000);
    const freshAds = newOnes.filter((a) => {
      const adDate = parseKleinanzeigenTime(a.time);
      return adDate && adDate >= cutoff;
    });

    freshAds.forEach((a) => seenUrls.add(a.url));

    console.log(`🆕 ${freshAds.length} neue Anzeigen gesendet.`);
    lastUpdate = now;
    return freshAds;
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
    const filters = req.query || {};
    const newAds = await updateAds(filters);
    res.json(newAds);
  } catch (err) {
    res.status(500).json({ error: "Crawler-Fehler", details: err.message });
  }
});

// 💓 Healthcheck
app.get("/health", (req, res) => {
  res.send("✅ Fahregut Auto-Crawler läuft (Version 8.3 – Correct Date Sorting ✅)");
});

// 🔁 Fly wach halten (alle 20 Sekunden)
setInterval(() => {
  axios.get("https://fahregut-auto-crawler.fly.dev/health").catch(() => {});
}, 20000);

// 🌐 Server starten
app.listen(PORT, () => {
  console.log(`🚗 Server läuft auf Port ${PORT} – Version 8.3 ✅`);
});
