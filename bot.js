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

export const MAP_SELECTOR = '#map';

export function isolateMapLayout(root, selector = MAP_SELECTOR) {
  if (!root || typeof root.querySelector !== 'function') {
    throw new Error('A root with querySelector is required');
  }

  if (!selector || typeof selector !== 'string') {
    throw new Error('A map selector string is required');
  }

  const map = root.querySelector(selector);
  if (!map) return false;

  const body = root.body ?? root;

  if (body?.style) {
    body.style.margin = '0';
    if ('padding' in body.style) body.style.padding = '0';
  }

  if (body?.children) {
    for (const child of Array.from(body.children)) {
      if (child !== map && child?.style) {
        child.style.display = 'none';
      }
    }
  }

  if (map.style) {
    map.style.position = 'absolute';
    map.style.top = '0';
    map.style.left = '0';
    map.style.width = '100%';
    map.style.height = '100%';
  }

  if (typeof map.scrollIntoView === 'function') {
    map.scrollIntoView({ block: 'start', inline: 'start' });
  }

  return true;
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

      const isolationSource = `(${isolateMapLayout.toString()})`;
      const mapPrepared = await page.evaluate(
        ({ selector, isolationSource }) => {
          const isolateMapLayout = eval(isolationSource);
          return isolateMapLayout(document, selector);
        },
        { selector: MAP_SELECTOR, isolationSource }
      );

      const mapHandle = await page.$(MAP_SELECTOR);
      const buffer = mapPrepared && mapHandle
        ? await mapHandle.screenshot({ type: 'png' })
        : await page.screenshot({ fullPage: true });
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
