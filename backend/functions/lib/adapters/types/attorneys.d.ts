import { ObjectKeyVal } from './basic';

// TODO: make this implement the IRecordSet<any> interface
export interface AttorneyListRecordSet {
  attorneyList: ObjectKeyVal[];
  initialized?: boolean;
}

export type AttorneyListDbResult = {
  success: boolean;
  message: string;
  count: number;
  body: AttorneyListRecordSet;
};
