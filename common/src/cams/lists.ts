export type ListNames = 'banks' | 'bankruptcy-software';

export type ListItem<T = string> = {
  _id: string;
  _deleted?: true;
  list: ListNames;
  key: string;
  value: T;
};

export type BankListItem = ListItem<string> & {
  list: 'banks';
};

export type BankList = BankListItem[];

export type BankruptcySoftwareListItem = ListItem<string> & {
  list: 'bankruptcy-software';
};

export type BankruptcySoftwareList = BankruptcySoftwareListItem[];
