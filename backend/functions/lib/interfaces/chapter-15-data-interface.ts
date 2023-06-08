import { Chapter15Case } from "../adapters/types/cases";
import { PacerCaseData } from "../adapters/types/pacer";

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
