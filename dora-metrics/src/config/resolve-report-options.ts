const DEFAULT_OWNER = 'US-Trustee-Program';
const DEFAULT_REPO = 'Bankruptcy-Oversight-Support-Systems';
const DEFAULT_WORKFLOW_FILE_NAME = 'continuous-deployment.yml';
const DEFAULT_PERIOD_DAYS = 7;
const DEFAULT_LOOKBACK_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type ReportOptions = {
  owner: string;
  repo: string;
  workflowFileName: string;
  startDate: Date;
  periodDays: number;
  endDate: Date;
};

function resolveEnvVar(name: string, defaultValue: string): string {
  const raw = process.env[name];
  return raw ? raw : defaultValue;
}

function resolveStartDate(): Date {
  const raw = process.env.DORA_START_DATE;
  if (raw) {
    const startDate = new Date(raw);
    if (Number.isNaN(startDate.getTime())) {
      throw new Error(`Invalid DORA_START_DATE: ${raw}`);
    }
    return startDate;
  }
  return new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * MS_PER_DAY);
}

function resolvePeriodDays(): number {
  const raw = process.env.DORA_PERIOD_DAYS;
  return raw ? Number(raw) : DEFAULT_PERIOD_DAYS;
}

export function resolveReportOptions(): ReportOptions {
  return {
    owner: resolveEnvVar('DORA_OWNER', DEFAULT_OWNER),
    repo: resolveEnvVar('DORA_REPO', DEFAULT_REPO),
    workflowFileName: resolveEnvVar('DORA_WORKFLOW_FILE_NAME', DEFAULT_WORKFLOW_FILE_NAME),
    startDate: resolveStartDate(),
    periodDays: resolvePeriodDays(),
    endDate: new Date(),
  };
}
