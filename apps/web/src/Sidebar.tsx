/**
 * The right-hand sidebar: spec readout, resize, board info, fins, weight estimate,
 * trace-image controls, the control-point inspector, analysis toggles, and the
 * ghost comparison.
 *
 * Every tool is a collapsible section (`Disclosure`) drawn from the registry in
 * `sidebar-sections.ts`, in registry order, under three group labels. What is open is
 * decided by the shell — per-view relevance, the master collapse-all, and the user's
 * own toggles all flow through `SidebarState` — so this file only renders it. On the
 * desktop tier the whole thing folds to a 40px rail that keeps the headline dims.
 *
 * State is owned by the app shell and threaded in as props — this component is purely
 * presentational so the shell stays the single source of truth (several of these values
 * also drive the editor overlays).
 */
import { FIN_SETUP_LABELS, type InterpolationType } from '@openshaper/kernel';
import type { BoardSpecs } from '@openshaper/store';
import {
  Button,
  Checkbox,
  cn,
  Disclosure,
  Input,
  Panel,
  PanelBody,
  Textarea,
  Tooltip,
} from '@openshaper/ui';
import { Check, ChevronRight, ChevronsDownUp, ChevronsUpDown, Copy } from 'lucide-react';
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { ControlPointInspector } from './ControlPointInspector';
import { CoffeeIcon } from './components/Support';
import { SUPPORT_URL } from './support';
import type { BoardMeta } from './file-io';
import { fmtDimsHeadline, fmtLen, fmtVol, parseLen, type LengthUnit } from './format';
import type { TraceView, UseTrace } from './use-trace';
import { FinPanel } from './FinPanel';
import {
  anyOpen,
  SECTION_GROUPS,
  setAll,
  SIDEBAR_SECTIONS,
  toggleSection,
  type SectionId,
  type SidebarState,
} from './sidebar-sections';
import { boardStore } from './store';
import { OverlayToggle, Sel, SpecRow, UnitSelect } from './view-toolkit';
import {
  fmtWeight,
  FOAM_TYPES,
  GLASS_SCHEDULES,
  type FoamType,
  type GlassSchedule,
  type WeightBreakdown,
} from './weights';

/** Signed length difference (current − ghost) in the active units. */
function diffLen(cur: number, ghost: number, units: LengthUnit): string {
  const d = cur - ghost;
  return `${d >= 0 ? '+' : '−'}${fmtLen(Math.abs(d), units)}`;
}

/** Signed volume difference (current − ghost) in liters. */
function diffVol(cur: number, ghost: number): string {
  const d = cur - ghost;
  return `${d >= 0 ? '+' : '−'}${fmtVol(Math.abs(d))}`;
}

/** A labeled subsection of the spec readout (Nose / Center / Tail / Overall). */
function SpecGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="pt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
        {title}
      </div>
      {children}
    </div>
  );
}

export interface ResizeFields {
  l: string;
  w: string;
  t: string;
}

export interface OverlayToggles {
  grid: boolean;
  comb: boolean;
  com: boolean;
  dist: boolean;
}

export interface SidebarProps {
  specs: BoardSpecs | null;
  units: LengthUnit;
  interpolationType: InterpolationType;

  resize: ResizeFields;
  setResize: Dispatch<SetStateAction<ResizeFields>>;
  applyResize: () => void;

  meta: BoardMeta;
  setMeta: Dispatch<SetStateAction<BoardMeta>>;

  foamType: FoamType;
  glassSchedule: GlassSchedule;
  weight: WeightBreakdown | null;

  trace: UseTrace;
  /** Open the OS file picker for a given view's trace image. */
  onLoadTrace: (view: TraceView) => void;

  overlayToggles: OverlayToggles;
  setOverlayToggles: Dispatch<SetStateAction<OverlayToggles>>;

  ghost: boolean;
  ghostSpecs: BoardSpecs | null;

  /** Which sections are open, which the user owns, and whether the rail is folded. */
  sidebar: SidebarState;
  onSidebarChange: (next: SidebarState) => void;
  /**
   * Offer the fold-to-rail control. Desktop only: in the bottom sheet the snap
   * points already are the collapse, and a rail inside a sheet is nonsense.
   */
  collapsible?: boolean;

  /**
   * Change the display unit. Supplied only when the toolbar has no room for the
   * picker (the phone tier), so exactly one of the two is ever mounted.
   */
  onUnitChange?: (key: string) => void;
}

export function Sidebar({
  specs,
  units,
  interpolationType,
  resize,
  setResize,
  applyResize,
  meta,
  setMeta,
  foamType,
  glassSchedule,
  weight,
  trace,
  onLoadTrace,
  overlayToggles,
  setOverlayToggles,
  ghost,
  ghostSpecs,
  sidebar,
  onSidebarChange,
  collapsible = false,
  onUnitChange,
}: SidebarProps) {
  const past = useSyncExternalStore(boardStore.subscribe, () => boardStore.getState().past);
  const fins = useSyncExternalStore(
    boardStore.subscribe,
    () => boardStore.getState().board?.fins ?? null,
  );

  if (collapsible && sidebar.collapsed) {
    return (
      <SidebarRail
        specs={specs}
        units={units}
        onExpand={() => onSidebarChange({ ...sidebar, collapsed: false })}
      />
    );
  }

  const open = new Set(sidebar.open);
  const isOpen = (id: SectionId) => open.has(id);
  const setOpen = (id: SectionId) => (v: boolean) => onSidebarChange(toggleSection(sidebar, id, v));

  const overlaysOn = Object.values(overlayToggles).filter(Boolean).length;
  const hasTrace = Boolean(trace.traces.outline || trace.traces.rocker);

  /** Section bodies, keyed by id. A section absent here is not rendered at all. */
  const bodies: Partial<Record<SectionId, ReactNode>> = {
    specs: <SpecsSection specs={specs} units={units} interpolationType={interpolationType} />,
    resize: (
      <ResizeSection
        specs={specs}
        units={units}
        resize={resize}
        setResize={setResize}
        applyResize={applyResize}
      />
    ),
    controlPoint: <ControlPointInspector store={boardStore} units={units} />,
    analysis: (
      <AnalysisSection overlayToggles={overlayToggles} setOverlayToggles={setOverlayToggles} />
    ),
    boardInfo: <BoardInfoSection meta={meta} setMeta={setMeta} />,
    fins: <FinPanel store={boardStore} units={units} />,
    weight: (
      <WeightSection
        foamType={foamType}
        glassSchedule={glassSchedule}
        weight={weight}
        setMeta={setMeta}
      />
    ),
    trace: <TraceSection trace={trace} onLoadTrace={onLoadTrace} units={units} />,
    // Both of these are conditional: an empty undo stack and a board with no ghost
    // have nothing to show, and a header promising otherwise is worse than no header.
    ...(past.length > 0 ? { history: <HistorySection past={past} /> } : {}),
    ...(ghost && specs && ghostSpecs
      ? { compare: <CompareSection specs={specs} ghostSpecs={ghostSpecs} units={units} /> }
      : {}),
  };

  /** Header digests — what a shut section is still worth reading. */
  const summaries: Partial<Record<SectionId, ReactNode>> = {
    specs: specs ? fmtVol(specs.volume) : undefined,
    analysis: overlaysOn > 0 ? `${overlaysOn} on` : undefined,
    boardInfo: meta.model || undefined,
    fins: fins ? FIN_SETUP_LABELS[fins.setup] : undefined,
    weight: weight ? fmtWeight(weight.total) : undefined,
    history: `${past.length} step${past.length === 1 ? '' : 's'}`,
  };

  const visible = SIDEBAR_SECTIONS.filter((s) => bodies[s.id] !== undefined);

  return (
    <aside aria-label="Board panels" className="flex w-full min-h-0 shrink-0 flex-col lg:w-72">
      {/* Deliberately not `sticky`: a bar floating over the list owns a 36px band at
          the top of it where a section header can come to rest underneath, and the
          click that should open that section hits the bar instead. On the desktop
          mount the row is a flex sibling of the scroller below, so it stays put
          without ever covering anything; inside the sheet the sheet body does the
          scrolling and this simply scrolls with it. */}
      <div className="flex h-9 shrink-0 items-center gap-1 pointer-coarse:h-12">
        <IconButton
          label={anyOpen(sidebar) ? 'Collapse all sections' : 'Expand all sections'}
          onClick={() => onSidebarChange(setAll(sidebar, !anyOpen(sidebar)))}
        >
          {anyOpen(sidebar) ? (
            <ChevronsDownUp className="size-4" />
          ) : (
            <ChevronsUpDown className="size-4" />
          )}
        </IconButton>
        <span className="flex-1" />
        {collapsible && (
          <IconButton
            label="Hide board panels"
            onClick={() => onSidebarChange({ ...sidebar, collapsed: true })}
          >
            <ChevronRight className="size-4" />
          </IconButton>
        )}
      </div>

      <div
        className={cn(
          'flex min-h-0 flex-col gap-2 pb-2',
          // Only the desktop mount is its own scroll container. Inside the sheet the
          // sheet body scrolls, and a bounded scroller here would fight it.
          collapsible && 'flex-1 overflow-y-auto pr-0.5',
        )}
      >
        {/* First, deliberately: the sheet opens at `half` and everything past Specs
            is already below the fold there, so a control banished from the toolbar
            must not land somewhere worse than where it came from. */}
        {onUnitChange && (
          <Panel>
            <PanelBody className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Display units</span>
              <UnitSelect value={units.key} onChange={onUnitChange} />
            </PanelBody>
          </Panel>
        )}

        {SECTION_GROUPS.map((group) => {
          const inGroup = visible.filter((s) => s.group === group);
          if (inGroup.length === 0) return null;
          return (
            <div key={group} className="flex flex-col gap-2">
              <div className="px-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">
                {group}
              </div>
              {inGroup.map((s) => (
                <Disclosure
                  key={s.id}
                  title={s.title}
                  open={isOpen(s.id)}
                  onOpenChange={setOpen(s.id)}
                  summary={summaries[s.id]}
                  marked={s.id === 'trace' && hasTrace}
                >
                  {bodies[s.id]}
                </Disclosure>
              ))}
            </div>
          );
        })}
      </div>

      <SupportFooter />
    </aside>
  );
}

/** A square icon button sized for both pointer kinds. */
function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground pointer-coarse:size-11"
      >
        {children}
      </button>
    </Tooltip>
  );
}

/**
 * The folded sidebar: 40px of rail that hands 248px back to the canvas while keeping
 * the readout issue #37 did not want to lose.
 *
 * The dims run vertically because they are the one thing worth keeping at this width;
 * a rail of icons would have given the space back and taken the answer to "how big is
 * this board" with it.
 */
function SidebarRail({
  specs,
  units,
  onExpand,
}: {
  specs: BoardSpecs | null;
  units: LengthUnit;
  onExpand: () => void;
}) {
  return (
    <div className="flex w-10 shrink-0 flex-col items-center gap-1 rounded-lg border border-border bg-card py-1.5">
      <IconButton label="Show board panels" onClick={onExpand}>
        <ChevronRight className="size-4 rotate-180" />
      </IconButton>
      {/* The whole rail reads as one target; this is the rest of it, hidden from
          assistive tech so the chevron above stays the single announced control. */}
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={onExpand}
        className="flex min-h-0 flex-1 cursor-pointer justify-center overflow-hidden rounded-md py-1 transition-colors hover:bg-accent/40"
      >
        {specs && (
          <span className="[writing-mode:vertical-rl] whitespace-nowrap font-mono text-[11px] tabular-nums text-muted-foreground">
            {fmtDimsHeadline(specs.length, specs.maxWidth, specs.thickness, units)} ·{' '}
            {fmtVol(specs.volume)}
          </span>
        )}
      </button>
      <SupportRailLink />
    </div>
  );
}

/**
 * The support ask, pinned below the scroll.
 *
 * It used to be a three-line card at the bottom of an eleven-panel scroll, which in
 * practice meant it was never on screen at all. One row that is always visible is a
 * smaller ask and a far louder one.
 */
function SupportFooter() {
  if (!SUPPORT_URL) return null;
  return (
    <a
      href={SUPPORT_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="Buy me a coffee — OpenShaper is free & open-source"
      className="mt-auto flex h-9 shrink-0 items-center gap-2 border-t border-border px-2 text-xs text-muted-foreground transition-colors hover:text-foreground pointer-coarse:h-11"
    >
      <CoffeeIcon className="size-4 shrink-0 text-primary" />
      <span className="truncate">Buy me a coffee</span>
    </a>
  );
}

/** The same ask at rail width, where only the cup fits. */
function SupportRailLink() {
  if (!SUPPORT_URL) return null;
  return (
    <a
      href={SUPPORT_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Buy me a coffee"
      title="Buy me a coffee — OpenShaper is free & open-source"
      className="grid size-8 shrink-0 place-items-center rounded-md text-primary transition-colors hover:bg-accent pointer-coarse:size-11"
    >
      <CoffeeIcon className="size-4" />
    </a>
  );
}

function SpecsSection({
  specs,
  units,
  interpolationType,
}: {
  specs: BoardSpecs | null;
  units: LengthUnit;
  interpolationType: InterpolationType;
}) {
  // Brief confirmation after copying the dimensions headline; resets itself.
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(t);
  }, [copied]);

  if (!specs) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-1 text-sm">
      <Tooltip label={copied ? 'Copied' : 'Copy dimensions'}>
        <button
          type="button"
          aria-label="Copy dimensions"
          className="flex w-full items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5 text-left hover:bg-muted pointer-coarse:min-h-11"
          onClick={() => {
            const text = fmtDimsHeadline(specs.length, specs.maxWidth, specs.thickness, units);
            void navigator.clipboard
              ?.writeText(text)
              ?.then(() => setCopied(true))
              ?.catch(() => {});
          }}
        >
          <span className="font-mono text-[13px] tabular-nums text-foreground">
            {fmtDimsHeadline(specs.length, specs.maxWidth, specs.thickness, units)}
          </span>
          {/* Copying changes nothing on screen, so without this the click reads
              as broken — people click again. It was one of the editor's
              most-repeated dead clicks before the tick was added. */}
          {copied ? (
            <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
          ) : (
            <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
        </button>
      </Tooltip>

      <SpecGroup title="Nose">
        <SpecRow label={'Width @ 12"'} value={fmtLen(specs.noseWidth, units)} />
        <SpecRow label={'Thickness @ 12"'} value={fmtLen(specs.noseThickness, units)} />
        <SpecRow label="Rocker" value={fmtLen(specs.noseRocker, units)} />
        <SpecRow label={'Rocker @ 12"'} value={fmtLen(specs.noseRocker1, units)} />
        {specs.length >= 121.92 && (
          <SpecRow label={'Rocker @ 24"'} value={fmtLen(specs.noseRocker2, units)} />
        )}
      </SpecGroup>

      <SpecGroup title="Center">
        <SpecRow label="Width" value={fmtLen(specs.maxWidth, units)} />
        <SpecRow label="Wide point" value={fmtLen(specs.maxWidthPos, units)} />
        <SpecRow label="Center width" value={fmtLen(specs.centerWidth, units)} />
        <SpecRow label="Thickness" value={fmtLen(specs.thickness, units)} />
        <SpecRow label="Max thickness" value={fmtLen(specs.maxThickness, units)} />
      </SpecGroup>

      <SpecGroup title="Tail">
        <SpecRow label={'Width @ 12"'} value={fmtLen(specs.tailWidth, units)} />
        <SpecRow label={'Thickness @ 12"'} value={fmtLen(specs.tailThickness, units)} />
        <SpecRow label="Rocker" value={fmtLen(specs.tailRocker, units)} />
        <SpecRow label={'Rocker @ 12"'} value={fmtLen(specs.tailRocker1, units)} />
        {specs.length >= 121.92 && (
          <SpecRow label={'Rocker @ 24"'} value={fmtLen(specs.tailRocker2, units)} />
        )}
      </SpecGroup>

      <SpecGroup title="Overall">
        <SpecRow label="Length" value={fmtLen(specs.length, units)} />
        <SpecRow label="Length o/curve" value={fmtLen(specs.lengthOverCurve, units)} />
        <SpecRow label="Max rocker" value={fmtLen(specs.maxRocker, units)} />
        <SpecRow label="Volume" value={fmtVol(specs.volume)} />
        <SpecRow label="Center of mass" value={fmtLen(specs.centerOfMass, units)} />
      </SpecGroup>

      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-muted-foreground">Interpolation</span>
        <Sel
          value={interpolationType}
          onChange={(t) => boardStore.getState().setInterpolationType(t)}
          options={[
            { value: 'controlPoint', label: 'Control point' },
            { value: 'sLinear', label: 'S-blend' },
          ]}
          title="Cross-section interpolation model"
        />
      </div>
      <p className="pt-2 text-xs text-muted-foreground">
        Live from the kernel — every pane edits the same board, so changes sync across views and the
        specs update instantly.
      </p>
    </div>
  );
}

function ResizeSection({
  specs,
  units,
  resize,
  setResize,
  applyResize,
}: {
  specs: BoardSpecs | null;
  units: LengthUnit;
  resize: ResizeFields;
  setResize: Dispatch<SetStateAction<ResizeFields>>;
  applyResize: () => void;
}) {
  return (
    <div className="space-y-2 text-sm">
      {(
        [
          ['l', 'Length', specs?.length],
          ['w', 'Width', specs?.maxWidth],
          ['t', 'Thickness', specs?.thickness],
        ] as const
      ).map(([key, label, cur]) => (
        <label key={key} className="flex items-center gap-2">
          <span className="w-16 text-muted-foreground">{label}</span>
          <Input
            value={resize[key]}
            placeholder={cur != null ? fmtLen(cur, units) : ''}
            onChange={(e) => setResize((r) => ({ ...r, [key]: e.target.value }))}
          />
        </label>
      ))}
      <Button size="sm" variant="secondary" disabled={!specs} onClick={applyResize}>
        Apply
      </Button>
      <p className="text-xs text-muted-foreground">
        Blank fields keep that dimension; others scale to the target. Undoable.
      </p>
    </div>
  );
}

/**
 * The most recent labelled undo steps, newest first. Clicking a step reverts the
 * board to just before that action (everything jumped over becomes redoable).
 */
function HistorySection({ past }: { past: readonly { label: string }[] }) {
  const shown = past.slice(-10).reverse();
  return (
    <div className="space-y-0.5 text-sm">
      {shown.map((e, k) => {
        const index = past.length - 1 - k;
        return (
          <button
            key={index}
            type="button"
            title="Revert to before this step"
            className="flex min-h-8 w-full items-center justify-between rounded px-2 py-1 text-left transition-colors hover:bg-accent hover:text-accent-foreground pointer-coarse:min-h-11"
            onClick={() => boardStore.getState().jumpTo(index)}
          >
            <span>{e.label}</span>
            <span className="text-xs text-muted-foreground">#{index + 1}</span>
          </button>
        );
      })}
    </div>
  );
}

function BoardInfoSection({
  meta,
  setMeta,
}: {
  meta: BoardMeta;
  setMeta: Dispatch<SetStateAction<BoardMeta>>;
}) {
  return (
    <div className="space-y-2 text-sm">
      {(['designer', 'model', 'surfer'] as const).map((field) => (
        <label key={field} className="flex items-center gap-2">
          <span className="w-16 capitalize text-muted-foreground">{field}</span>
          <Input
            value={meta[field] ?? ''}
            placeholder="—"
            onChange={(e) => setMeta((m) => ({ ...m, [field]: e.target.value }))}
          />
        </label>
      ))}
      <Textarea
        value={meta.comments ?? ''}
        placeholder="Comments…"
        onChange={(e) => setMeta((m) => ({ ...m, comments: e.target.value }))}
        rows={2}
        className="resize-none"
      />
    </div>
  );
}

function WeightSection({
  foamType,
  glassSchedule,
  weight,
  setMeta,
}: {
  foamType: FoamType;
  glassSchedule: GlassSchedule;
  weight: WeightBreakdown | null;
  setMeta: Dispatch<SetStateAction<BoardMeta>>;
}) {
  return (
    <div className="space-y-2 text-sm">
      <div className="flex gap-2">
        <Sel
          value={foamType}
          onChange={(f) => setMeta((m) => ({ ...m, foamType: f }))}
          options={FOAM_TYPES.map((f) => ({ value: f, label: f }))}
          title="Foam type"
        />
        <Sel
          value={glassSchedule}
          onChange={(g) => setMeta((m) => ({ ...m, glassSchedule: g }))}
          options={GLASS_SCHEDULES.map((g) => ({ value: g, label: `${g} oz` }))}
          title="Glass schedule"
        />
      </div>
      {weight ? (
        <>
          <SpecRow label="Foam" value={fmtWeight(weight.foam)} />
          <SpecRow label="Glass" value={fmtWeight(weight.cloth)} />
          <SpecRow label="Resin" value={fmtWeight(weight.resin)} />
          <SpecRow label="Hardware" value={fmtWeight(weight.hardware)} />
          <div className="border-t border-border pt-1 font-semibold">
            <SpecRow label="Total" value={fmtWeight(weight.total)} />
          </div>
        </>
      ) : (
        <p className="text-muted-foreground">—</p>
      )}
    </div>
  );
}

function AnalysisSection({
  overlayToggles,
  setOverlayToggles,
}: {
  overlayToggles: OverlayToggles;
  setOverlayToggles: Dispatch<SetStateAction<OverlayToggles>>;
}) {
  return (
    <div className="space-y-1 text-sm">
      <OverlayToggle
        label="Grid & guides"
        checked={overlayToggles.grid}
        onChange={(v) => setOverlayToggles((s) => ({ ...s, grid: v }))}
      />
      <OverlayToggle
        label="Curvature comb"
        checked={overlayToggles.comb}
        onChange={(v) => setOverlayToggles((s) => ({ ...s, comb: v }))}
      />
      <OverlayToggle
        label="Center of mass"
        checked={overlayToggles.com}
        onChange={(v) => setOverlayToggles((s) => ({ ...s, com: v }))}
      />
      <OverlayToggle
        label="Volume distribution"
        checked={overlayToggles.dist}
        onChange={(v) => setOverlayToggles((s) => ({ ...s, dist: v }))}
      />
      <p className="pt-1 text-xs text-muted-foreground">
        Grid &amp; guides show in every pane (baseline + centerline emphasized); comb on the edited
        curves; CoM &amp; volume distribution on the outline and rocker.
      </p>
    </div>
  );
}

function CompareSection({
  specs,
  ghostSpecs,
  units,
}: {
  specs: BoardSpecs;
  ghostSpecs: BoardSpecs;
  units: LengthUnit;
}) {
  return (
    <div className="space-y-1 text-sm">
      <SpecRow label="Length" value={diffLen(specs.length, ghostSpecs.length, units)} />
      <SpecRow label="Width" value={diffLen(specs.maxWidth, ghostSpecs.maxWidth, units)} />
      <SpecRow label="Thickness" value={diffLen(specs.thickness, ghostSpecs.thickness, units)} />
      <SpecRow label="Volume" value={diffVol(specs.volume, ghostSpecs.volume)} />
      <p className="pt-1 text-xs text-muted-foreground">Dashed grey curves are the ghost board.</p>
    </div>
  );
}

/** Trace-image controls: per-view load/clear, opacity, mirror, and the two calibration flows. */
function TraceSection({
  trace,
  onLoadTrace,
  units,
}: {
  trace: UseTrace;
  onLoadTrace: (view: TraceView) => void;
  units: LengthUnit;
}) {
  const [lenText, setLenText] = useState('');
  const view = trace.activeView;
  const img = trace.traces[view];
  const submitLength = () => {
    trace.applyLength(parseLen(lenText, units));
    setLenText('');
  };
  return (
    <div className="space-y-2 text-sm">
      <div className="flex gap-1">
        {(['outline', 'rocker'] as TraceView[]).map((v) => (
          <Button
            key={v}
            size="sm"
            variant={view === v ? 'secondary' : 'ghost'}
            onClick={() => trace.setActiveView(v)}
          >
            {v === 'outline' ? 'Outline' : 'Rocker'}
            {trace.traces[v] ? ' ●' : ''}
          </Button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={() => onLoadTrace(view)}>
          {img ? 'Replace…' : 'Load image…'}
        </Button>
        {img && (
          <Button size="sm" variant="ghost" onClick={() => trace.clear(view)}>
            Clear
          </Button>
        )}
      </div>
      {img && (
        <>
          {/* Visible, not loaded: the image stays in place either way, so a
              trace hidden to look at a shared board comes straight back. */}
          <label className="flex items-center gap-2">
            <Checkbox
              checked={trace.visible[view]}
              onChange={(e) => trace.setVisible(view, e.target.checked)}
            />
            <span className="text-muted-foreground">
              Show {view === 'outline' ? 'outline' : 'rocker'} trace
            </span>
          </label>
          <label className="flex items-center gap-2">
            <span className="w-14 text-muted-foreground">Opacity</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={img.opacity}
              onChange={(e) => trace.setOpacity(view, Number(e.target.value))}
              className="flex-1"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => trace.beginAlign(view)}>
              Align (4-click)
            </Button>
            <Button size="sm" variant="ghost" onClick={() => trace.beginLength(view)}>
              Set scale…
            </Button>
            <Button size="sm" variant="ghost" onClick={() => trace.flip(view)}>
              Flip
            </Button>
          </div>
          {trace.calibration && (
            // Escape was the ONLY way out of a calibration: `cancelCalibration` was
            // exported from the hook and called by nothing, so a phone user who
            // started one by mistake had to complete all four taps or reload the
            // page. The button is the escape hatch; the key still works for anyone
            // who has one.
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                Follow the prompts on the {view} view.
              </p>
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0"
                onClick={trace.cancelCalibration}
              >
                Cancel
              </Button>
            </div>
          )}
          {trace.lengthPending && (
            <label className="flex items-center gap-2">
              <span className="shrink-0 text-muted-foreground">Distance</span>
              <Input
                autoFocus
                value={lenText}
                placeholder="e.g. 30in"
                onChange={(e) => setLenText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitLength();
                }}
              />
              <Button size="sm" variant="secondary" onClick={submitLength}>
                Set
              </Button>
            </label>
          )}
          <p className="text-xs text-muted-foreground">
            Drag the image to move, use the top handle to rotate. Align maps two image points onto
            two drawing points (auto-scales); Set scale uses a typed real-world distance.
          </p>
        </>
      )}
    </div>
  );
}
