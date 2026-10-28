import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_PROFILE = path.join(process.cwd(), '.chrome-screenshot-profile');
const OUTPUT_DIR = path.join(process.cwd(), 'screenshots');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('Starting Chrome headless with CDP...');
const chromeProcess = spawn(CHROME_PATH, [
  '--headless=new',
  '--remote-debugging-port=9222',
  `--user-data-dir=${TEMP_PROFILE}`,
  '--disable-gpu',
  '--no-sandbox',
  '--disable-extensions',
  '--window-size=1920,1080',
  'about:blank',
]);

async function waitForCdp(retries = 30) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json/list');
      if (res.ok) {
        const list = await res.json();
        const page = list.find((t) => t.type === 'page');
        if (page && page.webSocketDebuggerUrl) {
          return page.webSocketDebuggerUrl;
        }
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Chrome CDP page target failed to start');
}

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.id = 1;
    this.callbacks = new Map();
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function captureScreen(cdp, { url, width, height, deviceScaleFactor = 2, delay = 2500, filename, runBeforeScreenshot = null }) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor,
    mobile: width < 600,
  });

  console.log(`Navigating to ${url}...`);
  await cdp.send('Page.navigate', { url });
  
  await new Promise((r) => setTimeout(r, delay));

  if (runBeforeScreenshot) {
    try {
      await cdp.send('Runtime.evaluate', {
        expression: `(${runBeforeScreenshot.toString()})()`,
        awaitPromise: true,
      });
      await new Promise((r) => setTimeout(r, 1200));
    } catch (e) {
      console.warn('Action failed:', e);
    }
  }

  console.log(`Capturing screenshot ${filename}...`);
  const { data } = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
  });

  const outPath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(outPath, Buffer.from(data, 'base64'));
  console.log(`Saved screenshot to: ${outPath} (${Math.round(data.length * 0.75 / 1024)} KB)`);
}

async function run() {
  try {
    const wsUrl = await waitForCdp();
    console.log('Connected to CDP Page at:', wsUrl);

    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    const cdp = new CdpClient(ws);
    await cdp.send('Page.enable');
    await cdp.send('DOM.enable');
    await cdp.send('Runtime.enable');

    // 1. Mobile QR Menu (with mouth-watering food photos)
    await captureScreen(cdp, {
      url: 'http://localhost:3000/#guest',
      width: 430,
      height: 932,
      deviceScaleFactor: 2,
      delay: 3000,
      filename: '01_mijoz_qr_menyu.png',
    });

    // 2. Waiter / Live Orders (Zakazlar kelib tushishi)
    await captureScreen(cdp, {
      url: 'http://localhost:3000/#waiter',
      width: 1440,
      height: 900,
      deviceScaleFactor: 2,
      delay: 3000,
      filename: '02_zakazlar_tushishi_ofitsiant.png',
      runBeforeScreenshot: () => {
        // Switch to 'orders' or 'calls' tab if available
        const btns = Array.from(document.querySelectorAll('button'));
        const orderBtn = btns.find((b) => b.textContent && b.textContent.includes('Buyurtmalar'));
        if (orderBtn) orderBtn.click();
      },
    });

    // 3. Kassa & POS tizimi (To'lovlar, Chek, Stol hisobi)
    await captureScreen(cdp, {
      url: 'http://localhost:3000/#cashier',
      width: 1440,
      height: 900,
      deviceScaleFactor: 2,
      delay: 3000,
      filename: '03_kassa_pos_tolovlar.png',
    });

    // 4. Boss / Menejer Paneli (Stollar xaritasi & Boshqaruv)
    await captureScreen(cdp, {
      url: 'http://localhost:3000/#manager',
      width: 1440,
      height: 900,
      deviceScaleFactor: 2,
      delay: 3000,
      filename: '04_boss_boshqaruv_paneli.png',
    });

    ws.close();
    console.log('All screenshots captured successfully!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    chromeProcess.kill();
    try {
      fs.rmSync(TEMP_PROFILE, { recursive: true, force: true });
    } catch {}
  }
}

run();
