import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';

/**
 * readIds — thin wrapper delegating to the repository's findIdsByChapter.
 * No cursor/state — caller re-queries fresh each invocation.
 */
async function readIds(
  context: ApplicationContext,
  collectionName: string,
  matchChapter: string,
  limit: number,
): Promise<string[]> {
  const repo = factory.getTrusteeCaseAppointmentsRepository(context);
  return repo.findIdsByChapter(collectionName, matchChapter, limit);
}

/**
 * applyFix — thin wrapper delegating to the repository's applyChapterFix.
 */
async function applyFix(
  context: ApplicationContext,
  collectionName: string,
  ids: string[],
  operation: 'rename' | 'delete',
  matchChapter: string,
  setChapter?: string,
): Promise<{ modifiedCount: number }> {
  const repo = factory.getTrusteeCaseAppointmentsRepository(context);
  return repo.applyChapterFix(collectionName, ids, operation, matchChapter, setChapter);
}

const FixChapter7AppointmentsUseCase = {
  readIds,
  applyFix,
};

export default FixChapter7AppointmentsUseCase;
