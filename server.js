import express from "express";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

chromium.setHeadlessMode = true;
chromium.setGraphicsMode = false;

const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.send("🚗 Fahregut Auto-Crawler läuft!");
});

app.get("/crawl", async (req, res) => {
  const { marke = "", modell = "" } = req.query;
  const query = [marke, modell].filter(Boolean).join(" ");
  const searchUrl = `https://www.kleinanzeigen.de/s-autos/${encodeURIComponent(query)}/k0`;

  try {
    console.log("⏳ Warte kurz, bis Chromium bereit ist...");
    await new Promise((resolve) => setTimeout(resolve, 3000)); // Warte 3 Sekunden

    let browser;
    const executablePath = (await chromium.executablePath()) || "/usr/bin/google-chrome-stable";

    try {
      console.log("🚀 Starte Chrome...");
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
      });
    } catch (err) {
      console.error("⚠️ Erster Start fehlgeschlagen:", err.message);
      console.log("🔁 Neuer Versuch in 3 Sekunden...");
      await new Promise((r) => setTimeout(r, 3000));

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
      });
    }

    const page = await browser.newPage();
    console.log(`🌐 Lade ${searchUrl} ...`);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 90000 });

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
    console.error("❌ Crawler-Fehler:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`✅ Fahregut-Crawler läuft auf Port ${PORT}`));
