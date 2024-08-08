import { AttorneyUser } from '../../../../../common/src/cams/users';

export interface AttorneyListRecordSet {
  attorneyList: AttorneyUser[];
  initialized?: boolean;
}

export type AttorneyListDbResult = {
  success: boolean;
  message: string;
  count: number;
  body: AttorneyListRecordSet;
};
