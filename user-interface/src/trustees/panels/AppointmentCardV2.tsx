import './AppointmentCardV2.scss';
import { TrusteeAppointment, isChapter12Standing, isChapter13Standing } from '@common/cams/trustee-appointments';
import {
  TrusteeUpcomingKeyDates,
  CompletionStatus,
  isoToMMDDYYYY,
  isoToMMDD,
  isoToMMYYYY,
  isoRangeToMMDD,
  calculateAuditReqBy,
} from '@common/cams/trustee-upcoming-key-dates';
import { formatDate } from '@/lib/utils/datetime';
import { useNavigate } from 'react-router-dom';
import Tag, { UswdsTagStyle } from '@/lib/components/uswds/Tag';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';

const NO_DATE = 'No date added';

export interface AppointmentCardV2Props {
  appointment: TrusteeAppointment;
  keyDatesData: TrusteeUpcomingKeyDates | null;
  isLoading: boolean;
  canManage: boolean;
  appointmentHeading: string;
  onEditKeyDates: (section: 'audit' | 'tpr' | 'tir' | 'annual-report' | 'other') => void;
}

function StatusTag({ year, status }: { year?: number; status?: CompletionStatus }) {
  if (!year || !status) return null;
  const isComplete = status === 'COMPLETE';
  return (
    <Tag uswdsStyle={isComplete ? UswdsTagStyle.Green : UswdsTagStyle.Secondary}>
      {isComplete ? 'Complete' : 'Incomplete'} for {year}
    </Tag>
  );
}

function ReportCard({
  title,
  onEdit,
  canManage,
  statusYear,
  statusValue,
  children,
}: {
  title: string;
  onEdit: () => void;
  canManage: boolean;
  statusYear?: number;
  statusValue?: CompletionStatus;
  children: React.ReactNode;
}) {
  return (
    <div className="appointment-v2-report-card">
      <div className="appointment-v2-report-card-header">
        <div className="appointment-v2-report-card-title-row">
          <h4>{title}</h4>
          <StatusTag year={statusYear} status={statusValue} />
        </div>
        {canManage && (
          <Button
            id={`edit-${title.toLowerCase().replace(/\s+/g, '-')}`}
            uswdsStyle={UswdsButtonStyle.Unstyled}
            onClick={onEdit}
          >
            <IconLabel icon="edit" label="Edit" />
          </Button>
        )}
      </div>
      <div className="appointment-v2-report-card-body">{children}</div>
    </div>
  );
}

function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: (string | undefined)[][];
}) {
  return (
    <table className="appointment-v2-table">
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col}>{col}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j}>{cell && cell !== NO_DATE ? cell : ''}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AuditFieldExamCard({
  data,
  canManage,
  onEdit,
  variant,
}: {
  data: TrusteeUpcomingKeyDates | null;
  canManage: boolean;
  onEdit: () => void;
  variant: 'chapter7' | 'chapter12' | 'chapter13';
}) {
  const auditReqByYear = calculateAuditReqBy(data?.lastAuditFiscalYear);

  if (variant === 'chapter12') {
    const columns = ['Audit Recommended by', 'Last Audit Report Date', "Last Audit's Fiscal Year"];
    const rows = [
      [
        auditReqByYear !== null ? String(auditReqByYear) : NO_DATE,
        data?.pastAudit ? isoToMMDDYYYY(data.pastAudit) : NO_DATE,
        data?.lastAuditFiscalYear ? String(data.lastAuditFiscalYear) : NO_DATE,
      ],
    ];
    return (
      <ReportCard
        title="Audit/Field Exam"
        onEdit={onEdit}
        canManage={canManage}
        statusYear={data?.auditCompletionYear}
        statusValue={data?.auditCompletionStatus}
      >
        <DataTable columns={columns} rows={rows} />
      </ReportCard>
    );
  }

  if (variant === 'chapter13') {
    const columns = ['Annual Audit Period', 'Last Audit Report'];
    const rows = [
      [
        '10/01 - 9/30',
        data?.pastAudit ? isoToMMDDYYYY(data.pastAudit) : NO_DATE,
      ],
    ];
    return (
      <ReportCard
        title="Audit"
        onEdit={onEdit}
        canManage={canManage}
        statusYear={data?.auditCompletionYear}
        statusValue={data?.auditCompletionStatus}
      >
        <DataTable columns={columns} rows={rows} />
      </ReportCard>
    );
  }

  const columns = ['Audit', 'Audit Req by', "Last Audit's Fiscal Year", 'Last Audit Report Date', 'Last Field Exam Report Date'];
  const rows = [
    [
      data?.upcomingExamOrAuditYear ? String(data.upcomingExamOrAuditYear) : NO_DATE,
      auditReqByYear !== null ? String(auditReqByYear) : NO_DATE,
      data?.lastAuditFiscalYear ? String(data.lastAuditFiscalYear) : NO_DATE,
      data?.pastAudit ? isoToMMDDYYYY(data.pastAudit) : NO_DATE,
      data?.pastFieldExam ? isoToMMDDYYYY(data.pastFieldExam) : NO_DATE,
    ],
  ];

  return (
    <ReportCard
      title="Audit/Field Exam"
      onEdit={onEdit}
      canManage={canManage}
      statusYear={data?.auditCompletionYear}
      statusValue={data?.auditCompletionStatus}
    >
      <DataTable columns={columns} rows={rows} />
    </ReportCard>
  );
}

function TprCard({
  data,
  canManage,
  onEdit,
}: {
  data: TrusteeUpcomingKeyDates | null;
  canManage: boolean;
  onEdit: () => void;
}) {
  const tprPeriod =
    data?.tprReviewPeriodStart && data?.tprReviewPeriodEnd
      ? `${isoToMMDDYYYY(data.tprReviewPeriodStart)}-${isoToMMDDYYYY(data.tprReviewPeriodEnd)}`
      : NO_DATE;

  const tprDue =
    data?.tprDue && data?.tprDueYearType
      ? `${isoToMMDD(data.tprDue)}/${new Date().getFullYear() % 2 === (data.tprDueYearType === 'EVEN' ? 0 : 1) ? new Date().getFullYear() : new Date().getFullYear() + 1}`
      : NO_DATE;

  const frequencyLabels: Record<string, string> = {
    ANNUAL: 'Annual',
    BIANNUAL: 'Biannual',
    SEMI_ANNUAL: 'Semi-Annual',
  };

  const columns = ['TPR Review Period', 'TPR Review Period Frequency', 'TPR Due', 'Last TPR Submitted'];
  const rows = [
    [
      tprPeriod,
      data?.tprFrequency ? frequencyLabels[data.tprFrequency] : NO_DATE,
      tprDue,
      data?.lastTprSubmitted ? isoToMMDDYYYY(data.lastTprSubmitted) : NO_DATE,
    ],
  ];

  return (
    <ReportCard
      title="Trustee Performance Report"
      onEdit={onEdit}
      canManage={canManage}
      statusYear={data?.tprCompletionYear}
      statusValue={data?.tprCompletionStatus}
    >
      <DataTable columns={columns} rows={rows} />
    </ReportCard>
  );
}

function TirCard({
  data,
  canManage,
  onEdit,
}: {
  data: TrusteeUpcomingKeyDates | null;
  canManage: boolean;
  onEdit: () => void;
}) {
  let tirReviewPeriod = NO_DATE;
  if (data?.tirReviewPeriodStart && data?.tirReviewPeriodEnd) {
    const period1 = isoRangeToMMDD(data.tirReviewPeriodStart, data.tirReviewPeriodEnd);
    if (data.tirSemiAnnualReviewPeriodStart && data.tirSemiAnnualReviewPeriodEnd) {
      const period2 = isoRangeToMMDD(data.tirSemiAnnualReviewPeriodStart, data.tirSemiAnnualReviewPeriodEnd);
      tirReviewPeriod = `${period1} & ${period2}`;
    } else {
      tirReviewPeriod = period1;
    }
  }

  let tirSubmission = NO_DATE;
  if (data?.tirSubmission) {
    tirSubmission = data.tirSemiAnnualSubmission
      ? `${isoToMMDD(data.tirSubmission)} & ${isoToMMDD(data.tirSemiAnnualSubmission)}`
      : isoToMMDD(data.tirSubmission);
  }

  let tirDue = NO_DATE;
  if (data?.tirReview) {
    tirDue = data.tirSemiAnnualReview
      ? `${isoToMMDD(data.tirReview)} & ${isoToMMDD(data.tirSemiAnnualReview)}`
      : isoToMMDD(data.tirReview);
  }

  const columns = ['TIR Review Period', 'TIR Submission', 'TIR Due', 'TIR Letter'];
  const rows = [
    [
      tirReviewPeriod,
      tirSubmission,
      tirDue,
      data?.pastTprSubmission ? isoToMMDDYYYY(data.pastTprSubmission) : NO_DATE,
    ],
  ];

  return (
    <ReportCard
      title="Trustee Interim Report"
      onEdit={onEdit}
      canManage={canManage}
      statusYear={data?.tirCompletionYear}
      statusValue={data?.tirCompletionStatus}
    >
      <DataTable columns={columns} rows={rows} />
    </ReportCard>
  );
}

function BudgetCard({
  data,
  chapter,
}: {
  data: TrusteeUpcomingKeyDates | null;
  chapter: string;
}) {
  const budgetSubmission = chapter === '13' ? '07/01' : '05/01';
  const budgetReview = chapter === '13' ? '08/15' : '06/01';

  const columns = ['Budget Submission Due', 'Budget Due to OO'];
  const rows = [[budgetSubmission, budgetReview]];

  return (
    <ReportCard
      title="Budget"
      onEdit={() => {}}
      canManage={false}
    >
      <DataTable columns={columns} rows={rows} />
    </ReportCard>
  );
}

function AnnualReportCard({ data, canManage, onEdit }: { data: TrusteeUpcomingKeyDates | null; canManage: boolean; onEdit: () => void }) {
  const columns = ['Annual Report Submission', 'Annual Report Due to OO'];
  const rows = [['09/01', '09/15']];
  return (
    <ReportCard
      title="Annual Report"
      onEdit={onEdit}
      canManage={canManage}
      statusYear={data?.annualReportCompletionYear}
      statusValue={data?.annualReportCompletionStatus}
    >
      <DataTable columns={columns} rows={rows} />
    </ReportCard>
  );
}

function OtherCard({
  data,
  canManage,
  onEdit,
  variant,
}: {
  data: TrusteeUpcomingKeyDates | null;
  canManage: boolean;
  onEdit: () => void;
  variant: 'chapter7' | 'chapter12' | 'chapter13';
}) {
  if (variant === 'chapter12' || variant === 'chapter13') {
    const showAnnualReport = variant === 'chapter12';
    const annualReportDue = data?.annualReportDue
      ? isoToMMDD(data.annualReportDue) + ' (Due non-audit years)'
      : NO_DATE;
    const leaseExpiration = data?.leaseExpiration ? isoToMMDDYYYY(data.leaseExpiration) : NO_DATE;
    const pastBackgroundQuestion = data?.pastBackgroundQuestion
      ? isoToMMDDYYYY(data.pastBackgroundQuestion)
      : NO_DATE;
    const idExpiration = data?.idExpiration ? isoToMMDDYYYY(data.idExpiration) : NO_DATE;
    const lastCompensationStudy = data?.lastCompensationStudy
      ? isoToMMYYYY(data.lastCompensationStudy) + ' (Required every 5 years)'
      : NO_DATE;

    const columns = [
      ...(showAnnualReport ? ['Annual Report Due to OO'] : []),
      'Lease Expiration',
      'Last Update to Background Questionnaire',
      'ID Expiration',
      ...(variant === 'chapter13' ? ['Last Compensation Study'] : []),
    ];
    const rows = [[
      ...(showAnnualReport ? [annualReportDue] : []),
      leaseExpiration,
      pastBackgroundQuestion,
      idExpiration,
      ...(variant === 'chapter13' ? [lastCompensationStudy] : []),
    ]];

    return (
      <ReportCard title="Other" onEdit={onEdit} canManage={canManage}>
        <DataTable columns={columns} rows={rows} />
      </ReportCard>
    );
  }

  return (
    <ReportCard title="Other" onEdit={onEdit} canManage={canManage}>
      <DataTable
        columns={['Last Update to Background Questionnaire']}
        rows={[[data?.pastBackgroundQuestion ? isoToMMDDYYYY(data.pastBackgroundQuestion) : NO_DATE]]}
      />
    </ReportCard>
  );
}

const UNIX_EPOCH = '1970-01-01';

function formatAppointmentDate(dateString: string): string {
  if (dateString.startsWith(UNIX_EPOCH)) return 'Not Specified';
  return formatDate(dateString);
}

export default function AppointmentCardV2(props: Readonly<AppointmentCardV2Props>) {
  const { appointment, keyDatesData, isLoading, canManage, onEditKeyDates } = props;
  const navigate = useNavigate();
  const formattedEffectiveDate = formatAppointmentDate(appointment.effectiveDate);
  const formattedAppointedDate = formatAppointmentDate(appointment.appointedDate);

  function openEditTrustee() {
    navigate(`/trustees/${appointment.trusteeId}/appointments/${appointment.id}/edit`);
  }

  const isChapter12 = isChapter12Standing(appointment.chapter, appointment.appointmentType);
  const isChapter13 = isChapter13Standing(appointment.chapter, appointment.appointmentType);
  const isPanelChapter7 = appointment.chapter === '7' && appointment.appointmentType === 'panel';
  const isSubVPool = appointment.chapter === '11-subchapter-v' && appointment.appointmentType === 'pool';
  const isChapter12CaseByCase = appointment.chapter === '12' && appointment.appointmentType === 'case-by-case';
  const isChapter13CaseByCase = appointment.chapter === '13' && appointment.appointmentType === 'case-by-case';

  return (
    <div className="appointment-v2-container">
      <div className="appointment-v2-meta">
        <span>
          <strong>Appointed:</strong> {formattedAppointedDate}
        </span>
        <span>
          <strong>Status Effective:</strong> {formattedEffectiveDate}
        </span>
        {canManage && (
          <Button
            id="edit-appointment"
            uswdsStyle={UswdsButtonStyle.Unstyled}
            onClick={openEditTrustee}
          >
            <IconLabel icon="edit" label="Edit Appointment" />
          </Button>
        )}
      </div>

      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <div className="appointment-v2-cards">
          {isPanelChapter7 && (
            <>
              <AuditFieldExamCard
                data={keyDatesData}
                canManage={canManage}
                onEdit={() => onEditKeyDates('audit')}
                variant="chapter7"
              />
              <TprCard
                data={keyDatesData}
                canManage={canManage}
                onEdit={() => onEditKeyDates('tpr')}
              />
              <TirCard
                data={keyDatesData}
                canManage={canManage}
                onEdit={() => onEditKeyDates('tir')}
              />
              <OtherCard
                data={keyDatesData}
                canManage={canManage}
                onEdit={() => onEditKeyDates('other')}
                variant="chapter7"
              />
            </>
          )}
          {isChapter12 && (
            <>
              <AuditFieldExamCard
                data={keyDatesData}
                canManage={canManage}
                onEdit={() => onEditKeyDates('audit')}
                variant="chapter12"
              />
              <TprCard
                data={keyDatesData}
                canManage={canManage}
                onEdit={() => onEditKeyDates('tpr')}
              />
              <BudgetCard
                data={keyDatesData}
                chapter={appointment.chapter}
              />
              <OtherCard
                data={keyDatesData}
                canManage={canManage}
                onEdit={() => onEditKeyDates('other')}
                variant="chapter12"
              />
            </>
          )}
          {isSubVPool && (
            <ReportCard title="Other" onEdit={() => onEditKeyDates('other')} canManage={canManage}>
              <DataTable
                columns={['Last Monthly Report Received']}
                rows={[[keyDatesData?.lastMonthlyReportReceived ? isoToMMDDYYYY(keyDatesData.lastMonthlyReportReceived) : NO_DATE]]}
              />
            </ReportCard>
          )}
          {isChapter13 && (
            <>
              <AuditFieldExamCard
                data={keyDatesData}
                canManage={canManage}
                onEdit={() => onEditKeyDates('audit')}
                variant="chapter13"
              />
              <TprCard
                data={keyDatesData}
                canManage={canManage}
                onEdit={() => onEditKeyDates('tpr')}
              />
              <BudgetCard
                data={keyDatesData}
                chapter={appointment.chapter}
              />
              <OtherCard
                data={keyDatesData}
                canManage={canManage}
                onEdit={() => onEditKeyDates('other')}
                variant="chapter13"
              />
            </>
          )}
          {(isChapter12CaseByCase || isChapter13CaseByCase) && (
            <>
              <AnnualReportCard
                data={keyDatesData}
                canManage={canManage}
                onEdit={() => onEditKeyDates('annual-report')}
              />
              <TprCard
                data={keyDatesData}
                canManage={canManage}
                onEdit={() => onEditKeyDates('tpr')}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
