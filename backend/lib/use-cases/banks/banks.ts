import { BankAuditHistory, BankProfile } from '@common/cams/banks';
import { createAuditRecord } from '@common/cams/auditable';
import { getCamsUserReference } from '@common/cams/session';
import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';

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

    try {
      const updated = await this.repository.updateBank(id, bankData);

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

      return updated;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to update bank.');
    }
  }

  async getBankHistory(bankId: string): Promise<BankAuditHistory[]> {
    try {
      return await this.repository.getBankHistory(bankId);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to retrieve bank history.');
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
