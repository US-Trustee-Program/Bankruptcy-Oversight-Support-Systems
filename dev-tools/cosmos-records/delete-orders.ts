import { deleteDocuments } from './lib';

export default function deleteOrders() {
  deleteDocuments('orders', 'caseId', 'SELECT * FROM c');
  deleteDocuments('cases', 'caseId', 'SELECT * FROM c WHERE c.documentType = "AUDIT_TRANSFER"');
  deleteDocuments('cases', 'caseId', 'SELECT * FROM c WHERE c.documentType LIKE "TRANSFER_%"');
  deleteDocuments('cases', 'caseId', 'SELECT * FROM c WHERE c.documentType LIKE "CONSOLIDATION_%"');
  deleteDocuments(
    'cases',
    'caseId',
    'SELECT * FROM c WHERE c.documentType = "AUDIT_CONSOLIDATION"',
  );
  deleteDocuments('consolidations', 'consolidationId', 'SELECT * FROM c');
}

deleteOrders();
