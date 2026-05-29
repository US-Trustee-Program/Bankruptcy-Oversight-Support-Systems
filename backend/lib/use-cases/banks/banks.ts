import { BankAuditHistory, BankProfile } from '@common/cams/banks';
import { BankruptcySoftwareProfile } from '@common/cams/bankruptcy-software';
import { TrusteeSummary } from '@common/cams/trustees';
import { createAuditRecord } from '@common/cams/auditable';
import { getCamsUserReference } from '@common/cams/session';
import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';
import { CamsPaginationResponse } from '../gateways.types';

const MODULE_NAME = 'BANKS-USE-CASE';

export class BanksUseCase {
  private readonly repository;
  private readonly context: ApplicationContext;

  constructor(context: ApplicationContext) {
    this.context = context;
    this.repository = factory.getBanksRepository(context);
  }

  async getBanks(): Promise<BankProfile[]> {
    try {
      return await this.repository.getBanks();
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to retrieve banks.');
    }
  }

  async getBank(id: string): Promise<BankProfile> {
    try {
      return await this.repository.getBank(id);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to retrieve bank.');
    }
  }

  async updateBank(
    id: string,
    input: { name: string; status: 'active' | 'inactive' },
  ): Promise<BankProfile> {
    const userRef = getCamsUserReference(this.context.session.user);
    const existing = await this.repository.getBank(id);

    const bankData: BankProfile = {
      ...existing,
      name: input.name,
      status: input.status,
      updatedOn: new Date().toISOString(),
      updatedBy: userRef,
    };

    let updated: BankProfile;
    try {
      updated = await this.repository.updateBank(id, bankData);

      await this.repository.createBankAuditRecord(
        createAuditRecord(
          {
            documentType: 'AUDIT_BANK',
            bankId: id,
            before: existing,
            after: updated,
          },
          userRef,
        ),
      );
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to update bank.');
    }

    if (input.status === 'inactive') {
      await this.cascadeBankInactivationToSoftware(id, userRef);
    }

    return updated;
  }

  private async cascadeBankInactivationToSoftware(
    bankId: string,
    userRef: ReturnType<typeof getCamsUserReference>,
  ): Promise<void> {
    const softwareRepo = factory.getBankruptcySoftwareRepository(this.context);
    try {
      const affectedProfiles = await softwareRepo.findSoftwareByBankId(bankId);
      for (const profile of affectedProfiles) {
        const updatedProfile = this.inactivateBankAssociation(profile, bankId);
        await softwareRepo.updateSoftware(profile.id, updatedProfile);
        await softwareRepo.createSoftwareAuditRecord(
          createAuditRecord(
            {
              documentType: 'AUDIT_BANKRUPTCY_SOFTWARE',
              softwareId: profile.id,
              before: profile,
              after: updatedProfile,
            },
            userRef,
          ),
        );
      }
    } catch (originalError) {
      throw getCamsError(
        originalError,
        MODULE_NAME,
        'Unable to cascade bank inactivation to software.',
      );
    } finally {
      softwareRepo.release();
    }
  }

  private inactivateBankAssociation(
    profile: BankruptcySoftwareProfile,
    bankId: string,
  ): BankruptcySoftwareProfile {
    return {
      ...profile,
      associatedBanks: profile.associatedBanks.map((b) =>
        b.bankId === bankId ? { ...b, status: 'inactive' } : b,
      ),
    };
  }

  async getBankHistory(bankId: string): Promise<BankAuditHistory[]> {
    try {
      return await this.repository.getBankHistory(bankId);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to retrieve bank history.');
    }
  }

  async getTrusteesByBank(
    bankId: string,
    limit: number,
    offset: number,
  ): Promise<CamsPaginationResponse<TrusteeSummary>> {
    const trusteesRepository = factory.getTrusteesRepository(this.context);
    try {
      return await trusteesRepository.findTrusteesByBank(bankId, limit, offset);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to retrieve trustees for bank.');
    } finally {
      trusteesRepository.release();
    }
  }

  async createBank(input: { name: string }): Promise<BankProfile> {
    const userRef = getCamsUserReference(this.context.session.user);

    const bankData = createAuditRecord<BankProfile>(
      {
        documentType: 'BANK_PROFILE',
        name: input.name,
        status: 'active',
      },
      userRef,
    );

    try {
      const createdBank = await this.repository.createBank(bankData);

      await this.repository.createBankAuditRecord(
        createAuditRecord(
          {
            documentType: 'AUDIT_BANK',
            bankId: createdBank.id,
            before: null,
            after: createdBank,
          },
          userRef,
        ),
      );

      return createdBank;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to create bank.');
    }
  }
}
