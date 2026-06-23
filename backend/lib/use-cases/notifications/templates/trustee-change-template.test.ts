import { TrusteeChangeField, TrusteeChangeSet } from '@common/cams/notifications';
import { compileTrusteeChangeTemplate } from './trustee-change-template';

function buildChangeSet(
  fields: TrusteeChangeField[],
  overrides: Partial<TrusteeChangeSet> = {},
): TrusteeChangeSet {
  return {
    trusteeId: 'trustee-1',
    trusteeName: 'Henry Green',
    fields,
    primaryChapter: '7',
    ...overrides,
  };
}

describe('compileTrusteeChangeTemplate', () => {
  describe('subject', () => {
    test('uses the un-escaped trustee name', () => {
      const result = compileTrusteeChangeTemplate(
        buildChangeSet(
          [
            {
              label: 'Public Email',
              before: 'a@b.test',
              after: 'c@d.test',
              category: 'profile',
              section: 'appointment',
            },
          ],
          { trusteeName: 'Smith & Co' },
        ),
      );

      expect(result.subject).toBe('Trustee Information Changed: Smith & Co');
    });
  });

  describe('html', () => {
    test('renders multiple appointment rows for a multi-field profile change', () => {
      const result = compileTrusteeChangeTemplate(
        buildChangeSet([
          {
            label: 'Name',
            before: 'Henry Green',
            after: 'Henry G. Green',
            category: 'profile',
            section: 'appointment',
          },
          {
            label: 'Public Email',
            before: 'a@b.test',
            after: 'c@d.test',
            category: 'profile',
            section: 'appointment',
          },
          {
            label: 'Software',
            before: 'OldSoft',
            after: 'NewSoft',
            category: 'profile',
            section: 'appointment',
          },
        ]),
      );

      const rowCount = (result.html.match(/class="change-row"/g) ?? []).length;
      expect(rowCount).toBe(3);
      expect(result.html).toContain('Name');
      expect(result.html).toContain('Public Email');
      expect(result.html).toContain('Software');
    });

    test('renders comma-separated stackValues fields as multiple <div> lines', () => {
      const result = compileTrusteeChangeTemplate(
        buildChangeSet([
          {
            label: 'Division(s)',
            before: 'Manhattan, Queens',
            after: 'Brooklyn, Queens, Staten Island',
            category: 'profile',
            section: 'appointment',
            stackValues: true,
          },
        ]),
      );

      expect(result.html).toContain(
        '<div style="margin: 0; padding: 0;">Brooklyn</div><div style="margin: 0; padding: 0;">Queens</div><div style="margin: 0; padding: 0;">Staten Island</div>',
      );
      expect(result.html).toContain(
        '<div style="margin: 0; padding: 0;">Manhattan</div><div style="margin: 0; padding: 0;">Queens</div>',
      );
    });

    test('renders a single-item stackValues field as plain escaped text, not stacked divs', () => {
      const result = compileTrusteeChangeTemplate(
        buildChangeSet([
          {
            label: 'Division(s)',
            before: 'Manhattan',
            after: 'Brooklyn',
            category: 'profile',
            section: 'appointment',
            stackValues: true,
          },
        ]),
      );

      expect(result.html).not.toContain('<div style="margin: 0; padding: 0;">');
      expect(result.html).toContain('Manhattan');
      expect(result.html).toContain('Brooklyn');
    });

    test('escapes HTML special characters in field values', () => {
      const result = compileTrusteeChangeTemplate(
        buildChangeSet([
          {
            label: 'Public Email',
            before: '',
            after: '<script>alert(1)</script>',
            category: 'profile',
            section: 'appointment',
          },
        ]),
      );

      expect(result.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(result.html).not.toContain('<script>alert(1)</script>');
    });

    test('escapes HTML special characters in the trustee name in the body', () => {
      const result = compileTrusteeChangeTemplate(
        buildChangeSet(
          [
            {
              label: 'Public Email',
              before: '',
              after: 'x@y.test',
              category: 'profile',
              section: 'appointment',
            },
          ],
          { trusteeName: 'Smith <b>&</b> Co' },
        ),
      );

      expect(result.html).toContain("Trustee Smith &lt;b&gt;&amp;&lt;/b&gt; Co's information");
      expect(result.html).not.toContain('Smith <b>&</b> Co');
    });

    test('appointment section is empty when only meeting fields changed', () => {
      const result = compileTrusteeChangeTemplate(
        buildChangeSet([
          {
            label: 'Zoom Link',
            before: 'https://zoom.us/old',
            after: 'https://zoom.us/new',
            category: 'zoom-341',
            section: 'meeting',
          },
        ]),
      );

      expect(result.html).toContain('Zoom Link');
      // No appointment-section data rows.
      const appointmentRows = result.html
        .split('Appointment Information')[1]
        .split('341 Meeting Information')[0]
        .match(/class="change-row"/g);
      expect(appointmentRows).toBeNull();
    });
  });

  describe('text (plaintext fallback)', () => {
    test('renders Label: before -> after for a single profile change', () => {
      const result = compileTrusteeChangeTemplate(
        buildChangeSet([
          {
            label: 'Public Email',
            before: 'old@example.test',
            after: 'new@example.test',
            category: 'profile',
            section: 'appointment',
          },
        ]),
      );

      expect(result.text).toBe(
        [
          "Trustee Henry Green's information has changed.",
          '',
          'Appointment Information',
          'Public Email: old@example.test -> new@example.test',
        ].join('\n'),
      );
    });

    test('omits the meeting section when no meeting fields are present', () => {
      const result = compileTrusteeChangeTemplate(
        buildChangeSet([
          {
            label: 'Name',
            before: 'Henry Green',
            after: 'Henry G. Green',
            category: 'profile',
            section: 'appointment',
          },
        ]),
      );

      expect(result.text).not.toContain('341 Meeting Information');
    });

    test('omits the appointment section when no appointment fields are present', () => {
      const result = compileTrusteeChangeTemplate(
        buildChangeSet([
          {
            label: 'Zoom Link',
            before: 'https://zoom.us/old',
            after: 'https://zoom.us/new',
            category: 'zoom-341',
            section: 'meeting',
          },
        ]),
      );

      expect(result.text).not.toContain('Appointment Information');
      expect(result.text).toContain('341 Meeting Information');
      expect(result.text).toContain('Zoom Link: https://zoom.us/old -> https://zoom.us/new');
    });

    test('renders both sections when both have changes', () => {
      const result = compileTrusteeChangeTemplate(
        buildChangeSet([
          {
            label: 'Name',
            before: 'Henry Green',
            after: 'Henry G. Green',
            category: 'profile',
            section: 'appointment',
          },
          {
            label: 'Zoom Link',
            before: 'https://zoom.us/old',
            after: 'https://zoom.us/new',
            category: 'zoom-341',
            section: 'meeting',
          },
        ]),
      );

      expect(result.text).toContain('Appointment Information');
      expect(result.text).toContain('Name: Henry Green -> Henry G. Green');
      expect(result.text).toContain('341 Meeting Information');
      expect(result.text).toContain('Zoom Link: https://zoom.us/old -> https://zoom.us/new');
    });

    test('flattens stacked-multivalue cells to comma-separated for plaintext', () => {
      const result = compileTrusteeChangeTemplate(
        buildChangeSet([
          {
            label: 'Division(s)',
            before: 'Manhattan, Queens',
            after: 'Brooklyn, Queens, Staten Island',
            category: 'profile',
            section: 'appointment',
            stackValues: true,
          },
        ]),
      );

      expect(result.text).toContain(
        'Division(s): Manhattan, Queens -> Brooklyn, Queens, Staten Island',
      );
    });

    test('leaves single-item stackValues field as-is in plaintext', () => {
      const result = compileTrusteeChangeTemplate(
        buildChangeSet([
          {
            label: 'Division(s)',
            before: 'Manhattan',
            after: 'Brooklyn',
            category: 'profile',
            section: 'appointment',
            stackValues: true,
          },
        ]),
      );

      expect(result.text).toContain('Division(s): Manhattan -> Brooklyn');
    });
  });

  describe('snapshot', () => {
    test('matches the rendered HTML for a representative multi-field change', () => {
      const result = compileTrusteeChangeTemplate(
        buildChangeSet([
          {
            label: 'Name',
            before: 'Henry Green',
            after: 'Henry G. Green',
            category: 'profile',
            section: 'appointment',
          },
          {
            label: 'Division(s)',
            before: 'Manhattan, Queens',
            after: 'Brooklyn, Queens, Staten Island',
            category: 'profile',
            section: 'appointment',
            stackValues: true,
          },
          {
            label: 'Zoom Link',
            before: 'https://zoom.us/j/1234567890',
            after: 'https://zoom.us/j/9876543210',
            category: 'zoom-341',
            section: 'meeting',
          },
        ]),
      );

      expect(result.html).toMatchSnapshot();
    });
  });
});
