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

export const dataUrlToBuffer = (dataUrl) => {
  if (!dataUrl) throw new Error('Data URL is required');
  const match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
  if (!match) throw new Error('Invalid PNG data URL');
  return Buffer.from(match[1], 'base64');
};

export const ALERT_CANVAS_SELECTORS = Object.freeze([
  '#screenshotCanvas',
  '#map canvas',
  'canvas.maplibregl-canvas',
  'canvas.mapboxgl-canvas',
  'canvas',
]);

export function generateCanvasDataUrl(root, selectors) {
  if (!root || typeof root.querySelector !== 'function') {
    throw new Error('A root with querySelector is required');
  }

  if (!Array.isArray(selectors) || selectors.length === 0) {
    throw new Error('A non-empty selectors array is required');
  }

  for (const selector of selectors) {
    const node = root.querySelector(selector);
    if (node && typeof node.toDataURL === 'function') {
      return node.toDataURL('image/png');
    }
  }

  return null;
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
      browser = await puppeteer.launch({ ...options, args: options.args ? [...options.args] : undefined });
      page = await browser.newPage();
      await page.goto('https://alerts.in.ua/', { waitUntil: 'networkidle0' });
      await page.waitForSelector(ALERT_CANVAS_SELECTORS.join(', '), { visible: true, timeout: 20000 });

      const generatorSource = `(${generateCanvasDataUrl.toString()})`;
      const dataUrl = await page.evaluate(
        ({ selectors, generatorSource }) => {
          const generateCanvasDataUrl = eval(generatorSource);
          return generateCanvasDataUrl(document, selectors);
        },
        { selectors: ALERT_CANVAS_SELECTORS, generatorSource }
      );

      const buffer = dataUrl ? dataUrlToBuffer(dataUrl) : await page.screenshot({ fullPage: true });
      await bot.sendPhoto(chatId, buffer);
    } catch (error) {
      console.error('Failed to send alert image:', error);
      await bot.sendMessage(chatId, 'Не вдалося отримати мапу тривог.');
    } finally {
      if (page) await page.close();
      if (browser) await browser.close();
    }
  });
}
