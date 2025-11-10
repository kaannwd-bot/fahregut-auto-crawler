import express from "express";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

chromium.setHeadlessMode = true;
chromium.setGraphicsMode = false;

const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.send("🚗 Fahregut Auto-Crawler läuft stabil ✅ (Render async fix)");
});

app.get("/crawl", async (req, res) => {
  const { marke = "", modell = "" } = req.query;
  const query = [marke, modell].filter(Boolean).join(" ");
  const searchUrl = `https://www.kleinanzeigen.de/s-autos/${encodeURIComponent(query)}/k0`;

  console.log("=======================================================");
  console.log(`🔍 Anfrage: ${searchUrl}`);

  // 👉 Sofortige Antwort an Browser, damit Render keinen 502 gibt
  res.status(202).json({ status: "Crawler gestartet", query: query || "alle Fahrzeuge" });

  // ---- Rest läuft im Hintergrund ----
  try {
    await new Promise((r) => setTimeout(r, 3000));
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
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: true,
      ignoreHTTPSErrors: true,
      protocolTimeout: 180000,
    });

    const page = await browser.newPage();
    console.log("🌍 Lade Seite:", searchUrl);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 120000 });

    await autoScroll(page);
    console.log("🕒 Warte bis Anzeigen sichtbar sind...");
    await page.waitForSelector("article, .aditem, [data-testid='list-item']", { timeout: 25000 });

    const cars = await page.evaluate(() => {
      const arr = [];
      document.querySelectorAll("article, .aditem, [data-testid='list-item']").forEach((el) => {
        const title = el.querySelector("a h2, h2")?.innerText || "";
        const price = el.querySelector(".price, [data-testid='ad-price']")?.innerText || "";
        const location = el.querySelector(".aditem-main--top--left, [data-testid='location-date']")?.innerText || "";
        const details = el.querySelector(".aditem-main--middle, [data-testid='labels']")?.innerText || "";
        const image = el.querySelector("img")?.src || "https://via.placeholder.com/400x250?text=Auto";
        const url = el.querySelector("a")?.href || "";
        if (title && url) arr.push({ title, price, location, details, image, url });
      });
      return arr.slice(0, 10);
    });

    console.log(`✅ ${cars.length} Fahrzeuge gefunden.`);
    await browser.close();

  } catch (err) {
    console.error("❌ Hintergrund-Fehler:", err.message);
  }
});

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
