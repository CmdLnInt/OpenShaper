// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Share links: turning a codec fragment into an address someone else can open.
 *
 * The codec (`@openshaper/io` share-link.ts) knows nothing about origins — it
 * only produces the `v1.…` payload. This module is the app half: which origin
 * the link should point at, and whether the result is short enough to be worth
 * copying.
 *
 * The origin question exists because of the desktop build. In Tauri the page is
 * served from an internal scheme, so `location.origin` would produce a link only
 * that machine can open. A desktop user sharing to a forum needs the public web
 * address, which is what `SITE_URL` already is.
 */
import { SHARE_URL_MAX_CHARS, SHARE_URL_WARN_CHARS } from '@openshaper/io';
import { SITE_URL } from './seo/site';

/**
 * Whether we are running inside the Tauri WebView. Tauri v2 injects
 * `__TAURI_INTERNALS__`; `__TAURI__` is checked too so a build with
 * `withGlobalTauri` still reports correctly.
 */
export const isTauri = (): boolean =>
  typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

/** The origin a share link should point at: public web address, never an app-internal one. */
export const shareOrigin = (): string =>
  typeof window === 'undefined' || isTauri() ? SITE_URL : window.location.origin;

/** Assemble the full link. The payload is a fragment, so it never leaves the browser. */
export const buildShareUrl = (fragment: string): string => `${shareOrigin()}/app#board=${fragment}`;

/**
 * How a generated link measures up.
 *
 * - `ok`     — copy it.
 * - `warn`   — copyable, but long enough that some forums will mangle or reject it.
 * - `reject` — refuse, and offer the `.board` file instead.
 *
 * Measured on the *whole URL*, per the issue. The accept side measures the
 * payload alone (the codec's own cap), which is deliberately a touch more
 * permissive — the recipient's origin is not the sharer's, and a link
 * OpenShaper generates must always be one OpenShaper opens.
 */
export type ShareSize = 'ok' | 'warn' | 'reject';

export const shareSize = (url: string): ShareSize => {
  if (url.length > SHARE_URL_MAX_CHARS) return 'reject';
  if (url.length > SHARE_URL_WARN_CHARS) return 'warn';
  return 'ok';
};

/**
 * A human size for the link, so the dialog can say how big it is without
 * showing three kilobytes of URL. The payload is Base64URL, so one character is
 * one byte.
 */
export const shareSizeLabel = (url: string): string =>
  url.length < 1024 ? `${url.length} bytes` : `${(url.length / 1024).toFixed(1)} KB`;

/**
 * Copy text to the clipboard, reporting whether it worked.
 *
 * Never throws: a denied permission, an insecure context, a WebView without
 * clipboard support and jsdom (where `navigator.clipboard` is simply undefined)
 * all resolve `false`, which is the dialog's cue to reveal the manual-copy
 * field rather than to fail.
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};
