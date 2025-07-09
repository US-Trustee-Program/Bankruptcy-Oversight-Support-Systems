import { describe, beforeEach } from 'vitest';
import { FSM } from './FSM';
import { MockSelectionService } from './selection/SelectionService.humble';

describe('FSM', () => {
  let fsm: FSM;
  let selectionService: MockSelectionService;

  beforeEach(() => {
    selectionService = new MockSelectionService();
    fsm = new FSM(selectionService);
  });

  test('delete this test', () => {
    expect(fsm).toBeTruthy();
  });
});
