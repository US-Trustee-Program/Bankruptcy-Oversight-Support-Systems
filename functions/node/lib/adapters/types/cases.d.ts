import * as mssql from "mssql";
import { ObjectKeyVal } from "./basic";

// TODO: make this implement the IRecordSet<any> interface
export type CaseListRecordSet = {
  staff1Label: string;
  staff2Label: string;
  caseList: ObjectKeyVal[];
  initialized: boolean;
}

export type CaseListDbResult = {
  success: boolean;
  message: string;
  count: number;
  body: CaseListRecordSet;
};
