import { boardDiagramSvg, specSheetHtml, type SpecSection } from '@openshaper/export';
import {
  FIN_SETUP_LABELS,
  FIN_SYSTEM_LABELS,
  getRockerAtPos,
  getThicknessAtPos,
  getWidthAtPos,
  resolveFins,
  type BezierBoard,
  type FinConfig,
  type ResolvedFin,
} from '@openshaper/kernel';
import type { BoardSpecs } from '@openshaper/store';
import type { BoardMeta } from './file-io';
import { fmtDimsHeadline, fmtLen, fmtVol, type LengthUnit } from './format';
import {
  longitudinalDistance,
  longitudinalLength,
  longitudinalX,
  type LongitudinalMeasure,
} from './longitudinal-measure';

/** 4 ft in cm — below this, the @24" rocker readouts are omitted (matches the sidebar). */
const MIN_LEN_FOR_24 = 121.92;

/** Compose the printable spec-sheet HTML (board info + grouped dimensions in `units`). */
export const specSheetHtmlFor = (
  board: BezierBoard,
  specs: BoardSpecs,
  meta: BoardMeta,
  units: LengthUnit,
  fins?: FinConfig,
  longitudinalMeasure: LongitudinalMeasure = 'rocker',
): string => {
  const L = (cm: number): string => fmtLen(cm, units);
  const LX = (x: number): string => L(longitudinalDistance(board, x, longitudinalMeasure));
  const measuredLength = longitudinalLength(board, longitudinalMeasure);
  const at = (distance: number) => longitudinalX(board, distance, longitudinalMeasure);
  const tail1 = at(30.48);
  const tail2 = at(60.96);
  const nose1 = at(Math.max(0, measuredLength - 30.48));
  const nose2 = at(Math.max(0, measuredLength - 60.96));
  const center = at(measuredLength / 2);
  const hasFins = !!fins && fins.setup !== 'none';
  const finText = hasFins
    ? `${FIN_SETUP_LABELS[fins.setup]} · ${FIN_SYSTEM_LABELS[fins.system]}`
    : '';

  // Per-fin placement breakdown (distance-from-tail, base, depth, toe/cant, foil) —
  // mirrors the detail the retired NTS board PDF used to print.
  const sideName = (s: ResolvedFin['side']): string =>
    s === 0 ? 'Center' : s < 0 ? 'Port' : 'Starboard';
  const finPlacement: [string, string][] = hasFins
    ? resolveFins(board, fins).map((fin) => {
        const angles = fin.side === 0 ? '' : ` · toe ${fin.toe}° · cant ${fin.cant}°`;
        const summary =
          `${LX(fin.spec.trailingFromTail)} from tail · base ${L(fin.spec.base)} · ` +
          `depth ${L(fin.spec.depth)}${angles} · ${fin.foil}`;
        return [sideName(fin.side), summary];
      })
    : [];

  const sections: SpecSection[] = [
    {
      title: 'Nose',
      rows: [
        ['Width @ 12"', L(getWidthAtPos(board, nose1))],
        ['Thickness @ 12"', L(getThicknessAtPos(board, nose1))],
        ['Rocker', L(specs.noseRocker)],
        ['Rocker @ 12"', L(getRockerAtPos(board, nose1))],
        ...(measuredLength >= MIN_LEN_FOR_24
          ? ([['Rocker @ 24"', L(getRockerAtPos(board, nose2))]] as [string, string][])
          : []),
      ],
    },
    {
      title: 'Center',
      rows: [
        ['Width', L(specs.maxWidth)],
        ['Wide point', LX(specs.maxWidthPos)],
        ['Center width', L(getWidthAtPos(board, center))],
        ['Thickness', L(getThicknessAtPos(board, center))],
        ['Max thickness', L(specs.maxThickness)],
      ],
    },
    {
      title: 'Tail',
      rows: [
        ['Width @ 12"', L(getWidthAtPos(board, tail1))],
        ['Thickness @ 12"', L(getThicknessAtPos(board, tail1))],
        ['Rocker', L(specs.tailRocker)],
        ['Rocker @ 12"', L(getRockerAtPos(board, tail1))],
        ...(measuredLength >= MIN_LEN_FOR_24
          ? ([['Rocker @ 24"', L(getRockerAtPos(board, tail2))]] as [string, string][])
          : []),
      ],
    },
    {
      title: 'Overall',
      rows: [
        ['Length', L(measuredLength)],
        [
          longitudinalMeasure === 'rocker' ? 'Projected length' : 'Length o/curve',
          L(longitudinalMeasure === 'rocker' ? specs.length : specs.lengthOverCurve),
        ],
        ['Max rocker', L(specs.maxRocker)],
        ['Volume', fmtVol(specs.volume)],
        ['Center of mass', LX(specs.centerOfMass)],
        ...(hasFins ? ([['Fins', finText]] as [string, string][]) : []),
      ],
    },
  ];

  return specSheetHtml({
    title: meta.model || 'Surfboard',
    designer: meta.designer,
    date: new Date().toISOString().slice(0, 10),
    headline: `${fmtDimsHeadline(measuredLength, specs.maxWidth, getThicknessAtPos(board, center), units)} · ${fmtVol(specs.volume)}`,
    info: [
      ...(meta.surfer ? ([['Surfer', meta.surfer]] as [string, string][]) : []),
      ...(hasFins ? ([['Fins', finText]] as [string, string][]) : []),
      ...(meta.comments ? ([['Notes', meta.comments]] as [string, string][]) : []),
    ],
    sections,
    diagramSvg: boardDiagramSvg(board, { fmt: (cm) => fmtLen(cm, units) }),
    finPlacement,
  });
};

/**
 * Open an HTML document in a new tab via a Blob URL, instead of writing into a
 * blank window with the deprecated `document.write`. Returns false when the
 * pop-up was blocked, so the caller can surface an error.
 */
export const openHtmlInNewTab = (html: string): boolean => {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const w = window.open(url, '_blank');
  if (!w) {
    URL.revokeObjectURL(url);
    return false;
  }
  // The blob must outlive the new tab's initial fetch; revoke well after that.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
};
