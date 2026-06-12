import { describe, expect, it } from 'bun:test';
import { parseTagClasses } from '../src/annotations';

describe('parseTagClasses', () => {
  it('returns undefined when there is no tag class', () => {
    expect(parseTagClasses('just a plain doc comment')).toBeUndefined();
    expect(parseTagClasses('')).toBeUndefined();
  });

  it('parses a single tag class with one key', () => {
    expect(parseTagClasses('@tree(parent: true)')).toEqual({ tree: { parent: true } });
  });

  it('coerces the value grammar: bool / number / quoted / bare word', () => {
    expect(parseTagClasses('@x(b: true, n: -1.5, q: "hi there", bare: position)')).toEqual({
      x: { b: true, n: -1.5, q: 'hi there', bare: 'position' },
    });
  });

  it('parses array values without splitting on inner commas', () => {
    expect(parseTagClasses('@search(on: [name, email], weights: [1, 2])')).toEqual({
      search: { on: ['name', 'email'], weights: [1, 2] },
    });
  });

  it('parses multiple tag classes on one line', () => {
    expect(parseTagClasses('@tree(parent: true) @order(by: position, dir: asc)')).toEqual({
      tree: { parent: true },
      order: { by: 'position', dir: 'asc' },
    });
  });

  it('merges keys across repeated tag classes (later wins)', () => {
    expect(parseTagClasses('@tree(parent: true)\n@tree(parent: false, root: true)')).toEqual({
      tree: { parent: false, root: true },
    });
  });

  it('ignores prose around a tag class', () => {
    expect(parseTagClasses('the parent pointer @tree(parent: true) — see docs')).toEqual({
      tree: { parent: true },
    });
  });
});
