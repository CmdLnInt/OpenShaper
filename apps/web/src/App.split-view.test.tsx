import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { setTier } from './test/viewport';
import { DEFAULT_VIEW_STATE, loadViewState, saveViewState } from './view-state';

vi.mock('@openshaper/render3d', () => ({ Board3DView: () => null }));

/**
 * Split view: two full-width panes stacked, each pointed at any of the four
 * views by a picker that stands in for its title. A desktop layout only —
 * halving a tablet's height leaves two panes too short to work in.
 */

const tabs = () => within(screen.getByRole('group', { name: 'Views' })).getAllByRole('button');
const tabNames = () => tabs().map((b) => b.textContent);
const splitTab = () => tabs().find((b) => b.textContent === 'Split')!;

const picker = (slot: 'Top' | 'Bottom') =>
  screen.getByLabelText(`${slot} pane view`) as HTMLSelectElement;
const pick = (slot: 'Top' | 'Bottom', value: string) =>
  fireEvent.change(picker(slot), { target: { value } });
/** The pane pairing currently on screen, top first. */
const panes = () => [picker('Top').value, picker('Bottom').value];

describe('the split view tab', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('is offered on a desktop', () => {
    setTier('desktop');
    render(<App />);
    expect(tabNames()).toEqual(['Quad', 'Outline', 'Rocker', 'Cross-section', '3D', 'Split']);
  });

  it('is withheld on a tablet and on a phone', () => {
    setTier('tablet');
    const tablet = render(<App />);
    expect(tabNames()).not.toContain('Split');
    tablet.unmount();

    setTier('phone');
    render(<App />);
    expect(tabNames()).not.toContain('Split');
  });

  it('renders Outline over Rocker by default', () => {
    setTier('desktop');
    render(<App />);
    fireEvent.click(splitTab());
    expect(panes()).toEqual(['outline', 'rocker']);
    // Two 2D panes, and no pane heading left — each title is its picker.
    expect(document.querySelectorAll('canvas')).toHaveLength(2);
    expect(screen.queryByRole('heading', { name: 'Outline' })).toBeNull();
  });

  it('is reachable by its number key, and only where it is offered', () => {
    setTier('desktop');
    const desktop = render(<App />);
    fireEvent.keyDown(window, { key: '6' });
    expect(panes()).toEqual(['outline', 'rocker']);
    desktop.unmount();

    setTier('tablet');
    render(<App />);
    fireEvent.keyDown(window, { key: '6' });
    expect(screen.queryByLabelText('Top pane view')).toBeNull();
  });
});

describe('choosing what each half shows', () => {
  beforeEach(() => {
    localStorage.clear();
    setTier('desktop');
  });

  const openSplit = () => {
    render(<App />);
    fireEvent.click(splitTab());
  };

  it('points a half at another view', () => {
    openSplit();
    pick('Bottom', 'crossSection');
    expect(panes()).toEqual(['outline', 'crossSection']);
    // The cross-section pane brings its station controls with it.
    expect(screen.getByRole('button', { name: /next cross-section/i })).toBeTruthy();
  });

  it('puts the 3D surface in a half', () => {
    openSplit();
    pick('Top', '3d');
    expect(panes()).toEqual(['3d', 'rocker']);
    expect(screen.getByTitle(/Draw the stringer line/)).toBeTruthy();
  });

  it('swaps the halves rather than showing one pane twice', () => {
    openSplit();
    pick('Top', 'rocker'); // the bottom's pane
    expect(panes()).toEqual(['rocker', 'outline']);

    pick('Bottom', 'rocker'); // and back
    expect(panes()).toEqual(['outline', 'rocker']);
  });

  it('restores a stored pairing', () => {
    saveViewState({
      ...DEFAULT_VIEW_STATE,
      view: 'split',
      split: { top: 'crossSection', bottom: 'outline' },
    });
    render(<App />);
    expect(panes()).toEqual(['crossSection', 'outline']);
  });

  it('falls back to a single view on a tier without split, keeping the preference', () => {
    saveViewState({ ...DEFAULT_VIEW_STATE, view: 'split' });
    setTier('tablet');
    render(<App />);

    expect(screen.queryByLabelText('Top pane view')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Outline' })).toBeTruthy();
    // Derived at render, not written back — widen the window and split returns.
    expect(loadViewState().view).toBe('split');
  });
});
