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
