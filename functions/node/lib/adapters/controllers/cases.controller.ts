import log from '../services/logger.service';
import useCase from '../../use-cases/index.js';
import { CasePersistenceGateway } from "../types/persistence-gateway.js";
import proxyData from "../data-access.proxy";
import { LogContext, RecordObj } from '../types/basic';

const NAMESPACE = "CASES-CONTROLLER";

export class CasesController {
  private context: LogContext;
  private casesDb: CasePersistenceGateway;

  constructor(context: LogContext) {
    this.context = context;
    this.initializeDb();
  }

  private async initializeDb() {
    if (typeof this.casesDb == 'undefined') {
      this.casesDb = (await proxyData(this.context, 'cases')) as CasePersistenceGateway;
      log.info(this.context, NAMESPACE, 'casesDB was set successfully');
    }
  }

  public async getCaseList(context: LogContext, query: {chapter: string, professionalId: number}) {
    await this.initializeDb();
    log.info(this.context, NAMESPACE, 'Getting case list.');

    let profId = 0;
    let chapter = '';
    if (query.professionalId) {
      profId = query.professionalId;
    }
    if (query.chapter) {
      chapter = query.chapter;
    }
    return await useCase.listCases(context, this.casesDb, { chapter, professionalId: profId });
  }

  public async getCase(context: LogContext, query: {caseId: string}) {
    await this.initializeDb();
    log.info(context, NAMESPACE, `Getting single case ${query.caseId}.`);

    return await useCase.getCase(context, this.casesDb, +query.caseId);
  }

  public async createCase(context: LogContext, recordSet: object) {
    await this.initializeDb();
    log.info(context, NAMESPACE, 'Inserting Case');

    let record: RecordObj[] = [];

    for (let rec in recordSet) {
      record.push({
        fieldName: rec,
        fieldValue: recordSet[rec],
      } as RecordObj);
    }

    return await useCase.addCase(context, this.casesDb, record);
  }

  public async updateCase(context: LogContext, caseId: number, recordSet: object) {
    await this.initializeDb();
    log.info(context, NAMESPACE, 'Updating Case');

    const record: RecordObj[] = [];

    for (let rec in recordSet) {
      record.push({
        fieldName: rec,
        fieldValue: recordSet[rec],
      } as RecordObj);
    }

    return await useCase.updateCase(context, this.casesDb, caseId, record);
  }

  public async deleteCase(context: LogContext, caseId: number) {
    await this.initializeDb();
    log.info(context, NAMESPACE, `Deleting case ${caseId}.`);

    return await useCase.deleteCase(context, this.casesDb, caseId);
  }
}

