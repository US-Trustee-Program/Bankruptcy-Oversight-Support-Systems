import {
  BankruptcySoftwareProfile,
  SoftwareBankAssociation,
} from '@common/cams/bankruptcy-software';
import { createAuditRecord } from '@common/cams/auditable';
import { getCamsUserReference } from '@common/cams/session';
import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';
import { BadRequestError } from '../../common-errors/bad-request';

const MODULE_NAME = 'BANKRUPTCY-SOFTWARE-USE-CASE';

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

  async updateSoftware(
    id: string,
    update:
      | Partial<Pick<BankruptcySoftwareProfile, 'name' | 'status' | 'contact'>>
      | { addBank: { bankId: string; bankName: string } }
      | { updateBankAssociation: { bankId: string; status: SoftwareBankAssociation['status'] } },
  ): Promise<BankruptcySoftwareProfile> {
    try {
      const userRef = getCamsUserReference(this.context.session.user);
      const current = await this.repository.findSoftwareById(id);
      let merged: BankruptcySoftwareProfile;

      if ('addBank' in update) {
        const { bankId, bankName } = update.addBank;
        const existingBanks = current.associatedBanks ?? [];
        if (existingBanks.some((b) => b.bankId === bankId)) {
          throw new BadRequestError(MODULE_NAME, {
            message: `Bank ${bankId} is already associated with this software.`,
          });
        }
        merged = {
          ...current,
          associatedBanks: [...existingBanks, { bankId, bankName, status: 'active' }],
          updatedBy: userRef,
          updatedOn: new Date().toISOString(),
        };
      } else if ('updateBankAssociation' in update) {
        const { bankId, status } = update.updateBankAssociation;
        const existingBanks = current.associatedBanks ?? [];
        const index = existingBanks.findIndex((b) => b.bankId === bankId);
        if (index === -1) {
          throw new BadRequestError(MODULE_NAME, {
            message: `Bank ${bankId} is not associated with this software.`,
          });
        }
        const updatedBanks = [...existingBanks];
        updatedBanks[index] = { ...updatedBanks[index], status };
        merged = {
          ...current,
          associatedBanks: updatedBanks,
          updatedBy: userRef,
          updatedOn: new Date().toISOString(),
        };
      } else {
        merged = {
          ...current,
          ...update,
          updatedBy: userRef,
          updatedOn: new Date().toISOString(),
        };
      }

      const updated = await this.repository.updateSoftware(id, merged);
      await this.repository.createSoftwareAuditRecord(
        createAuditRecord(
          {
            documentType: 'AUDIT_BANKRUPTCY_SOFTWARE',
            softwareId: id,
            before: current,
            after: updated,
          },
          userRef,
        ),
      );
      return updated;
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
}
