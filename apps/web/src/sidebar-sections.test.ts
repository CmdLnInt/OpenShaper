// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import {
  anyOpen,
  applyViewChange,
  DEFAULT_SIDEBAR_STATE,
  isSectionId,
  sectionIds,
  setAll,
  SIDEBAR_SECTIONS,
  toggleSection,
  type SidebarState,
} from './sidebar-sections';

const state = (over: Partial<SidebarState> = {}): SidebarState => ({
  ...DEFAULT_SIDEBAR_STATE,
  ...over,
});

describe('the section registry', () => {
  it('has no duplicate ids — the persisted open/touched sets are keyed by them', () => {
    expect(new Set(sectionIds()).size).toBe(SIDEBAR_SECTIONS.length);
  });

  it('keeps each group contiguous, so a label is never emitted twice', () => {
    const seen = new Set<string>();
    let previous = '';
    for (const { group } of SIDEBAR_SECTIONS) {
      if (group === previous) continue;
      expect(seen.has(group), `${group} is split across the table`).toBe(false);
      seen.add(group);
      previous = group;
    }
  });

  it('leads with Specs — the readout is the one section worth defaulting open', () => {
    expect(SIDEBAR_SECTIONS[0]?.id).toBe('specs');
    expect(SIDEBAR_SECTIONS[0]?.defaultOpen).toBe(true);
  });

  it('rejects unknown ids, so a stale persisted blob cannot resurrect a removed section', () => {
    expect(isSectionId('specs')).toBe(true);
    expect(isSectionId('construction')).toBe(false);
    expect(isSectionId(null)).toBe(false);
  });
});

describe('applyViewChange', () => {
  it('opens the trace controls in the views that can hold a trace', () => {
    expect(applyViewChange(state(), 'outline').open).toContain('trace');
    expect(applyViewChange(state(), 'rocker').open).toContain('trace');
  });

  it('closes them again in a view that cannot', () => {
    const outline = applyViewChange(state(), 'outline');
    expect(applyViewChange(outline, '3d').open).not.toContain('trace');
  });

  it('opens Fins in 3D, where fins are the thing you can actually see', () => {
    expect(applyViewChange(state(), '3d').open).toContain('fins');
    expect(applyViewChange(state(), 'crossSection').open).not.toContain('fins');
  });

  it('leaves an always-relevant section open in every view', () => {
    for (const view of ['quad', 'outline', 'rocker', 'crossSection', '3d'] as const) {
      expect(applyViewChange(state(), view).open, view).toContain('specs');
    }
  });

  it('never auto-opens a section marked as reference material', () => {
    for (const view of ['quad', 'outline', 'rocker', 'crossSection', '3d'] as const) {
      expect(applyViewChange(state(), view).open, view).not.toContain('history');
    }
  });

  it('leaves a hand-opened section open in a view it is not relevant to', () => {
    // The whole point of `touched`: "I opened Fins, stop closing it."
    const s = toggleSection(state(), 'fins', true);
    expect(applyViewChange(s, 'crossSection').open).toContain('fins');
  });

  it('leaves a hand-closed section closed in a view it *is* relevant to', () => {
    const s = toggleSection(applyViewChange(state(), 'outline'), 'trace', false);
    expect(applyViewChange(s, 'rocker').open).not.toContain('trace');
  });

  it('preserves the collapsed rail — a view change is not a reason to unfold', () => {
    expect(applyViewChange(state({ collapsed: true }), 'outline').collapsed).toBe(true);
  });

  it('returns ids in registry order, so render order cannot drift from the table', () => {
    const { open } = applyViewChange(state(), 'outline');
    const order = sectionIds();
    const positions = open.map((id) => order.indexOf(id));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});

describe('setAll', () => {
  it('closes everything, then opens everything', () => {
    expect(setAll(state(), false).open).toEqual([]);
    expect(setAll(state(), true).open).toEqual([...sectionIds()]);
  });

  it('survives the next view change', () => {
    // Without marking everything touched, switching view would silently re-open half
    // of what was just collapsed and the master toggle would read as broken.
    const collapsed = setAll(state(), false);
    expect(applyViewChange(collapsed, 'outline').open).toEqual([]);
  });

  it('holds an expand-all open in a view where most sections are irrelevant', () => {
    const expanded = setAll(state(), true);
    expect(applyViewChange(expanded, '3d').open).toEqual([...sectionIds()]);
  });

  it('round-trips', () => {
    const s = state();
    expect(setAll(setAll(s, false), true).open).toEqual([...sectionIds()]);
  });

  it('leaves the rail alone — collapsing sections is not collapsing the sidebar', () => {
    expect(setAll(state({ collapsed: true }), false).collapsed).toBe(true);
  });
});

describe('anyOpen', () => {
  it('drives which way the master toggle points', () => {
    expect(anyOpen(state())).toBe(true);
    expect(anyOpen(setAll(state(), false))).toBe(false);
  });
});
