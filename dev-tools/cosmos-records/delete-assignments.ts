import { deleteDocuments } from './lib';

export default function deleteAssignments() {
  deleteDocuments('assignments', 'SELECT * FROM c');
  deleteDocuments('cases', 'SELECT * FROM c WHERE c.documentType = "AUDIT_ASSIGNMENT"');
}

if (require.main === module) {
  deleteAssignments();
}
