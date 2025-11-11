import express from "express";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

chromium.setHeadlessMode = true;
chromium.setGraphicsMode = false;

const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.send("🚗 Fahregut Auto-Crawler läuft (Version 5 – stabil mit Auto-Fallback & Timeout ✅)");
});

// ✅ Crawl-Route – liefert direkt JSON zurück
app.get("/crawl", async (req, res) => {
  const { marke = "", modell = "" } = req.query;
  const query = [marke, modell].filter(Boolean).join(" ");
  const searchUrl = `https://www.kleinanzeigen.de/s-autos/${encodeURIComponent(query)}/k0`;

  console.log("=======================================================");
  console.log(`🔍 Anfrage: ${searchUrl}`);

  try {
    // ⏱ Timeout-Schutz (max. 90 Sekunden)
    const cars = await Promise.race([
      crawlKleinanzeigen(searchUrl),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout – Puppeteer zu lange beschäftigt")), 90000)
      ),
    ]);

    if (!cars || cars.length === 0) {
      console.log("⚠️ Keine Fahrzeuge gefunden.");
      return res.json([]);
    }

    console.log(`✅ ${cars.length} Fahrzeuge gefunden.`);
    res.json(cars);
  } catch (err) {
    console.error("❌ Fehler beim Crawlen:", err.message);
    res.status(500).json({ error: "Crawler-Fehler", details: err.message });
  }
});

// 🔧 Haupt-Crawler-Funktion (mit automatischem Fallback)
async function crawlKleinanzeigen(searchUrl) {
  console.log("🕒 Starte Puppeteer...");

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
      ],
      executablePath,
      headless: chromium.headless,
    });
  } catch (err) {
    console.error("⚠️ Sparticuz Chromium konnte nicht gestartet werden:", err.message);
    console.log("🔁 Fallback: Standard-Puppeteer wird verwendet...");
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  );

  console.log("🌍 Lade Seite:", searchUrl);
  await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 120000 });

  // ✅ Cookies akzeptieren (wenn vorhanden)
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

  // ✅ Fahrzeugdaten extrahieren
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
