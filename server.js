import express from "express";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

chromium.setHeadlessMode = true;
chromium.setGraphicsMode = false;

const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.send("🚗 Fahregut Auto-Crawler läuft stabil!");
});

app.get("/crawl", async (req, res) => {
  const { marke = "", modell = "" } = req.query;
  const query = [marke, modell].filter(Boolean).join(" ");
  const searchUrl = `https://www.kleinanzeigen.de/s-autos/${encodeURIComponent(query)}/k0`;

  try {
    console.log("⏳ Starte stabilen Chromium-Start...");
    await new Promise((resolve) => setTimeout(resolve, 5000)); // längeres Warten (5s)

    const executablePath = (await chromium.executablePath()) || "/usr/bin/google-chrome-stable";

    let browser;
    let attempt = 0;
    let success = false;

    while (!success && attempt < 3) {
      try {
        attempt++;
        console.log(`🚀 Starte Chrome (Versuch ${attempt})...`);
        browser = await puppeteer.launch({
          args: [
            ...chromium.args,
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--no-zygote",
          ],
          defaultViewport: chromium.defaultViewport,
          executablePath,
          headless: chromium.headless,
          protocolTimeout: 120000, // 2 Minuten Timeout
        });
        success = true;
      } catch (err) {
        console.error(`⚠️ Chrome-Start fehlgeschlagen (${attempt}):`, err.message);
        if (attempt < 3) {
          console.log("🔁 Neuer Versuch in 5 Sekunden...");
          await new Promise((r) => setTimeout(r, 5000));
        }
      }
    }

    if (!success) throw new Error("Chromium konnte nach 3 Versuchen nicht gestartet werden.");

    const page = await browser.newPage();
    console.log(`🌐 Lade ${searchUrl} ...`);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 120000 });

    const cars = await page.evaluate(() => {
      const arr = [];
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
        if (title && url) arr.push({ title, price, location, details, image, url });
      });
      return arr.slice(0, 10);
    });

    await browser.close();
    console.log(`✅ Erfolgreich ${cars.length} Autos gefunden!`);
    res.json(cars);
  } catch (err) {
    console.error("❌ Crawler-Fehler:", err.message);
    res.status(500).json({
      error: "Crawler ist gerade nicht erreichbar – bitte später erneut versuchen.",
      reason: err.message,
    });
  }
});

app.listen(PORT, () => console.log(`✅ Fahregut-Crawler läuft auf Port ${PORT}`));
