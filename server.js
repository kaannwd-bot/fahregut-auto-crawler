import express from "express";
import fs from "fs";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

chromium.setHeadlessMode = true;
chromium.setGraphicsMode = false;

const app = express();
const PORT = process.env.PORT || 10000;
const OUTPUT_PATH = "/tmp/output.json"; // Render erlaubt nur /tmp als Schreibpfad

app.get("/", (req, res) => {
  res.send("🚗 Fahregut Auto-Crawler läuft stabil ✅ (mit Datenspeicherung)");
});

// ✅ Crawler starten (asynchron)
app.get("/crawl", async (req, res) => {
  const { marke = "", modell = "" } = req.query;
  const query = [marke, modell].filter(Boolean).join(" ");
  const searchUrl = `https://www.kleinanzeigen.de/s-autos/${encodeURIComponent(query)}/k0`;

  console.log("=======================================================");
  console.log(`🔍 Anfrage: ${searchUrl}`);

  // Sofortige Antwort an Render, damit kein 502-Fehler kommt
  res.status(202).json({ status: "Crawler gestartet", query: query || "alle Fahrzeuge" });

  try {
    console.log("🕒 Warte kurz, bis Chromium bereit ist...");
    await new Promise((r) => setTimeout(r, 4000));

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
      defaultViewport: { width: 1280, height: 900 },
      executablePath,
      headless: true, // auf Render muss es true bleiben
      ignoreHTTPSErrors: true,
      protocolTimeout: 180000,
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    );

    console.log("🌍 Lade Seite:", searchUrl);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 120000 });

    // ✅ Cookie-Banner automatisch wegklicken
    try {
      await page.waitForSelector("button[aria-label*='Alle akzeptieren']", { timeout: 8000 });
      await page.click("button[aria-label*='Alle akzeptieren']");
      console.log("✅ Cookies akzeptiert");
    } catch {
      console.log("⚠️ Kein Cookie-Banner gefunden oder übersprungen");
    }

    // Scrollen, damit alle Anzeigen geladen werden
    await autoScroll(page);

    console.log("🕒 Warte, bis Anzeigen sichtbar sind...");
    await page.waitForSelector("article[data-testid='listing-ad']", { timeout: 30000 });

    const cars = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll("article[data-testid='listing-ad']").forEach((el) => {
        const title = el.querySelector("h2")?.innerText || "";
        const price = el.querySelector("[data-testid='ad-price']")?.innerText || "";
        const location = el.querySelector("[data-testid='location-date']")?.innerText || "";
        const image = el.querySelector("img")?.src || "https://via.placeholder.com/400x250?text=Auto";
        const link = el.querySelector("a")?.href || "";
        if (title && link) results.push({ title, price, location, image, link });
      });
      return results;
    });

    await browser.close();

    console.log(`✅ ${cars.length} Fahrzeuge gefunden.`);
    if (cars.length > 0) {
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(cars, null, 2));
      console.log("💾 Ergebnisse gespeichert unter:", OUTPUT_PATH);
    } else {
      console.log("⚠️ Keine Fahrzeuge gefunden.");
    }
  } catch (err) {
    console.error("❌ Hintergrund-Fehler:", err.message);
  }
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

// 🔄 Scroll-Funktion
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 400;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 500);
    });
  });
}

app.listen(PORT, () => console.log(`✅ Fahregut-Crawler läuft auf Port ${PORT}`));
