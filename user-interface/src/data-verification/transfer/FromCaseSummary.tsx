import DocketEntryDocumentList from '@/lib/components/DocketEntryDocumentList';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { AlertDetails, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { useApi2 } from '@/lib/hooks/UseApi2';
import { formatDate } from '@/lib/utils/datetime';
import { CaseSummary } from '@common/cams/cases';
import { TransferOrder } from '@common/cams/orders';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { CaseTable } from './CaseTable';

export type FromCaseSummaryProps = {
  onOrderUpdate: (alertDetails: AlertDetails, order?: TransferOrder) => void;
  order: TransferOrder;
};

export function FromCaseSummary(props: FromCaseSummaryProps) {
  const { order } = props;
  const [originalCaseSummary, setOriginalCaseSummary] = useState<CaseSummary | null>(null);

  const api = useApi2();

  async function getCaseSummary(caseId: string) {
    await api
      .getCaseSummary(caseId)
      .then((response) => {
        setOriginalCaseSummary(response.data);
      })
      .catch((reason) => {
        props.onOrderUpdate({
          message: reason.message,
          timeOut: 8,
          type: UswdsAlertStyle.Error,
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
              caption="Loading case..."
              id={`transfer-from-case-loading-${order.id}`}
            ></LoadingSpinner>
          )}
          {originalCaseSummary && (
            <CaseTable
              cases={[originalCaseSummary]}
              id={`transfer-from-case-${order.id}`}
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
                  target="_blank"
                  title={`Open case ${order.caseId} docket in new window`}
                  to={`/case-detail/${order.caseId}/court-docket?document=${docketEntry.documentNumber}`}
                >
                  {docketEntry.documentNumber && (
                    <span className="document-number">#{docketEntry.documentNumber} - </span>
                  )}
                  {formatDate(order.orderDate)} - {docketEntry.summaryText}
                </Link>
                <p className="measure-6 text-wrap">{docketEntry.fullText}</p>
                {docketEntry.documents && <DocketEntryDocumentList docketEntry={docketEntry} />}
              </div>
            );
          })}
        </div>
        <div className="grid-col-1"></div>
      </div>
    </>
  );
}
