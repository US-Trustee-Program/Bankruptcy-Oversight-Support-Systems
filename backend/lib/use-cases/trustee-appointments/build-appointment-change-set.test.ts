import {
  buildAppointmentChangeSet,
  AppointmentFieldSnapshot,
} from './build-appointment-change-set';

describe('buildAppointmentChangeSet', () => {
  const baseSnapshot: AppointmentFieldSnapshot = {
    chapter: '7',
    appointmentType: 'panel',
    courtId: 'court-001',
    divisionCodes: ['001'],
    appointedDate: '2024-01-15',
    status: 'active',
    effectiveDate: '2024-01-15',
  };

  test('detects a single field change (chapter CH7 to Sub-V)', () => {
    const result = buildAppointmentChangeSet({
      trusteeId: 'trustee-1',
      trusteeName: 'Henry Green',
      before: baseSnapshot,
      after: { ...baseSnapshot, chapter: '11-subchapter-v' },
    });

    expect(result.fields).toHaveLength(1);
    expect(result.fields[0]).toEqual({
      label: 'Chapter',
      before: '7',
      after: '11 Subchapter V',
      category: 'profile',
      section: 'appointment',
    });
    expect(result.subjectOverride).toBe('Trustee Appointment Changed: Henry Green');
    expect(result.primaryChapter).toBe('11-subchapter-v');
  });

  test('detects multiple field changes (status + effective date)', () => {
    const result = buildAppointmentChangeSet({
      trusteeId: 'trustee-1',
      trusteeName: 'Henry Green',
      before: baseSnapshot,
      after: {
        ...baseSnapshot,
        status: 'inactive',
        effectiveDate: '2025-06-01',
      },
    });

    expect(result.fields).toHaveLength(2);
    expect(result.fields[0].label).toBe('Status');
    expect(result.fields[0].before).toBe('Active');
    expect(result.fields[0].after).toBe('Inactive');
    expect(result.fields[1].label).toBe('Status Effective Date');
    expect(result.subjectOverride).toBe('Trustee Appointment Changed: Henry Green');
  });

  test('returns empty fields array when nothing changes', () => {
    const result = buildAppointmentChangeSet({
      trusteeId: 'trustee-1',
      trusteeName: 'Henry Green',
      before: baseSnapshot,
      after: { ...baseSnapshot },
    });

    expect(result.fields).toHaveLength(0);
    expect(result.subjectOverride).toBeUndefined();
  });

  test('emits all fields as new when before is undefined (create)', () => {
    const result = buildAppointmentChangeSet({
      trusteeId: 'trustee-1',
      trusteeName: 'Henry Green',
      before: undefined,
      after: baseSnapshot,
    });

    expect(result.fields.length).toBeGreaterThanOrEqual(7);
    for (const field of result.fields) {
      expect(field.before).toBe('');
      expect(field.after).not.toBe('');
      expect(field.category).toBe('profile');
      expect(field.section).toBe('appointment');
    }
    expect(result.subjectOverride).toBe('New Trustee Appointment: Henry Green');
    expect(result.primaryChapter).toBe('7');
  });

  test('renders multiple divisions comma-separated with stackValues', () => {
    const result = buildAppointmentChangeSet({
      trusteeId: 'trustee-1',
      trusteeName: 'Henry Green',
      before: { ...baseSnapshot, divisionCodes: ['001'] },
      after: { ...baseSnapshot, divisionCodes: ['001', '002'] },
    });

    const divisionField = result.fields.find((f) => f.label === 'Division');
    expect(divisionField).toBeDefined();
    expect(divisionField!.before).toBe('001');
    expect(divisionField!.after).toBe('001, 002');
    expect(divisionField!.stackValues).toBe(true);
  });

  test('uses courtNameResolver for District field', () => {
    const resolver = (courtId: string) =>
      courtId === 'court-xyz' ? 'Eastern District of Missouri' : undefined;

    const result = buildAppointmentChangeSet({
      trusteeId: 'trustee-1',
      trusteeName: 'Henry Green',
      before: { ...baseSnapshot, courtId: 'court-001' },
      after: { ...baseSnapshot, courtId: 'court-xyz' },
      courtNameResolver: resolver,
    });

    const districtField = result.fields.find((f) => f.label === 'District');
    expect(districtField).toBeDefined();
    expect(districtField!.before).toBe('court-001');
    expect(districtField!.after).toBe('Eastern District of Missouri');
  });

  test('falls back to raw courtId when resolver returns undefined', () => {
    const resolver = () => undefined;

    const result = buildAppointmentChangeSet({
      trusteeId: 'trustee-1',
      trusteeName: 'Henry Green',
      before: { ...baseSnapshot, courtId: 'court-A' },
      after: { ...baseSnapshot, courtId: 'court-B' },
      courtNameResolver: resolver,
    });

    const districtField = result.fields.find((f) => f.label === 'District');
    expect(districtField).toBeDefined();
    expect(districtField!.before).toBe('court-A');
    expect(districtField!.after).toBe('court-B');
  });

  test('formats hyphenated status values as title case', () => {
    const result = buildAppointmentChangeSet({
      trusteeId: 'trustee-1',
      trusteeName: 'Henry Green',
      before: { ...baseSnapshot, status: 'active' },
      after: { ...baseSnapshot, status: 'voluntarily-suspended' },
    });

    const statusField = result.fields.find((f) => f.label === 'Status');
    expect(statusField).toBeDefined();
    expect(statusField!.before).toBe('Active');
    expect(statusField!.after).toBe('Voluntarily Suspended');
  });
});
