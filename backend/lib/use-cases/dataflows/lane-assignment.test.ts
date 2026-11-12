import { beforeEach, describe, test, expect, vi } from 'vitest';
import { assignLanesRoundRobin, pickJitterSeconds } from './lane-assignment';

describe('assignLanesRoundRobin', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('splits regions evenly across lanes, round-robin by sorted order', () => {
    const lanes = assignLanesRoundRobin(['05', '03', '02', '04', '01', '06'], 3);
    expect(lanes).toEqual([
      ['01', '04'],
      ['02', '05'],
      ['03', '06'],
    ]);
  });

  test('uneven split leaves earlier lanes with one extra region', () => {
    const lanes = assignLanesRoundRobin(['01', '02', '03', '04', '05'], 3);
    expect(lanes).toEqual([['01', '04'], ['02', '05'], ['03']]);
  });

  test('more lanes than regions leaves the extra lanes empty', () => {
    const lanes = assignLanesRoundRobin(['02', '01'], 5);
    expect(lanes).toEqual([['01'], ['02'], [], [], []]);
  });

  test('a single lane holds every region in sorted order', () => {
    const lanes = assignLanesRoundRobin(['03', '01', '02'], 1);
    expect(lanes).toEqual([['01', '02', '03']]);
  });

  test('an empty region list returns laneCount empty lanes', () => {
    const lanes = assignLanesRoundRobin([], 3);
    expect(lanes).toEqual([[], [], []]);
  });

  test('does not mutate the input array', () => {
    const regions = ['03', '01', '02'];
    assignLanesRoundRobin(regions, 2);
    expect(regions).toEqual(['03', '01', '02']);
  });
});

describe('pickJitterSeconds', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('returns minSeconds when Math.random() returns 0', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(pickJitterSeconds(30, 60)).toBe(30);
  });

  test('returns maxSeconds when Math.random() returns just under 1', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9999999999);
    expect(pickJitterSeconds(30, 60)).toBe(60);
  });

  test('returns a mid-range value for a mid-range random draw', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(pickJitterSeconds(30, 60)).toBe(45);
  });
});
