import * as crypto from 'crypto';
import {
  Consolidation,
  ConsolidationFrom,
  ConsolidationTo,
  Transfer,
  TransferFrom,
  TransferTo,
} from '../../../../common/src/cams/events';
import { CaseHistory } from '../../../../common/src/cams/history';
import { CasesRepository } from '../../use-cases/gateways.types';
import { SyncedCase } from '../../../../common/src/cams/cases';
import { ResourceActions } from '../../../../common/src/cams/actions';
import { CasesSearchPredicate } from '../../../../common/src/api/search';

export class LocalCasesRepository implements CasesRepository {
  caseHistoryContainer: CaseHistory[] = [];
  consolidationsContainer: Consolidation[] = [];
  transfersContainer: Transfer[] = [];
  async deleteMigrations(): Promise<void> {}

  release() {
    return;
  }

  async createTransferFrom(reference: TransferFrom): Promise<TransferFrom> {
    const doc = { ...reference, id: crypto.randomUUID() };
    this.transfersContainer.push(doc);
    return doc;
  }

  async createTransferTo(reference: TransferTo): Promise<TransferTo> {
    const doc = { ...reference, id: crypto.randomUUID() };
    this.transfersContainer.push(doc);
    return doc;
  }

  async getTransfers(caseId: string): Promise<Array<TransferFrom | TransferTo>> {
    const transfers = this.transfersContainer.filter((doc) => doc.caseId === caseId);
    return Promise.resolve(transfers);
  }

  async createConsolidationTo(reference: ConsolidationTo): Promise<ConsolidationTo> {
    const doc = { ...reference, id: crypto.randomUUID() };
    this.consolidationsContainer.push(doc);
    return doc;
  }

  async createConsolidationFrom(reference: ConsolidationFrom): Promise<ConsolidationFrom> {
    const doc = { ...reference, id: crypto.randomUUID() };
    this.consolidationsContainer.push(doc);
    return doc;
  }

  async getConsolidation(caseId: string): Promise<Array<ConsolidationTo | ConsolidationFrom>> {
    const consolidations = this.consolidationsContainer.filter((doc) => doc.caseId === caseId);
    return Promise.resolve(consolidations);
  }

  async getCaseHistory(_caseId: string): Promise<CaseHistory[]> {
    throw new Error('Not implemented.');
  }

  async createCaseHistory(history: CaseHistory) {
    this.caseHistoryContainer.push(history);
  }

  async close() {
    return;
  }

  async syncDxtrCase(_bCase: SyncedCase) {
    throw new Error('Not implemented.');
  }

  async getConsolidationChildCaseIds(_predicate: CasesSearchPredicate): Promise<string[]> {
    throw new Error('Not implemented.');
  }

  async searchCases(_predicate: CasesSearchPredicate): Promise<ResourceActions<SyncedCase>[]> {
    throw new Error('Not implemented.');
  }
}
