import { BCase } from '../domain/bcase';
import { CreateCaseOptions, createCases } from './lib/common';

export function createChapter15Cases(caseCount: number, options: CreateCaseOptions): Array<BCase> {
  return createCases(caseCount, { ...options, chapter: '15' });
}
