import express from "express";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

chromium.setHeadlessMode = true;
chromium.setGraphicsMode = false;

const app = express();
const PORT = process.env.PORT || 8080;

app.get("/", (req, res) => {
  res.send("🚗 Fahregut Auto-Crawler läuft (Version 6.4 – Fly.io Fix + Schnellmodus ✅)");
});

// ✅ Crawl-Route – liefert direkt JSON zurück
app.get("/crawl", async (req, res) => {
  const { marke = "", modell = "" } = req.query;
  const query = [marke, modell].filter(Boolean).join(" ");
  const searchUrl =
    query.trim().length > 0
      ? `https://www.kleinanzeigen.de/s-autos/${encodeURIComponent(query)}/k0`
      : "https://www.kleinanzeigen.de/s-autos/c216";

  console.log(`🔍 Suche gestartet: ${searchUrl}`);

  try {
    const cars = await Promise.race([
      crawlKleinanzeigen(searchUrl),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout – zu lange Antwortzeit")), 90000)
      ),
    ]);

    if (!cars || cars.length === 0) {
      console.log("⚠️ Keine Fahrzeuge gefunden.");
      return res.json([]);
    }

    console.log(`✅ ${cars.length} Fahrzeuge extrahiert`);
    res.json(cars);
  } catch (err) {
    console.error("❌ Fehler beim Crawlen:", err.message);
    res.status(500).json({ error: "Crawler-Fehler", details: err.message });
  }
});

// 🔧 Haupt-Crawler-Funktion
async function crawlKleinanzeigen(url) {
  console.log("🕒 Starte Browser...");

  let executablePath;
  try {
    executablePath = await chromium.executablePath();
  } catch (err) {
    console.warn("⚠️ Chromium executablePath Fehler – verwende Fallback.");
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

  console.log("🌍 Lade Seite:", url);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

  // ✅ Schneller Cookie-Klick (wenn sichtbar)
  try {
    await page.click("button[aria-label*='Alle akzeptieren']", { delay: 200 });
  } catch {}

  // 🔎 Fahrzeuge lesen
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
  return cars;
}

app.listen(PORT, () => console.log(`✅ Server läuft auf Port ${PORT}`));
