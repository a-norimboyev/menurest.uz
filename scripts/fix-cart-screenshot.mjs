import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_PROFILE = path.join(process.cwd(), '.chrome-cart-profile-2');
const OUTPUT_DIR = path.join(process.cwd(), 'screenshots', 'mobile_flow');

const chromeProcess = spawn(CHROME_PATH, [
  '--headless=new',
  '--remote-debugging-port=9226',
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
      const res = await fetch('http://127.0.0.1:9226/json/list');
      if (res.ok) {
        const list = await res.json();
        const page = list.find((t) => t.type === 'page');
        if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Chrome CDP failed to start on 9226');
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
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    const cdp = new CdpClient(ws);
    await cdp.send('Page.enable');
    await cdp.send('DOM.enable');
    await cdp.send('Runtime.enable');

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 430,
      height: 932,
      deviceScaleFactor: 2,
      mobile: true,
    });

    await cdp.send('Page.navigate', { url: 'http://localhost:3000/#guest' });
    await new Promise((r) => setTimeout(r, 3000));

    // 1. Click first dish
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const cards = document.querySelectorAll('.rounded-card');
        if (cards[0]) cards[0].click();
      })()`,
    });
    await new Promise((r) => setTimeout(r, 1000));

    // 2. Click "Savatchaga qo'shish" inside modal
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const addBtn = btns.find(b => b.textContent && b.textContent.includes('Savatchaga'));
        if (addBtn) addBtn.click();
      })()`,
    });
    await new Promise((r) => setTimeout(r, 1000));

    // 3. Click second dish and add it too
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const cards = document.querySelectorAll('.rounded-card');
        if (cards[1]) cards[1].click();
      })()`,
    });
    await new Promise((r) => setTimeout(r, 1000));

    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const addBtn = btns.find(b => b.textContent && b.textContent.includes('Savatchaga'));
        if (addBtn) addBtn.click();
      })()`,
    });
    await new Promise((r) => setTimeout(r, 1000));

    // 4. Click the floating cart banner
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const banners = Array.from(document.querySelectorAll('div')).filter(el => el.textContent && el.textContent.includes('Savatchada:'));
        if (banners.length > 0) banners[banners.length - 1].click();
      })()`,
    });
    await new Promise((r) => setTimeout(r, 1200));

    // Capture the clean cart drawer screenshot
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    const outPath = path.join(OUTPUT_DIR, '03_savatcha_va_buyurtma.png');
    fs.writeFileSync(outPath, Buffer.from(data, 'base64'));
    console.log(`Saved clean cart drawer to: ${outPath}`);

    ws.close();
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
