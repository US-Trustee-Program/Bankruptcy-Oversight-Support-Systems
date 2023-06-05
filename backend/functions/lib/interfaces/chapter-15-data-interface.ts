import { Chapter15Case } from "../adapters/types/cases";

export function pacerToChapter15Data(input: Chapter15Case[]): Chapter15Case[] {
  const output = input.map((caseRecord: Chapter15Case) => {
    return {
      caseNumber: caseRecord.caseNumber,
      caseTitle: caseRecord.caseTitle,
      dateFiled: caseRecord.dateFiled
    }
  })
  return output;
}
