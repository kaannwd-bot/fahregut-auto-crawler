import express from "express";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

chromium.setHeadlessMode = true;
chromium.setGraphicsMode = false;

const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.send("🚗 Fahregut Auto-Crawler läuft stabil ✅");
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
        "--disable-gpu"
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: true,
      ignoreHTTPSErrors: true,
      protocolTimeout: 120000
    });

    const page = await browser.newPage();
    console.log("🌍 Lade Seite:", searchUrl);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 120000 });

    const cars = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll("article").forEach((el) => {
        const title = el.querySelector("a h2")?.innerText || "";
        const price = el.querySelector(".price")?.innerText || "";
        const location = el.querySelector(".aditem-main--top--left")?.innerText || "";
        const details = el.querySelector(".aditem-main--middle")?.innerText || "";
        const image =
          el.querySelector("img")?.src || "https://via.placeholder.com/400x250?text=Auto";
        const url = el.querySelector("a")?.getAttribute("href")
          ? "https://www.kleinanzeigen.de" + el.querySelector("a").getAttribute("href")
          : "";
        if (title && url) results.push({ title, price, location, details, image, url });
      });
      return results.slice(0, 10);
    });

    console.log(`✅ ${cars.length} Fahrzeuge gefunden.`);
    await browser.close();
    res.json(cars);
  } catch (err) {
    console.error("❌ FEHLER:", err.message);
    res.status(500).json({
      error: "Crawler konnte nicht ausgeführt werden.",
      reason: err.message
    });
  }
});

app.listen(PORT, () =>
  console.log(`✅ Fahregut-Crawler läuft auf Port ${PORT}`)
);
