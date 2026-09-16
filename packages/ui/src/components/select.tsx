import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/**
 * A native `<select>` matching the design system.
 *
 * Every select in the app was a hand-rolled `<select>` with its own class string —
 * five in the construction panel, one per export dialog, plus the two in
 * `view-toolkit`. They drifted in three ways that all show up on a phone:
 *
 *  - **Height.** They sat at 28-32px with no `pointer-coarse:` bump, so the one
 *    widget that opens a full-screen native picker was among the smallest targets
 *    on the screen.
 *  - **Font.** At 12-14px, iOS zooms the page when the control takes focus, and
 *    nothing zooms it back. 16px is the threshold, so the coarse size crosses it.
 *  - **The option popup.** On the dark theme a `bg-background` select renders its
 *    popup with the UA's own colours on some platforms; only `view-toolkit`'s copy
 *    had learnt to set `[&>option]` explicitly. That fix now applies everywhere.
 *
 * Callers that want the denser fine-pointer look pass `h-7 text-xs` through
 * `className`: `cn`'s tailwind-merge drops the base `h-8`/`text-sm` but leaves the
 * `pointer-coarse:` pair alone, because they are a different variant. So a compact
 * select stays compact with a mouse and still grows for a fingertip.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-card [&>option]:text-foreground pointer-coarse:h-11 pointer-coarse:text-base',
      className,
    )}
    {...props}
  />
));
Select.displayName = 'Select';
