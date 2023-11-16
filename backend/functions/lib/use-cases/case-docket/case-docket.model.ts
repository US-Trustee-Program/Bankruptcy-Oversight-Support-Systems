export type CaseDocketEntry = {
  sequenceNumber: number;
  documentNumber?: string;
  dateFiled: string;
  summaryText: string;
  fullText: string;
};
export type CaseDocket = Array<CaseDocketEntry>;
