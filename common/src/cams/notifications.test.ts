import { NOTIFICATION_ROUTING_DEFINITIONS } from './notifications';

describe('NOTIFICATION_ROUTING_DEFINITIONS', () => {
  test('defines exactly 6 routing records', () => {
    expect(NOTIFICATION_ROUTING_DEFINITIONS).toHaveLength(6);
  });

  test('each definition has a unique id', () => {
    const ids = NOTIFICATION_ROUTING_DEFINITIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('covers arrays do not overlap across definitions', () => {
    const allKeys = NOTIFICATION_ROUTING_DEFINITIONS.flatMap((d) => d.covers);
    expect(new Set(allKeys).size).toBe(allKeys.length);
  });

  test('chapter 7 oversight covers chapter:7', () => {
    const def = NOTIFICATION_ROUTING_DEFINITIONS.find((d) => d.id === 'chapter-7-oversight');
    expect(def?.covers).toEqual(['chapter:7']);
    expect(def?.displayName).toBe('Chapter 7 Oversight');
  });

  test('chapter 11 oversight covers chapter:11', () => {
    const def = NOTIFICATION_ROUTING_DEFINITIONS.find((d) => d.id === 'chapter-11-oversight');
    expect(def?.covers).toEqual(['chapter:11']);
    expect(def?.displayName).toBe('Chapter 11 Oversight');
  });

  test('chapter 12 oversight covers chapter:12', () => {
    const def = NOTIFICATION_ROUTING_DEFINITIONS.find((d) => d.id === 'chapter-12-oversight');
    expect(def?.covers).toEqual(['chapter:12']);
    expect(def?.displayName).toBe('Chapter 12 Oversight');
  });

  test('chapter 13 oversight covers chapter:13', () => {
    const def = NOTIFICATION_ROUTING_DEFINITIONS.find((d) => d.id === 'chapter-13-oversight');
    expect(def?.covers).toEqual(['chapter:13']);
    expect(def?.displayName).toBe('Chapter 13 Oversight');
  });

  test('subchapter v oversight covers chapter:11-subchapter-v', () => {
    const def = NOTIFICATION_ROUTING_DEFINITIONS.find((d) => d.id === 'subchapter-v-oversight');
    expect(def?.covers).toEqual(['chapter:11-subchapter-v']);
    expect(def?.displayName).toBe('Chapter 11 Subchapter V');
  });

  test('341 meeting oversight covers category:zoom-341', () => {
    const def = NOTIFICATION_ROUTING_DEFINITIONS.find((d) => d.id === '341-meeting-oversight');
    expect(def?.covers).toEqual(['category:zoom-341']);
    expect(def?.displayName).toBe('341 Meeting Oversight');
  });
});
