import express from "express";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

chromium.setHeadlessMode = true;
chromium.setGraphicsMode = false;

const app = express();
const PORT = process.env.PORT || 8080;

let lastResults = []; // Zwischenspeicher für letzte Inserate
let newCars = []; // Neu erkannte Fahrzeuge

app.get("/", (req, res) => {
  res.send("🚗 Fahregut Auto-Crawler läuft (Version 6.5 – Realtime Live ✅)");
});

// 🔄 Realtime-Endpoint – gibt nur NEUE Inserate zurück
app.get("/live", (req, res) => {
  res.json(newCars);
});

// ✅ Standard-Endpunkt: einmaliger Crawl
app.get("/crawl", async (req, res) => {
  try {
    const cars = await crawlKleinanzeigen("https://www.kleinanzeigen.de/s-autos/c216");
    res.json(cars);
  } catch (err) {
    console.error("❌ Fehler beim Crawlen:", err.message);
    res.status(500).json({ error: "Crawler-Fehler", details: err.message });
  }
});

// 🔧 Crawl-Funktion (mit Fly.io-kompatiblem Chromium)
async function crawlKleinanzeigen(url) {
  console.log("🌍 Lade Seite:", url);

  let executablePath;
  try {
    executablePath = await chromium.executablePath();
  } catch (e) {
    console.warn("⚠️ Chromium executablePath Fehler, Fallback wird genutzt");
    executablePath = "/usr/bin/chromium-browser";
  }

  const browser = await puppeteer.launch({
    args: [...chromium.args, "--no-sandbox", "--disable-dev-shm-usage"],
    executablePath,
    headless: chromium.headless,
    defaultViewport: { width: 1280, height: 900 },
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  );

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

  try {
    await page.click("button[aria-label*='Alle akzeptieren']", { delay: 200 });
  } catch {}

  const cars = await page.evaluate(() => {
    const arr = [];
    document.querySelectorAll("article[data-testid='listing-ad']").forEach((el) => {
      const title = el.querySelector("h2")?.innerText || "";
      const price = el.querySelector("[data-testid='ad-price']")?.innerText || "";
      const location = el.querySelector("[data-testid='location-date']")?.innerText || "";
      const image = el.querySelector("img")?.src || "";
      const url = el.querySelector("a")?.href || "";
      if (title && url) arr.push({ title, price, location, image, url });
    });
    return arr;
  });

  await browser.close();
  console.log(`✅ ${cars.length} Fahrzeuge gefunden`);
  return cars;
}

// 🧠 Hintergrundprozess: alle 10 Sekunden nach neuen Inseraten suchen
async function startRealtimeCrawl() {
  try {
    const cars = await crawlKleinanzeigen("https://www.kleinanzeigen.de/s-autos/c216");

    // Nur neue Fahrzeuge ermitteln (nach URL)
    const fresh = cars.filter((c) => !lastResults.some((old) => old.url === c.url));

    if (fresh.length > 0) {
      console.log(`🆕 ${fresh.length} neue Fahrzeuge gefunden!`);
      newCars = fresh;
      lastResults = cars;
    } else {
      console.log("⏳ Keine neuen Fahrzeuge.");
    }
  } catch (err) {
    console.error("⚠️ Realtime-Fehler:", err.message);
  }

  setTimeout(startRealtimeCrawl, 10000); // 10 Sekunden Zyklus
}

// 🔁 Starte den Live-Loop
startRealtimeCrawl();

app.listen(PORT, () => console.log(`✅ Server läuft auf Port ${PORT} (Realtime aktiv)`));
