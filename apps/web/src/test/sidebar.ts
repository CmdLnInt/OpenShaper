// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Opening a sidebar section from a test.
 *
 * The sidebar is an accordion: most sections start collapsed, and a collapsed
 * section's body is unmounted rather than hidden (see `Disclosure`). A test that
 * wants to assert on a control inside one has to open it first, the same as a user.
 *
 * Kept here rather than repeated per file so that if the header markup changes,
 * every test that reaches into a section moves with it.
 */
import { fireEvent, screen } from '@testing-library/react';
import { SIDEBAR_SECTIONS, type SectionId } from '../sidebar-sections';

/**
 * Expand a sidebar section by id, if it is not already open.
 *
 * Throws when the section is not on screen at all — a collapsed section still
 * renders its header, so a missing one means it was gated out (an empty undo
 * stack, no ghost board), which a test should be told about rather than silently
 * pass over.
 */
export function openSection(id: SectionId): void {
  const section = SIDEBAR_SECTIONS.find((s) => s.id === id);
  if (!section) throw new Error(`Unknown sidebar section: ${id}`);
  const header = screen.getByRole('button', { name: section.title });
  if (header.getAttribute('aria-expanded') === 'true') return;
  fireEvent.click(header);
}
