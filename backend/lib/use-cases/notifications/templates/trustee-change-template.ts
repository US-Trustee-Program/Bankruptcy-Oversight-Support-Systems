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

const STACK_ITEM_STYLE = 'margin: 0; padding: 0;';

function splitListValue(value: string): string[] {
  return value
    .replace(/[[\]]/g, '')
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function formatCellValue(
  value: string,
  propertyName: string | undefined,
  shouldStack: boolean,
): string {
  if (!value) return '';

  if (propertyName) {
    return `<div style="${STACK_ITEM_STYLE}"><strong>${escapeHtml(propertyName)}:</strong> ${escapeHtml(value)}</div>`;
  }

  if (shouldStack) {
    const items = splitListValue(value);
    if (items.length > 1) {
      return items
        .map((item) => `<div style="${STACK_ITEM_STYLE}">${escapeHtml(item)}</div>`)
        .join('');
    }
  }

  return escapeHtml(value);
}

function buildChangedAtSuffix(iso?: string): string {
  return iso ? ` on ${formatTimestamp(iso)}` : '';
}

function generateRow(field: TrusteeChangeField): string {
  const shouldStack = field.stackValues ?? false;
  const beforeCell = field.comparisons
    .map((c) => formatCellValue(c.before, c.propertyName, shouldStack))
    .filter(Boolean)
    .join('');
  const afterCell = field.comparisons
    .map((c) => formatCellValue(c.after, c.propertyName, shouldStack))
    .filter(Boolean)
    .join('');

  return `
                                <tr class="change-row">
                                    <td width="200" style="border-bottom: 1px solid #000000; font-weight: bold; padding: 8px; width: 200px; min-width: 200px; max-width: 200px;">${escapeHtml(field.label)}</td>
                                    <td width="50%" style="border-bottom: 1px solid #000000; padding: 8px;">${beforeCell}</td>
                                    <td width="50%" style="border-bottom: 1px solid #000000; padding: 8px;">${afterCell}</td>
                                </tr>`;
}

function compileRows(fields: TrusteeChangeField[]): string {
  return fields.map(generateRow).join('');
}

function formatPlaintextValue(
  value: string,
  propertyName: string | undefined,
  shouldStack: boolean,
): string {
  if (!value) return value;
  if (propertyName) return `${propertyName}: ${value}`;
  if (shouldStack) {
    const items = splitListValue(value);
    return items.length > 1 ? items.join(', ') : value;
  }
  return value;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  const year = date.getUTCFullYear();
  const rawHours = date.getUTCHours();
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  const ampm = rawHours >= 12 ? 'PM' : 'AM';
  const hours = rawHours % 12 || 12;
  return `${month}/${day}/${year} ${hours}:${minutes} ${ampm} UTC`;
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
      for (const c of field.comparisons) {
        const before = formatPlaintextValue(c.before, c.propertyName, shouldStack);
        const after = formatPlaintextValue(c.after, c.propertyName, shouldStack);
        lines.push(`${field.label}: ${before} -> ${after}`);
      }
    }
  }

  if (meetingFields.length > 0) {
    lines.push('', '341 Meeting Information');
    for (const field of meetingFields) {
      const shouldStack = field.stackValues ?? false;
      for (const c of field.comparisons) {
        const before = formatPlaintextValue(c.before, c.propertyName, shouldStack);
        const after = formatPlaintextValue(c.after, c.propertyName, shouldStack);
        lines.push(`${field.label}: ${before} -> ${after}`);
      }
    }
  }

  if (changeSet.author) {
    const emailPart = changeSet.author.email ? ` (${changeSet.author.email})` : '';
    const timePart = buildChangedAtSuffix(changeSet.changedAt);
    lines.push('', `Changed by ${changeSet.author.name}${emailPart}${timePart}`);
    if (changeSet.profileLink) {
      lines.push(`View profile: ${changeSet.profileLink}`);
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

function renderSection(sectionHtml: string, rows: string): string {
  if (!rows) return '';
  return sectionHtml;
}

function buildAuthorSection(changeSet: TrusteeChangeSet): string {
  if (!changeSet.author) return '';

  const name = escapeHtml(changeSet.author.name);
  const emailDisplay = changeSet.author.email ? ` (${escapeHtml(changeSet.author.email)})` : '';
  const timestamp = escapeHtml(buildChangedAtSuffix(changeSet.changedAt));

  const profileLinkHtml = changeSet.profileLink
    ? `\n                            <p style="margin: 0; font-size: 13px;"><a href="${escapeHtml(changeSet.profileLink)}" style="color: #005ea2;">View Trustee Profile in CAMS</a></p>`
    : '';

  return `<tr>
                        <td style="padding-top: 10px;">
                            <p style="margin: 0 0 8px 0; font-size: 13px; color: #333333;">Changed by ${name}${emailDisplay}${timestamp}</p>${profileLinkHtml}
                        </td>
                    </tr>`;
}

export function compileTrusteeChangeTemplate(changeSet: TrusteeChangeSet): CompiledTemplate {
  const appointmentFields = changeSet.fields.filter((f) => f.section === 'appointment');
  const meetingFields = changeSet.fields.filter((f) => f.section === 'meeting');
  const appointmentRows = compileRows(appointmentFields);
  const meetingRows = compileRows(meetingFields);

  const rendered = TRUSTEE_CHANGE_TEMPLATE.replaceAll(
    '{{trustee_name}}',
    escapeHtml(changeSet.trusteeName),
  )
    .replace(
      /<!-- Appointment Information Section -->[\s\S]*?{{appointment_info_rows}}[\s\S]*?<\/td>\s*<\/tr>/,
      (match) =>
        renderSection(match.replace('{{appointment_info_rows}}', appointmentRows), appointmentRows),
    )
    .replace(
      /<!-- 341 Meeting Information Section -->[\s\S]*?{{meeting_info_rows}}[\s\S]*?<\/td>\s*<\/tr>/,
      (match) => renderSection(match.replace('{{meeting_info_rows}}', meetingRows), meetingRows),
    )
    .replace('{{author_section}}', buildAuthorSection(changeSet));

  const rawSubject =
    changeSet.subjectOverride ?? `Trustee Information Changed: ${changeSet.trusteeName}`;
  const subject = rawSubject.replace(/[\r\n]/g, ' ');

  return {
    subject,
    html: stripTrailingWhitespace(rendered),
    text: buildPlaintext(changeSet),
  };
}
