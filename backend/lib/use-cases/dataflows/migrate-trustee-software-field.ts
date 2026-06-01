import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { Trustee } from '@common/cams/trustees';
import {
  BankruptcySoftwareProfile,
  SoftwareBankAssociation,
} from '@common/cams/bankruptcy-software';

const MODULE_NAME = 'MIGRATE-TRUSTEE-SOFTWARE-FIELD';

interface MigrationResult {
  migrated: number;
  skipped: number;
  notFound: number;
  errors: number;
  details: string[];
}

function buildBankNameToIdMap(
  associatedBanks: SoftwareBankAssociation[] | undefined,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const bank of associatedBanks ?? []) {
    map.set(bank.bankName.toLowerCase(), bank.bankId);
  }
  return map;
}

function banksNeedMigration(banks: string[] | undefined, bankIdSet: Set<string>): boolean {
  if (!banks || banks.length === 0) return false;
  return banks.some((bank) => !bankIdSet.has(bank));
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

  logger.info(MODULE_NAME, 'Starting trustee software and bank field migration');

  const softwareList = await softwareRepository.getSoftwareList();
  const softwareByName = new Map<string, BankruptcySoftwareProfile>();
  const softwareById = new Map<string, BankruptcySoftwareProfile>();
  for (const sw of softwareList) {
    softwareByName.set(sw.name.toLowerCase(), sw);
    softwareById.set(sw.id, sw);
  }

  const trustees = await trusteesRepository.listTrustees();

  for (const trustee of trustees) {
    try {
      const legacySoftware = (trustee as Trustee & { software?: string }).software;
      let softwareIdToSet: string | undefined = trustee.softwareId;
      let needsSoftwareMigration = false;

      if (!trustee.softwareId && legacySoftware) {
        const matchedSoftware = softwareByName.get(legacySoftware.toLowerCase());
        if (!matchedSoftware) {
          result.notFound++;
          result.details.push(
            `Trustee ${trustee.trusteeId}: software "${legacySoftware}" not found`,
          );
          logger.warn(
            MODULE_NAME,
            `Trustee ${trustee.trusteeId}: software "${legacySoftware}" not found in software collection`,
          );
          continue;
        }
        softwareIdToSet = matchedSoftware.id;
        needsSoftwareMigration = true;
      }

      const software = softwareIdToSet ? softwareById.get(softwareIdToSet) : undefined;
      const bankNameMap = buildBankNameToIdMap(software?.associatedBanks);
      const bankIdSet = new Set(software?.associatedBanks?.map((b) => b.bankId) ?? []);
      const needsBankMigration = banksNeedMigration(trustee.banks, bankIdSet);

      if (!needsSoftwareMigration && !needsBankMigration) {
        result.skipped++;
        continue;
      }

      let migratedBanks = trustee.banks;
      if (needsBankMigration && trustee.banks) {
        const resolved: string[] = [];
        let allResolved = true;
        for (const bankName of trustee.banks) {
          const bankId = bankNameMap.get(bankName.toLowerCase());
          if (bankId) {
            resolved.push(bankId);
          } else {
            allResolved = false;
            result.notFound++;
            result.details.push(
              `Trustee ${trustee.trusteeId}: bank "${bankName}" not found in software's associated banks`,
            );
            logger.warn(
              MODULE_NAME,
              `Trustee ${trustee.trusteeId}: bank "${bankName}" not found in associated banks for software ${softwareIdToSet}`,
            );
          }
        }
        if (!allResolved) {
          continue;
        }
        migratedBanks = resolved;
      }

      const userReference = { id: 'system-migration', name: 'System Migration' };
      const updatedFields: Record<string, unknown> = { ...trustee };
      if (needsSoftwareMigration) {
        updatedFields.softwareId = softwareIdToSet;
        updatedFields.software = undefined;
      }
      if (needsBankMigration) {
        updatedFields.banks = migratedBanks;
      }

      await trusteesRepository.updateTrustee(
        trustee.trusteeId,
        updatedFields as Trustee,
        userReference,
      );

      result.migrated++;
      const details: string[] = [];
      if (needsSoftwareMigration) {
        details.push(`software "${legacySoftware}" → softwareId "${softwareIdToSet}"`);
      }
      if (needsBankMigration) {
        details.push(`banks migrated to IDs`);
      }
      result.details.push(`Trustee ${trustee.trusteeId}: ${details.join(', ')}`);
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
