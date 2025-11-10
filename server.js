import express from "express";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import chromium from "chromium";

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("✅ Fahregut Kleinanzeigen Auto-Crawler läuft auf Render!");
});

app.get("/crawl", async (req, res) => {
  try {
    // Puppeteer NUR HIER starten (nicht beim Serverstart)
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: chromium.path,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"
    );

    await page.goto("https://www.kleinanzeigen.de/s-autos/c216", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    const title = await page.title();
    await browser.close();

    res.send(`✅ Website geladen: ${title}`);
  } catch (err) {
    console.error(err);
    res.send(`❌ Fehler beim Crawlen: ${err.message}`);
  }
});

app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));
