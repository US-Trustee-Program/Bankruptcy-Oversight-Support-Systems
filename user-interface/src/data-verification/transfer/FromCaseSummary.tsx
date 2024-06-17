import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DocketEntryDocumentList from '@/lib/components/DocketEntryDocumentList';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { formatDate } from '@/lib/utils/datetime';
import { CaseSummary } from '@common/cams/cases';
import { CaseTable } from './CaseTable';
import { AlertDetails, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { TransferOrder } from '@common/cams/orders';
import { useApi2 } from '@/lib/hooks/UseApi2';
import { SessionContext } from '@/login/Session';

export type FromCaseSummaryProps = {
  order: TransferOrder;
  onOrderUpdate: (alertDetails: AlertDetails, order?: TransferOrder) => void;
};

export function FromCaseSummary(props: FromCaseSummaryProps) {
  const { order } = props;
  const [originalCaseSummary, setOriginalCaseSummary] = useState<CaseSummary | null>(null);

  const session = useContext(SessionContext);
  const api = useApi2(session);

  async function getCaseSummary(caseId: string) {
    await api
      .getCaseSummary(caseId)
      .then((response) => {
        setOriginalCaseSummary(response.data);
      })
      .catch((reason) => {
        props.onOrderUpdate({
          message: reason.message,
          type: UswdsAlertStyle.Error,
          timeOut: 8,
        });
      });
  }

  useEffect(() => {
    getCaseSummary(order.caseId);
  }, []);

  return (
    <>
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="grid-col-10">
          {!originalCaseSummary && (
            // NOTE!: Do not start an id attribute value with a GUID.  Id's can not start with a number.
            <LoadingSpinner
              id={`transfer-from-case-loading-${order.id}`}
              caption="Loading case..."
            ></LoadingSpinner>
          )}
          {originalCaseSummary && (
            <CaseTable
              id={`transfer-from-case-${order.id}`}
              cases={[originalCaseSummary]}
            ></CaseTable>
          )}
        </div>
        <div className="grid-col-1"></div>
      </div>
      <div className="grid-row grid-gap-lg dockets-label">
        <div className="grid-col-2"></div>
        <div className="grid-col-9">
          <h4>Docket Entry</h4>
        </div>
        <div className="grid-col-1"></div>
      </div>
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-2"></div>
        <div className="grid-col-9">
          {order.docketEntries.map((docketEntry, idx) => {
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
                <p tabIndex={0} className="measure-6 text-wrap">
                  {docketEntry.fullText}
                </p>
                {docketEntry.documents && (
                  <DocketEntryDocumentList documents={docketEntry.documents} />
                )}
              </div>
            );
          })}
        </div>
        <div className="grid-col-1"></div>
      </div>
    </>
  );
}
