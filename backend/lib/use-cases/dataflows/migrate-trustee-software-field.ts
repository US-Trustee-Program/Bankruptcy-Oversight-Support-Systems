import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { Trustee } from '@common/cams/trustees';
import { BankruptcySoftwareProfile } from '@common/cams/bankruptcy-software';

const MODULE_NAME = 'MIGRATE-TRUSTEE-SOFTWARE-FIELD';

export interface MigrationResult {
  migrated: number;
  skipped: number;
  notFound: number;
  errors: number;
  details: string[];
}

export async function migrateTrusteeSoftwareField(
  context: ApplicationContext,
): Promise<MigrationResult> {
  const { logger } = context;
  const trusteesRepository = factory.getTrusteesRepository(context);
  const softwareRepository = factory.getBankruptcySoftwareRepository(context);

  const result: MigrationResult = {
    migrated: 0,
    skipped: 0,
    notFound: 0,
    errors: 0,
    details: [],
  };

  logger.info(MODULE_NAME, 'Starting trustee software field migration (software → softwareId)');

  const softwareList = await softwareRepository.getSoftwareList();
  const softwareByName = new Map<string, BankruptcySoftwareProfile>();
  for (const sw of softwareList) {
    softwareByName.set(sw.name.toLowerCase(), sw);
  }

  const trustees = await trusteesRepository.listTrustees();

  for (const trustee of trustees) {
    try {
      if (trustee.softwareId) {
        result.skipped++;
        continue;
      }

      const legacySoftware = (trustee as Trustee & { software?: string }).software;
      if (!legacySoftware) {
        result.skipped++;
        continue;
      }

      const matchedSoftware = softwareByName.get(legacySoftware.toLowerCase());
      if (!matchedSoftware) {
        result.notFound++;
        result.details.push(`Trustee ${trustee.trusteeId}: software "${legacySoftware}" not found`);
        logger.warn(
          MODULE_NAME,
          `Trustee ${trustee.trusteeId}: software "${legacySoftware}" not found in software collection`,
        );
        continue;
      }

      const userReference = { id: 'system-migration', name: 'System Migration' };
      await trusteesRepository.updateTrustee(
        trustee.trusteeId,
        { ...trustee, softwareId: matchedSoftware.id, software: undefined } as Trustee,
        userReference,
      );

      result.migrated++;
      result.details.push(
        `Trustee ${trustee.trusteeId}: "${legacySoftware}" → softwareId "${matchedSoftware.id}"`,
      );
    } catch (e) {
      result.errors++;
      result.details.push(`Trustee ${trustee.trusteeId}: ERROR - ${(e as Error).message}`);
      logger.error(
        MODULE_NAME,
        `Failed to migrate trustee ${trustee.trusteeId}: ${(e as Error).message}`,
      );
    }
  }

  logger.info(
    MODULE_NAME,
    `Migration complete. Migrated: ${result.migrated}, Skipped: ${result.skipped}, Not Found: ${result.notFound}, Errors: ${result.errors}`,
  );

  return result;
}
