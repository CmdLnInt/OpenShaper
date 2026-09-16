/**
 * A one-time nudge to turn a phone sideways.
 *
 * The editor's 2D views are length-wise: a 1879 x 525mm board is about 3.6:1, so
 * in a 336x609 portrait pane the fit is width-constrained and the board occupies
 * roughly 80px of 609. The same phone in landscape gives a 820x278 pane, where
 * the board draws at ~4.11 px/cm against ~1.53 — nearly three times the size, for
 * no work at all. It is the cheapest improvement available on a phone, and it is
 * invisible unless someone says so.
 *
 * Deliberately inline rather than a `Toast`: `Toast` and `ConsentBanner` both sit
 * at `bottom-28 z-50`, and on a 360x780 first load the consent banner's own
 * buttons are already below the fold. A fourth thing anchored there would make a
 * known problem worse, and sitting in the chrome means this never has to wait for
 * the banner to be dismissed.
 */
import { Button } from '@openshaper/ui';
import { useEffect, useRef, useState } from 'react';
import { track } from './analytics';
import { useIsPhone, useMediaQuery } from './useMediaQuery';

const DISMISSED_KEY = 'bs.landscapeHintSeen';

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    // Private browsing or a blocked store — the hint reappears next visit, which
    // is a milder failure than never showing it.
    return false;
  }
}

export function LandscapeHint() {
  const isPhone = useIsPhone();
  const isPortrait = useMediaQuery('(orientation: portrait)');
  const [dismissed, setDismissed] = useState(wasDismissed);

  // Only a portrait phone has something to gain. Turning the device satisfies the
  // hint on its own, so the condition doubles as the dismissal.
  const show = isPhone && isPortrait && !dismissed;

  // StrictMode double-invokes effects; without this the impression is sent twice.
  const reportedShown = useRef(false);
  useEffect(() => {
    if (!show || reportedShown.current) return;
    reportedShown.current = true;
    track('landscape_hint', { action: 'shown' });
  }, [show]);

  if (!show) return null;

  const dismiss = () => {
    setDismissed(true);
    track('landscape_hint', { action: 'dismissed' });
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Same as above: worst case it asks again next time.
    }
  };

  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground"
    >
      <span className="min-w-0 flex-1">Turn your phone sideways for a bigger board.</span>
      <Button size="sm" variant="ghost" aria-label="Dismiss" className="shrink-0" onClick={dismiss}>
        ×
      </Button>
    </div>
  );
}
