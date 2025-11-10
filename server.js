import express from "express";
import chromium from "chromium";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("✅ Fahregut Kleinanzeigen Auto-Crawler läuft auf Render!");
});

app.get("/crawl", async (req, res) => {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: chromium.path,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    // Simuliere echten Browser
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1366, height: 768 });
    await page.setExtraHTTPHeaders({
      "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
    });

    // Beispiel: Autos in Köln abrufen
    const url = "https://www.kleinanzeigen.de/s-autos/c216";
    await page.goto(url, { waitUntil: "domcontentloaded" });

    // Kurze Verzögerung, damit JS auf der Seite läuft
    await page.waitForTimeout(3000);

    // Titel und Anzahl Ergebnisse auslesen
    const title = await page.title();
    const firstItem = await page.$eval("article", el => el.innerText.slice(0, 80));

    await browser.close();

    res.send(`✅ ${title} – Beispielanzeige: ${firstItem}`);
  } catch (err) {
    console.error("Crawler-Fehler:", err);
    res.status(500).send("❌ Fehler beim Crawlen: " + err.message);
  }
});

app.listen(PORT, "0.0.0.0", () => console.log(`🚀 Server läuft auf Port ${PORT}`));
