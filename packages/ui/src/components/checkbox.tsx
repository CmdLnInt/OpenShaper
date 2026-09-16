import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export type CheckboxProps = InputHTMLAttributes<HTMLInputElement>;

/**
 * A checkbox matching the design system.
 *
 * Every checkbox in the app was a bare `<input type="checkbox">`, which the UA
 * renders at ~13px — the smallest target in the editor, well under the 24px
 * WCAG floor and less than a third of the 44px a fingertip wants. A native
 * checkbox cannot be grown with padding (the box is the control), so `size`
 * does the work: `accent-color` keeps the checked state on-brand without
 * rebuilding the control out of divs and losing the native semantics.
 *
 * Wrap it in a `<label>` so the text is part of the target too — that is what
 * makes the row comfortably tappable even at the smaller fine-pointer size.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        'size-4 shrink-0 cursor-pointer accent-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:size-6',
        className,
      )}
      {...props}
    />
  ),
);
Checkbox.displayName = 'Checkbox';
