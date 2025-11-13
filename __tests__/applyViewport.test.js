/**
 * Tests applyViewport from bot.js to ensure every screenshot uses a 2K viewport
 * and invalid inputs fail fast. Run with `npm test`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { applyViewport, TARGET_VIEWPORT } from '../bot.js';

const createPage = () => ({
  setViewport: vi.fn().mockResolvedValue(undefined),
});

describe('applyViewport', () => {
  let page;

  beforeEach(() => {
    page = createPage();
  });

  it('applies the default 2K viewport dimensions', async () => {
    await applyViewport(page);

    expect(page.setViewport).toHaveBeenCalledWith({
      width: TARGET_VIEWPORT.width,
      height: TARGET_VIEWPORT.height,
      deviceScaleFactor: TARGET_VIEWPORT.deviceScaleFactor,
    });
  });

  it('allows overriding viewport dimensions', async () => {
    const override = { width: 3200, height: 1800, deviceScaleFactor: 2 };

    await applyViewport(page, override);

    expect(page.setViewport).toHaveBeenCalledWith(override);
  });

  it('throws when page lacks setViewport', async () => {
    await expect(applyViewport({}, TARGET_VIEWPORT)).rejects.toThrow(
      'A Puppeteer page with setViewport is required'
    );
  });

  it('throws when viewport object is missing', async () => {
    await expect(applyViewport(page, null)).rejects.toThrow('A viewport object is required');
  });

  it('throws when viewport width or height are not finite numbers', async () => {
    await expect(
      applyViewport(page, { width: Infinity, height: TARGET_VIEWPORT.height })
    ).rejects.toThrow('Viewport width and height must be finite numbers');
  });
});
