import express from "express";
import puppeteer from "puppeteer";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", async (req, res) => {
  res.send("🚗 Fahregut Auto-Crawler läuft!");
});

app.get("/crawl", async (req, res) => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  await page.goto("https://www.mobile.de", { waitUntil: "domcontentloaded" });
  const title = await page.title();

  await browser.close();

  res.send(`✅ Website geladen: ${title}`);
});

app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
