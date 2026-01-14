import './DatesCard.scss';
import { formatDate } from '@/lib/utils/datetime';

interface DatesCardProps {
  dateFiled: string;
  reopenedDate?: string;
  closedDate?: string;
  dismissedDate?: string;
  showReopenDate: boolean;
}

export default function DatesCard(props: Readonly<DatesCardProps>) {
  const { dateFiled, reopenedDate, closedDate, dismissedDate, showReopenDate } = props;

  return (
    <div className="date-information usa-card">
      <div className="usa-card__container">
        <div className="usa-card__body">
          <h4>Dates</h4>
          <dl className="date-list">
            <div data-testid="case-detail-filed-date">
              <dt className="case-detail-item-name">Case Filed:</dt>
              <dd className="case-detail-item-value">{formatDate(dateFiled)}</dd>
            </div>
            {reopenedDate && showReopenDate && (
              <div data-testid="case-detail-reopened-date">
                <dt className="case-detail-item-name">Reopened by court:</dt>
                <dd className="case-detail-item-value">{formatDate(reopenedDate)}</dd>
              </div>
            )}
            {!showReopenDate && closedDate && (
              <div data-testid="case-detail-closed-date">
                <dt className="case-detail-item-name">Closed by court:</dt>
                <dd className="case-detail-item-value">{formatDate(closedDate)}</dd>
              </div>
            )}
            {dismissedDate && (
              <div data-testid="case-detail-dismissed-date">
                <dt className="case-detail-item-name">Dismissed by court:</dt>
                <dd className="case-detail-item-value">{formatDate(dismissedDate)}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </div>
  );
}
