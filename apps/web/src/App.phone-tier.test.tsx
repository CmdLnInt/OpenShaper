import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { setTier } from './test/viewport';
import { loadViewState, saveViewState, DEFAULT_VIEW_STATE } from './view-state';

vi.mock('@openshaper/render3d', () => ({ Board3DView: () => null }));

/**
 * Quad on a phone stacks four panes into ~1200px of scroll inside a ~740px
 * viewport, and every canvas sets `touch-action: none` — so most of that column
 * cannot be reached by the gesture a phone user would try. Phones get the single
 * views; every other tier is untouched.
 */

/** The view tabs, scoped — "Outline" and "Rocker" also label trace-panel buttons. */
const tabs = () => within(screen.getByRole('group', { name: 'Views' })).getAllByRole('button');
const tabNames = () => tabs().map((b) => b.textContent);

describe('the phone tier drops quad', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('offers no Quad tab on a phone, in either orientation', () => {
    setTier('phone');
    render(<App />);
    expect(tabNames()).toEqual(['Outline', 'Rocker', 'Cross-section', '3D']);
    expect(screen.getByRole('heading', { name: 'Outline' })).toBeTruthy();
  });

  it('counts a landscape phone as a phone — short, not narrow', () => {
    setTier('phoneLandscape');
    render(<App />);
    expect(tabNames()).not.toContain('Quad');
  });

  it('keeps Quad on a tablet and on a desktop', () => {
    setTier('tablet');
    const tablet = render(<App />);
    expect(tabNames()).toContain('Quad');
    tablet.unmount();

    setTier('desktop');
    render(<App />);
    expect(tabNames()).toContain('Quad');
  });

  it('renders Outline when the stored view is one this tier does not offer', () => {
    saveViewState({ ...DEFAULT_VIEW_STATE, view: 'quad' });
    setTier('phone');
    render(<App />);

    // A maximized pane, not the quad column: exactly one pane heading.
    expect(screen.queryByRole('heading', { name: 'Rocker (deck + bottom)' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Outline' })).toBeTruthy();
  });

  it('does not overwrite a stored Quad preference just because a phone opened it', () => {
    // The coercion is a render-time derivation, not a correction of the stored
    // value — otherwise opening the editor once on a phone would silently destroy
    // the preference the user set on their desktop.
    saveViewState({ ...DEFAULT_VIEW_STATE, view: 'quad' });
    setTier('phone');
    render(<App />);

    expect(loadViewState().view).toBe('quad');
  });

  it('ignores the number key for a view this tier does not offer', () => {
    setTier('phone');
    render(<App />);

    fireEvent.keyDown(window, { key: '3' }); // rocker — available
    expect(screen.getByRole('heading', { name: 'Rocker (deck + bottom)' })).toBeTruthy();

    fireEvent.keyDown(window, { key: '1' }); // quad — not available, must be a no-op
    expect(screen.getByRole('heading', { name: 'Rocker (deck + bottom)' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Outline' })).toBeNull();
  });
});
