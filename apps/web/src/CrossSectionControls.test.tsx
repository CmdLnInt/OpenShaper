import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CrossSectionControls } from './CrossSectionControls';
import { lengthUnitByKey } from './format';
import { setPointer } from './test/viewport';

/**
 * The cluster has to shed controls on touch, and the point of these tests is that
 * shedding them from the header does not lose them.
 *
 * At 360px the seven icon buttons plus the position field measured 362px against a
 * 334px header, so Copy and Paste sat entirely off-screen — present in the DOM,
 * unreachable by a user. Raising everything to the 44px touch floor made it 480px.
 * The overflow menu is what buys the room back, so what matters is that all four
 * editing actions still run, and that a mouse still gets the dense row.
 */

const units = lengthUnitByKey('cm');

const props = (over: Partial<Parameters<typeof CrossSectionControls>[0]> = {}) => ({
  index: 2,
  total: 5,
  onPrev: vi.fn(),
  onNext: vi.fn(),
  onAdd: vi.fn(),
  onDelete: vi.fn(),
  onCopy: vi.fn(),
  onPaste: vi.fn(),
  canPaste: true,
  positionCm: 90,
  units,
  onMoveTo: vi.fn(),
  ...over,
});

const overflow = () => screen.getByRole('button', { name: 'More cross-section actions' });

afterEach(() => setPointer('fine'));

describe('the cross-section cluster with a mouse', () => {
  it('keeps every action as its own button', () => {
    render(<CrossSectionControls {...props()} />);
    for (const label of ['Add', 'Delete', 'Copy', 'Paste']) {
      expect(
        screen.getByRole('button', { name: new RegExp(`${label} cross-section`) }),
      ).toBeTruthy();
    }
    expect(screen.queryByRole('button', { name: 'More cross-section actions' })).toBeNull();
  });
});

describe('the cross-section cluster on a coarse pointer', () => {
  it('collapses the four editing actions into one overflow button', () => {
    setPointer('coarse');
    render(<CrossSectionControls {...props()} />);

    // Navigation and position stay in the header — that is what a phone is for.
    expect(screen.getByRole('button', { name: 'Previous cross-section' })).toBeTruthy();
    expect(screen.getByLabelText('Selected slice position')).toBeTruthy();

    // The editing actions are not header buttons any more...
    expect(screen.queryByRole('button', { name: 'Add cross-section' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Paste cross-section' })).toBeNull();
    // ...they are behind this.
    expect(overflow()).toBeTruthy();
  });

  it.each([
    ['Add cross-section here', 'onAdd'],
    ['Delete this cross-section', 'onDelete'],
    ['Copy this cross-section', 'onCopy'],
    ['Paste the copied shape here', 'onPaste'],
  ] as const)('still runs %s from the menu', (label, handler) => {
    setPointer('coarse');
    const p = props();
    render(<CrossSectionControls {...p} />);

    fireEvent.click(overflow());
    fireEvent.click(screen.getByRole('menuitem', { name: label }));

    expect(p[handler]).toHaveBeenCalledTimes(1);
  });

  it('gives the glyphs real labels, which a tooltip cannot do on touch', () => {
    // `Tooltip` suppresses itself for `pointerType === 'touch'` by design, so the
    // icon-only row was unlabeled text on a phone. Menu rows carry the words.
    setPointer('coarse');
    render(<CrossSectionControls {...props()} />);
    fireEvent.click(overflow());
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      'Add cross-section here',
      'Delete this cross-section',
      'Copy this cross-section',
      'Paste the copied shape here',
    ]);
  });

  it('says why a row is unavailable rather than just greying it', () => {
    setPointer('coarse');
    render(<CrossSectionControls {...props({ canPaste: false, total: 1 })} />);
    fireEvent.click(overflow());

    const paste = screen.getByRole('menuitem', { name: 'Paste the copied shape here' });
    expect(paste).toHaveProperty('disabled', true);
    expect(paste.getAttribute('title')).toBe('Nothing copied yet');

    const del = screen.getByRole('menuitem', { name: 'Delete this cross-section' });
    expect(del.getAttribute('title')).toBe('A board needs at least one cross-section');
  });
});
