/**
 * Tests waitForAnySelector from bot.js to ensure it resolves when
 * canvases appear, handles timeout fallbacks, rethrows unexpected
 * errors, and validates inputs. Run with `npm test`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ALERT_CANVAS_SELECTORS, waitForAnySelector } from '../bot.js';

const createPage = () => ({
  waitForFunction: vi.fn(),
});

describe('waitForAnySelector', () => {
  let page;

  beforeEach(() => {
    page = createPage();
  });

  it('resolves true when waitForFunction finds a selector', async () => {
    page.waitForFunction.mockResolvedValue(undefined);

    await expect(waitForAnySelector(page, ALERT_CANVAS_SELECTORS, { timeout: 1234 })).resolves.toBe(true);

    expect(page.waitForFunction).toHaveBeenCalledTimes(1);
    expect(page.waitForFunction.mock.calls[0][1]).toEqual({ timeout: 1234 });
    expect(page.waitForFunction.mock.calls[0][2]).toBe(ALERT_CANVAS_SELECTORS);
  });

  it('returns false when waitForFunction times out', async () => {
    const error = new Error('Timed out');
    error.name = 'TimeoutError';
    page.waitForFunction.mockRejectedValue(error);

    await expect(waitForAnySelector(page, ALERT_CANVAS_SELECTORS)).resolves.toBe(false);
  });

  it('rethrows unexpected waitForFunction errors', async () => {
    const error = new Error('browser disconnected');
    page.waitForFunction.mockRejectedValue(error);

    await expect(waitForAnySelector(page, ALERT_CANVAS_SELECTORS)).rejects.toThrow('browser disconnected');
  });

  it('validates that a page with waitForFunction is provided', async () => {
    await expect(waitForAnySelector({}, ALERT_CANVAS_SELECTORS)).rejects.toThrow(
      'A Puppeteer page with waitForFunction is required'
    );
  });

  it('validates that selectors are provided', async () => {
    await expect(waitForAnySelector(page, [])).rejects.toThrow('A non-empty selectors array is required');
  });
});
