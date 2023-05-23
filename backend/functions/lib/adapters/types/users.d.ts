import { ObjectKeyVal } from "./basic";

// TODO: make this implement the IRecordSet<any> interface
export type UserListRecordSet = {
  userList: ObjectKeyVal[];
  initialized: boolean;
}

export type UserListDbResult = {
  success: boolean;
  message: string;
  count: number;
  body: UserListRecordSet;
};
