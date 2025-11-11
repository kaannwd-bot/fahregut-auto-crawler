import express from "express";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

chromium.setHeadlessMode = true;
chromium.setGraphicsMode = false;

const app = express();
const PORT = process.env.PORT || 10000;

// 🧠 Cache für letzte Inserate
let lastResults = [];
let lastRunTime = 0;

app.get("/", (req, res) => {
  res.send("🚗 Fahregut Live-Auto-Crawler läuft (Version 6.0 – zeigt neueste Inserate ✅)");
});

// 🟡 API-Endpunkt – liefert aktuelle Fahrzeuge
app.get("/crawl", async (req, res) => {
  const now = Date.now();

  // Nur alle 10 Sekunden aktualisieren
  if (now - lastRunTime < 10 * 1000 && lastResults.length > 0) {
    console.log("⚡ Verwende gecachte Ergebnisse (unter 10 Sekunden alt)");
    return res.json(lastResults);
  }

  try {
    console.log("🌍 Lade neueste Autos …");
    const cars = await crawlKleinanzeigen("https://www.kleinanzeigen.de/s-autos/c216");

    if (!cars || cars.length === 0) {
      console.log("⚠️ Keine neuen Fahrzeuge gefunden – gebe alten Cache zurück.");
      return res.json(lastResults);
    }

    lastResults = cars.slice(0, 25); // nur die 25 neuesten behalten
    lastRunTime = now;

    console.log(`✅ ${lastResults.length} neue Fahrzeuge geladen.`);
    res.json(lastResults);
  } catch (err) {
    console.error("❌ Fehler beim Crawlen:", err.message);
    res.status(500).json({ error: "Crawler-Fehler", details: err.message });
  }
});

// 🔧 Haupt-Crawler-Funktion
async function crawlKleinanzeigen(url) {
  console.log("🕒 Starte Puppeteer (Fly.io-kompatibel)…");

  let browser;
  try {
    const executablePath = await chromium.executablePath();
    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote",
        "--single-process",
        "--disable-infobars",
      ],
      executablePath,
      headless: true,
      ignoreHTTPSErrors: true,
      defaultViewport: { width: 1280, height: 900 },
    });
  } catch (err) {
    console.error("⚠️ Sparticuz Chromium konnte nicht gestartet werden:", err.message);
    console.log("🔁 Fallback: Standard-Puppeteer wird verwendet …");
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  );

  await page.setExtraHTTPHeaders({ "Accept-Language": "de-DE,de;q=0.9,en;q=0.8" });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  console.log("🌍 Öffne Seite:", url);
  await page.goto(url, { waitUntil: "networkidle2", timeout: 90000 });

  // ✅ Cookies akzeptieren
  try {
    await page.waitForSelector("button[aria-label*='Alle akzeptieren']", { timeout: 5000 });
    await page.click("button[aria-label*='Alle akzeptieren']");
    console.log("✅ Cookies akzeptiert");
  } catch {
    console.log("⚠️ Kein Cookie-Banner sichtbar");
  }

  console.log("🔎 Extrahiere aktuelle Fahrzeugdaten …");
  const cars = await page.evaluate(() => {
    const arr = [];
    document.querySelectorAll("article[data-testid='listing-ad'], article").forEach((el) => {
      const title = el.querySelector("h2")?.innerText || "";
      const price = el.querySelector("[data-testid='ad-price']")?.innerText || "";
      const location = el.querySelector("[data-testid='location-date']")?.innerText || "";
      const image = el.querySelector("img")?.src || "https://via.placeholder.com/400x250?text=Auto";
      const url = el.querySelector("a")?.href || "";
      if (title && url) arr.push({ title, price, location, image, url });
    });
    return arr;
  });

  await browser.close();
  console.log(`💾 ${cars.length} Fahrzeuge extrahiert ✅`);
  return cars;
}

app.listen(PORT, () => console.log(`✅ Fahregut Live-Crawler läuft auf Port ${PORT}`));
