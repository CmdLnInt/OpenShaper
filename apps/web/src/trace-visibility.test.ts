// SPDX-License-Identifier: GPL-3.0-or-later
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_TRACE_VISIBILITY,
  loadTraceVisibility,
  saveTraceVisibility,
  TRACE_VISIBILITY_VERSION,
} from './trace-visibility';

const KEY = 'bs.traceVisible';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('loadTraceVisibility', () => {
  it('defaults to visible when nothing is stored', () => {
    // The upgrade path: an existing user's traces must not disappear the first
    // time they load a build that has this file in it.
    expect(loadTraceVisibility()).toEqual({ outline: true, rocker: true });
  });

  it('round-trips both flags', () => {
    saveTraceVisibility({ outline: false, rocker: true });
    expect(loadTraceVisibility()).toEqual({ outline: false, rocker: true });
  });

  it.each([
    ['malformed JSON', '{{{not json'],
    ['a non-object', '42'],
    ['null', 'null'],
    ['a blob from another schema version', JSON.stringify({ outline: false, version: 99 })],
    ['a blob with no version', JSON.stringify({ outline: false, rocker: false })],
  ])('falls back to visible for %s', (_label, raw) => {
    localStorage.setItem(KEY, raw);
    // Visible is the safe direction: an invisible trace with no way to guess
    // why is the worse failure.
    expect(loadTraceVisibility()).toEqual(DEFAULT_TRACE_VISIBILITY);
  });

  it('fills a missing field rather than rejecting the whole blob', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ outline: false, version: TRACE_VISIBILITY_VERSION }),
    );
    expect(loadTraceVisibility()).toEqual({ outline: false, rocker: true });
  });

  it('survives a locked localStorage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(loadTraceVisibility()).toEqual(DEFAULT_TRACE_VISIBILITY);
  });
});

describe('saveTraceVisibility', () => {
  it('stamps the version', () => {
    saveTraceVisibility({ outline: false, rocker: false });
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({
      outline: false,
      rocker: false,
      version: TRACE_VISIBILITY_VERSION,
    });
  });

  it('swallows a quota failure', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => saveTraceVisibility({ outline: false, rocker: false })).not.toThrow();
  });
});
