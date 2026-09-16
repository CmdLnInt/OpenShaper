import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { setTier } from './test/viewport';

vi.mock('@openshaper/render3d', () => ({ Board3DView: () => null }));

/**
 * The bottom sheet's 112px peek is a quarter of a landscape phone's height, and
 * the point of turning the phone is to see the board — so on a short viewport it
 * starts out of the way, and the panels button is the way back.
 */

const sheet = () => screen.queryByRole('dialog', { name: 'Board panels' });
const panelsButton = () => screen.getByRole('button', { name: /board panels$/i });

describe('the bottom sheet on a short viewport', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts closed where height is scarcest', () => {
    setTier('phoneLandscape');
    render(<App />);
    expect(sheet(), 'a landscape phone opens on the board, not the panels').toBeNull();
  });

  it('still starts at peek in portrait, where the readout costs little', () => {
    setTier('phone');
    render(<App />);
    expect(sheet()).not.toBeNull();
  });

  it('is reachable again from the panels button, which is the only way back', () => {
    // A closed sheet has no drag handle, so if this button did not reopen it the
    // sidebar would be unreachable for the rest of the session.
    setTier('phoneLandscape');
    render(<App />);
    expect(sheet()).toBeNull();

    fireEvent.click(panelsButton());
    expect(sheet(), 'the button must open, not just toggle to another closed state').not.toBeNull();
  });

  it('toggles rather than only opening', () => {
    setTier('phoneLandscape');
    render(<App />);

    fireEvent.click(panelsButton()); // closed -> half
    expect(sheet()).not.toBeNull();
    fireEvent.click(panelsButton()); // half -> closed
    expect(sheet(), 'pressing it again should put the panels away').toBeNull();
  });

  it('opens from peek rather than closing, since peek is not "showing panels"', () => {
    setTier('phone');
    render(<App />);
    expect(sheet()).not.toBeNull(); // peek

    fireEvent.click(panelsButton());
    // Still open — at peek the button's job is to reveal the panels, not hide them.
    expect(sheet()).not.toBeNull();
  });
});
