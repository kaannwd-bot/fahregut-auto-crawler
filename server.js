import express from "express";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

chromium.setHeadlessMode = true;
chromium.setGraphicsMode = false;

const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.send("🚗 Fahregut Auto-Crawler läuft (Version 4 – direkte JSON-Ausgabe ✅)");
});

// ✅ Crawl-Route – liefert sofort JSON zurück
app.get("/crawl", async (req, res) => {
  const { marke = "", modell = "" } = req.query;
  const query = [marke, modell].filter(Boolean).join(" ");
  const searchUrl = `https://www.kleinanzeigen.de/s-autos/${encodeURIComponent(query)}/k0`;

  console.log("=======================================================");
  console.log(`🔍 Anfrage: ${searchUrl}`);

  try {
    const cars = await crawlKleinanzeigen(searchUrl);

    if (!cars || cars.length === 0) {
      console.log("⚠️ Keine Fahrzeuge gefunden.");
      return res.json([]);
    }

    console.log(`✅ ${cars.length} Fahrzeuge gefunden.`);
    res.json(cars); // <---- Direkt JSON-Antwort an PHP
  } catch (err) {
    console.error("❌ Fehler beim Crawlen:", err.message);
    res.status(500).json({ error: "Crawler-Fehler", details: err.message });
  }
});

// 🔧 Haupt-Crawler-Funktion
async function crawlKleinanzeigen(searchUrl) {
  console.log("🕒 Starte Puppeteer...");
  const executablePath = await chromium.executablePath();

  const browser = await puppeteer.launch({
    args: [
      ...chromium.args,
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--single-process",
      "--no-zygote",
    ],
    executablePath,
    headless: true,
    ignoreHTTPSErrors: true,
    defaultViewport: { width: 1280, height: 900 },
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  );

  console.log("🌍 Lade Seite:", searchUrl);
  await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 120000 });

  // ✅ Cookies akzeptieren
  try {
    await page.waitForSelector("button[aria-label*='Alle akzeptieren']", { timeout: 8000 });
    await page.click("button[aria-label*='Alle akzeptieren']");
    console.log("✅ Cookies akzeptiert");
  } catch {
    console.log("⚠️ Kein Cookie-Banner sichtbar");
  }

  // 🔄 Scrollen bis alles geladen ist
  await autoScroll(page);
  console.log("🔎 Lese Fahrzeugdaten...");

  // ✅ Fahrzeuge extrahieren
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

// 🔄 Scroll-Funktion
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 500;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 400);
    });
  });
}

app.listen(PORT, () => console.log(`✅ Fahregut-Crawler läuft auf Port ${PORT}`));
