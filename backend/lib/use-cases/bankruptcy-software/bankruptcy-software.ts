import {
  BankruptcySoftwareProfile,
  SoftwareBankAssociation,
} from '@common/cams/bankruptcy-software';
import { createAuditRecord } from '@common/cams/auditable';
import { CamsUserReference } from '@common/cams/users';
import { getCamsUserReference } from '@common/cams/session';
import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';
import { BadRequestError } from '../../common-errors/bad-request';

const MODULE_NAME = 'BANKRUPTCY-SOFTWARE-USE-CASE';

type SoftwareUpdate =
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

  async updateSoftware(id: string, update: SoftwareUpdate): Promise<BankruptcySoftwareProfile> {
    try {
      const userRef = getCamsUserReference(this.context.session.user);
      const current = await this.repository.findSoftwareById(id);
      const merged = this.applyUpdate(current, update, userRef);
      return await this.saveWithAudit(id, current, merged);
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
        message: `Bank ${bankId} is already associated with this software.`,
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
        message: `Bank ${bankId} is not associated with this software.`,
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
  ): Promise<BankruptcySoftwareProfile> {
    const userRef = getCamsUserReference(this.context.session.user);
    const updated = await this.repository.updateSoftware(id, after);
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
    return updated;
  }
}
