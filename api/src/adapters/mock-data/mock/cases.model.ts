import logging from '../../logging.service';

const NAMESPACE = 'CASES-MOCK';

type caseRecord = {
  caseid: number;
  analyst: string;
  chapter: string;
};

let caseTable: caseRecord[] = [];

function createRecord(data: { analyst: string; chapter: string }): boolean {
  const length = caseTable.length;

  caseTable.push({
    caseid: caseTable.length + 1,
    analyst: data.analyst,
    chapter: data.chapter
  });

  return caseTable.length > length ? true : false;
}

function getAll(): {} {
  logging.info(NAMESPACE, 'Getting all cases');

  const results = {
    message: 'cases list',
    count: caseTable.length,
    body: caseTable
  };

  logging.info(NAMESPACE, 'Retrieved cases: ', results);

  return results;
}

function getRecord(id: string): caseRecord | undefined {
  return caseTable.filter((theCase) => theCase.caseid == +id).pop();
}

function updateRecord(record: caseRecord) {
  return caseTable.filter((theCase) => theCase.caseid == +record.caseid).pop();
}

function deleteRecord() {}

export default { createRecord, getAll, getRecord, updateRecord, deleteRecord };
