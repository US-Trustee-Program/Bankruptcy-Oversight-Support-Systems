import {
  BankruptcySoftwareAuditHistory,
  BankruptcySoftwareProfile,
  SoftwareBankAssociation,
} from '@common/cams/bankruptcy-software';
import { createAuditRecord } from '@common/cams/auditable';
import { CamsUserReference } from '@common/cams/users';
import { getCamsUserReference } from '@common/cams/session';
import { TrusteeSummary } from '@common/cams/trustees';
import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';
import { BadRequestError } from '../../common-errors/bad-request';
import { CamsPaginationResponse } from '../gateways.types';

const MODULE_NAME = 'BANKRUPTCY-SOFTWARE-USE-CASE';

export type SoftwareUpdate =
  | Partial<Pick<BankruptcySoftwareProfile, 'name' | 'status' | 'contact'>>
  | { addBank: { bankId: string; bankName: string } }
  | { updateBankAssociation: { bankId: string; status: SoftwareBankAssociation['status'] } };

export class BankruptcySoftwareUseCase {
  private readonly repository;
  private readonly context: ApplicationContext;

  constructor(context: ApplicationContext) {
    this.context = context;
    this.repository = factory.getBankruptcySoftwareRepository(context);
  }

  async getSoftwareList(): Promise<BankruptcySoftwareProfile[]> {
    try {
      return await this.repository.getSoftwareList();
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to retrieve bankruptcy software.');
    }
  }

  async getSoftware(id: string): Promise<BankruptcySoftwareProfile> {
    try {
      return await this.repository.findSoftwareById(id);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to retrieve bankruptcy software.');
    }
  }

  async getSoftwareHistory(softwareId: string): Promise<BankruptcySoftwareAuditHistory[]> {
    try {
      return await this.repository.getSoftwareHistory(softwareId);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to retrieve software history.');
    }
  }

  async getTrusteesBySoftware(
    softwareId: string,
    limit: number,
    offset: number,
  ): Promise<CamsPaginationResponse<TrusteeSummary>> {
    const trusteesRepository = factory.getTrusteesRepository(this.context);
    try {
      return await trusteesRepository.findTrusteesBySoftware(softwareId, limit, offset);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to retrieve trustees for software.');
    } finally {
      trusteesRepository.release();
    }
  }

  async getTrusteesByBankAndSoftware(
    softwareId: string,
    bankId: string,
    limit: number,
    offset: number,
  ): Promise<CamsPaginationResponse<TrusteeSummary>> {
    const trusteesRepository = factory.getTrusteesRepository(this.context);
    try {
      return await trusteesRepository.findTrusteesByBankAndSoftware(
        softwareId,
        bankId,
        limit,
        offset,
      );
    } catch (originalError) {
      throw getCamsError(
        originalError,
        MODULE_NAME,
        'Unable to retrieve trustees for bank and software.',
      );
    } finally {
      trusteesRepository.release();
    }
  }

  async getTrusteeCountsBySoftware(softwareId: string): Promise<Record<string, number>> {
    try {
      const software = await this.repository.findSoftwareById(softwareId);
      const bankIds = (software.associatedBanks ?? []).map((b) => b.bankId);
      if (bankIds.length === 0) return {};

      const trusteesRepository = factory.getTrusteesRepository(this.context);
      try {
        const entries = await Promise.all(
          bankIds.map(async (bankId) => {
            const count = await trusteesRepository.countTrusteesByBankAndSoftware(
              softwareId,
              bankId,
            );
            return [bankId, count] as const;
          }),
        );
        return Object.fromEntries(entries);
      } finally {
        trusteesRepository.release();
      }
    } catch (originalError) {
      throw getCamsError(
        originalError,
        MODULE_NAME,
        'Unable to retrieve trustee counts for software.',
      );
    }
  }

  async updateSoftware(id: string, update: SoftwareUpdate): Promise<BankruptcySoftwareProfile> {
    try {
      const userRef = getCamsUserReference(this.context.session.user);
      const current = await this.repository.findSoftwareById(id);
      const merged = this.applyUpdate(current, update, userRef);
      return await this.saveWithAudit(id, current, merged, userRef);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to update bankruptcy software.');
    }
  }

  async createSoftware(input: { name: string }): Promise<BankruptcySoftwareProfile> {
    const userRef = getCamsUserReference(this.context.session.user);

    const softwareData = createAuditRecord<BankruptcySoftwareProfile>(
      {
        documentType: 'BANKRUPTCY_SOFTWARE',
        name: input.name,
        status: 'active',
      },
      userRef,
    );

    try {
      const createdSoftware = await this.repository.createSoftware(softwareData);

      await this.repository.createSoftwareAuditRecord(
        createAuditRecord(
          {
            documentType: 'AUDIT_BANKRUPTCY_SOFTWARE',
            softwareId: createdSoftware.id,
            before: null,
            after: createdSoftware,
          },
          userRef,
        ),
      );

      return createdSoftware;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to create bankruptcy software.');
    }
  }

  private applyUpdate(
    current: BankruptcySoftwareProfile,
    update: SoftwareUpdate,
    userRef: CamsUserReference,
  ): BankruptcySoftwareProfile {
    const base = {
      ...current,
      updatedBy: userRef,
      updatedOn: new Date().toISOString(),
    };

    if ('addBank' in update) {
      return this.addBankAssociation(base, update.addBank.bankId, update.addBank.bankName);
    }
    if ('updateBankAssociation' in update) {
      return this.updateBankAssociationStatus(
        base,
        update.updateBankAssociation.bankId,
        update.updateBankAssociation.status,
      );
    }
    return { ...base, ...update };
  }

  private addBankAssociation(
    software: BankruptcySoftwareProfile,
    bankId: string,
    bankName: string,
  ): BankruptcySoftwareProfile {
    const existingBanks = software.associatedBanks ?? [];
    if (existingBanks.some((b) => b.bankId === bankId)) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'This bank is already associated with this software.',
      });
    }
    return {
      ...software,
      associatedBanks: [...existingBanks, { bankId, bankName, status: 'active' }],
    };
  }

  private updateBankAssociationStatus(
    software: BankruptcySoftwareProfile,
    bankId: string,
    status: SoftwareBankAssociation['status'],
  ): BankruptcySoftwareProfile {
    const existingBanks = software.associatedBanks ?? [];
    const index = existingBanks.findIndex((b) => b.bankId === bankId);
    if (index === -1) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'The specified bank is not associated with this software.',
      });
    }
    const updatedBanks = [...existingBanks];
    updatedBanks[index] = { ...updatedBanks[index], status };
    return { ...software, associatedBanks: updatedBanks };
  }

  private async saveWithAudit(
    id: string,
    before: BankruptcySoftwareProfile,
    after: BankruptcySoftwareProfile,
    userRef: CamsUserReference,
  ): Promise<BankruptcySoftwareProfile> {
    const updated = await this.repository.updateSoftware(id, after);
    try {
      await this.repository.createSoftwareAuditRecord(
        createAuditRecord(
          {
            documentType: 'AUDIT_BANKRUPTCY_SOFTWARE',
            softwareId: id,
            before,
            after: updated,
          },
          userRef,
        ),
      );
    } catch (auditError) {
      this.context.logger.error(
        MODULE_NAME,
        'Audit record creation failed after successful data write.',
        {
          softwareId: id,
          error: (auditError as Error).message,
        },
      );
      throw getCamsError(
        auditError as Error,
        MODULE_NAME,
        'Audit record creation failed after successful data write.',
      );
    }
    return updated;
  }
}
