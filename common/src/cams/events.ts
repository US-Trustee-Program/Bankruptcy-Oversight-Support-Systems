import { ConsolidationType } from './orders';

interface EventReference {
  caseId: string;
  title: string;
  otherCaseId: string;
  orderDate: string;
  divisionName: string;
  courtName: string;
}

export type TransferIn = EventReference & {
  documentType: 'TRANSFER_IN';
};

export type TransferOut = EventReference & {
  documentType: 'TRANSFER_OUT';
};

export type Transfer = TransferIn | TransferOut;

// Pointer to the LEAD Case.
export type ConsolidationTo = EventReference & {
  documentType: 'CONSOLIDATION_TO';
  consolidationType: ConsolidationType;
};

// Pointer to child case. One for each child.
export type ConsolidationFrom = EventReference & {
  documentType: 'CONSOLIDATION_FROM';
  consolidationType: ConsolidationType;
};

export type Consolidation = ConsolidationTo | ConsolidationFrom;
