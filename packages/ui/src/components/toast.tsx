import { forwardRef, useEffect, useState, type HTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/cn';

const STACK_ID = 'os-toast-stack';

/**
 * The shared bottom-centre stack, created on first use.
 *
 * Toasts are raised from unrelated subtrees — the editor shell renders two of
 * them from independent conditionals, and the service-worker update prompt comes
 * from the route above it — so they have no common ancestor to lay them out.
 * Before this they were each `fixed bottom-28 left-1/2`, which put two toasts at
 * exactly the same coordinates: a save confirmation and an import notice landed
 * on top of each other, unreadable.
 *
 * `pointer-events-none` on the stack so the empty container never swallows a tap
 * meant for the canvas beneath it; each pill turns them back on.
 */
function toastStack(): HTMLElement {
  const existing = document.getElementById(STACK_ID);
  if (existing) return existing;
  const el = document.createElement('div');
  el.id = STACK_ID;
  // col-reverse: the first toast sits nearest the bottom anchor and later ones
  // stack upwards, so an arriving toast never displaces one being read.
  el.className =
    'pointer-events-none fixed bottom-[calc(var(--os-sheet-inset)+1rem)] left-1/2 z-50 flex -translate-x-1/2 flex-col-reverse items-center gap-2';
  document.body.appendChild(el);
  return el;
}

/**
 * Non-blocking notification pill. Purely presentational — the caller owns the
 * show/dismiss state and timing; the stack owns where it lands.
 */
export const Toast = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    // Resolved in an effect so this stays safe to render on the server.
    const [host, setHost] = useState<HTMLElement | null>(null);
    useEffect(() => setHost(toastStack()), []);
    if (!host) return null;

    return createPortal(
      <div
        ref={ref}
        role="alert"
        className={cn(
          'pointer-events-auto max-w-[calc(100vw-2rem)] cursor-pointer rounded-md border border-border bg-card px-4 py-2 text-sm text-card-foreground shadow-lg',
          className,
        )}
        {...props}
      />,
      host,
    );
  },
);
Toast.displayName = 'Toast';
