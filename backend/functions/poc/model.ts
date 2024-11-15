export type Bounds = {
  divisionCodes: string[];
  chapters: string[];
  dateRange: [string, string];
};

export type Predicate = {
  divisionCode: string;
  chapter: string;
  dateRange: [string, string];
};

export type PredicateAndPage = Predicate & {
  pageNumber: number;
};

// properties here are temporary.  Need to figure out what this type should look like.
export type AcmsConsolidation = {
  orderId: string;
  caseId: string;
};
