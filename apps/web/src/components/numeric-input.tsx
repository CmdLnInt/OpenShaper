import { Input } from '@openshaper/ui';

export function NumericInput({
  value,
  onValueChange,
  onCommit,
  onEscape,
  ariaLabel,
  className,
  step,
  type = 'text',
  placeholder,
  autoFocus,
  disabled,
  signed,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onCommit: () => void;
  onEscape?: () => void;
  ariaLabel?: string;
  className?: string;
  step?: number | string;
  type?: 'number' | 'text';
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  /**
   * The value can legitimately be negative, so do not ask for a decimal keypad.
   *
   * `inputMode="decimal"` requests digits and a separator — and nothing else, which
   * on a phone means no minus key at all. Fin toe, cant and sweep commit whatever
   * float is typed (`FinPanel` patches them with no clamp), so a keypad that cannot
   * express the value is worse than a full keyboard that can.
   */
  signed?: boolean;
}) {
  return (
    <Input
      aria-label={ariaLabel}
      value={value}
      type={type}
      inputMode={signed ? 'text' : 'decimal'}
      enterKeyHint="done"
      step={step}
      placeholder={placeholder}
      autoFocus={autoFocus}
      disabled={disabled}
      onChange={(event) => onValueChange(event.target.value)}
      onBlur={onCommit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          onCommit();
          (event.target as HTMLInputElement).blur();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          onEscape?.();
          (event.target as HTMLInputElement).blur();
        }
      }}
      className={className}
    />
  );
}
