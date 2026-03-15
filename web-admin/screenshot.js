import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const pages = [
  { name: 'dashboard', url: 'http://localhost:5174/' },
  { name: 'advertisers', url: 'http://localhost:5174/advertisers' },
  { name: 'campaigns', url: 'http://localhost:5174/campaigns' },
  { name: 'creatives', url: 'http://localhost:5174/creatives' },
  { name: 'targeting', url: 'http://localhost:5174/targeting' },
  { name: 'reports-overview', url: 'http://localhost:5174/reports/overview' },
  { name: 'reports-advertiser', url: 'http://localhost:5174/reports/advertiser' },
  { name: 'reports-campaign', url: 'http://localhost:5174/reports/campaign' },
];

async function takeScreenshots() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  for (const pageInfo of pages) {
    console.log(`Capturing: ${pageInfo.name}`);
    try {
      await page.goto(pageInfo.url, { waitUntil: 'networkidle0', timeout: 30000 });
      await page.waitForTimeout(2000);

      const screenshotPath = path.join(screenshotsDir, `${pageInfo.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`  Saved: ${screenshotPath}`);
    } catch (error) {
      console.error(`  Error capturing ${pageInfo.name}:`, error.message);
    }
  }

  await browser.close();
  console.log('\nDone! Screenshots saved to:', screenshotsDir);
}

takeScreenshots().catch(console.error);
