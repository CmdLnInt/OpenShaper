import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

/** A multi-line text input matching {@link Input}. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        // 16px on touch: below that iOS zooms the page when the field takes focus,
        // and it does not zoom back out. The board comments box was the last 14px
        // field in the editor, and the only one that is not an `Input`.
        'w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:text-base',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
