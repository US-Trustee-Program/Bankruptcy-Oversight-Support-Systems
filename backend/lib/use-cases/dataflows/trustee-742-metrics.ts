import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { TrusteeNameHistory } from '@common/cams/trustees';
import { isNotFoundError } from '../../common-errors/not-found-error';

// Launch date for CAMS-742 trustee name management feature
const LAUNCH_DATE = '2026-04-28T00:00:00.000Z';

export type Trustee742Metrics = {
  // Count of trustee list fetches since last sync — proxy for sort adoption
  // (trustee list is sorted by last name post-742; each load reflects that sort)
  trusteeListFetchCount: number;
  nameEditsTotal: number;
  nameEditsMigrated: number;
  nameEditsNonMigrated: number;
};

export class Trustee742MetricsUseCase {
  public async gatherMetrics(context: ApplicationContext): Promise<Trustee742Metrics> {
    const repo = factory.getTrusteesRepository(context);
    const stateRepo = factory.getTrustee742MetricsSyncStateRepo(context);

    let lastSyncDate: string;
    try {
      const state = await stateRepo.read('TRUSTEE_742_METRICS_STATE');
      lastSyncDate = state.lastSyncDate;
    } catch (e) {
      if (!isNotFoundError(e)) throw e;
      lastSyncDate = LAUNCH_DATE;
    }
    const runAt = new Date().toISOString();

    const trustees = await repo.listTrustees();

    const nameEditCounts = { total: 0, migrated: 0, nonMigrated: 0 };

    for (const trustee of trustees) {
      const history = await repo.listTrusteeHistory(trustee.trusteeId);
      const nameEdits = history.filter(
        (h): h is TrusteeNameHistory =>
          h.documentType === 'AUDIT_NAME' && !!h.createdOn && h.createdOn >= lastSyncDate,
      );

      if (nameEdits.length > 0) {
        const isMigrated = !!(trustee.legacy?.truIds && trustee.legacy.truIds.length > 0);
        nameEditCounts.total += nameEdits.length;
        if (isMigrated) {
          nameEditCounts.migrated += nameEdits.length;
        } else {
          nameEditCounts.nonMigrated += nameEdits.length;
        }
      }
    }

    await stateRepo.upsert({ documentType: 'TRUSTEE_742_METRICS_STATE', lastSyncDate: runAt });

    return {
      trusteeListFetchCount: trustees.length,
      nameEditsTotal: nameEditCounts.total,
      nameEditsMigrated: nameEditCounts.migrated,
      nameEditsNonMigrated: nameEditCounts.nonMigrated,
    };
  }
}
