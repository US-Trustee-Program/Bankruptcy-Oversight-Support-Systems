import mssql from "mssql";

// TODO: make this implement the IRecordSet<any> interface
export type CaseListRecordSet = {
  staff1Label: string;
  staff2Label: string;
  caseList: ObjectKeyVal[];
}
