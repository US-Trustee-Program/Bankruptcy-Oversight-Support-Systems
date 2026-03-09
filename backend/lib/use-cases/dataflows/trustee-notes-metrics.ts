import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';

export type TrusteeNoteMetrics = {
  notesLast24Hrs: number;
  trusteesWithNotes: number;
  notesPerTrustee: Array<{ trusteeId: string; noteCount: number }>;
  uniqueNoteAuthors: number;
};

export class TrusteeNotesMetricsUseCase {
  public async gatherMetrics(context: ApplicationContext): Promise<TrusteeNoteMetrics> {
    const repo = factory.getTrusteeNotesRepository(context);
    const cutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const notes = await repo.getNotesSince(cutoffIso);

    const trusteesWithNotes = new Set(notes.map((n) => n.trusteeId)).size;

    const countMap = notes.reduce<Map<string, number>>((acc, n) => {
      acc.set(n.trusteeId, (acc.get(n.trusteeId) ?? 0) + 1);
      return acc;
    }, new Map());
    const notesPerTrustee = [...countMap.entries()]
      .map(([trusteeId, noteCount]) => ({ trusteeId, noteCount }))
      .sort((a, b) => b.noteCount - a.noteCount);

    const uniqueNoteAuthors = new Set(notes.map((n) => n.createdBy.id)).size;

    repo.release();

    return {
      notesLast24Hrs: notes.length,
      trusteesWithNotes,
      notesPerTrustee,
      uniqueNoteAuthors,
    };
  }
}
