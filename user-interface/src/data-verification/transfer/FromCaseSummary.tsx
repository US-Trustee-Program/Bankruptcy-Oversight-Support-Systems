import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DocketEntryDocumentList from '@/lib/components/DocketEntryDocumentList';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { formatDate } from '@/lib/utils/datetime';
import { CaseSummary } from '@common/cams/cases';
import CaseTable from './CaseTable';
import { AlertDetails, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { TransferOrder } from '@common/cams/orders';
import createApi2 from '@/lib/Api2Factory';

type FromCaseSummaryProps = {
  order: TransferOrder;
  onOrderUpdate: (alertDetails: AlertDetails, order?: TransferOrder) => void;
};

export function FromCaseSummary(props: Readonly<FromCaseSummaryProps>) {
  const { order } = props;
  const [originalCaseSummary, setOriginalCaseSummary] = useState<CaseSummary | null>(null);

  const api = createApi2();

  useEffect(() => {
    api
      .getCaseSummary(order.caseId)
      .then((response) => {
        setOriginalCaseSummary(response.data);
      })
      .catch((error) => {
        props.onOrderUpdate({
          message: error.message,
          type: UswdsAlertStyle.Error,
          timeOut: 8,
        });
      });
  }, [order.caseId, props.onOrderUpdate]);

  return (
    <>
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="grid-col-10">
          {!originalCaseSummary && (
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
          {order.docketEntries.map((docketEntry) => {
            return (
              <div key={docketEntry.documentNumber}>
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
