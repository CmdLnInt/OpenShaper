import { render, screen } from '@testing-library/react';
import { Select, Textarea } from '@openshaper/ui';
import { describe, expect, it } from 'vitest';
import { Sel, UnitSelect } from './view-toolkit';

/**
 * The coarse-pointer floor survives a caller's compact override.
 *
 * This is the one claim the design system rests on that is not obvious, and it has
 * been got wrong twice in review: `Sel` renders at `h-7 text-xs` so the editor stays
 * dense with a mouse, and the question is whether that also cancels the
 * `pointer-coarse:` pair the primitive sets. It does not — tailwind-merge treats a
 * variant-prefixed utility as a different key from its bare form, so `h-7` replaces
 * `h-8` and leaves `pointer-coarse:h-11` standing.
 *
 * jsdom has no layout engine, so this asserts on the merged class list rather than a
 * measured box. The rendered sizes are covered in a real browser by
 * `e2e/tap-targets.spec.ts`; what is pinned here is the merge rule those numbers
 * depend on, because a tailwind-merge upgrade that changed it would otherwise
 * silently drop every touch target in the app back to its fine-pointer size.
 */
describe('the coarse-pointer touch floor', () => {
  it('is set by the Select primitive', () => {
    render(
      <Select aria-label="plain">
        <option value="a">A</option>
      </Select>,
    );
    const el = screen.getByLabelText('plain');
    expect(el.className).toContain('pointer-coarse:h-11');
    expect(el.className).toContain('pointer-coarse:text-base');
  });

  it('survives the compact override a dense pane header asks for', () => {
    render(
      <Sel value="a" onChange={() => {}} options={[{ value: 'a', label: 'A' }]} title="compact" />,
    );
    const el = screen.getByTitle('compact');
    // The fine-pointer size is the caller's...
    expect(el.className).toContain('h-7');
    expect(el.className).not.toContain('h-8');
    // ...and the touch size is still the primitive's.
    expect(el.className).toContain('pointer-coarse:h-11');
    expect(el.className).toContain('pointer-coarse:text-base');
  });

  it('survives the palette override the toolbar unit picker asks for', () => {
    render(<UnitSelect value="cm" onChange={() => {}} />);
    const el = screen.getByLabelText('Display units');
    expect(el.className).toContain('bg-card');
    expect(el.className).not.toContain('bg-background');
    expect(el.className).toContain('pointer-coarse:h-11');
  });

  it('lifts the comments box over the iOS focus-zoom threshold', () => {
    // 16px is the threshold below which iOS zooms the page on focus and does not
    // zoom back. This was the last field in the editor under it.
    render(<Textarea aria-label="notes" />);
    expect(screen.getByLabelText('notes').className).toContain('pointer-coarse:text-base');
  });
});
