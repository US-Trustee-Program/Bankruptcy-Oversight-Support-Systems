import { NOTIFICATION_ROUTING_DEFINITIONS } from './notifications';

describe('NOTIFICATION_ROUTING_DEFINITIONS', () => {
  test('defines exactly 3 routing records', () => {
    expect(NOTIFICATION_ROUTING_DEFINITIONS).toHaveLength(3);
  });

  test('each definition has a unique id', () => {
    const ids = NOTIFICATION_ROUTING_DEFINITIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('covers arrays do not overlap across definitions', () => {
    const allKeys = NOTIFICATION_ROUTING_DEFINITIONS.flatMap((d) => d.covers);
    expect(new Set(allKeys).size).toBe(allKeys.length);
  });

  test('default chapter oversight covers chapters 7, 11, 12, 13', () => {
    const def = NOTIFICATION_ROUTING_DEFINITIONS.find((d) => d.id === 'default-chapter-oversight');
    expect(def?.covers).toEqual(['chapter:7', 'chapter:11', 'chapter:12', 'chapter:13']);
    expect(def?.displayName).toBe('Chapter 7, 11, 12, 13 Oversight');
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
