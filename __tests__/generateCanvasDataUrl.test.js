/**
 * Tests generateCanvasDataUrl from bot.js to ensure the canvas fallback
 * chain handles valid canvases, skips invalid nodes, and throws on bad
 * inputs. Run with `npm test`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ALERT_CANVAS_SELECTORS, generateCanvasDataUrl } from '../bot.js';

const createCanvas = (label) => ({
  label,
  toDataURL: vi.fn(() => `${label}-data-url`),
});

const createRoot = (responses = {}) => ({
  querySelector: vi.fn((selector) => responses[selector] ?? null),
});

describe('generateCanvasDataUrl', () => {
  let root;

  beforeEach(() => {
    root = createRoot();
  });

  it('returns the first canvas that can render toDataURL', () => {
    const primary = createCanvas('primary');
    root.querySelector.mockImplementation((selector) => {
      if (selector === ALERT_CANVAS_SELECTORS[0]) return primary;
      return null;
    });

    const result = generateCanvasDataUrl(root, ALERT_CANVAS_SELECTORS);

    expect(result).toBe('primary-data-url');
    expect(primary.toDataURL).toHaveBeenCalledWith('image/png');
  });

  it('skips nodes that do not expose toDataURL', () => {
    const fallback = createCanvas('fallback');
    root.querySelector.mockImplementation((selector) => {
      if (selector === ALERT_CANVAS_SELECTORS[0]) {
        return { notCanvas: true };
      }
      if (selector === ALERT_CANVAS_SELECTORS[ALERT_CANVAS_SELECTORS.length - 1]) {
        return fallback;
      }
      return null;
    });

    const result = generateCanvasDataUrl(root, ALERT_CANVAS_SELECTORS);

    expect(result).toBe('fallback-data-url');
    expect(fallback.toDataURL).toHaveBeenCalledTimes(1);
  });

  it('returns null when no selectors yield a usable canvas', () => {
    const result = generateCanvasDataUrl(root, ALERT_CANVAS_SELECTORS);

    expect(result).toBeNull();
    expect(root.querySelector).toHaveBeenCalledTimes(ALERT_CANVAS_SELECTORS.length);
  });

  it('throws when root lacks querySelector', () => {
    expect(() => generateCanvasDataUrl({}, ALERT_CANVAS_SELECTORS)).toThrow(
      'A root with querySelector is required'
    );
  });

  it.each([undefined, null, [], 'canvas'])('validates selectors input: %s', (selectors) => {
    expect(() => generateCanvasDataUrl(root, selectors)).toThrow(
      'A non-empty selectors array is required'
    );
  });
});
