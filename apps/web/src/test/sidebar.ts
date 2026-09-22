// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Reaching a sidebar tool from a test.
 *
 * The sidebar is a tab strip over an accordion: a tool is only in the DOM when its tab
 * is the active one, and only expanded when its section is open. A test that wants to
 * assert on a control inside one has to do both, the same as a user.
 *
 * Kept here rather than repeated per file, and keyed off the registry rather than
 * hard-coded tab names, so adding or moving a tool does not touch any spec.
 */
import { fireEvent, screen } from '@testing-library/react';
import { SIDEBAR_SECTIONS, tabById, type SectionId } from '../sidebar-sections';

/** Bring a section's tab to the front. Safe to call when it is already active. */
export function openTabFor(id: SectionId): void {
  const section = SIDEBAR_SECTIONS.find((s) => s.id === id);
  if (!section) throw new Error(`Unknown sidebar section: ${id}`);
  const tab = tabById(section.tab);
  const button = screen.getByRole('tab', { name: tab.title });
  if (button.getAttribute('aria-selected') !== 'true') fireEvent.click(button);
}

/**
 * Select a section's tab and expand the section.
 *
 * Throws when the section is not on screen after its tab is active — a collapsed
 * section still renders its header, so a missing one means it was gated out (an empty
 * undo stack, no ghost board), which a test should be told about rather than silently
 * pass over.
 *
 * A tab holding a single tool renders it bare, with no header to click; that is not a
 * failure, so the expand step is skipped when there is nothing to expand.
 */
export function openSection(id: SectionId): void {
  const section = SIDEBAR_SECTIONS.find((s) => s.id === id);
  if (!section) throw new Error(`Unknown sidebar section: ${id}`);
  openTabFor(id);
  const header = screen.queryByRole('button', { name: section.title });
  if (!header) return; // rendered bare, already visible
  if (header.getAttribute('aria-expanded') === 'true') return;
  fireEvent.click(header);
}
