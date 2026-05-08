import { BankProfile } from '@common/cams/banks';
import { createAuditRecord } from '@common/cams/auditable';
import { getCamsUserReference } from '@common/cams/session';
import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';

export class BanksUseCase {
  private readonly repository;
  private readonly context: ApplicationContext;

  constructor(context: ApplicationContext) {
    this.context = context;
    this.repository = factory.getBanksRepository(context);
  }

  async getBanks(): Promise<BankProfile[]> {
    return this.repository.getBanks();
  }

  async getBank(id: string): Promise<BankProfile> {
    return this.repository.getBank(id);
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
  }
}
