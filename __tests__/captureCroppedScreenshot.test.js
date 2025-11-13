/**
 * Tests captureCroppedScreenshot from bot.js to ensure screenshots are cropped
 * 70px on each side (or a custom padding) before being sent. Run with `npm test`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  captureCroppedScreenshot,
  DEFAULT_CROP_PADDING,
  TARGET_VIEWPORT,
} from '../bot.js';

const createPage = ({ width = TARGET_VIEWPORT.width, height = TARGET_VIEWPORT.height } = {}) => ({
  viewport: vi.fn(() => ({ width, height })),
  screenshot: vi.fn().mockResolvedValue(Buffer.from('png')),
});

describe('captureCroppedScreenshot', () => {
  let page;

  beforeEach(() => {
    page = createPage();
  });

  it('captures a PNG screenshot cropped by the default padding', async () => {
    const buffer = await captureCroppedScreenshot(page);

    expect(page.screenshot).toHaveBeenCalledWith({
      type: 'png',
      clip: {
        x: DEFAULT_CROP_PADDING,
        y: DEFAULT_CROP_PADDING,
        width: TARGET_VIEWPORT.width - DEFAULT_CROP_PADDING * 2,
        height: TARGET_VIEWPORT.height - DEFAULT_CROP_PADDING * 2,
      },
    });
    expect(buffer.toString()).toBe('png');
  });

  it('allows customizing the padding per screenshot', async () => {
    page = createPage({ width: 1000, height: 800 });
    const padding = 50;

    await captureCroppedScreenshot(page, padding);

    expect(page.screenshot).toHaveBeenCalledWith({
      type: 'png',
      clip: { x: padding, y: padding, width: 900, height: 700 },
    });
  });

  it('throws when page lacks viewport or screenshot helpers', async () => {
    await expect(captureCroppedScreenshot({}, DEFAULT_CROP_PADDING)).rejects.toThrow(
      'A Puppeteer page with viewport and screenshot is required'
    );
  });

  it('throws when viewport info is missing', async () => {
    page.viewport = vi.fn(() => undefined);

    await expect(captureCroppedScreenshot(page, DEFAULT_CROP_PADDING)).rejects.toThrow(
      'A viewport with finite width and height is required before taking screenshots'
    );
  });

  it('throws when padding is invalid', async () => {
    await expect(captureCroppedScreenshot(page, -1)).rejects.toThrow(
      'Padding must be a non-negative finite number'
    );
    await expect(captureCroppedScreenshot(page, Infinity)).rejects.toThrow(
      'Padding must be a non-negative finite number'
    );
  });

  it('throws when padding exceeds viewport bounds', async () => {
    page = createPage({ width: 100, height: 100 });

    await expect(captureCroppedScreenshot(page, 100)).rejects.toThrow(
      'Padding is too large for the current viewport dimensions'
    );
  });
});
