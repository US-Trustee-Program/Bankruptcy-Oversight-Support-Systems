import { Accordion } from '@/lib/components/uswds/Accordion';
import { formatDate } from '@/lib/utils/datetime';
import { AlertDetails } from '@/data-verification/DataVerificationScreen';
import { ConsolidationOrder } from '@/lib/type-declarations/chapter-15';
import { CaseTableImperative } from './CaseTable';
import { useRef, useState } from 'react';
import { ConsolidatedCasesTable } from './ConsolidatedCasesTable';
import './TransferOrderAccordion.scss';
import { ConsolidationOrderCase } from '@common/cams/orders';

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
  const caseTable = useRef<CaseTableImperative>(null);
  const [includedCases, setIncludedCases] = useState<Array<ConsolidationOrderCase>>([]);

  function handleIncludeCase(bCase: ConsolidationOrderCase) {
    if (includedCases.includes(bCase)) {
      setIncludedCases(includedCases.filter((aCase) => bCase !== aCase));
    } else {
      setIncludedCases([...includedCases, bCase]);
    }
    console.log('Included cases', includedCases);
  }

  function onCollapse() {
    setIncludedCases([]);
    caseTable.current?.clearSelection();
  }

  return (
    <Accordion
      key={order.id}
      id={`order-list-${order.id}`}
      expandedId={expandedId}
      onExpand={onExpand}
      onCollapse={onCollapse}
    >
      <section
        className="accordion-heading grid-row grid-gap-lg"
        data-testid={`accordion-heading-${order.id}`}
      >
        <div className="grid-col-6 text-no-wrap" aria-label={`Court district ${order.courtName}`}>
          {order.courtName}
        </div>
        <div
          className="grid-col-2 text-no-wrap"
          title="Event date"
          aria-label={`Event date ${formatDate(order.orderDate)}`}
        >
          {formatDate(order.orderDate)}
        </div>
        <div className="grid-col-2 order-type text-no-wrap">
          <span aria-label={`Event type ${orderType.get(order.orderType)}`}>
            {orderType.get(order.orderType)}
          </span>
        </div>
        <div className="grid-col-2 order-status text-no-wrap">
          <span
            className={order.status}
            aria-label={`Event status ${statusType.get(order.status)}`}
          >
            {statusType.get(order.status)}
          </span>
        </div>
      </section>
      <section className="accordion-content" data-testid={`accordion-content-${order.id}`}>
        <div className="grid-row grid-gap-lg">
          <div className="grid-col-1"></div>

          <div>
            <ConsolidatedCasesTable
              id={'case-list'}
              cases={order.childCases}
              onSelect={handleIncludeCase}
              ref={caseTable}
            ></ConsolidatedCasesTable>
          </div>
          <div className="grid-col-1"></div>
        </div>
      </section>
    </Accordion>
  );
}
