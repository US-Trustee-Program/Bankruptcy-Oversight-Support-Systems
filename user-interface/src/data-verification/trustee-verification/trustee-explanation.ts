import { ScoreByScorer, TrusteeSerializedState } from '@common/cams/trustee-match-pipeline';
import { differingRows } from './trustee-comparison';

export type TrusteeExplanation = {
  sentence: string;
};

type FieldGroup = 'name' | 'address' | 'state' | 'phone' | 'email';

/** Fixed display order for the sentence's field list; unrelated to the comparison table's rows. */
const GROUP_ORDER: FieldGroup[] = ['name', 'address', 'state', 'phone', 'email'];

function groupsPresent(differs: Record<string, boolean>): FieldGroup[] {
  const present: Record<FieldGroup, boolean> = {
    name: differs.name,
    address: differs.street || differs.city || differs.zip,
    state: differs.state,
    phone: differs.phone,
    email: differs.email,
  };
  return GROUP_ORDER.filter((group) => present[group]);
}

/** Joins field names with no serial comma: "a", "a and b", "a, b and c". */
function joinFields(fields: FieldGroup[]): string {
  if (fields.length === 0) return 'information';
  if (fields.length === 1) return fields[0];
  return `${fields.slice(0, -1).join(', ')} and ${fields[fields.length - 1]}`;
}

function oneCandidateExplanation(scores: ScoreByScorer): TrusteeExplanation {
  const differs = differingRows(scores);
  const groups = groupsPresent(differs);
  const verb = groups.length >= 2 ? 'do' : 'does';
  return {
    sentence: `Trustee ${joinFields(groups)} sent to CAMS ${verb} not exactly match a trustee in CAMS.`,
  };
}

/**
 * Maps an identity task's stored findings to its "Why CAMS needs you" sentence. Reads only the
 * pipeline's stored scores - nothing here re-matches or recomputes a comparison.
 */
export function buildTrusteeExplanation(findings: TrusteeSerializedState): TrusteeExplanation {
  const { candidates } = findings;
  if (candidates.length === 0) {
    return {
      sentence: 'Trustee information sent to CAMS does not match any trustee in CAMS.',
    };
  }
  if (candidates.length >= 2) {
    return {
      sentence: 'Trustee information sent to CAMS matches multiple trustees in CAMS.',
    };
  }
  return oneCandidateExplanation(candidates[0].scores);
}
