import { parseBrd } from '@openshaper/io';
import { describe, expect, it } from 'vitest';
import {
  longitudinalDistance,
  longitudinalLength,
  longitudinalLengthScale,
  longitudinalX,
} from './longitudinal-measure';
import { scaleSpline, splineLength } from '@openshaper/kernel';
import sampleBrd from './sample-board.brd?raw';

const { board } = parseBrd(sampleBrd);

describe('longitudinal rocker measurements', () => {
  it('leaves projected coordinates unchanged', () => {
    expect(longitudinalDistance(board, 42, 'projected')).toBe(42);
    expect(longitudinalX(board, 42, 'projected')).toBe(42);
  });

  it('round-trips positions without moving them', () => {
    for (const x of [-5, 0, 10, 42, 90, 100, 195])
      expect(longitudinalX(board, longitudinalDistance(board, x, 'rocker'), 'rocker')).toBeCloseTo(
        x,
        8,
      );
  });

  it('reports the developed bottom length', () => {
    expect(longitudinalLength(board, 'rocker')).toBeGreaterThan(
      longitudinalLength(board, 'projected'),
    );
  });

  it('solves the horizontal resize needed for a requested rocker length', () => {
    const target = longitudinalLength(board, 'rocker') * 1.1;
    const scale = longitudinalLengthScale(board, target, 'rocker');
    expect(splineLength(scaleSpline(board.bottom, 1, scale))).toBeCloseTo(target, 8);
  });
});
