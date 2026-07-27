import { CaseChapter, VALID_CASE_CHAPTERS } from '@common/cams/cases';

// ACMS's CURR_CASE_CHAPT carries legacy codes that don't match CAMS's chapter
// vocabulary directly: '7A' (asset) / '7N' (no-asset) are CAMS chapter 7,
// '9' is unpadded (unlike the '09' used when querying ACMS), and 'AC' is the
// predecessor to chapter 15 and is not imported into CAMS. See the chapter
// comment on AcmsGatewayImpl.getLeadCaseIds for the full documented code set.
// Throws for 'AC' or any other value outside CAMS's valid chapter set so the
// migration skips/fails the record rather than writing an invalid chapter.
export function normalizeAcmsCaseChapter(chapter: string): CaseChapter {
  const trimmed = chapter.trim();

  let normalized = trimmed;
  if (trimmed === '7A' || trimmed === '7N') {
    normalized = '7';
  } else if (trimmed === '09') {
    normalized = '9';
  }

  if (!VALID_CASE_CHAPTERS.includes(normalized as CaseChapter)) {
    throw new Error(`Invalid ACMS chapter value: ${chapter}`);
  }

  return normalized as CaseChapter;
}
