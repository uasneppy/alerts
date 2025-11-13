/**
 * Tests resolveLaunchOptions from bot.js to ensure Puppeteer launch
 * configuration covers manual overrides, chromium-provided binaries,
 * and fallback behavior. Run with `npm test`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockExecutablePath = vi.fn();

vi.mock('@sparticuz/chromium', () => ({
  default: {
    executablePath: mockExecutablePath,
    args: ['--mock-chromium-flag'],
    headless: true,
  },
}));

const loadModule = () => import('../bot.js');
const resetEnv = () => {
  delete process.env.CHROME_EXECUTABLE_PATH;
  delete process.env.PUPPETEER_EXECUTABLE_PATH;
};

describe('resolveLaunchOptions', () => {
  beforeEach(() => {
    vi.resetModules();
    mockExecutablePath.mockReset();
    resetEnv();
  });

  it('prefers a manually provided executable path', async () => {
    process.env.CHROME_EXECUTABLE_PATH = '/usr/bin/custom-chrome';
    const { resolveLaunchOptions } = await loadModule();
    const options = await resolveLaunchOptions();

    expect(options.executablePath).toBe('/usr/bin/custom-chrome');
    expect(options.args).toEqual(['--no-sandbox', '--disable-setuid-sandbox']);
    expect(mockExecutablePath).not.toHaveBeenCalled();
  });

  it('uses chromium binary details when available', async () => {
    mockExecutablePath.mockResolvedValue('/tmp/chromium');
    const { resolveLaunchOptions } = await loadModule();
    const options = await resolveLaunchOptions();

    expect(options.executablePath).toBe('/tmp/chromium');
    expect(options.args).toEqual(['--mock-chromium-flag']);
    expect(options.headless).toBe(true);
  });

  it('falls back to safe defaults when chromium lookup fails', async () => {
    mockExecutablePath.mockRejectedValue(new Error('missing binary'));
    const { resolveLaunchOptions } = await loadModule();
    const options = await resolveLaunchOptions();

    expect(options.executablePath).toBeUndefined();
    expect(options.args).toEqual(['--no-sandbox', '--disable-setuid-sandbox']);
    expect(options.headless).toBe('new');
  });
});
