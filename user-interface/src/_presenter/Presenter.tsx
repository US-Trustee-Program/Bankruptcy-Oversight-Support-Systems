import Button from '@/lib/components/uswds/Button';
import { Api2 } from '@/lib/models/api2';
import { UstpOfficeDetails } from '@common/cams/offices';
import { useEffect, useState } from 'react';

type State = {
  count: number;
  doBang: boolean;
  offices: UstpOfficeDetails[];
};

type Actions = {
  increment: () => void;
  decrement: () => void;
  getOffices: () => void;
};

type Presenter = {
  state: State;
  actions: Actions;
};

export function usePresenter(state: Partial<State>): Presenter {
  console.log('RENDER PresenterWithUseState usePresenter');
  const handleBang = (value: number) => {
    return value % 10 === 0;
  };
  const [count, setCount] = useState<number>(state.count ?? 0);
  const [doBang, setDoBang] = useState<boolean>(handleBang(state.count ?? 0));
  const [offices, setOffices] = useState<UstpOfficeDetails[]>([]);

  const increment = () => {
    setCount((prevCount) => prevCount + 1);
    setDoBang(handleBang(count + 1));
  };

  const decrement = () => {
    setCount((prevCount) => prevCount - 1);
    setDoBang(handleBang(count - 1));
  };

  const getOffices = async () => {
    const response = await Api2.getOffices();
    if (count > 0) {
      setOffices(response.data.slice(0, count));
    } else {
      setOffices([]);
    }
  };

  return { state: { count, doBang, offices }, actions: { increment, decrement, getOffices } };
}

type ViewProps = {
  startCount?: number;
};

export function PresenterWithUseState(props: ViewProps) {
  console.log('RENDER PresenterWithUseState');

  const { actions, state } = usePresenter({ count: props.startCount });

  useEffect(() => {
    actions.getOffices();
  }, [state.count]);

  return (
    <>
      <div data-testId="theCount">{`${state.count}`}</div>
      <div data-testId="theBang">{state.doBang ? 'BANG!' : 'wimper'}</div>
      <Button onClick={actions.decrement}> - </Button>
      <Button onClick={actions.increment}> + </Button>
      <ul>
        {state.offices.map((office: UstpOfficeDetails) => (
          <li key={office.officeCode}>{office.officeName}</li>
        ))}
      </ul>
    </>
  );
}
