import { createCase, CreateCaseOptions } from './lib/common';

export function createNoJudgeAssignedCases(options: CreateCaseOptions = {}) {
  const bCase = createCase(options);
  delete bCase.judge;
  return [bCase];
}
