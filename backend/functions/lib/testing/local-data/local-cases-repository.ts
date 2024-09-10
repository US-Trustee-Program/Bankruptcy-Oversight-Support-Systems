import * as crypto from 'crypto';
import {
  Consolidation,
  ConsolidationFrom,
  ConsolidationTo,
  Transfer,
  TransferFrom,
  TransferTo,
} from '../../../../../common/src/cams/events';
import { CaseHistory } from '../../../../../common/src/cams/history';
import { ApplicationContext } from '../../adapters/types/basic';
import { CasesRepository } from '../../use-cases/gateways.types';

export class LocalCasesRepository implements CasesRepository {
  caseHistoryContainer: CaseHistory[] = [];
  consolidationsContainer: Consolidation[] = [];
  transfersContainer: Transfer[] = [];

  async createTransferFrom(
    _context: ApplicationContext,
    reference: TransferFrom,
  ): Promise<TransferFrom> {
    const doc = { ...reference, id: crypto.randomUUID() };
    this.transfersContainer.push(doc);
    return doc;
  }

  async createTransferTo(_context: ApplicationContext, reference: TransferTo): Promise<TransferTo> {
    const doc = { ...reference, id: crypto.randomUUID() };
    this.transfersContainer.push(doc);
    return doc;
  }

  async getTransfers(
    _context: ApplicationContext,
    caseId: string,
  ): Promise<Array<TransferFrom | TransferTo>> {
    const transfers = this.transfersContainer.filter((doc) => doc.caseId === caseId);
    return Promise.resolve(transfers);
  }

  async createConsolidationTo(
    _context: ApplicationContext,
    reference: ConsolidationTo,
  ): Promise<ConsolidationTo> {
    const doc = { ...reference, id: crypto.randomUUID() };
    this.consolidationsContainer.push(doc);
    return doc;
  }

  async createConsolidationFrom(
    _context: ApplicationContext,
    reference: ConsolidationFrom,
  ): Promise<ConsolidationFrom> {
    const doc = { ...reference, id: crypto.randomUUID() };
    this.consolidationsContainer.push(doc);
    return doc;
  }

  async getConsolidation(
    _context: ApplicationContext,
    caseId: string,
  ): Promise<Array<ConsolidationTo | ConsolidationFrom>> {
    const consolidations = this.consolidationsContainer.filter((doc) => doc.caseId === caseId);
    return Promise.resolve(consolidations);
  }

  async getCaseHistory(_context: ApplicationContext, _caseId: string): Promise<CaseHistory[]> {
    throw new Error('Not implemented.');
  }

  async createCaseHistory(_context: ApplicationContext, history: CaseHistory) {
    this.caseHistoryContainer.push(history);
  }
}
