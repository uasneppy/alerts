import TelegramBot from 'node-telegram-bot-api';
import puppeteer from 'puppeteer';
import chromium from '@sparticuz/chromium';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.BOT_TOKEN;
const isTestEnv = process.env.NODE_ENV === 'test';
if (!token && !isTestEnv) throw new Error('BOT_TOKEN is required');

const createFallbackLaunchOptions = () => ({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

export const resolveLaunchOptions = async () => {
  const manualPath = process.env.CHROME_EXECUTABLE_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
  const fallback = createFallbackLaunchOptions();

  if (manualPath) {
    return { ...fallback, executablePath: manualPath };
  }

  try {
    const executablePath = await chromium.executablePath();
    if (!executablePath) return fallback;
    return {
      args: Array.isArray(chromium.args) && chromium.args.length ? [...chromium.args] : fallback.args,
      headless: typeof chromium.headless === 'boolean' ? chromium.headless : fallback.headless,
      executablePath,
    };
  } catch {
    return fallback;
  }
};

let cachedLaunchOptionsPromise;
const getLaunchOptions = () => {
  if (!cachedLaunchOptionsPromise) cachedLaunchOptionsPromise = resolveLaunchOptions();
  return cachedLaunchOptionsPromise;
};

export const TARGET_VIEWPORT = Object.freeze({ width: 2560, height: 1440, deviceScaleFactor: 1 });
export const DEFAULT_CROP_PADDING = 70;

export async function applyViewport(page, viewport = TARGET_VIEWPORT) {
  if (!page || typeof page.setViewport !== 'function') {
    throw new Error('A Puppeteer page with setViewport is required');
  }

  if (!viewport || typeof viewport !== 'object') {
    throw new Error('A viewport object is required');
  }

  const { width, height, deviceScaleFactor = 1 } = viewport;

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error('Viewport width and height must be finite numbers');
  }

  await page.setViewport({ width, height, deviceScaleFactor });
}

export async function captureCroppedScreenshot(page, padding = DEFAULT_CROP_PADDING) {
  if (!page || typeof page.screenshot !== 'function' || typeof page.viewport !== 'function') {
    throw new Error('A Puppeteer page with viewport and screenshot is required');
  }

  if (!Number.isFinite(padding) || padding < 0) {
    throw new Error('Padding must be a non-negative finite number');
  }

  const viewport = page.viewport();
  if (!viewport || !Number.isFinite(viewport.width) || !Number.isFinite(viewport.height)) {
    throw new Error('A viewport with finite width and height is required before taking screenshots');
  }

  const clipWidth = viewport.width - padding * 2;
  const clipHeight = viewport.height - padding * 2;

  if (clipWidth <= 0 || clipHeight <= 0) {
    throw new Error('Padding is too large for the current viewport dimensions');
  }

  return page.screenshot({
    type: 'png',
    clip: {
      x: padding,
      y: padding,
      width: clipWidth,
      height: clipHeight,
    },
  });
}

if (token) {
  const bot = new TelegramBot(token, { polling: true });

  bot.on('message', async (msg) => {
    const text = msg.text?.toLowerCase() ?? '';
    if (!text.includes('тривога')) return;

    const chatId = msg.chat.id;
    let browser;
    let page;

    try {
      const options = await getLaunchOptions();

      browser = await puppeteer.launch({
        ...options,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-infobars',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--js-flags=--max-old-space-size=4096',
          ...(options.args || []),
        ],
      });

      page = await browser.newPage();
      await applyViewport(page);

      await page.goto('https://alerts.in.ua/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      // Дай сторінці трохи часу підвантажити карту
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const buffer = await captureCroppedScreenshot(page);
      await bot.sendPhoto(chatId, buffer);
    } catch (error) {
      console.error('Failed to send alert image:', error);
      await bot.sendMessage(chatId, 'Не вдалося отримати мапу тривог.');
    } finally {
      if (page) {
        try {
          await page.close();
        } catch {}
      }
      if (browser) {
        try {
          await browser.close();
        } catch {}
      }
    }
  });
}
