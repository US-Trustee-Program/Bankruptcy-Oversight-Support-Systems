import { deleteDocuments } from './lib';

export default function deleteAssignments() {
  deleteDocuments('assignments', 'caseId', 'SELECT * FROM c');
  deleteDocuments('cases', 'caseId', 'SELECT * FROM c WHERE c.documentType = "AUDIT_ASSIGNMENT"');
}

if (require.main === module) {
  deleteAssignments();
}
