import { Address } from '@common/cams/contact';
import { Trustee, TrusteeInput } from '@common/cams/trustees';
import {
  TrusteeDataDifference,
  TrusteeDataReportSummary,
  TrusteeProfileField,
} from '@common/cams/trustee-data-report';
import { AtsTrusteeRecord } from '../../adapters/types/ats.types';
import { transformTrusteeRecord } from '../../adapters/gateways/ats/cleansing/ats-mappings';
import { selectPrimaryRecord } from '../dataflows/migrate-trustees';

const PROFILE_FIELDS: TrusteeProfileField[] = [
  'name',
  'companyName',
  'publicAddress',
  'internalAddress',
  'phone',
  'email',
];

type ProfileSource = Pick<Trustee, 'name' | 'public' | 'internal'> | TrusteeInput;

/** A TOD record and whether it is in scope for "in TOD only", and if so, why. */
export type ScopedTodRecord = {
  record: AtsTrusteeRecord;
  inScope: boolean;
  statusMissing?: boolean;
};

function renderAddress(address: Partial<Address> | undefined): string {
  if (!address) return '';
  return [address.address1, address.address2, address.city, address.state, address.zipCode]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ');
}

function profileValue(source: ProfileSource, field: TrusteeProfileField): string | undefined {
  switch (field) {
    case 'name':
      return source.name;
    case 'companyName':
      return source.public?.companyName;
    case 'publicAddress':
      return renderAddress(source.public?.address);
    case 'internalAddress':
      return renderAddress(source.internal?.address);
    case 'phone':
      return source.public?.phone?.number;
    case 'email':
      return source.public?.email;
  }
}

export function normalizeForComparison(
  field: TrusteeProfileField,
  value: string | null | undefined,
): string {
  if (value === null || value === undefined) return '';
  if (field === 'phone') return value.replace(/\D/g, '');
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function displayValue(value: string | undefined): string | undefined {
  return value?.trim() ? value : undefined;
}

export function compareTrusteeProfile(
  camsTrustee: Trustee,
  linkedTodRecords: AtsTrusteeRecord[],
): TrusteeDataDifference[] {
  const expected = transformTrusteeRecord(selectPrimaryRecord(linkedTodRecords));
  const todIds = linkedTodRecords.map((record) => record.ID.toString());

  return PROFILE_FIELDS.flatMap((field) => {
    const camsValue = profileValue(camsTrustee, field);
    const todValue = profileValue(expected, field);
    if (normalizeForComparison(field, camsValue) === normalizeForComparison(field, todValue)) {
      return [];
    }
    const difference: TrusteeDataDifference = {
      kind: 'field',
      camsTrusteeId: camsTrustee.trusteeId,
      todIds,
      trusteeName: camsTrustee.name,
      field,
      camsValue: displayValue(camsValue),
      todValue: displayValue(todValue),
    };
    return [difference];
  });
}

export function findTodOnly(
  todRecords: ScopedTodRecord[],
  linkedTruIds: Set<string>,
): TrusteeDataDifference[] {
  return todRecords
    .filter(({ record, inScope }) => inScope && !linkedTruIds.has(record.ID.toString()))
    .map(({ record, statusMissing }) => ({
      kind: 'tod-only',
      todIds: [record.ID.toString()],
      trusteeName: transformTrusteeRecord(record).name,
      ...(statusMissing ? { todStatusMissing: true } : {}),
    }));
}

export function findCamsOnly(
  camsTrustees: Trustee[],
  existingTodIds: Set<string>,
): TrusteeDataDifference[] {
  return camsTrustees
    .filter((trustee) => !(trustee.legacy?.truIds ?? []).some((id) => existingTodIds.has(id)))
    .map((trustee) => ({
      kind: 'cams-only',
      camsTrusteeId: trustee.trusteeId,
      todIds: trustee.legacy?.truIds ?? [],
      trusteeName: trustee.name,
    }));
}

export function summarize(
  differences: TrusteeDataDifference[],
  trusteesCompared: number,
): TrusteeDataReportSummary {
  const fieldDifferencesByField = Object.fromEntries(
    PROFILE_FIELDS.map((field) => [field, 0]),
  ) as Record<TrusteeProfileField, number>;
  const summary: TrusteeDataReportSummary = {
    trusteesCompared,
    todOnly: 0,
    todOnlyStatusMissing: 0,
    camsOnly: 0,
    fieldDifferences: 0,
    fieldDifferencesByField,
  };

  for (const difference of differences) {
    if (difference.kind === 'tod-only') {
      summary.todOnly++;
      if (difference.todStatusMissing) summary.todOnlyStatusMissing++;
    }
    if (difference.kind === 'cams-only') summary.camsOnly++;
    if (difference.kind === 'field' && difference.field) {
      summary.fieldDifferences++;
      fieldDifferencesByField[difference.field]++;
    }
  }

  return summary;
}
