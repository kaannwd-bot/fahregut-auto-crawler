import express from "express";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

chromium.setHeadlessMode = true;
chromium.setGraphicsMode = false;

const app = express();
const PORT = process.env.PORT || 10000;

// ✅ Healthcheck für Fly.io Proxy
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// ✅ Root-Route
app.get("/", (req, res) => {
  res.send("🚗 Fahregut Auto-Crawler läuft (Version 6.3 – Fly.io stabil & HealthCheck ✅)");
});

// ✅ Crawl-Route – zeigt neueste Inserate
app.get("/crawl", async (req, res) => {
  const url = "https://www.kleinanzeigen.de/s-autos/c216";
  console.log("🌍 Starte Crawl:", url);

  try {
    const cars = await Promise.race([
      crawlKleinanzeigen(url),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout – Seite reagiert nicht")), 25000)
      ),
    ]);

    res.json(cars);
  } catch (err) {
    console.error("❌ Fehler:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// 🔧 Haupt-Crawler
async function crawlKleinanzeigen(url) {
  console.log("🕒 Öffne Browser...");

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
    executablePath: await chromium.executablePath(),
    headless: true,
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  );

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });

  const cars = await page.evaluate(() => {
    const arr = [];
    document.querySelectorAll("article[data-testid='listing-ad']").forEach((el) => {
      const title = el.querySelector("h2")?.innerText || "";
      const price = el.querySelector("[data-testid='ad-price']")?.innerText || "";
      const location = el.querySelector("[data-testid='location-date']")?.innerText || "";
      const image = el.querySelector("img")?.src || "";
      const link = el.querySelector("a")?.href || "";
      if (title && link) arr.push({ title, price, location, image, link });
    });
    return arr.slice(0, 25);
  });

  await browser.close();
  console.log(`✅ ${cars.length} Fahrzeuge gefunden.`);
  return cars;
}

app.listen(PORT, () =>
  console.log(`✅ Fahregut Crawler läuft stabil auf Port ${PORT}`)
);
