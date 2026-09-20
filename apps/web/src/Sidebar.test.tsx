// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * The sidebar as an accordion: what a shut section still tells you, what the master
 * toggle does to all of them at once, and the desktop fold-to-rail.
 *
 * Rendered through `<App />` rather than in isolation because the behaviour under test
 * is the wiring — the shell owns `SidebarState`, decides per-view relevance and feeds
 * both mounts — and a hand-built props object would assert none of that.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { SIDEBAR_SECTIONS } from './sidebar-sections';
import { setTier } from './test/viewport';

vi.mock('@openshaper/render3d', () => ({ Board3DView: () => null }));

const header = (name: string) => screen.getByRole('button', { name });
const isOpen = (name: string) => header(name).getAttribute('aria-expanded') === 'true';
const panels = () => screen.getByRole('complementary', { name: 'Board panels' });
const masterToggle = () => screen.getByRole('button', { name: /(Collapse|Expand) all sections/ });

/** Every section that is on screen, open or shut. */
const presentTitles = () =>
  SIDEBAR_SECTIONS.map((s) => s.title).filter(
    (title) => screen.queryByRole('button', { name: title }) !== null,
  );

beforeEach(() => {
  localStorage.clear();
  setTier('desktop');
});

describe('the sidebar accordion', () => {
  it('shows every section as a readable header, not a scroll of open panels', async () => {
    render(<App />);
    await screen.findAllByText(/[\d.]+ liters/);

    // Ten sections; Compare needs a ghost and History needs an undo step, so a fresh
    // board shows eight. What matters is that each is *named* without scrolling to it.
    expect(presentTitles()).toEqual([
      'Specs',
      'Resize',
      'Control point',
      'Analysis',
      'Board info',
      'Fins',
      'Weight estimate',
      'Trace image',
    ]);
  });

  it('unmounts a shut section rather than hiding it', async () => {
    render(<App />);
    await screen.findAllByText(/[\d.]+ liters/);

    // Board info starts shut: its fields must not be in the DOM at all, or every
    // collapsed section keeps re-rendering on each drag of a control point.
    expect(isOpen('Board info')).toBe(false);
    expect(screen.queryByPlaceholderText('Comments…')).toBeNull();

    fireEvent.click(header('Board info'));
    expect(isOpen('Board info')).toBe(true);
    expect(screen.getByPlaceholderText('Comments…')).toBeTruthy();
  });

  it('keeps a shut section worth reading, via its summary', async () => {
    render(<App />);
    await screen.findAllByText(/[\d.]+ liters/);

    // Weight is shut by default and still answers the question it exists for.
    expect(isOpen('Weight estimate')).toBe(false);
    expect(within(panels()).getByText(/\d+(\.\d+)? kg/)).toBeTruthy();
  });

  it('does not let a summary bleed into the section name', async () => {
    render(<App />);
    await screen.findAllByText(/[\d.]+ liters/);

    // The summary lives inside the header button, so without an explicit label the
    // accessible name drifts with the board — "Weight estimate2.44 kg (5.4 lb)".
    expect(header('Weight estimate')).toBeTruthy();
  });

  it('names a section that is gated out of the sidebar entirely', async () => {
    render(<App />);
    await screen.findAllByText(/[\d.]+ liters/);

    // No ghost board loaded, so Compare has nothing to say and no header to promise it.
    expect(screen.queryByRole('button', { name: 'Compare (Δ vs ghost)' })).toBeNull();
  });
});

describe('the master collapse toggle', () => {
  it('shuts every section in one click', async () => {
    render(<App />);
    await screen.findAllByText(/[\d.]+ liters/);
    expect(presentTitles().some(isOpen)).toBe(true);

    fireEvent.click(masterToggle());
    expect(presentTitles().every((t) => !isOpen(t))).toBe(true);
  });

  it('opens every section on the next click', async () => {
    render(<App />);
    await screen.findAllByText(/[\d.]+ liters/);

    fireEvent.click(masterToggle()); // collapse all
    fireEvent.click(masterToggle()); // expand all
    expect(presentTitles().every(isOpen)).toBe(true);
  });

  it('survives a view change, which is what stops it reading as broken', async () => {
    render(<App />);
    await screen.findAllByText(/[\d.]+ liters/);

    fireEvent.click(masterToggle());
    // Switching view re-runs the per-view relevance rule; collapse-all marks every
    // section as the user's, so the rule must decline to re-open any of them.
    fireEvent.click(screen.getByRole('button', { name: 'Outline' }));
    expect(presentTitles().every((t) => !isOpen(t))).toBe(true);
  });

  it('flips its label with its direction', async () => {
    render(<App />);
    await screen.findAllByText(/[\d.]+ liters/);

    expect(screen.getByRole('button', { name: 'Collapse all sections' })).toBeTruthy();
    fireEvent.click(masterToggle());
    expect(screen.getByRole('button', { name: 'Expand all sections' })).toBeTruthy();
  });
});

describe('per-view relevance', () => {
  it('opens the trace controls in a view that can hold a trace', async () => {
    render(<App />);
    await screen.findAllByText(/[\d.]+ liters/);

    fireEvent.click(screen.getByRole('button', { name: 'Outline' }));
    expect(isOpen('Trace image')).toBe(true);
  });

  it('shuts them again where there is nothing to trace over', async () => {
    render(<App />);
    await screen.findAllByText(/[\d.]+ liters/);

    fireEvent.click(screen.getByRole('button', { name: 'Outline' }));
    fireEvent.click(screen.getByRole('button', { name: '3D' }));
    expect(isOpen('Trace image')).toBe(false);
  });

  it('never removes a section it considers irrelevant', async () => {
    render(<App />);
    await screen.findAllByText(/[\d.]+ liters/);
    const inQuad = presentTitles();

    fireEvent.click(screen.getByRole('button', { name: '3D' }));
    // Switching view may shut a tool. It may never be the reason one cannot be found.
    expect(presentTitles()).toEqual(inQuad);
  });

  it('defers to a section the user opened by hand', async () => {
    render(<App />);
    await screen.findAllByText(/[\d.]+ liters/);

    fireEvent.click(header('Weight estimate')); // Weight is never auto-relevant
    fireEvent.click(screen.getByRole('button', { name: 'Outline' }));
    fireEvent.click(screen.getByRole('button', { name: '3D' }));
    expect(isOpen('Weight estimate')).toBe(true);
  });

  it('defers to a section the user shut by hand', async () => {
    render(<App />);
    await screen.findAllByText(/[\d.]+ liters/);

    fireEvent.click(screen.getByRole('button', { name: 'Outline' }));
    fireEvent.click(header('Trace image')); // shut it although Outline wants it open
    fireEvent.click(screen.getByRole('button', { name: 'Rocker' }));
    expect(isOpen('Trace image')).toBe(false);
  });
});

describe('the desktop rail', () => {
  it('folds the sidebar away and keeps the headline dims', async () => {
    render(<App />);
    await screen.findAllByText(/[\d.]+ liters/);

    fireEvent.click(screen.getByRole('button', { name: 'Hide board panels' }));

    expect(screen.queryByRole('button', { name: 'Specs' })).toBeNull();
    // Issue #37 wanted the space back, not the readout — the rail keeps the dims.
    expect(screen.getByRole('button', { name: 'Show board panels' })).toBeTruthy();
    expect(screen.getByText(/liters/)).toBeTruthy();
  });

  it('comes back with the sections exactly as they were', async () => {
    render(<App />);
    await screen.findAllByText(/[\d.]+ liters/);

    fireEvent.click(header('Board info'));
    fireEvent.click(screen.getByRole('button', { name: 'Hide board panels' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show board panels' }));

    expect(isOpen('Board info')).toBe(true);
  });

  it('is not offered in the bottom sheet, whose snap points already are the collapse', async () => {
    setTier('tablet');
    render(<App />);
    await screen.findAllByText(/[\d.]+ liters/);

    expect(screen.queryByRole('button', { name: 'Hide board panels' })).toBeNull();
    // The master toggle is still there — it is the one control that earns its place
    // at every tier.
    expect(masterToggle()).toBeTruthy();
  });
});

describe('the support link', () => {
  it('sits outside the scroll, so it is on screen at every scroll position', async () => {
    render(<App />);
    await screen.findAllByText(/[\d.]+ liters/);

    const link = within(panels()).getByRole('link', { name: /coffee/i });
    // Being a sibling of the scrolling section list rather than its last child is the
    // whole point: as the eleventh panel it was never rendered on screen at all.
    expect(link.parentElement).toBe(panels());
  });

  it('follows the sidebar into the bottom sheet', async () => {
    setTier('phone');
    render(<App />);
    await screen.findAllByText(/[\d.]+ liters/);

    expect(within(panels()).getByRole('link', { name: /coffee/i })).toBeTruthy();
  });

  it('survives the fold, as the one thing on the rail besides the dims', async () => {
    render(<App />);
    await screen.findAllByText(/[\d.]+ liters/);

    fireEvent.click(screen.getByRole('button', { name: 'Hide board panels' }));
    expect(screen.getByRole('link', { name: 'Buy me a coffee' })).toBeTruthy();
  });
});
