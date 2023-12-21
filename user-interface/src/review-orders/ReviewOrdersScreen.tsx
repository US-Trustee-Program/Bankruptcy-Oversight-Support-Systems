import './ReviewOrdersScreen.scss';
import { Accordion, AccordionGroup } from '@/lib/components/uswds/Accordion';

export default function ReviewOrders() {
  const regionNumber = '02';
  const orderList = [
    {
      caseId: '23-12345',
      title: 'Some case title',
      orderDate: '01/23/2024',
      orderType: 'transfer',
      status: 'pending',
      content: 'here is some content hidden inside the 1st accordion',
    },
    {
      caseId: '23-12346',
      title: 'Some case title 2',
      orderDate: '01/24/2024',
      orderType: 'consolidation',
      status: 'pending',
      content: 'here is some content hidden inside the 2nd accordion',
    },
    {
      caseId: '23-12347',
      title: 'Some case title 3',
      orderDate: '01/25/2024',
      orderType: 'transfer',
      status: 'approved',
      content: 'here is some content hidden inside the 3rd accordion',
    },
    {
      caseId: '23-12348',
      title: 'Some case title 4',
      orderDate: '01/26/2024',
      orderType: 'transfer',
      status: 'pending',
      content: 'here is some content hidden inside the 4th accordion',
    },
    {
      caseId: '23-12349',
      title: 'Some case title 5',
      orderDate: '01/27/2024',
      orderType: 'transfer',
      status: 'rejected',
      content: 'here is some content hidden inside the 5th accordion',
    },
  ];

  const statusType = new Map();
  statusType.set('pending', 'Pending Review');
  statusType.set('approved', 'Approved');
  statusType.set('rejected', 'Rejected');

  const orderType = new Map();
  orderType.set('transfer', 'Transfer');
  orderType.set('consolidation', 'Consolidation');

  return (
    <div data-testid="review-orders-screen" className="review-orders-screen">
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="grid-col-10">
          <h1>Review Court Orders</h1>
          <h2>Region {regionNumber}</h2>

          <section className="order-list-container">
            <AccordionGroup>
              {orderList.map((order, idx: number) => {
                return (
                  <Accordion key={idx} id={`order-list-${idx}`}>
                    <div className="grid-row grid-gap-lg">
                      <div className="grid-col-1 case-id text-no-wrap">{order.caseId}</div>
                      <div className="grid-col-3 case-title text-no-wrap">{order.title}</div>
                      <div className="grid-col-1 order-date text-no-wrap">{order.orderDate}</div>
                      <div className="grid-col-3"></div>
                      <div className="grid-col-2 order-type text-no-wrap">
                        <span>{orderType.get(order.orderType)}</span>
                      </div>
                      <div className="grid-col-2 order-status text-no-wrap">
                        <span className={order.status}>{statusType.get(order.status)}</span>
                      </div>
                    </div>
                    {order.content}
                  </Accordion>
                );
              })}
            </AccordionGroup>
          </section>
        </div>
        <div className="grid-col-1"></div>
      </div>
    </div>
  );
}
