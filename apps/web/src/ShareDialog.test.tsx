// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * The dialog is the last thing between a shaper and a public forum post
 * containing their name, so these tests weight the disclosure and the
 * failure paths as heavily as the happy one.
 *
 * jsdom has no `navigator.clipboard` at all, which makes the manual-copy
 * fallback the *default* path here — the success path is the one needing a stub.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseBrd } from '@openshaper/io';
import { SHARE_URL_MAX_CHARS } from '@openshaper/io';
import type { BezierBoard } from '@openshaper/kernel';
import { ShareDialog } from './ShareDialog';
import type { BoardMeta } from './file-io';
import sampleBrd from './sample-board.brd?raw';

const board = parseBrd(sampleBrd).board as BezierBoard;

/** Render with real `meta` state, so the inline fields' write-back is observable. */
function Harness({
  initialMeta = {},
  onCopied = () => {},
  onDownloadBoard = () => {},
  onClose = () => {},
}: {
  initialMeta?: BoardMeta;
  onCopied?: () => void;
  onDownloadBoard?: () => void;
  onClose?: () => void;
}) {
  const [meta, setMeta] = useState<BoardMeta>(initialMeta);
  return (
    <>
      <ShareDialog
        board={board}
        meta={meta}
        setMeta={setMeta}
        onCopied={onCopied}
        onDownloadBoard={onDownloadBoard}
        onClose={onClose}
      />
      {/* An attribute, not text: metadata rendered as text would match the
          dialog's own copy in every `getByText` query. */}
      <output data-testid="meta" data-meta={JSON.stringify(meta)} />
    </>
  );
}

/** Wait for the async encode to land. */
const linkReady = () => screen.findByText(/Link size:/);

const stubClipboard = (writeText = vi.fn().mockResolvedValue(undefined)) => {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
    writable: true,
  });
  return writeText;
};

afterEach(() => {
  // @ts-expect-error — removing the stub installed above, if any.
  delete navigator.clipboard;
  vi.restoreAllMocks();
});

describe('identification', () => {
  it('shows the model and designer read-only when both are set', async () => {
    render(<Harness initialMeta={{ model: 'Go Fish', designer: 'Ada L' }} />);
    await linkReady();

    expect(screen.getByText(/Go Fish/)).toBeTruthy();
    expect(screen.getByText(/Ada L/)).toBeTruthy();
    expect(screen.queryByLabelText('Board model')).toBeNull();
  });

  it.each([
    ['nothing at all', {}],
    ['only a model', { model: 'Go Fish' }],
    ['only a designer', { designer: 'Ada L' }],
  ])('offers inline fields when the board has %s', async (_label, initialMeta) => {
    render(<Harness initialMeta={initialMeta} />);
    await linkReady();

    // Both fields, prefilled with whatever exists — so a half-named board can
    // be completed rather than presenting a lopsided form.
    expect((screen.getByLabelText('Board model') as HTMLInputElement).value).toBe(
      (initialMeta as BoardMeta).model ?? '',
    );
    expect((screen.getByLabelText('Board designer') as HTMLInputElement).value).toBe(
      (initialMeta as BoardMeta).designer ?? '',
    );
  });

  it('writes the fields back to the board metadata, not just the link', async () => {
    render(<Harness />);
    await linkReady();

    fireEvent.change(screen.getByLabelText('Board model'), { target: { value: 'Mini Simmons' } });
    await waitFor(() =>
      expect(screen.getByTestId('meta').getAttribute('data-meta')).toContain('Mini Simmons'),
    );
  });

  it('keeps the fields mounted and focused while a name is typed', async () => {
    // The regression this file exists for. `named` was derived live, so with a
    // designer already set the FIRST character typed into the model made both
    // fields non-empty, collapsed the form to the read-only line, and unmounted
    // the input mid-word — only that character ever landed. On a phone the
    // on-screen keyboard closed with it, which reads as the dialog closing.
    render(<Harness initialMeta={{ designer: 'Jared' }} />);
    await linkReady();

    const field = () => screen.getByLabelText('Board model') as HTMLInputElement;
    field().focus();

    for (const value of ['j', 'ja', 'jar', 'jare', 'jared']) {
      fireEvent.change(field(), { target: { value } });
      // Still the same element, still focused — not a fresh node.
      expect(screen.queryByLabelText('Board model')).not.toBeNull();
      expect(document.activeElement).toBe(field());
      expect(field().value).toBe(value);
    }

    await waitFor(() =>
      expect(screen.getByTestId('meta').getAttribute('data-meta')).toContain('jared'),
    );
    // The read-only identification line must not take over mid-session.
    expect(screen.queryByText('jared —')).toBeNull();
  });

  it('does not offer the fields when the board already has both', async () => {
    render(<Harness initialMeta={{ model: 'Go Fish', designer: 'Ada L' }} />);
    await linkReady();

    expect(screen.queryByLabelText('Board model')).toBeNull();
  });

  it('still allows copying with the fields left blank', async () => {
    const writeText = stubClipboard();
    const onCopied = vi.fn();
    render(<Harness onCopied={onCopied} />);
    await linkReady();

    // Naming is offered, never required.
    expect(screen.getByLabelText('Board model')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await waitFor(() => expect(onCopied).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('#board=v1.'));
  });
});

describe('disclosure', () => {
  it('says the link is an editable snapshot that cannot be revoked', async () => {
    render(<Harness initialMeta={{ model: 'M', designer: 'D' }} />);
    await linkReady();

    const body = document.body.textContent ?? '';
    expect(body).toContain('editable snapshot');
    expect(body).toMatch(/cannot be updated or revoked/);
    expect(body).toMatch(/Anyone with the link/);
  });

  it('lists what travels and what does not', async () => {
    render(<Harness initialMeta={{ model: 'M', designer: 'D' }} />);
    await linkReady();

    const body = document.body.textContent ?? '';
    expect(body).toMatch(/Trace images/);
    expect(body).toMatch(/comparison ghost/);
    expect(body).toMatch(/Undo history/);
    expect(body).toMatch(/cross-section/);
  });

  it('shows the size but never the URL itself', async () => {
    render(<Harness initialMeta={{ model: 'M', designer: 'D' }} />);
    await linkReady();

    // A three-kilobyte URL in the dialog would be unreadable and would put the
    // payload on screen (and into a screenshot) for no benefit.
    expect(screen.getByText(/Link size: \d/)).toBeTruthy();
    expect(document.body.textContent).not.toContain('#board=');
  });

  it('excludes itself from PostHog capture and replay', async () => {
    const { container } = render(<Harness initialMeta={{ model: 'M', designer: 'D' }} />);
    await linkReady();

    expect(container.querySelector('.ph-no-capture')).toBeTruthy();
  });
});

describe('copying', () => {
  it('reports success once and does not reveal the URL field', async () => {
    stubClipboard();
    const onCopied = vi.fn();
    render(<Harness initialMeta={{ model: 'M', designer: 'D' }} onCopied={onCopied} />);
    await linkReady();

    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await waitFor(() => expect(onCopied).toHaveBeenCalledTimes(1));
    expect(screen.queryByLabelText(/copy this link manually/i)).toBeNull();
  });

  it('falls back to a selected read-only field when the clipboard refuses', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    const onCopied = vi.fn();
    const onClose = vi.fn();
    render(
      <Harness initialMeta={{ model: 'M', designer: 'D' }} onCopied={onCopied} onClose={onClose} />,
    );
    await linkReady();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    });

    const field = (await screen.findByLabelText(/copy this link manually/i)) as HTMLInputElement;
    expect(field.readOnly).toBe(true);
    expect(field.value).toContain('#board=v1.');
    expect(field.classList.contains('ph-no-capture')).toBe(true);
    // The dialog stays open and reports nothing — the user is copying now.
    expect(onCopied).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('uses the same fallback when there is no clipboard API at all', async () => {
    expect(navigator.clipboard).toBeUndefined();
    render(<Harness initialMeta={{ model: 'M', designer: 'D' }} />);
    await linkReady();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    });
    expect(await screen.findByLabelText(/copy this link manually/i)).toBeTruthy();
  });
});

describe('when a link will not do', () => {
  it('offers the .board file when the browser has no Compression Streams', async () => {
    const real = globalThis.CompressionStream;
    // @ts-expect-error — simulating an old browser.
    delete globalThis.CompressionStream;
    try {
      const onDownloadBoard = vi.fn();
      const onClose = vi.fn();
      render(<Harness onDownloadBoard={onDownloadBoard} onClose={onClose} />);

      expect(await screen.findByText(/no Compression Streams support/)).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Copy link' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Download .board' }));
      expect(onDownloadBoard).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.CompressionStream = real;
    }
  });

  it('warns but still copies a link past the warning threshold', async () => {
    // Drive the band from the real metadata rather than mocking the codec: a
    // giant comments field is the cheapest way to a genuinely long link.
    // ~33,800 characters of link: past the 30,000 warning, under the 50,000 limit.
    render(<Harness initialMeta={{ model: 'M', designer: 'D', comments: randomish(30_000) }} />);
    await linkReady();

    expect(screen.getByText(/some forums may truncate or reject it/)).toBeTruthy();
    expect(screen.getByText(/receives the complete board link/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeTruthy();
  });

  it('refuses a link past the hard limit and offers the file instead', async () => {
    const onDownloadBoard = vi.fn();
    render(
      <Harness
        // ~63,800 characters of link: past the 50,000 hard limit.
        initialMeta={{ model: 'M', designer: 'D', comments: randomish(60_000) }}
        onDownloadBoard={onDownloadBoard}
      />,
    );
    await linkReady();

    expect(screen.getByText(/too large to share as a link/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Copy link' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Download .board' }));
    expect(onDownloadBoard).toHaveBeenCalledTimes(1);
  });
});

/**
 * Poorly-compressible filler of a given length, deterministic across runs.
 *
 * It has to genuinely resist gzip or it cannot reach a size band at all:
 * `'x'.repeat(n)` compresses to nothing, and so does an LCG read from its low
 * bits. Measured with this xorshift, the generated link lands within a few
 * hundred characters of `length` — see the callers.
 */
function randomish(length: number): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let seed = 12345;
  let out = '';
  while (out.length < length) {
    seed ^= seed << 13;
    seed |= 0;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    seed |= 0;
    out += alphabet[(seed >>> 8) % alphabet.length];
  }
  return out;
}

describe('the thresholds these tests rely on', () => {
  it('is measured against the real limit, not a guess', () => {
    expect(SHARE_URL_MAX_CHARS).toBe(50_000);
  });
});
