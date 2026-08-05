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

  const noopResolvers = {
    courtNameResolver: () => undefined,
    allDivisionsResolver: () => [],
  } as const;

  test('detects a single field change (chapter CH7 to Sub-V)', () => {
    const result = buildAppointmentChangeSet({
      ...noopResolvers,
      trusteeId: 'trustee-1',
      trusteeName: 'Henry Green',
      before: baseSnapshot,
      after: { ...baseSnapshot, chapter: '11-subchapter-v' },
    });

    expect(result.fields).toHaveLength(1);
    expect(result.fields[0]).toEqual({
      label: 'Chapter',
      comparisons: [{ before: '7', after: '11 Subchapter V' }],
      category: 'profile',
      section: 'appointment',
    });
    expect(result.subjectOverride).toBe('Trustee Appointment Changed: Henry Green');
    expect(result.chapters).toEqual(['11-subchapter-v']);
  });

  test('detects multiple field changes (status + effective date)', () => {
    const result = buildAppointmentChangeSet({
      ...noopResolvers,
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
    expect(result.fields[0].comparisons[0].before).toBe('Active');
    expect(result.fields[0].comparisons[0].after).toBe('Inactive');
    expect(result.fields[1].label).toBe('Status Effective Date');
    expect(result.subjectOverride).toBe('Trustee Appointment Changed: Henry Green');
    expect(result.chapters).toEqual(['7']);
  });

  test('returns empty fields array when nothing changes', () => {
    const result = buildAppointmentChangeSet({
      ...noopResolvers,
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
      ...noopResolvers,
      trusteeId: 'trustee-1',
      trusteeName: 'Henry Green',
      before: undefined,
      after: baseSnapshot,
    });

    expect(result.fields).toHaveLength(6);
    for (const field of result.fields) {
      expect(field.comparisons[0].before).toBe('');
      expect(field.comparisons[0].after).not.toBe('');
      expect(field.category).toBe('profile');
      expect(field.section).toBe('appointment');
    }
    expect(result.trusteeId).toBe('trustee-1');
    expect(result.trusteeName).toBe('Henry Green');
    expect(result.subjectOverride).toBe('New Trustee Appointment: Henry Green');
    expect(result.chapters).toEqual(['7']);
  });

  test('stacks multiple divisions with newline separator', () => {
    // '071' resolves to 'Brooklyn', '081' resolves to 'Manhattan'
    const result = buildAppointmentChangeSet({
      trusteeId: 'trustee-1',
      trusteeName: 'Henry Green',
      before: { ...baseSnapshot, divisionCodes: ['081'] },
      after: { ...baseSnapshot, divisionCodes: ['081', '071'] },
      courtNameResolver: () => 'Southern District of New York',
      allDivisionsResolver: () => [],
    });

    const field = result.fields.find((f) => f.label === 'District (Division)');
    expect(field).toBeDefined();
    expect(field!.comparisons[0].before).toBe('Southern District of New York (Manhattan)');
    expect(field!.comparisons[0].after).toBe(
      'Southern District of New York (Manhattan)\nSouthern District of New York (Brooklyn)',
    );
    expect(field!.stackValues).toBe(true);
    expect(result.chapters).toEqual(['7']);
  });

  test('uses courtNameResolver for District (Division) field', () => {
    const courtNameResolver = (courtId: string) =>
      courtId === 'court-xyz' ? 'Eastern District of Missouri' : undefined;

    const result = buildAppointmentChangeSet({
      trusteeId: 'trustee-1',
      trusteeName: 'Henry Green',
      before: { ...baseSnapshot, courtId: 'court-001', divisionCodes: ['XXX'] },
      after: { ...baseSnapshot, courtId: 'court-xyz', divisionCodes: ['XXX'] },
      courtNameResolver,
      allDivisionsResolver: () => [],
    });

    const field = result.fields.find((f) => f.label === 'District (Division)');
    expect(field).toBeDefined();
    expect(field!.comparisons[0].before).toBe('court-001 (XXX)');
    expect(field!.comparisons[0].after).toBe('Eastern District of Missouri (XXX)');
    expect(field!.stackValues).toBe(true);
    expect(result.chapters).toEqual(['7']);
  });

  test('falls back to raw courtId when resolver returns undefined', () => {
    const result = buildAppointmentChangeSet({
      trusteeId: 'trustee-1',
      trusteeName: 'Henry Green',
      before: { ...baseSnapshot, courtId: 'court-A', divisionCodes: ['XXX'] },
      after: { ...baseSnapshot, courtId: 'court-B', divisionCodes: ['XXX'] },
      courtNameResolver: () => undefined,
      allDivisionsResolver: () => [],
    });

    const field = result.fields.find((f) => f.label === 'District (Division)');
    expect(field).toBeDefined();
    expect(field!.comparisons[0].before).toBe('court-A (XXX)');
    expect(field!.comparisons[0].after).toBe('court-B (XXX)');
    expect(field!.stackValues).toBe(true);
    expect(result.chapters).toEqual(['7']);
  });

  test('status change shows human-readable label for hyphenated status values', () => {
    const result = buildAppointmentChangeSet({
      ...noopResolvers,
      trusteeId: 'trustee-1',
      trusteeName: 'Henry Green',
      before: { ...baseSnapshot, status: 'active' },
      after: { ...baseSnapshot, status: 'voluntarily-suspended' },
    });

    const statusField = result.fields.find((f) => f.label === 'Status');
    expect(statusField).toBeDefined();
    expect(statusField!.comparisons[0].before).toBe('Active');
    expect(statusField!.comparisons[0].after).toBe('Voluntarily Suspended');
    expect(result.chapters).toEqual(['7']);
  });

  test('detects an appointmentType change', () => {
    const result = buildAppointmentChangeSet({
      ...noopResolvers,
      trusteeId: 'trustee-1',
      trusteeName: 'Henry Green',
      before: baseSnapshot,
      after: { ...baseSnapshot, appointmentType: 'off-panel' },
    });

    expect(result.fields).toHaveLength(1);
    expect(result.fields[0]).toEqual({
      label: 'Appointment Type',
      comparisons: [{ before: 'Panel', after: 'Off Panel' }],
      category: 'profile',
      section: 'appointment',
    });
    expect(result.subjectOverride).toBe('Trustee Appointment Changed: Henry Green');
    expect(result.chapters).toEqual(['7']);
  });

  test('detects an appointedDate change', () => {
    const result = buildAppointmentChangeSet({
      ...noopResolvers,
      trusteeId: 'trustee-1',
      trusteeName: 'Henry Green',
      before: baseSnapshot,
      after: { ...baseSnapshot, appointedDate: '2025-03-01' },
    });

    expect(result.fields).toHaveLength(1);
    expect(result.fields[0]).toEqual({
      label: 'Appointed Date',
      comparisons: [{ before: '2024-01-15', after: '2025-03-01' }],
      category: 'profile',
      section: 'appointment',
    });
    expect(result.chapters).toEqual(['7']);
  });

  test('resolves each division code to its human-readable name independently', () => {
    // '081' resolves to 'Manhattan', '071' resolves to 'Brooklyn'
    const result = buildAppointmentChangeSet({
      trusteeId: 'trustee-1',
      trusteeName: 'Henry Green',
      before: { ...baseSnapshot, courtId: 'court-sdny', divisionCodes: ['081'] },
      after: { ...baseSnapshot, courtId: 'court-sdny', divisionCodes: ['071'] },
      courtNameResolver: (id) =>
        id === 'court-sdny' ? 'Southern District of New York' : undefined,
      allDivisionsResolver: () => [],
    });
    const field = result.fields.find((f) => f.label === 'District (Division)');
    expect(field).toBeDefined();
    expect(field!.comparisons[0].before).toBe('Southern District of New York (Manhattan)');
    expect(field!.comparisons[0].after).toBe('Southern District of New York (Brooklyn)');
    expect(field!.stackValues).toBe(true);
    expect(result.chapters).toEqual(['7']);
  });

  test('falls back to raw code when division code has no matching name', () => {
    const result = buildAppointmentChangeSet({
      trusteeId: 'trustee-1',
      trusteeName: 'Henry Green',
      before: { ...baseSnapshot, divisionCodes: ['ZZZ'] },
      after: { ...baseSnapshot, divisionCodes: ['081'] },
      courtNameResolver: () => 'Eastern District',
      allDivisionsResolver: () => [],
    });
    const field = result.fields.find((f) => f.label === 'District (Division)');
    expect(field).toBeDefined();
    expect(field!.comparisons[0].before).toBe('Eastern District (ZZZ)');
    expect(field!.comparisons[0].after).toBe('Eastern District (Manhattan)');
    expect(field!.stackValues).toBe(true);
    expect(result.chapters).toEqual(['7']);
  });

  test('renders just district name when divisionCodes is empty', () => {
    const result = buildAppointmentChangeSet({
      trusteeId: 'trustee-1',
      trusteeName: 'Henry Green',
      before: { ...baseSnapshot, courtId: 'court-A', divisionCodes: [] },
      after: { ...baseSnapshot, courtId: 'court-B', divisionCodes: [] },
      courtNameResolver: (id) => (id === 'court-A' ? 'District A' : 'District B'),
      allDivisionsResolver: () => [],
    });
    const field = result.fields.find((f) => f.label === 'District (Division)');
    expect(field).toBeDefined();
    expect(field!.comparisons[0].before).toBe('District A');
    expect(field!.comparisons[0].after).toBe('District B');
    expect(field!.stackValues).toBe(true);
    expect(result.chapters).toEqual(['7']);
  });

  test('collapses to (All) when all known divisions are selected — no change emitted', () => {
    const result = buildAppointmentChangeSet({
      trusteeId: 'trustee-1',
      trusteeName: 'Henry Green',
      before: { ...baseSnapshot, divisionCodes: ['001', '002'] },
      after: { ...baseSnapshot, divisionCodes: ['001', '002'] },
      courtNameResolver: () => 'Test District',
      allDivisionsResolver: () => ['001', '002'],
    });
    expect(result.fields).toHaveLength(0);
  });

  test('collapses before to (All), after shows subset', () => {
    const result = buildAppointmentChangeSet({
      trusteeId: 'trustee-1',
      trusteeName: 'Henry Green',
      before: { ...baseSnapshot, divisionCodes: ['081', '071'] },
      after: { ...baseSnapshot, divisionCodes: ['081'] },
      courtNameResolver: () => 'Southern District of New York',
      allDivisionsResolver: () => ['081', '071'],
    });
    const field = result.fields.find((f) => f.label === 'District (Division)');
    expect(field).toBeDefined();
    expect(field!.comparisons[0].before).toBe('Southern District of New York (All)');
    expect(field!.comparisons[0].after).toBe('Southern District of New York (Manhattan)');
    expect(field!.stackValues).toBe(true);
    expect(result.chapters).toEqual(['7']);
  });

  test('does not collapse when allDivisionsResolver returns empty array', () => {
    const result = buildAppointmentChangeSet({
      trusteeId: 'trustee-1',
      trusteeName: 'Henry Green',
      before: { ...baseSnapshot, divisionCodes: ['081'] },
      after: { ...baseSnapshot, divisionCodes: ['081', '071'] },
      courtNameResolver: () => 'Southern District of New York',
      allDivisionsResolver: () => [],
    });
    const field = result.fields.find((f) => f.label === 'District (Division)');
    expect(field).toBeDefined();
    expect(field!.comparisons[0].before).toBe('Southern District of New York (Manhattan)');
    expect(field!.comparisons[0].after).toBe(
      'Southern District of New York (Manhattan)\nSouthern District of New York (Brooklyn)',
    );
    expect(field!.stackValues).toBe(true);
    expect(result.chapters).toEqual(['7']);
  });

  test('collapses single division that is the only known division', () => {
    const result = buildAppointmentChangeSet({
      trusteeId: 'trustee-1',
      trusteeName: 'Henry Green',
      before: { ...baseSnapshot, divisionCodes: ['081'] },
      after: { ...baseSnapshot, divisionCodes: ['081'] },
      courtNameResolver: () => 'Southern District of New York',
      allDivisionsResolver: () => ['081'],
    });
    expect(result.fields).toHaveLength(0);
  });

  test('before=subset stays stacked when after=all collapses', () => {
    const result = buildAppointmentChangeSet({
      trusteeId: 'trustee-1',
      trusteeName: 'Henry Green',
      before: { ...baseSnapshot, divisionCodes: ['081'] },
      after: { ...baseSnapshot, divisionCodes: ['081', '071'] },
      courtNameResolver: () => 'Southern District of New York',
      allDivisionsResolver: () => ['081', '071'],
    });
    const field = result.fields.find((f) => f.label === 'District (Division)');
    expect(field).toBeDefined();
    expect(field!.comparisons[0].before).toBe('Southern District of New York (Manhattan)');
    expect(field!.comparisons[0].after).toBe('Southern District of New York (All)');
    expect(field!.stackValues).toBe(true);
    expect(result.chapters).toEqual(['7']);
  });

  test('evaluates all-divisions collapse independently per courtId', () => {
    // '001' resolves to 'Portland'; court-A has one known division ('001') so it collapses,
    // court-B has two known divisions ('002','003') but only '002' assigned so it does not
    const result = buildAppointmentChangeSet({
      trusteeId: 'trustee-1',
      trusteeName: 'Henry Green',
      before: { ...baseSnapshot, courtId: 'court-A', divisionCodes: ['001'] },
      after: { ...baseSnapshot, courtId: 'court-B', divisionCodes: ['002'] },
      courtNameResolver: (id) => (id === 'court-A' ? 'District A' : 'District B'),
      allDivisionsResolver: (courtId) => (courtId === 'court-A' ? ['001'] : ['002', '003']),
    });
    const field = result.fields.find((f) => f.label === 'District (Division)');
    expect(field).toBeDefined();
    expect(field!.comparisons[0].before).toBe('District A (All)');
    expect(field!.comparisons[0].after).toBe('District B (Portland)');
    expect(field!.stackValues).toBe(true);
    expect(result.chapters).toEqual(['7']);
  });
});
