const DEFAULT_OWNER = 'US-Trustee-Program';
const DEFAULT_REPO = 'Bankruptcy-Oversight-Support-Systems';
const DEFAULT_WORKFLOW_FILE_NAME = 'continuous-deployment.yml';
const DEFAULT_BRANCH = 'main';
const DEFAULT_TICKET_LABEL_PATTERN = '^CAMS-\\d+$';
// Buckets line up with calendar weeks (Monday 00:00 UTC) only at 7. Other DORA_PERIOD_DAYS values
// still end on the snapped Monday but their bucket starts are not calendar-aligned.
const DEFAULT_PERIOD_DAYS = 7;
const DEFAULT_LOOKBACK_WEEKS = 13;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

export type ReportOptions = {
  owner: string;
  repo: string;
  workflowFileName: string;
  branch: string;
  ticketLabelPattern: RegExp;
  startDate: Date;
  periodDays: number;
  endDate: Date;
};

function resolveEnvVar(name: string, defaultValue: string): string {
  const raw = process.env[name];
  return raw ? raw : defaultValue;
}

// Most recent Monday 00:00:00.000 UTC at or before now, so reports cover complete calendar weeks only.
function resolveEndDate(): Date {
  const now = new Date();
  const daysSinceMonday = (now.getUTCDay() + 6) % 7;
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceMonday),
  );
}

function resolveStartDate(endDate: Date): Date {
  const raw = process.env.DORA_START_DATE;
  if (raw) {
    const startDate = new Date(raw);
    if (Number.isNaN(startDate.getTime())) {
      throw new Error(`Invalid DORA_START_DATE: ${raw}`);
    }
    if (startDate.getTime() > endDate.getTime()) {
      throw new Error(
        `DORA_START_DATE ${raw} is after the report end ${endDate.toISOString()} (most recent Monday 00:00 UTC)`,
      );
    }
    return startDate;
  }
  return new Date(endDate.getTime() - DEFAULT_LOOKBACK_WEEKS * MS_PER_WEEK);
}

function resolvePeriodDays(): number {
  const raw = process.env.DORA_PERIOD_DAYS;
  return raw ? Number(raw) : DEFAULT_PERIOD_DAYS;
}

function resolveTicketLabelPattern(): RegExp {
  const source = resolveEnvVar('DORA_TICKET_LABEL_PATTERN', DEFAULT_TICKET_LABEL_PATTERN);
  try {
    return new RegExp(source);
  } catch {
    throw new Error(`Invalid DORA_TICKET_LABEL_PATTERN: ${source}`);
  }
}

export function resolveReportOptions(): ReportOptions {
  const endDate = resolveEndDate();
  return {
    owner: resolveEnvVar('DORA_OWNER', DEFAULT_OWNER),
    repo: resolveEnvVar('DORA_REPO', DEFAULT_REPO),
    workflowFileName: resolveEnvVar('DORA_WORKFLOW_FILE_NAME', DEFAULT_WORKFLOW_FILE_NAME),
    branch: resolveEnvVar('DORA_BRANCH', DEFAULT_BRANCH),
    ticketLabelPattern: resolveTicketLabelPattern(),
    startDate: resolveStartDate(endDate),
    periodDays: resolvePeriodDays(),
    endDate,
  };
}
