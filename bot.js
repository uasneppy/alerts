import TelegramBot from 'node-telegram-bot-api';
import puppeteer from 'puppeteer';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.BOT_TOKEN;
const isTestEnv = process.env.NODE_ENV === 'test';
if (!token && !isTestEnv) throw new Error('BOT_TOKEN is required');

export const dataUrlToBuffer = (dataUrl) => {
  if (!dataUrl) throw new Error('Data URL is required');
  const match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
  if (!match) throw new Error('Invalid PNG data URL');
  return Buffer.from(match[1], 'base64');
};

if (token) {
  const bot = new TelegramBot(token, { polling: true });

  bot.on('message', async (msg) => {
    const text = msg.text?.toLowerCase() ?? '';
    if (!text.includes('тривога')) return;

    const chatId = msg.chat.id;
    let browser;
    let page;

    try {
      browser = await puppeteer.launch({ headless: 'new' });
      page = await browser.newPage();
      await page.goto('https://alerts.in.ua/', { waitUntil: 'networkidle0' });
      await page.waitForSelector('#screenshotCanvas', { visible: true });
      const dataUrl = await page.evaluate(() => {
        const canvas = document.getElementById('screenshotCanvas');
        return canvas?.toDataURL('image/png');
      });
      const buffer = dataUrlToBuffer(dataUrl);
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
