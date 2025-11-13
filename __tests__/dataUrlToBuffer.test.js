/**
 * Tests bot.js dataUrlToBuffer helper to ensure PNG data URLs
 * are validated and converted correctly. Covers success, missing input,
 * and malformed data. Run with `npm test`.
 */
import { describe, it, expect } from 'vitest';
import { dataUrlToBuffer } from '../bot.js';

describe('dataUrlToBuffer', () => {
  it('converts a valid PNG data URL into a buffer', () => {
    const pngData = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';
    const url = `data:image/png;base64,${pngData}`;

    const buffer = dataUrlToBuffer(url);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('throws when data URL is missing', () => {
    expect(() => dataUrlToBuffer()).toThrowError('Data URL is required');
  });

  it.each([
    'data:image/jpeg;base64,abc',
    'not-a-data-url'
  ])('rejects invalid PNG data URLs: %s', (input) => {
    expect(() => dataUrlToBuffer(input)).toThrowError('Invalid PNG data URL');
  });
});
