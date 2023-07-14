import { ObjectKeyVal } from './basic';

// TODO: make this implement the IRecordSet<any> interface
export interface UserListRecordSet {
  userList: ObjectKeyVal[];
  initialized: boolean;
}

export interface UserListDbResult {
  success: boolean;
  message: string;
  count: number;
  body: UserListRecordSet;
}
