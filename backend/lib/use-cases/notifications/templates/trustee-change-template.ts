import { TrusteeChangeField, TrusteeChangeSet } from '@common/cams/notifications';
import { TRUSTEE_CHANGE_TEMPLATE } from './trustee-change.template';

export type CompiledTemplate = {
  subject: string;
  html: string;
  text: string;
};

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

function splitStackedValue(value: string): string[] {
  return value
    .replace(/[[\]]/g, '')
    .split(/[,;]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function formatCellValue(value: string, shouldStack: boolean): string {
  if (!value) return '';

  if (shouldStack) {
    const items = splitStackedValue(value);
    if (items.length > 1) {
      return items
        .map((item) => `<div style="margin: 0; padding: 0;">${escapeHtml(item)}</div>`)
        .join('');
    }
  }

  return escapeHtml(value);
}

function generateRow(field: TrusteeChangeField): string {
  const shouldStack = field.stackValues ?? false;
  const formattedPrevious = formatCellValue(field.before, shouldStack);
  const formattedNew = formatCellValue(field.after, shouldStack);

  return `
                                <tr class="change-row">
                                    <td width="200" style="border-bottom: 1px solid #000000; font-weight: bold; padding: 8px; width: 200px; min-width: 200px; max-width: 200px;">${escapeHtml(field.label)}</td>
                                    <td width="50%" style="border-bottom: 1px solid #000000; padding: 8px;">${formattedPrevious}</td>
                                    <td width="50%" style="border-bottom: 1px solid #000000; padding: 8px;">${formattedNew}</td>
                                </tr>`;
}

function compileRows(fields: TrusteeChangeField[]): string {
  return fields.map(generateRow).join('');
}

function flattenStackedForPlaintext(value: string, shouldStack: boolean): string {
  if (!value || !shouldStack) return value;
  const items = splitStackedValue(value);
  return items.length > 1 ? items.join(', ') : value;
}

function buildPlaintext(changeSet: TrusteeChangeSet): string {
  const safeName = changeSet.trusteeName.replace(/[\r\n]/g, ' ');
  const lines: string[] = [`Trustee ${safeName}'s information has changed.`];

  const appointmentFields = changeSet.fields.filter((f) => f.section === 'appointment');
  const meetingFields = changeSet.fields.filter((f) => f.section === 'meeting');

  if (appointmentFields.length > 0) {
    lines.push('', 'Appointment Information');
    for (const field of appointmentFields) {
      const shouldStack = field.stackValues ?? false;
      const before = flattenStackedForPlaintext(field.before, shouldStack);
      const after = flattenStackedForPlaintext(field.after, shouldStack);
      lines.push(`${field.label}: ${before} -> ${after}`);
    }
  }

  if (meetingFields.length > 0) {
    lines.push('', '341 Meeting Information');
    for (const field of meetingFields) {
      const shouldStack = field.stackValues ?? false;
      const before = flattenStackedForPlaintext(field.before, shouldStack);
      const after = flattenStackedForPlaintext(field.after, shouldStack);
      lines.push(`${field.label}: ${before} -> ${after}`);
    }
  }

  return lines.join('\n');
}

function stripTrailingWhitespace(html: string): string {
  return html
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n');
}

export function compileTrusteeChangeTemplate(changeSet: TrusteeChangeSet): CompiledTemplate {
  const appointmentRows = compileRows(changeSet.fields.filter((f) => f.section === 'appointment'));
  const meetingRows = compileRows(changeSet.fields.filter((f) => f.section === 'meeting'));

  const rendered = TRUSTEE_CHANGE_TEMPLATE.replaceAll(
    '{{trustee_name}}',
    escapeHtml(changeSet.trusteeName),
  )
    .replaceAll('{{appointment_info_rows}}', appointmentRows)
    .replaceAll('{{meeting_info_rows}}', meetingRows);

  const rawSubject =
    changeSet.subjectOverride ?? `Trustee Information Changed: ${changeSet.trusteeName}`;
  const subject = rawSubject.replace(/[\r\n]/g, ' ');

  return {
    subject,
    html: stripTrailingWhitespace(rendered),
    text: buildPlaintext(changeSet),
  };
}
