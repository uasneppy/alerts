import TelegramBot from 'node-telegram-bot-api';
import puppeteer from 'puppeteer';
import chromium from '@sparticuz/chromium';
import dotenv from 'dotenv';

import { fetchLatestChannelMessages, formatChannelMessages } from './channelMessages.js';

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
export const ALERT_CANVAS_SELECTORS = Object.freeze([
  '#alerts-map canvas',
  '.leaflet-pane canvas',
  '.mapboxgl-canvas',
  'canvas',
]);

const ensureSelectors = (selectors) => {
  if (!Array.isArray(selectors) || !selectors.length) {
    throw new Error('A non-empty selectors array is required');
  }
  return selectors;
};

export function generateCanvasDataUrl(root, selectors) {
  if (!root || typeof root.querySelector !== 'function') {
    throw new Error('A root with querySelector is required');
  }

  const selectorsProvided = arguments.length >= 2;
  const searchSelectors = selectorsProvided ? selectors : ALERT_CANVAS_SELECTORS;
  const validatedSelectors = ensureSelectors(searchSelectors);

  for (const selector of validatedSelectors) {
    const node = root.querySelector(selector);
    if (node && typeof node.toDataURL === 'function') {
      return node.toDataURL('image/png');
    }
  }

  return null;
}

const toArray = (collection) => {
  if (!collection) return [];
  return Array.isArray(collection) ? collection : Array.from(collection);
};

export function isolateMapLayout(root, selector) {
  if (!root || typeof root.querySelector !== 'function') {
    throw new Error('A root with querySelector is required');
  }

  if (typeof selector !== 'string' || !selector.trim()) {
    throw new Error('A map selector string is required');
  }

  const mapElement = root.querySelector(selector);
  if (!mapElement) return false;

  const siblings = toArray(root.body?.children);
  siblings.forEach((child) => {
    if (child !== mapElement && child?.style) {
      child.style.display = 'none';
    }
  });

  const style = mapElement.style ?? (mapElement.style = {});
  Object.assign(style, { position: 'absolute', top: '0', left: '0', width: '100%', height: '100%' });

  if (typeof mapElement.scrollIntoView === 'function') {
    mapElement.scrollIntoView({ block: 'start', inline: 'start' });
  }

  return true;
}

export async function waitForAnySelector(page, selectors = ALERT_CANVAS_SELECTORS, options = {}) {
  if (!page || typeof page.waitForFunction !== 'function') {
    throw new Error('A Puppeteer page with waitForFunction is required');
  }

  const searchSelectors = ensureSelectors(selectors);

  try {
    await page.waitForFunction(
      (candidateSelectors) => candidateSelectors.some((selector) => Boolean(document.querySelector(selector))),
      options,
      searchSelectors
    );
    return true;
  } catch (error) {
    if (error?.name === 'TimeoutError') {
      return false;
    }
    throw error;
  }
}

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

    if (text.includes('чому тривога')) {
  try {
    // Тягнемо трохи більше, а потім самі обираємо останні 5
    const messages = await fetchLatestChannelMessages({ limit: 50 });

    // Підстрахуємось і відсортуємо за датою або message_id, якщо дата відсутня
    const sorted = [...messages].sort((a, b) => {
      const aKey = a.date ?? a.message_id ?? 0;
      const bKey = b.date ?? b.message_id ?? 0;
      return bKey - aKey; // новіші спочатку
    });

    const latestFive = sorted.slice(0, 5);
    const formatted = formatChannelMessages(latestFive);

    await bot.sendMessage(chatId, formatted);
  } catch (error) {
    console.error('Failed to fetch channel messages:', error);
    await bot.sendMessage(chatId, 'Не вдалося отримати повідомлення з каналу.');
  }
  return;
}

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
          '--disab