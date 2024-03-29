import { CaseSummary } from './cases';
import { ConsolidationType } from './orders';

type EventBase = {
  caseId: string;
  orderDate: string;
  otherCase: CaseSummary; // What happens if/when this is stale?? Store less than CaseSummary???
  // verificationDate: string; // TODO: Need this????
};

export type TransferFrom = EventBase & {
  documentType: 'TRANSFER_FROM';
};

export type TransferTo = EventBase & {
  documentType: 'TRANSFER_TO';
};

export type Transfer = TransferFrom | TransferTo;

type ConsolidationDetails = {
  consolidationType: ConsolidationType;
};

// Pointer to the LEAD Case.
export type ConsolidationTo = EventBase &
  ConsolidationDetails & {
    documentType: 'CONSOLIDATION_TO';
  };

// Pointer to child case. One for each child.
export type ConsolidationFrom = EventBase &
  ConsolidationDetails & {
    documentType: 'CONSOLIDATION_FROM';
  };

export type Consolidation = ConsolidationTo | ConsolidationFrom;

export type EventCaseReference = Consolidation | Transfer;
