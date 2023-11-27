import { CaseDocketGateway } from '../../adapters/gateways/gateways.types';
import { ApplicationContext } from '../../adapters/types/basic';
import { CaseDocket, CaseDocketEntryDocument } from './case-docket.model';

export class CaseDocketUseCase {
  private readonly gateway: CaseDocketGateway;

  constructor(gateway: CaseDocketGateway) {
    this.gateway = gateway;
  }

  public async getCaseDocket(context: ApplicationContext, caseId: string): Promise<CaseDocket> {
    const documentMap = new Map<number, CaseDocketEntryDocument[]>();
    const documents = await this.gateway.getCaseDocketDocuments(context, caseId);
    documents.forEach((d) => {
      const key = d.sequenceNumber;
      const nameParts = d.fileUri.split('-');
      d.fileLabel = nameParts.slice(nameParts.length - 2).join('-');
      const list = documentMap.has(key) ? documentMap.get(key) : [];
      list.push(d);
      documentMap.set(key, list);
    });
    const docket = await this.gateway.getCaseDocket(context, caseId);
    docket.forEach((d) => {
      const key = d.sequenceNumber;
      if (documentMap.has(key)) {
        d.documents = documentMap.get(key);
      }
    });
    return docket;
  }
}
