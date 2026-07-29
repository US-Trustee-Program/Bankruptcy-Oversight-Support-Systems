import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';

export type AppointmentIdPair = { trusteeApptId: string; caseApptId: string };

/**
 * readIdPairs — thin wrapper delegating to the repository's
 * findAppointmentIdPairsByChapter. No cursor/state — caller re-queries fresh
 * each invocation; matched documents naturally drop out of the next query
 * once fixed.
 */
async function readIdPairs(
  context: ApplicationContext,
  matchChapter: string,
  limit: number,
): Promise<AppointmentIdPair[]> {
  const repo = factory.getTrusteeCaseAppointmentsRepository(context);
  return repo.findAppointmentIdPairsByChapter(matchChapter, limit);
}

/**
 * applyFix — thin wrapper delegating to the repository's applyChapterFix.
 */
async function applyFix(
  context: ApplicationContext,
  idPairs: AppointmentIdPair[],
  operation: 'rename' | 'delete',
  matchChapter: string,
  setChapter?: string,
): Promise<{ modifiedCount: number }> {
  const repo = factory.getTrusteeCaseAppointmentsRepository(context);
  return repo.applyChapterFix(idPairs, operation, matchChapter, setChapter);
}

const FixChapter7AppointmentsUseCase = {
  readIdPairs,
  applyFix,
};

export default FixChapter7AppointmentsUseCase;
