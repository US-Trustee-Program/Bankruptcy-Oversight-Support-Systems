import { CaseDocketEntry } from '../case-docket/case-docket.model';

export type Order = CaseDocketEntry & {
  caseId: string;
  caseTitle: string;
  chapter: string;
  orderType: 'transfer';
  orderDate: string;
};
