/**
 * Tests isolateMapLayout from bot.js to ensure it hides non-map elements,
 * normalizes map sizing, and validates inputs. Run with `npm test`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isolateMapLayout } from '../bot.js';

const createElement = (id) => ({
  id,
  style: {},
  children: [],
  scrollIntoView: vi.fn(),
});

const createDom = () => {
  const elements = new Map();
  const body = { style: {}, children: [] };

  const register = (el) => {
    if (el.id) elements.set(`#${el.id}`, el);
    return el;
  };

  const append = (el) => {
    body.children.push(el);
    register(el);
  };

  const root = {
    body,
    querySelector: (selector) => elements.get(selector) ?? null,
  };

  return { root, body, append };
};

describe('isolateMapLayout', () => {
  let dom;
  let map;
  let sidebar;

  beforeEach(() => {
    dom = createDom();
    map = createElement('map');
    sidebar = createElement('sidebar');
    dom.append(map);
    dom.append(sidebar);
  });

  it('hides siblings and stretches the map area', () => {
    const result = isolateMapLayout(dom.root, '#map');

    expect(result).toBe(true);
    expect(map.style.position).toBe('absolute');
    expect(map.style.width).toBe('100%');
    expect(map.style.height).toBe('100%');
    expect(sidebar.style.display).toBe('none');
  });

  it('scrolls the map into view when supported', () => {
    isolateMapLayout(dom.root, '#map');
    expect(map.scrollIntoView).toHaveBeenCalledWith({ block: 'start', inline: 'start' });
  });

  it('returns false when the map selector is missing', () => {
    const result = isolateMapLayout(dom.root, '#missing');
    expect(result).toBe(false);
  });

  it('throws when root lacks querySelector', () => {
    expect(() => isolateMapLayout(null, '#map')).toThrowError('A root with querySelector is required');
  });

  it('throws when selector is not a string', () => {
    expect(() => isolateMapLayout(dom.root, null)).toThrowError('A map selector string is required');
  });
});
