import { Chapter15Case, PacerCaseData } from '../adapters/types/cases';

export function pacerToChapter15Data(input: PacerCaseData[]): Chapter15Case[] {
  const output = input.map((caseRecord: PacerCaseData) => {
    return {
      caseNumber: `${caseRecord.caseYear.toString().slice(-2)}-${caseRecord.caseNumber}`,
      caseTitle: caseRecord.caseTitle,
      dateFiled: caseRecord.dateFiled
    }
  })
  return output;
}
