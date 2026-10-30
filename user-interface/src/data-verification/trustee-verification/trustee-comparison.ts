import {
  ProjectedTrustee,
  rankCandidates,
  ScoreByScorer,
  SerializedCandidate,
  TrusteeSerializedState,
} from '@common/cams/trustee-match-pipeline';
import { TrusteeMatchSource } from '@common/cams/trustee-match-verification';
import { TrusteeSearchResult } from '@common/cams/trustee-search';
import { formatPhoneWithExtension } from '@/lib/utils/phone-extension.utils';

export type ComparisonRowKey =
  'name' | 'phone' | 'street' | 'city' | 'state' | 'zip' | 'email' | 'foundBy';

export type ComparisonRow = { key: ComparisonRowKey; label: string };

/** A candidate's value for one row; differs is true only when the stored findings show the field
 * was compared and did not match exactly. A field the pipeline could not compare never differs. */
export type ComparisonCell = { value?: string; differs: boolean };

export type ComparisonCandidate = {
  trusteeId: string;
  trusteeName: string;
  camsRaw: ProjectedTrustee;
  cells: Record<ComparisonRowKey, ComparisonCell>;
};

/** The trustee a verifier is about to match, with the cells the comparison table shows for it. */
export type SelectedTrustee = Pick<ComparisonCandidate, 'trusteeId' | 'trusteeName' | 'cells'>;

export type TrusteeComparison = {
  rows: ComparisonRow[];
  source: Record<ComparisonRowKey, string | undefined>;
  candidates: ComparisonCandidate[];
};

const ROWS: ComparisonRow[] = [
  { key: 'name', label: 'Name' },
  { key: 'phone', label: 'Phone' },
  { key: 'street', label: 'Street' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'zip', label: 'Zip' },
  { key: 'email', label: 'Email' },
  { key: 'foundBy', label: 'Found by' },
];

const FOUND_BY_LABELS: Record<string, string> = {
  recallBySurnameExact: 'Exact surname',
  recallByName: 'Name',
  recallByTokenIntersection: 'Name words',
  recallByAnchoredLevenshtein: 'Similar spelling',
};

function joinStreet(lines: (string | undefined)[]): string | undefined {
  return lines.filter(Boolean).join(', ') || undefined;
}

function isExactGrade(scores: ScoreByScorer, scorer: string): boolean {
  const score = scores[scorer];
  return !score || (score.pass && score.quality === 'exact');
}

function isPass(scores: ScoreByScorer, scorer: string): boolean {
  const score = scores[scorer];
  return !score || score.pass;
}

function isStreetExact(scores: ScoreByScorer): boolean {
  const closeness = scores.doesAddressMatch?.streetCloseness as number | undefined;
  return closeness === undefined || closeness === 1;
}

/** Which rows differ, read from the stored scores. A scorer that wrote no record found nothing to
 * compare (see ScoreByScorer), so its row does not differ. */
export function differingRows(scores: ScoreByScorer): Record<ComparisonRowKey, boolean> {
  return {
    name: !isExactGrade(scores, 'doesNameMatch'),
    phone: !isExactGrade(scores, 'doesPhoneMatch'),
    street: !isStreetExact(scores),
    city: !isPass(scores, 'doesCityMatch'),
    state: !isPass(scores, 'doesStateMatch'),
    zip: !isPass(scores, 'doesZipCodeMatch'),
    email: !isPass(scores, 'doesEmailMatch'),
    foundBy: false,
  };
}

type TrusteeContact = Pick<ProjectedTrustee, 'name' | 'address' | 'phone' | 'email'>;

function toCells(
  trustee: TrusteeContact,
  foundBy: string | undefined,
  differs: Record<ComparisonRowKey, boolean>,
): Record<ComparisonRowKey, ComparisonCell> {
  const { address } = trustee;
  const values: Record<ComparisonRowKey, string | undefined> = {
    name: trustee.name,
    phone: formatPhoneWithExtension(trustee.phone),
    street: joinStreet([address?.address1, address?.address2, address?.address3]),
    city: address?.city,
    state: address?.state,
    zip: address?.zipCode,
    email: trustee.email,
    foundBy,
  };
  return Object.fromEntries(
    ROWS.map(({ key }) => [key, { value: values[key], differs: differs[key] }]),
  ) as Record<ComparisonRowKey, ComparisonCell>;
}

function toCandidate(candidate: SerializedCandidate<ProjectedTrustee>): ComparisonCandidate {
  const { camsRaw, scores, origin } = candidate;
  const cells = toCells(camsRaw, FOUND_BY_LABELS[origin] ?? origin, differingRows(scores));
  return { trusteeId: camsRaw.trusteeId, trusteeName: camsRaw.name, camsRaw, cells };
}

const NOTHING_DIFFERS = Object.fromEntries(ROWS.map(({ key }) => [key, false])) as Record<
  ComparisonRowKey,
  boolean
>;

/**
 * The trustee a verifier picked from search. A candidate keeps its stored cells so its markers
 * match the table; any other trustee was never scored, so nothing is marked as differing.
 */
export function selectedTrusteeFromSearch(
  result: TrusteeSearchResult,
  candidates: ComparisonCandidate[],
): SelectedTrustee {
  const candidate = candidates.find((c) => c.trusteeId === result.trusteeId);
  if (candidate) {
    const { trusteeId, trusteeName, cells } = candidate;
    return { trusteeId, trusteeName, cells };
  }
  return {
    trusteeId: result.trusteeId,
    trusteeName: result.name,
    cells: toCells(result, undefined, NOTHING_DIFFERS),
  };
}

/**
 * Maps an identity task's stored findings to the comparison table: the source record, then one
 * column per candidate in pipeline rank order. Reads only stored facts - nothing is re-matched.
 */
export function buildTrusteeComparison(
  findings: TrusteeSerializedState,
  source: TrusteeMatchSource,
): TrusteeComparison {
  const { sourceRaw, sourceNormalized } = findings;
  const legacy = sourceRaw.legacy;
  // The pipeline caches the city/state/zip it parsed and compared on sourceNormalized.address;
  // with no candidates it never parsed, so fall back to the sync's own parse of the record.
  const parsed = sourceNormalized.address ?? legacy?.parsedCityStateZip ?? undefined;

  return {
    rows: source === 'DXTR' ? ROWS : ROWS.filter((row) => row.key !== 'email'),
    source: {
      name: sourceRaw.fullName,
      phone: legacy?.phone,
      street: joinStreet([legacy?.address1, legacy?.address2, legacy?.address3]),
      city: parsed?.city,
      state: parsed?.state ?? undefined,
      zip: parsed?.zipCode,
      email: legacy?.email,
      foundBy: undefined,
    },
    candidates: rankCandidates(findings.candidates).map(toCandidate),
  };
}
