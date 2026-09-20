// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * The editor sidebar's sections, as data.
 *
 * The sidebar used to be eleven panels hard-coded in render order inside one
 * `overflow-y-auto` column. Nothing could enumerate them, so nothing could reason
 * about them: which tools matter in the rocker view, what is open right now, what
 * to persist. A tool was discoverable only by scrolling past it.
 *
 * This table is the single source of truth for what the sidebar contains, how it is
 * grouped, and which views each section is relevant to. `Sidebar.tsx` renders in this
 * order; the two reducers below decide what is open, and are pure so the behaviour can
 * be tested without mounting React.
 *
 * Modelled on `shortcuts.ts`, which solved the same "nothing can enumerate these"
 * problem for key bindings.
 */
import type { View } from './view-toolkit';

export type SectionId =
  | 'specs'
  | 'resize'
  | 'controlPoint'
  | 'analysis'
  | 'boardInfo'
  | 'fins'
  | 'weight'
  | 'trace'
  | 'history'
  | 'compare';

/**
 * The three bands the sections fall into, in render order.
 *
 * Not "Board": the menubar already has a Board menu, and two different things under
 * one word on the same screen is a question the user has to stop and answer.
 */
export type SectionGroup = 'Design' | 'Build' | 'Reference';

export const SECTION_GROUPS: readonly SectionGroup[] = ['Design', 'Build', 'Reference'];

export interface SidebarSection {
  id: SectionId;
  title: string;
  group: SectionGroup;
  /**
   * Views this section is relevant to. On a view change, a section the user has not
   * touched opens here and closes elsewhere.
   *
   * `'all'` is always relevant; `[]` is never auto-opened — reference material you
   * reach for deliberately (Board info, Weight, History) rather than tools a view
   * implies.
   */
  relevantTo: readonly View[] | 'all';
  /** Open on a first-ever visit, before any view change or manual toggle. */
  defaultOpen: boolean;
}

export const SIDEBAR_SECTIONS: readonly SidebarSection[] = [
  { id: 'specs', title: 'Specs', group: 'Design', relevantTo: 'all', defaultOpen: true },
  { id: 'resize', title: 'Resize', group: 'Design', relevantTo: [], defaultOpen: false },
  {
    id: 'controlPoint',
    title: 'Control point',
    group: 'Design',
    // Not 3D: there is no control point to inspect in a view you cannot edit in.
    relevantTo: ['outline', 'rocker', 'crossSection', 'quad'],
    defaultOpen: false,
  },
  {
    id: 'analysis',
    title: 'Analysis',
    group: 'Design',
    // Not cross-section: the comb, CoM and volume distribution all draw on the
    // outline and rocker, so the toggles do nothing visible from there.
    relevantTo: ['outline', 'rocker', '3d', 'quad'],
    defaultOpen: false,
  },

  { id: 'boardInfo', title: 'Board info', group: 'Build', relevantTo: [], defaultOpen: false },
  {
    id: 'fins',
    title: 'Fins',
    group: 'Build',
    // Fins are only drawn in 3D, so that is where changing them shows something.
    relevantTo: ['3d', 'quad'],
    defaultOpen: false,
  },
  { id: 'weight', title: 'Weight estimate', group: 'Build', relevantTo: [], defaultOpen: false },

  {
    id: 'trace',
    title: 'Trace image',
    group: 'Reference',
    // The two views that can hold a trace at all.
    relevantTo: ['outline', 'rocker'],
    defaultOpen: false,
  },
  { id: 'history', title: 'History', group: 'Reference', relevantTo: [], defaultOpen: false },
  {
    id: 'compare',
    title: 'Compare (Δ vs ghost)',
    group: 'Reference',
    // Rendered only while a ghost board is loaded, so "always relevant" here means
    // "whenever it exists at all".
    relevantTo: 'all',
    defaultOpen: true,
  },
];

const ALL_IDS: readonly SectionId[] = SIDEBAR_SECTIONS.map((s) => s.id);

/** Section ids in registry order, for rendering and for iterating the reducers. */
export function sectionIds(): readonly SectionId[] {
  return ALL_IDS;
}

export function isSectionId(v: unknown): v is SectionId {
  return typeof v === 'string' && (ALL_IDS as readonly string[]).includes(v);
}

export interface SidebarState {
  /** Desktop only: the sidebar is folded to its rail. */
  collapsed: boolean;
  /** Ids currently expanded. */
  open: readonly SectionId[];
  /**
   * Ids the user has opened or closed by hand, which the per-view automation must
   * never override again.
   *
   * Persisted rather than session-scoped on purpose: "I opened Fins, stop closing it"
   * is a preference, and it should survive a reload. The automation therefore decays
   * as preferences accumulate, which is the right shape for a default — it helps
   * until you have an opinion, then gets out of the way.
   */
  touched: readonly SectionId[];
}

export const DEFAULT_SIDEBAR_STATE: SidebarState = {
  collapsed: false,
  open: SIDEBAR_SECTIONS.filter((s) => s.defaultOpen).map((s) => s.id),
  touched: [],
};

function isRelevant(section: SidebarSection, view: View): boolean {
  return section.relevantTo === 'all' || section.relevantTo.includes(view);
}

/**
 * Re-open the sections the new view implies and close the ones it does not —
 * skipping anything the user has touched.
 *
 * Deliberately never *removes* a section: every tool stays present and one click
 * away in every view, so switching view can never be the reason a control cannot be
 * found. It only changes what starts expanded.
 */
export function applyViewChange(state: SidebarState, view: View): SidebarState {
  const touched = new Set(state.touched);
  const wasOpen = new Set(state.open);
  const open = SIDEBAR_SECTIONS.filter((s) =>
    touched.has(s.id) ? wasOpen.has(s.id) : isRelevant(s, view),
  ).map((s) => s.id);
  // Identity matters: the shell runs this on every view change including the first
  // render, and a fresh object there would re-render and re-persist for nothing.
  return sameIds(open, state.open) ? state : { ...state, open };
}

const sameIds = (a: readonly SectionId[], b: readonly SectionId[]): boolean =>
  a.length === b.length && a.every((id, i) => id === b[i]);

/**
 * Open or close every section at once — the sidebar's master control.
 *
 * Marks everything touched. Without that the next view change would silently
 * re-open half of what was just collapsed, and the button would read as broken:
 * the user made a wholesale statement about the sidebar, so the automation has to
 * yield wholesale.
 */
export function setAll(state: SidebarState, open: boolean): SidebarState {
  return { ...state, open: open ? [...ALL_IDS] : [], touched: [...ALL_IDS] };
}

/** Toggle one section, recording that its state is now the user's to own. */
export function toggleSection(state: SidebarState, id: SectionId, open: boolean): SidebarState {
  const next = new Set(state.open);
  if (open) next.add(id);
  else next.delete(id);
  const touched = new Set(state.touched).add(id);
  return {
    ...state,
    open: ALL_IDS.filter((s) => next.has(s)),
    touched: ALL_IDS.filter((s) => touched.has(s)),
  };
}

/** Whether the master toggle should read "collapse all" (something is open) or "expand all". */
export function anyOpen(state: SidebarState): boolean {
  return state.open.length > 0;
}
