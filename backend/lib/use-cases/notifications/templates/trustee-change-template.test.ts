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
    chapters: ['7'],
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
              comparisons: [{ before: 'a@b.test', after: 'c@d.test' }],
              category: 'profile',
              section: 'appointment',
            },
          ],
          { trusteeName: 'Smith & Co' },
        ),
      );

      expect(result.subject).toBe('Trustee Information Changed: Smith & Co');
    });

    test('uses the default subject when subjectOverride is not set', () => {
      const result = compileTrusteeChangeTemplate(
        buildChangeSet([
          {
            label: 'Public Email',
            comparisons: [{ before: 'a@b.test', after: 'c@d.test' }],
            category: 'profile',
            section: 'appointment',
          },
        ]),
      );

      expect(result.subject).toBe('Trustee Information Changed: Henry Green');
    });

    test('uses subjectOverride when provided', () => {
      const result = compileTrusteeChangeTemplate(
        buildChangeSet(
          [
            {
              label: 'Chapter',
              comparisons: [{ before: '7', after: '11 Subchapter V' }],
              category: 'profile',
              section: 'appointment',
            },
          ],
          { subjectOverride: 'Trustee Appointment Changed: Henry Green' },
        ),
      );

      expect(result.subject).toBe('Trustee Appointment Changed: Henry Green');
    });

    test('strips CRLF from subjectOverride to prevent header injection', () => {
      const result = compileTrusteeChangeTemplate(
        buildChangeSet(
          [
            {
              label: 'Chapter',
              comparisons: [{ before: '7', after: '11' }],
              category: 'profile',
              section: 'appointment',
            },
          ],
          { subjectOverride: 'Appointment Changed\r\nBcc: attacker@evil.test' },
        ),
      );

      expect(result.subject).toBe('Appointment Changed  Bcc: attacker@evil.test');
      expect(result.subject).not.toContain('\r');
      expect(result.subject).not.toContain('\n');
    });
  });

  describe('html', () => {
    test('renders multiple appointment rows for a multi-field profile change', () => {
      const result = compileTrusteeChangeTemplate(
        buildChangeSet([
          {
            label: 'Name',
            comparisons: [{ before: 'Henry Green', after: 'Henry G. Green' }],
            category: 'profile',
            section: 'appointment',
          },
          {
            label: 'Public Email',
            comparisons: [{ before: 'a@b.test', after: 'c@d.test' }],
            category: 'profile',
            section: 'appointment',
          },
          {
            label: 'Software',
            comparisons: [{ before: 'OldSoft', after: 'NewSoft' }],
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
            comparisons: [
              { before: 'Manhattan, Queens', after: 'Brooklyn, Queens, Staten Island' },
            ],
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

    test('renders semicolon-separated and bracketed stackValues fields as multiple <div> lines', () => {
      const result = compileTrusteeChangeTemplate(
        buildChangeSet([
          {
            label: 'Division(s)',
            comparisons: [{ before: '[Manhattan; Queens]', after: '[Brooklyn; Staten Island]' }],
            category: 'profile',
            section: 'appointment',
            stackValues: true,
          },
        ]),
      );

      expect(result.html).toContain(
        '<div style="margin: 0; padding: 0;">Brooklyn</div><div style="margin: 0; padding: 0;">Staten Island</div>',
      );
      expect(result.html).toContain(
        '<div style="margin: 0; padding: 0;">Manhattan</div><div style="margin: 0; padding: 0;">Queens</div>',
      );
    });

    test('renders a single-item stackValues field without propertyName as plain escaped text', () => {
      const result = compileTrusteeChangeTemplate(
        buildChangeSet([
          {
            label: 'Division(s)',
            comparisons: [{ before: 'Manhattan', after: 'Brooklyn' }],
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

    test('renders a comparison with propertyName as a bold label', () => {
      const result = compileTrusteeChangeTemplate(
        buildChangeSet([
          {
            label: 'Public Contact',
            comparisons: [
              {
                propertyName: 'Website',
                before: 'https://old.example.com',
                after: 'https://new.example.com',
              },
            ],
            category: 'profile',
            section: 'appointment',
          },
        ]),
      );

      expect(result.html).toContain('<strong>Website:</strong> https://old.example.com');
      expect(result.html).toContain('<strong>Website:</strong> https://new.example.com');
    });

    test('renders multiple comparisons in a single row when they share a label', () => {
      const result = compileTrusteeChangeTemplate(
        buildChangeSet([
          {
            label: 'Public Contact',
            comparisons: [
              { propertyName: 'Email', before: 'old@example.com', after: 'new@example.com' },
              { propertyName: 'Website', before: 'https://old.com', after: 'https://new.com' },
            ],
            category: 'profile',
            section: 'appointment',
          },
        ]),
      );

      const rowCount = (result.html.match(/class="change-row"/g) ?? []).length;
      expect(rowCount).toBe(1);
      expect(result.html).toContain('<strong>Email:</strong> old@example.com');
      expect(result.html).toContain('<strong>Email:</strong> new@example.com');
      expect(result.html).toContain('<strong>Website:</strong> https://old.com');
      expect(result.html).toContain('<strong>Website:</strong> https://new.com');
    });

    test('escapes HTML special characters in field values', () => {
      const result = compileTrusteeChangeTemplate(
        buildChangeSet([
          {
            label: 'Public Email',
            comparisons: [{ before: '', after: '<script>alert(1)</script>' }],
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
              comparisons: [{ before: '', after: 'x@y.test' }],
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

    test('appointment section is omitted when only meeting fields changed', () => {
      const result = compileTrusteeChangeTemplate(
        buildChangeSet([
          {
            label: 'Zoom Link',
            comparisons: [{ before: 'https://zoom.us/old', after: 'https://zoom.us/new' }],
            category: 'zoom-341',
            section: 'meeting',
          },
        ]),
      );

      expect(result.html).toContain('Zoom Link');
      expect(result.html).not.toContain('Appointment Information');
    });
  });

  describe('text (plaintext fallback)', () => {
    test('renders Label: before -> after for a single profile change', () => {
      const result = compileTrusteeChangeTemplate(
        buildChangeSet([
          {
            label: 'Public Email',
            comparisons: [{ before: 'old@example.test', after: 'new@example.test' }],
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
            comparisons: [{ before: 'Henry Green', after: 'Henry G. Green' }],
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
            comparisons: [{ before: 'https://zoom.us/old', after: 'https://zoom.us/new' }],
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
            comparisons: [{ before: 'Henry Green', after: 'Henry G. Green' }],
            category: 'profile',
            section: 'appointment',
          },
          {
            label: 'Zoom Link',
            comparisons: [{ before: 'https://zoom.us/old', after: 'https://zoom.us/new' }],
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
            comparisons: [
              { before: 'Manhattan, Queens', after: 'Brooklyn, Queens, Staten Island' },
            ],
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

    test('flattens semicolon-separated and bracketed cells to comma-separated for plaintext', () => {
      const result = compileTrusteeChangeTemplate(
        buildChangeSet([
          {
            label: 'Division(s)',
            comparisons: [{ before: '[Manhattan; Queens]', after: '[Brooklyn; Staten Island]' }],
            category: 'profile',
            section: 'appointment',
            stackValues: true,
          },
        ]),
      );

      expect(result.text).toContain('Division(s): Manhattan, Queens -> Brooklyn, Staten Island');
    });

    test('leaves single-item stackValues field as-is in plaintext', () => {
      const result = compileTrusteeChangeTemplate(
        buildChangeSet([
          {
            label: 'Division(s)',
            comparisons: [{ before: 'Manhattan', after: 'Brooklyn' }],
            category: 'profile',
            section: 'appointment',
            stackValues: true,
          },
        ]),
      );

      expect(result.text).toContain('Division(s): Manhattan -> Brooklyn');
    });

    test('renders propertyName in plaintext as PropertyName: value', () => {
      const result = compileTrusteeChangeTemplate(
        buildChangeSet([
          {
            label: 'Public Contact',
            comparisons: [
              { propertyName: 'Email', before: 'old@example.test', after: 'new@example.test' },
              { propertyName: 'Website', before: 'https://old.com', after: 'https://new.com' },
            ],
            category: 'profile',
            section: 'appointment',
          },
        ]),
      );

      expect(result.text).toContain(
        'Public Contact: Email: old@example.test -> Email: new@example.test',
      );
      expect(result.text).toContain(
        'Public Contact: Website: https://old.com -> Website: https://new.com',
      );
    });
  });

  describe('snapshot', () => {
    test('matches the rendered HTML for a representative multi-field change', () => {
      const result = compileTrusteeChangeTemplate(
        buildChangeSet([
          {
            label: 'Name',
            comparisons: [{ before: 'Henry Green', after: 'Henry G. Green' }],
            category: 'profile',
            section: 'appointment',
          },
          {
            label: 'Division(s)',
            comparisons: [
              { before: 'Manhattan, Queens', after: 'Brooklyn, Queens, Staten Island' },
            ],
            category: 'profile',
            section: 'appointment',
            stackValues: true,
          },
          {
            label: 'Zoom Link',
            comparisons: [
              { before: 'https://zoom.us/j/1234567890', after: 'https://zoom.us/j/9876543210' },
            ],
            category: 'zoom-341',
            section: 'meeting',
          },
        ]),
      );

      expect(result.html).toMatchSnapshot();
    });
  });

  describe('author and profile link section', () => {
    const baseChangeSet: TrusteeChangeSet = {
      trusteeId: 'trustee-1',
      trusteeName: 'Henry Green',
      fields: [
        {
          label: 'Name',
          comparisons: [{ before: 'Henry Green', after: 'Henry G. Green' }],
          category: 'profile',
          section: 'appointment',
        },
      ],
    };

    test('renders author name and email in the footer when author is provided', () => {
      const result = compileTrusteeChangeTemplate({
        ...baseChangeSet,
        author: { name: 'Alex Rivera', email: 'alex@ustp.test' },
        changedAt: '2026-06-26T14:30:00.000Z',
      });

      expect(result.html).toContain(
        'Changed by Alex Rivera (alex@ustp.test) on 06/26/2026 2:30 PM UTC',
      );
    });

    test('renders author name without email when email is undefined', () => {
      const result = compileTrusteeChangeTemplate({
        ...baseChangeSet,
        author: { name: 'Alex Rivera' },
        changedAt: '2026-06-26T14:30:00.000Z',
      });

      expect(result.html).toContain('Changed by Alex Rivera on 06/26/2026 2:30 PM UTC');
      expect(result.html).not.toContain('(');
    });

    test('renders profile link when profileLink is provided', () => {
      const result = compileTrusteeChangeTemplate({
        ...baseChangeSet,
        author: { name: 'Alex Rivera', email: 'alex@ustp.test' },
        changedAt: '2026-06-26T14:30:00.000Z',
        profileLink: 'https://cams.ustp.gov/trustees/trustee-1',
      });

      expect(result.html).toContain('href="https://cams.ustp.gov/trustees/trustee-1"');
      expect(result.html).toContain('View Trustee Profile in CAMS');
    });

    test('omits profile link paragraph when profileLink is undefined', () => {
      const result = compileTrusteeChangeTemplate({
        ...baseChangeSet,
        author: { name: 'Alex Rivera', email: 'alex@ustp.test' },
        changedAt: '2026-06-26T14:30:00.000Z',
      });

      expect(result.html).toContain(
        'Changed by Alex Rivera (alex@ustp.test) on 06/26/2026 2:30 PM UTC',
      );
      expect(result.html).not.toContain('View Trustee Profile');
    });

    test('omits entire author section when author is undefined', () => {
      const result = compileTrusteeChangeTemplate(baseChangeSet);

      expect(result.html).not.toContain('Changed by');
      expect(result.html).not.toContain('View Trustee Profile');
    });

    test('escapes HTML in author name and email', () => {
      const result = compileTrusteeChangeTemplate({
        ...baseChangeSet,
        author: { name: '<script>alert(1)</script>', email: 'x"@y.com' },
        changedAt: '2026-06-26T14:30:00.000Z',
      });

      expect(result.html).toContain('&lt;script&gt;');
      expect(result.html).toContain('&quot;');
      expect(result.html).not.toContain('<script>alert');
    });

    test('plaintext includes author and link when both are provided', () => {
      const result = compileTrusteeChangeTemplate({
        ...baseChangeSet,
        author: { name: 'Alex Rivera', email: 'alex@ustp.test' },
        changedAt: '2026-06-26T14:30:00.000Z',
        profileLink: 'https://cams.ustp.gov/trustees/trustee-1',
      });

      expect(result.text).toContain(
        'Changed by Alex Rivera (alex@ustp.test) on 06/26/2026 2:30 PM UTC',
      );
      expect(result.text).toContain('View profile: https://cams.ustp.gov/trustees/trustee-1');
    });

    test('plaintext omits author line when author is undefined', () => {
      const result = compileTrusteeChangeTemplate(baseChangeSet);

      expect(result.text).not.toContain('Changed by');
      expect(result.text).not.toContain('View profile');
    });
  });
});
