import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError } from '../../common-errors/error-utilities';
import factory from '../../factory';
import { Trustee, TrusteeContact } from '@common/cams/trustees';
import { TrusteeStaff } from '@common/cams/trustee-staff';
import { MaybeData } from './queue-types';
import { CamsUserReference } from '@common/cams/users';

const MODULE_NAME = 'BACKFILL-TRUSTEE-CONTACT-PHONES-USE-CASE';

const MIGRATION_USER: CamsUserReference = { id: 'system-migration', name: 'System Migration' };

type BackfillContactPhonesResult = {
  internalMigrated: number;
  internalSkipped: number;
  internalFailed: number;
  staffMigrated: number;
  staffSkipped: number;
  staffFailed: number;
};

type LegacyPhone = { number?: string; extension?: string };

function buildTypedPhone(phone: LegacyPhone) {
  const typed: { number: string; type: 'direct'; extension?: string } = {
    number: phone.number!,
    type: 'direct',
  };
  if (phone.extension) {
    typed.extension = phone.extension;
  }
  return typed;
}

async function backfillInternalContacts(
  context: ApplicationContext,
): Promise<{ migrated: number; skipped: number; failed: number }> {
  const { logger } = context;
  const repo = factory.getTrusteesRepository(context);
  const trustees = await repo.listTrustees();

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const trustee of trustees) {
    const legacy = trustee.internal as (TrusteeContact & { phone?: LegacyPhone }) | undefined;

    if (!legacy?.phone?.number || legacy.phones?.length) {
      skipped++;
      continue;
    }

    try {
      const updated: Trustee = {
        ...trustee,
        internal: {
          ...legacy,
          phones: [buildTypedPhone(legacy.phone)],
          phone: undefined,
        } as TrusteeContact,
      };
      await repo.updateTrustee(trustee.trusteeId, updated, MIGRATION_USER);
      migrated++;
    } catch (e) {
      failed++;
      logger.error(
        MODULE_NAME,
        `Failed to migrate internal contact for trustee ${trustee.trusteeId}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  return { migrated, skipped, failed };
}

async function backfillStaffContacts(
  context: ApplicationContext,
): Promise<{ migrated: number; skipped: number; failed: number }> {
  const { logger } = context;
  const repo = factory.getTrusteeStaffRepository(context);
  const staffMembers = await repo.listUnmigratedStaff();

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const staffMember of staffMembers) {
    const legacy = staffMember.contact as
      | (TrusteeStaff['contact'] & { phone?: LegacyPhone })
      | undefined;

    if (!legacy?.phone?.number) {
      skipped++;
      continue;
    }

    try {
      const input = {
        name: staffMember.name,
        title: staffMember.title,
        contact: {
          ...legacy,
          phones: [buildTypedPhone(legacy.phone)],
          phone: undefined,
        },
      };
      await repo.updateStaffMember(staffMember.trusteeId, staffMember.id, input, MIGRATION_USER);
      migrated++;
    } catch (e) {
      failed++;
      logger.error(
        MODULE_NAME,
        `Failed to migrate contact phones for staff member ${staffMember.id}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  return { migrated, skipped, failed };
}

async function backfillTrusteeContactPhones(
  context: ApplicationContext,
): Promise<MaybeData<BackfillContactPhonesResult>> {
  try {
    const [internal, staff] = await Promise.all([
      backfillInternalContacts(context),
      backfillStaffContacts(context),
    ]);

    return {
      data: {
        internalMigrated: internal.migrated,
        internalSkipped: internal.skipped,
        internalFailed: internal.failed,
        staffMigrated: staff.migrated,
        staffSkipped: staff.skipped,
        staffFailed: staff.failed,
      },
    };
  } catch (originalError) {
    return {
      error: getCamsError(originalError, MODULE_NAME, 'Failed to backfill trustee contact phones.'),
    };
  }
}

const BackfillTrusteeContactPhonesUseCase = {
  backfillTrusteeContactPhones,
};

export default BackfillTrusteeContactPhonesUseCase;
