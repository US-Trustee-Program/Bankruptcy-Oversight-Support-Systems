export type CaseDocketEntry = {
  caseId: string;
  sequenceNumber: number;
  documentNumber?: string;
  dateEntered: string;
  dateFiled: string;
  type: string;
  summaryText: string;
  fullText: string;
};
export type CaseDocket = Array<CaseDocketEntry>;
