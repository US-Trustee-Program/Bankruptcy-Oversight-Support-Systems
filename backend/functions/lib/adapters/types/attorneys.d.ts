import { ObjectKeyVal } from './basic';

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
