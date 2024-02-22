import { deleteDocuments } from './lib';

export default function deleteOrders() {
  deleteDocuments('orders', 'SELECT * FROM c');
  deleteDocuments('cases', 'SELECT * FROM c WHERE c.documentType = "AUDIT_TRANSFER"');
  deleteDocuments('cases', 'SELECT * FROM c WHERE c.documentType LIKE "TRANSFER_%"');
  deleteDocuments('cases', 'SELECT * FROM c WHERE c.documentType = "AUDIT_CONSOLIDATIONS"');
  deleteDocuments('consolidations', 'SELECT * FROM c');
}

deleteOrders();
