import express from "express";
import fs from "fs";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

chromium.setHeadlessMode = true;
chromium.setGraphicsMode = false;

const app = express();
const PORT = process.env.PORT || 10000;
const OUTPUT_PATH = "/tmp/output.json";

app.get("/", (req, res) => {
  res.send("🚗 Fahregut Auto-Crawler läuft (Version 3 – stabil mit Retry & Wartezeit)");
});

// ✅ Crawl-Route
app.get("/crawl", async (req, res) => {
  const { marke = "", modell = "" } = req.query;
  const query = [marke, modell].filter(Boolean).join(" ");
  const searchUrl = `https://www.kleinanzeigen.de/s-autos/${encodeURIComponent(query)}/k0`;

  console.log("=======================================================");
  console.log(`🔍 Anfrage: ${searchUrl}`);

  // Sofortige Antwort an Render, damit kein Timeout
  res.status(202).json({ status: "Crawler gestartet", query: query || "alle Fahrzeuge" });

  await crawlKleinanzeigen(searchUrl);
});

// ✅ Ergebnisse abrufen
app.get("/results", (req, res) => {
  if (fs.existsSync(OUTPUT_PATH)) {
    const data = fs.readFileSync(OUTPUT_PATH, "utf8");
    res.type("application/json").send(data);
  } else {
    res.status(404).json({ error: "Keine Ergebnisse vorhanden." });
  }
});

// 🔧 Haupt-Crawler-Funktion
async function crawlKleinanzeigen(searchUrl) {
  try {
    console.log("🕒 Starte Crawler...");

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
      protocolTimeout: 180000,
      defaultViewport: { width: 1280, height: 900 },
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    );

    console.log("🌍 Lade Seite:", searchUrl);
    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 180000 });

    // ✅ Cookie-Banner schließen
    try {
      await page.waitForSelector("button[aria-label*='Alle akzeptieren']", { timeout: 8000 });
      await page.click("button[aria-label*='Alle akzeptieren']");
      console.log("✅ Cookies akzeptiert");
    } catch {
      console.log("⚠️ Kein Cookie-Banner sichtbar");
    }

    // Scrollen bis alle Anzeigen geladen sind
    await autoScroll(page);
    console.log("🕒 Warte bis Anzeigen erscheinen...");

    await page.waitForSelector("article[data-testid='listing-ad'], article", { timeout: 30000 });

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

    console.log(`📦 ${cars.length} Fahrzeuge gefunden`);

    if (cars.length === 0) {
      console.log("⚠️ Keine Anzeigen sichtbar – zweiter Versuch...");
      await page.reload({ waitUntil: "networkidle2" });
      await autoScroll(page);

      const retryCars = await page.evaluate(() => {
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

      console.log(`🔁 Zweiter Versuch: ${retryCars.length} Fahrzeuge gefunden.`);
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(retryCars, null, 2));
    } else {
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(cars, null, 2));
    }

    await browser.close();
    console.log("💾 Ergebnisse erfolgreich gespeichert ✅");
  } catch (err) {
    console.error("❌ Crawler-Fehler:", err.message);
  }
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
