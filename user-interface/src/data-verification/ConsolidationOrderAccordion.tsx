import { Link } from 'react-router-dom';
import DocketEntryDocumentList from '@/lib/components/DocketEntryDocumentList';
import { Accordion } from '@/lib/components/uswds/Accordion';
import { formatDate } from '@/lib/utils/datetime';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { AlertDetails } from '@/data-verification/DataVerificationScreen';
import { ConsolidationOrder } from '@/lib/type-declarations/chapter-15';
import './TransferOrderAccordion.scss';
import { CaseTable } from './CaseTable';

export interface ConsolidationOrderAccordionProps {
  order: ConsolidationOrder;
  statusType: Map<string, string>;
  orderType: Map<string, string>;
  regionsMap: Map<string, string>;
  onOrderUpdate: (alertDetails: AlertDetails, order?: ConsolidationOrder) => void;
  onExpand?: (id: string) => void;
  expandedId?: string;
}

export function ConsolidationOrderAccordion(props: ConsolidationOrderAccordionProps) {
  const { order, statusType, orderType, expandedId, onExpand } = props;

  return (
    <>
      <Accordion
        key={order.id}
        id={`order-list-${order.id}`}
        expandedId={expandedId}
        onExpand={onExpand}
      >
        <section
          className="accordion-heading grid-row grid-gap-lg"
          data-testid={`accordion-heading-${order.id}`}
        >
          <div
            className="grid-col-2 case-id text-no-wrap"
            aria-label={`Case number ${getCaseNumber(order.caseId).split('').join(' ')}`}
          >
            {getCaseNumber(order.caseId)}
          </div>
          <div className="grid-col-4 case-title" aria-label={`Case title ${order.caseTitle}`}>
            {order.caseTitle}
          </div>
          <div
            className="grid-col-2 order-date text-no-wrap"
            title="Order date"
            aria-label={`Order date ${formatDate(order.orderDate)}`}
          >
            {formatDate(order.orderDate)}
          </div>
          <div className="grid-col-2 order-type text-no-wrap">
            <span aria-label={`Order type ${orderType.get(order.orderType)}`}>
              {orderType.get(order.orderType)}
            </span>
          </div>
          <div className="grid-col-2 order-status text-no-wrap">
            <span
              className={order.status}
              aria-label={`Order status ${statusType.get(order.status)}`}
            >
              {statusType.get(order.status)}
            </span>
          </div>
        </section>
        <section className="accordion-content" data-testid={`accordion-content-${order.id}`}>
          <div className="grid-row grid-gap-lg">
            <div className="grid-col-1"></div>
            <div className="order-legal-statement grid-col-10">
              {!order.docketEntries && <>No docket entries</>}
              {order.docketEntries &&
                order.docketEntries.map((docketEntry, idx) => {
                  return (
                    <div key={idx}>
                      <Link
                        to={`/case-detail/${order.caseId}/court-docket?document=${docketEntry.documentNumber}`}
                        target="_blank"
                        title={`Open case ${order.caseId} docket in new window`}
                      >
                        {docketEntry.documentNumber && (
                          <span className="document-number">#{docketEntry.documentNumber} - </span>
                        )}
                        {formatDate(order.orderDate)} - {docketEntry.summaryText}
                      </Link>
                      <p tabIndex={0} className="measure-6">
                        {docketEntry.fullText}
                      </p>
                      {docketEntry.documents && (
                        <DocketEntryDocumentList documents={docketEntry.documents} />
                      )}
                    </div>
                  );
                })}
            </div>
            <div>
              <CaseTable id={'case-list'} cases={order.childCases}></CaseTable>
            </div>
            <div className="grid-col-1"></div>
          </div>
        </section>
      </Accordion>
    </>
  );
}
