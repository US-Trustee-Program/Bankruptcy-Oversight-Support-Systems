import { CallBackProps } from '../../case-assignment/AssignAttorneyModal';

export default class MockUpdateCases {
  public static mockCallback(props: CallBackProps) {
    console.log(props);
  }
}
