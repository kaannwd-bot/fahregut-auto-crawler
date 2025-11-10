import express from "express";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

chromium.setHeadlessMode = true;
chromium.setGraphicsMode = false;

const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.send("🚗 Fahregut Auto-Crawler läuft stabil ✅ (v2 mit JS-Render)");
});

app.get("/crawl", async (req, res) => {
  const { marke = "", modell = "" } = req.query;
  const query = [marke, modell].filter(Boolean).join(" ");
  const searchUrl = `https://www.kleinanzeigen.de/s-autos/${encodeURIComponent(query)}/k0`;

  console.log("=======================================================");
  console.log(`🔍 Anfrage: ${searchUrl}`);

  try {
    console.log("⏳ Warte 3 Sekunden, bevor Chromium gestartet wird...");
    await new Promise((r) => setTimeout(r, 3000));

    const executablePath = await chromium.executablePath();
    console.log("🚀 Starte Chromium mit Pfad:", executablePath || "[DEFAULT]");

    const browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--single-process",
        "--no-zygote",
        "--disable-gpu",
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: true,
      ignoreHTTPSErrors: true,
      protocolTimeout: 180000,
    });

    const page = await browser.newPage();
    console.log("🌍 Lade Seite:", searchUrl);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 120000 });

    // 👇 Auto-Scroll für Lazy Loading
    await autoScroll(page);

    // 👇 Warten bis Anzeigen sichtbar sind
    console.log("🕒 Warte bis JS-Anzeigen sichtbar sind...");
    await page.waitForSelector("article a h2, .aditem, [data-testid='list-item']", { timeout: 25000 }).catch(() => {
      console.warn("⚠️ Keine JS-Anzeigen-Elemente gefunden (Timeout).");
    });

    const cars = await page.evaluate(() => {
      const arr = [];
      document.querySelectorAll("article, .aditem, [data-testid='list-item']").forEach((el) => {
        const title = el.querySelector("a h2, h2")?.innerText || "";
        const price = el.querySelector(".price, [data-testid='ad-price']")?.innerText || "";
        const location =
          el.querySelector(".aditem-main--top--left, [data-testid='location-date']")?.innerText || "";
        const details = el.querySelector(".aditem-main--middle, [data-testid='labels']")?.innerText || "";
        const image =
          el.querySelector("img")?.src || "https://via.placeholder.com/400x250?text=Auto";
        const url = el.querySelector("a")?.href || "";
        if (title && url) arr.push({ title, price, location, details, image, url });
      });
      return arr.slice(0, 10);
    });

    console.log(`✅ ${cars.length} Fahrzeuge gefunden.`);
    await browser.close();
    res.json(cars);
  } catch (err) {
    console.error("❌ FEHLER:", err.message);
    res.status(500).json({
      error: "Crawler konnte nicht ausgeführt werden.",
      reason: err.message,
    });
  }
});

// 🔄 Auto-Scroll-Funktion (lädt Lazy-Content nach)
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
