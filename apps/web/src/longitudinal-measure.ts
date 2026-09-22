import {
  getLength,
  splineLength,
  splineLengthToX,
  scaleSpline,
  xAtSplineLength,
  type BezierBoard,
} from '@openshaper/kernel';

export type LongitudinalMeasure = 'projected' | 'rocker';

export const LONGITUDINAL_MEASURES: readonly {
  value: LongitudinalMeasure;
  label: string;
}[] = [
  { value: 'projected', label: 'X axis' },
  { value: 'rocker', label: 'Rocker' },
];

export const longitudinalDistance = (
  board: BezierBoard,
  x: number,
  measure: LongitudinalMeasure,
): number => {
  if (measure === 'projected') return x;
  const first = board.bottom.knots[0]!.end.x;
  const last = board.bottom.knots.at(-1)!.end.x;
  if (x < first) return x - first;
  const total = splineLength(board.bottom);
  if (x > last) return total + x - last;
  return splineLengthToX(board.bottom, x);
};

export const longitudinalX = (
  board: BezierBoard,
  distance: number,
  measure: LongitudinalMeasure,
): number => {
  if (measure === 'projected') return distance;
  const first = board.bottom.knots[0]!.end.x;
  if (distance < 0) return first + distance;
  const total = splineLength(board.bottom);
  const last = board.bottom.knots.at(-1)!.end.x;
  if (distance > total) return last + distance - total;
  return xAtSplineLength(board.bottom, distance);
};

export const longitudinalLength = (board: BezierBoard, measure: LongitudinalMeasure): number =>
  measure === 'rocker' ? splineLength(board.bottom) : getLength(board);

/** Horizontal scale that makes the bottom rocker develop to `targetLength`. */
export const longitudinalLengthScale = (
  board: BezierBoard,
  targetLength: number,
  measure: LongitudinalMeasure,
): number => {
  const current = longitudinalLength(board, measure);
  if (measure === 'projected' || targetLength <= 0 || current <= 0) return targetLength / current;
  let lo = 0.01;
  let hi = Math.max(2, (targetLength / current) * 2);
  while (splineLength(scaleSpline(board.bottom, 1, hi)) < targetLength) hi *= 2;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (splineLength(scaleSpline(board.bottom, 1, mid)) < targetLength) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};
