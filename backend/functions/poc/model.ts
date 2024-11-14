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
