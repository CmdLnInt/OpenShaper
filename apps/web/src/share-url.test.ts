// SPDX-License-Identifier: GPL-3.0-or-later
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SHARE_URL_MAX_CHARS, SHARE_URL_WARN_CHARS } from '@openshaper/io';
import { SITE_URL } from './seo/site';
import {
  buildShareUrl,
  copyToClipboard,
  isTauri,
  shareOrigin,
  shareSize,
  shareSizeLabel,
} from './share-url';

/** Install a fake Tauri global for the duration of one test. */
const asTauri = (key: '__TAURI_INTERNALS__' | '__TAURI__') => {
  (window as unknown as Record<string, unknown>)[key] = {};
  return () => {
    delete (window as unknown as Record<string, unknown>)[key];
  };
};

describe('origin', () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    delete (window as unknown as Record<string, unknown>).__TAURI__;
  });

  it('uses the page origin on the web', () => {
    expect(isTauri()).toBe(false);
    expect(shareOrigin()).toBe(window.location.origin);
  });

  it.each(['__TAURI_INTERNALS__', '__TAURI__'] as const)(
    'uses the public site URL under Tauri (%s)',
    (key) => {
      const restore = asTauri(key);
      try {
        expect(isTauri()).toBe(true);
        // The whole point: a desktop link must be openable by someone else, so
        // it can never carry the app's internal origin.
        expect(shareOrigin()).toBe(SITE_URL);
        expect(shareOrigin()).not.toBe(window.location.origin);
      } finally {
        restore();
      }
    },
  );

  it('puts the payload in the fragment of /app, never in a query parameter', () => {
    const url = buildShareUrl('v1.AAAA');
    expect(url).toBe(`${window.location.origin}/app#board=v1.AAAA`);
    expect(new URL(url).search).toBe('');
    expect(url).not.toContain('?');
  });
});

describe('size bands', () => {
  const urlOfLength = (n: number) => 'x'.repeat(n);

  it.each([
    ['well under the warning', 3_000, 'ok'],
    ['exactly at the warning', SHARE_URL_WARN_CHARS, 'ok'],
    ['one past the warning', SHARE_URL_WARN_CHARS + 1, 'warn'],
    ['exactly at the limit', SHARE_URL_MAX_CHARS, 'warn'],
    ['one past the limit', SHARE_URL_MAX_CHARS + 1, 'reject'],
  ])('%s', (_label, length, expected) => {
    expect(shareSize(urlOfLength(length))).toBe(expected);
  });

  it('labels the size without revealing the URL', () => {
    expect(shareSizeLabel(urlOfLength(512))).toBe('512 bytes');
    expect(shareSizeLabel(urlOfLength(2987))).toBe('2.9 KB');
  });
});

describe('clipboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports failure rather than throwing when there is no clipboard', async () => {
    // jsdom's default: navigator.clipboard is undefined. This is also the
    // WebView-refuses case, and it must reach the manual-copy fallback.
    expect(navigator.clipboard).toBeUndefined();
    await expect(copyToClipboard('x')).resolves.toBe(false);
  });

  it('reports failure when the write is rejected', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    await expect(copyToClipboard('x')).resolves.toBe(false);
  });

  it('reports success and writes the exact text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await expect(copyToClipboard('https://openshaper.com/app#board=v1.AA')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('https://openshaper.com/app#board=v1.AA');
  });
});
