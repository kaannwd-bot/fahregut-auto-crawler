import express from "express";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium"; // 🧩 bessere Version für Serverumgebungen

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("🚗 Fahregut Auto-Crawler läuft!");
});

app.get("/crawl", async (req, res) => {
  const { marke = "", modell = "" } = req.query;
  const query = [marke, modell].filter(Boolean).join(" ");
  const searchUrl = `https://www.kleinanzeigen.de/s-autos/${encodeURIComponent(query)}/k0`;

  try {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: await chromium.executablePath(),
      args: chromium.args,
    });

    const page = await browser.newPage();
    await page.goto(searchUrl, { waitUntil: "domcontentloaded" });

    const cars = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll("article").forEach(el => {
        const title = el.querySelector("a h2")?.innerText || "";
        const price = el.querySelector(".price")?.innerText || "";
        const location = el.querySelector(".aditem-main--top--left")?.innerText || "";
        const details = el.querySelector(".aditem-main--middle")?.innerText || "";
        const image = el.querySelector("img")?.src || "https://via.placeholder.com/400x250?text=Auto";
        const url = el.querySelector("a")?.href ? "https://www.kleinanzeigen.de" + el.querySelector("a").getAttribute("href") : "";
        if (title && url) results.push({ title, price, location, details, image, url });
      });
      return results.slice(0, 10);
    });

    await browser.close();
    res.json(cars);
  } catch (err) {
    console.error("❌ Crawler-Fehler:", err);
    res.status(500).json({ error: "Crawler crash: " + err.message });
  }
});

app.listen(PORT, () => console.log(`✅ Fahregut-Crawler läuft auf Port ${PORT}`));
