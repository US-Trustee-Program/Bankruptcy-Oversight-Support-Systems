import './TrusteeMatchVerificationAccordion.scss';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Accordion } from '@/lib/components/uswds/Accordion';
import Icon from '@/lib/components/uswds/Icon';
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';
import { CourtDivisionDetails } from '@common/cams/courts';
import { formatDate } from '@/lib/utils/datetime';
import { formatAppointmentStatus } from '@common/cams/trustee-appointments';
import { formatChapterType } from '@common/cams/trustees';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import { AlertDetails, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import Api2 from '@/lib/models/api2';

export interface TrusteeMatchVerificationAccordionProps {
  order: TrusteeMatchVerification;
  statusType: Map<string, string>;
  orderType: Map<string, string>;
  fieldHeaders: string[];
  courts?: CourtDivisionDetails[];
  hidden?: boolean;
  onOrderUpdate: (alertDetails: AlertDetails, order: TrusteeMatchVerification) => void;
}

export function TrusteeMatchVerificationAccordion(props: TrusteeMatchVerificationAccordionProps) {
  const { order, hidden, statusType, orderType, fieldHeaders, courts = [], onOrderUpdate } = props;
  const [isProcessing, setIsProcessing] = useState(false);

  const courtName = courts.find((c) => c.courtId === order.courtId)?.courtName ?? order.courtId;

  const { legacy } = order.dxtrTrustee;
  const addressLines = [
    legacy?.address1,
    legacy?.address2,
    legacy?.address3,
    legacy?.cityStateZipCountry,
  ].filter(Boolean) as string[];

  const preselected =
    order.matchCandidates.length > 0
      ? order.matchCandidates.reduce((best, c) => (c.totalScore > best.totalScore ? c : best))
      : undefined;

  async function handleApprove() {
    if (!preselected) return;
    setIsProcessing(true);
    try {
      await Api2.patchTrusteeVerificationOrderApproval(order.id, preselected.trusteeId);
      onOrderUpdate(
        { message: 'Trustee match confirmed.', type: UswdsAlertStyle.Success, timeOut: 8 },
        { ...order, status: 'approved', resolvedTrusteeId: preselected.trusteeId },
      );
    } catch {
      onOrderUpdate(
        { message: 'Failed to confirm trustee match.', type: UswdsAlertStyle.Error, timeOut: 8 },
        order,
      );
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <Accordion key={order.id} id={`order-list-${order.id}`} hidden={hidden}>
      <section
        className="accordion-heading grid-row grid-gap-lg"
        data-testid={`accordion-heading-${order.id}`}
      >
        <div
          className="accordion-header-field grid-col-6 text-no-wrap"
          aria-label={`${fieldHeaders[0]} – ${courtName}.`}
          data-cell={fieldHeaders[0]}
        >
          {courtName}
        </div>
        <div
          className="accordion-header-field grid-col-2 text-no-wrap"
          title="Event date"
          aria-label={`${fieldHeaders[1]} on ${formatDate(order.createdOn ?? order.updatedOn)}.`}
          data-cell={fieldHeaders[1]}
        >
          {formatDate(order.createdOn ?? order.updatedOn)}
        </div>
        <div
          className="accordion-header-field grid-col-2 order-type text-no-wrap"
          data-cell={fieldHeaders[2]}
        >
          <span
            className="event-type-label"
            aria-label={`${fieldHeaders[2]} - ${orderType.get(order.orderType)}.`}
          >
            {orderType.get(order.orderType)}
          </span>
        </div>
        <div
          className="accordion-header-field grid-col-2 order-status text-no-wrap"
          data-cell={fieldHeaders[3]}
        >
          <span
            className={`${order.status} event-status-label`}
            aria-label={`${fieldHeaders[3]} - ${statusType.get(order.status)}.`}
          >
            {statusType.get(order.status)}
          </span>
        </div>
      </section>
      <section
        className="accordion-content trustee-match-content"
        data-testid={`accordion-content-${order.id}`}
      >
        <p className="problem-statement">
          Trustee is inactive in CAMS but was appointed to case:{' '}
          <Link to={`/case-detail/${order.caseId}`} className="case-link">
            <Icon name="launch" />
            {getCaseNumber(order.caseId)}
          </Link>
        </p>

        <h3>Court Information</h3>
        <div className="trustee-data-grid trustee-info-grid" data-testid="dxtr-trustee-info">
          <div className="trustee-data-header grid-row grid-gap-lg">
            <div className="trustee-data-cell grid-col-2">Name</div>
            <div className="trustee-data-cell grid-col-2">Address</div>
            <div className="trustee-data-cell grid-col-1">Phone</div>
            <div className="trustee-data-cell grid-col-2">Email</div>
            <div className="trustee-data-cell grid-col-3 no-border"></div>
            <div className="trustee-data-cell grid-col-2 no-border"></div>
          </div>
          <div className="trustee-data-row grid-row grid-gap-lg">
            <div
              className="trustee-data-cell grid-col-2"
              data-cell="Name"
              data-testid="dxtr-trustee-name"
            >
              {order.dxtrTrustee.fullName}
            </div>
            <div className="trustee-data-cell grid-col-2" data-cell="Address">
              {addressLines.map((line, i) => (
                <span key={i}>
                  {line}
                  {i < addressLines.length - 1 && <br />}
                </span>
              ))}
            </div>
            <div className="trustee-data-cell grid-col-1" data-cell="Phone">
              {legacy?.phone ?? ''}
            </div>
            <div className="trustee-data-cell grid-col-2" data-cell="Email">
              {legacy?.email ?? ''}
            </div>
            <div className="trustee-data-cell grid-col-3 no-border"></div>
            <div className="trustee-data-cell grid-col-2 no-border"></div>
          </div>
        </div>

        <h3>CAMS Strongest Match</h3>
        {preselected && order.status === 'pending' ? (
          <div className="trustee-match-candidate-section" data-testid="candidate-info">
            <div className="trustee-data-grid trustee-candidates-grid">
              <div className="trustee-data-header grid-row grid-gap-lg">
                <div className="trustee-data-cell grid-col-2">Name</div>
                <div className="trustee-data-cell grid-col-2">Address</div>
                <div className="trustee-data-cell grid-col-1">Phone</div>
                <div className="trustee-data-cell grid-col-2">Email</div>
                <div className="trustee-data-cell grid-col-3">Trustee Appointment</div>
                <div className="trustee-data-cell grid-col-2">Action</div>
              </div>
              <div className="trustee-data-row grid-row grid-gap-lg">
                <div
                  className="trustee-data-cell grid-col-2"
                  data-cell="Name"
                  data-testid="candidate-name"
                >
                  {preselected.trusteeName}
                </div>
                <div className="trustee-data-cell grid-col-2" data-cell="Address">
                  {preselected.address &&
                    [
                      preselected.address.address1,
                      preselected.address.address2,
                      preselected.address.address3,
                      `${preselected.address.city}, ${preselected.address.state} ${preselected.address.zipCode}`,
                    ]
                      .filter(Boolean)
                      .map((line, i, arr) => (
                        <span key={i}>
                          {line}
                          {i < arr.length - 1 && <br />}
                        </span>
                      ))}
                </div>
                <div className="trustee-data-cell grid-col-1" data-cell="Phone">
                  {preselected.phone
                    ? `${preselected.phone.number}${preselected.phone.extension ? ` x${preselected.phone.extension}` : ''}`
                    : ''}
                </div>
                <div className="trustee-data-cell grid-col-2" data-cell="Email">
                  {preselected.email ?? ''}
                </div>
                <div className="trustee-data-cell grid-col-3" data-cell="Trustee Appt.">
                  {preselected.appointments?.map((appt, i, arr) => (
                    <span key={i}>
                      {[appt.courtName, appt.courtDivisionName].filter(Boolean).join(' ')}: Chap{' '}
                      {formatChapterType(appt.chapter)} - {formatAppointmentStatus(appt.status)}
                      {i < arr.length - 1 && <br />}
                    </span>
                  ))}
                </div>
                <div className="trustee-data-cell grid-col-2 text-no-wrap" data-cell="Action">
                  <button
                    data-testid="approve-button"
                    onClick={handleApprove}
                    disabled={isProcessing}
                    className="match-trustee-link"
                  >
                    <Icon name="check" />
                    Match Trustee
                  </button>
                </div>
              </div>
            </div>
            <Link to="/trustee/search" className="search-trustee-link">
              <Icon name="search" />
              Search for a different trustee
            </Link>
          </div>
        ) : preselected ? (
          <>
            <div className="trustee-data-grid trustee-candidates-grid">
              <div className="trustee-data-header grid-row grid-gap-lg">
                <div className="trustee-data-cell grid-col-2">Name</div>
                <div className="trustee-data-cell grid-col-2">Address</div>
                <div className="trustee-data-cell grid-col-1">Phone</div>
                <div className="trustee-data-cell grid-col-2">Email</div>
                <div className="trustee-data-cell grid-col-3">Trustee Appointment</div>
                <div className="trustee-data-cell grid-col-2">Action</div>
              </div>
              <div className="trustee-data-row grid-row grid-gap-lg">
                <div className="trustee-data-cell grid-col-2" data-cell="Name">
                  {preselected.trusteeName}
                </div>
                <div className="trustee-data-cell grid-col-2" data-cell="Address">
                  {preselected.address &&
                    [
                      preselected.address.address1,
                      preselected.address.address2,
                      preselected.address.address3,
                      `${preselected.address.city}, ${preselected.address.state} ${preselected.address.zipCode}`,
                    ]
                      .filter(Boolean)
                      .map((line, i, arr) => (
                        <span key={i}>
                          {line}
                          {i < arr.length - 1 && <br />}
                        </span>
                      ))}
                </div>
                <div className="trustee-data-cell grid-col-1" data-cell="Phone">
                  {preselected.phone
                    ? `${preselected.phone.number}${preselected.phone.extension ? ` x${preselected.phone.extension}` : ''}`
                    : ''}
                </div>
                <div className="trustee-data-cell grid-col-2" data-cell="Email">
                  {preselected.email ?? ''}
                </div>
                <div className="trustee-data-cell grid-col-3" data-cell="Trustee Appt.">
                  {preselected.appointments?.map((appt, i, arr) => (
                    <span key={i}>
                      {[appt.courtName, appt.courtDivisionName].filter(Boolean).join(' ')}: Chap{' '}
                      {formatChapterType(appt.chapter)} - {formatAppointmentStatus(appt.status)}
                      {i < arr.length - 1 && <br />}
                    </span>
                  ))}
                </div>
                <div className="trustee-data-cell grid-col-2 text-no-wrap" data-cell="Action">
                  <Link to="#" className="match-trustee-link">
                    <Icon name="check" />
                    Match Trustee
                  </Link>
                </div>
              </div>
            </div>
            <Link to="/trustee/search" className="search-trustee-link">
              <Icon name="search" />
              Search for a different trustee.
            </Link>
          </>
        ) : (
          <p className="no-candidates-message">
            There are no suggested matches in CAMS.{' '}
            <Link to="/trustee/search" className="search-trustee-link">
              <Icon name="search" />
              Search for a trustee
            </Link>
          </p>
        )}
      </section>
    </Accordion>
  );
}
