import express from "express";
import puppeteer from "puppeteer-core";
import chromium from "chromium";

const app = express();
const PORT = process.env.PORT || 3000;

// Health-Check Route (wichtig für Render)
app.get("/", (req, res) => {
  res.send("✅ Fahregut Auto-Crawler läuft auf Render!");
});

// Puppeteer Test
app.get("/crawl", async (req, res) => {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: chromium.path,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.goto("https://www.mobile.de", { waitUntil: "domcontentloaded" });
    const title = await page.title();

    await browser.close();

    res.send(`✅ Website geladen: ${title}`);
  } catch (err) {
    res.status(500).send("❌ Fehler beim Crawlen: " + err.message);
  }
});

// Serverstart
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server läuft auf Port ${PORT}`);
});
