import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_PROFILE = path.join(process.cwd(), '.chrome-mobile-profile-v2');
const OUTPUT_DIR = path.join(process.cwd(), 'screenshots', 'mobile_flow');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('Starting Chrome headless with CDP for Full Presentation Flow...');
const chromeProcess = spawn(CHROME_PATH, [
  '--headless=new',
  '--remote-debugging-port=9224',
  `--user-data-dir=${TEMP_PROFILE}`,
  '--disable-gpu',
  '--no-sandbox',
  '--disable-extensions',
  '--window-size=1200,1000',
  'about:blank',
]);

async function waitForCdp(retries = 30) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9224/json/list');
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
  throw new Error('Chrome CDP failed to start on 9224');
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

    // Emulate iPhone 15 Pro (430 x 932 @ 2x)
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 430,
      height: 932,
      deviceScaleFactor: 2,
      mobile: true,
    });

    const evaluate = async (fn) => {
      return await cdp.send('Runtime.evaluate', {
        expression: `(${fn.toString()})()`,
        awaitPromise: true,
      });
    };

    const takeScreenshot = async (filename) => {
      console.log(`Capturing ${filename}...`);
      const { data } = await cdp.send('Page.captureScreenshot', {
        format: 'png',
        fromSurface: true,
      });
      const outPath = path.join(OUTPUT_DIR, filename);
      fs.writeFileSync(outPath, Buffer.from(data, 'base64'));
      console.log(`Saved: ${outPath} (${Math.round((data.length * 0.75) / 1024)} KB)`);
    };

    // 1. Step 1: Main QR Menu (wait until dish cards are loaded)
    console.log('Navigating to Guest Menu...');
    await cdp.send('Page.navigate', { url: 'http://localhost:3000/#guest' });
    
    // Poll until cards appear
    for (let i = 0; i < 20; i++) {
      const res = await evaluate(() => document.querySelectorAll('.rounded-card').length);
      if (res?.result?.value > 0) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    await new Promise((r) => setTimeout(r, 1200));
    await takeScreenshot('01_asosiy_qr_menyu.png');

    // 2. Step 2: Dish detail modal
    console.log('Opening dish detail modal...');
    await evaluate(() => {
      const dishCards = document.querySelectorAll('.rounded-card');
      if (dishCards && dishCards.length > 0) {
        dishCards[0].click();
      }
    });
    await new Promise((r) => setTimeout(r, 1200));
    await takeScreenshot('02_taom_tafsiloti_modifikator.png');

    // Add to cart from modal
    console.log('Adding to cart...');
    await evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const addModalBtn = btns.find((b) => b.textContent && b.textContent.includes('Savatchaga'));
      if (addModalBtn) addModalBtn.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    // Also add second dish from list
    await evaluate(() => {
      const addBtns = Array.from(document.querySelectorAll('button')).filter((b) => b.textContent && b.textContent.includes('Qo\'shish'));
      if (addBtns.length > 1) addBtns[1].click();
    });
    await new Promise((r) => setTimeout(r, 800));

    // 3. Step 3: Open Cart Drawer
    console.log('Opening cart drawer...');
    await evaluate(() => {
      const banners = Array.from(document.querySelectorAll('div')).filter((el) => el.textContent && el.textContent.includes('Savatchada:'));
      if (banners.length > 0) banners[banners.length - 1].click();
    });
    await new Promise((r) => setTimeout(r, 1200));
    await takeScreenshot('03_savatcha_va_buyurtma.png');

    // Close cart drawer
    await evaluate(() => {
      const closeBtn = document.querySelector('button[aria-label="Yopish"]') || document.querySelector('.lucide-x');
      if (closeBtn) closeBtn.closest('button').click();
    });
    await new Promise((r) => setTimeout(r, 800));

    // 4. Step 4: Orders tab
    console.log('Opening Buyurtmalar tab...');
    await evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const ordersBtn = btns.find((b) => b.textContent && b.textContent.includes('Buyurtmalar'));
      if (ordersBtn) ordersBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1200));
    await takeScreenshot('04_buyurtmalar_holati.png');

    // 5. Step 5: Waiter tab
    console.log('Opening Ofitsiant tab...');
    await evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const waiterBtn = btns.find((b) => b.textContent && b.textContent.includes('Ofitsiant'));
      if (waiterBtn) waiterBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1200));
    await takeScreenshot('05_ofitsiantni_chaqirish.png');

    // 6. Step 6: Bill tab
    console.log('Opening Hisob tab...');
    await evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const billBtn = btns.find((b) => b.textContent && b.textContent.includes('Hisob'));
      if (billBtn) billBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1200));
    await takeScreenshot('06_joriy_hisob_chek.png');

    ws.close();
    console.log('All mobile screenshots captured successfully!');
  } catch (err) {
    console.error('Error in mobile flow:', err);
  } finally {
    chromeProcess.kill();
    try {
      fs.rmSync(TEMP_PROFILE, { recursive: true, force: true });
    } catch {}
  }
}

run();
