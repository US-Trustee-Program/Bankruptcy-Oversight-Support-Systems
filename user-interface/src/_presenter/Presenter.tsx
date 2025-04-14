import Button from '@/lib/components/uswds/Button';
import { useState } from 'react';

type State = {
  count: number;
};

type Actions = {
  increment: () => void;
  decrement: () => void;
};

type Presenter = {
  state: State;
  actions: Actions;
};

export function usePresenter(state: Partial<State>): Presenter {
  console.log('RENDER PresenterWithUseState usePresenter');
  const [count, setCount] = useState<number>(state.count ?? 0);

  const increment = () => {
    setCount((prevCount) => prevCount + 1);
  };
  const decrement = () => {
    setCount((prevCount) => prevCount - 1);
  };

  return { state: { count }, actions: { increment, decrement } };
}

type ViewProps = {
  startCount?: number;
};

export function PresenterWithUseState(props: ViewProps) {
  console.log('RENDER PresenterWithUseState');

  const { actions, state } = usePresenter({ count: props.startCount });

  return (
    <>
      <div data-testId="theCount">{`${state.count}`}</div>
      <Button onClick={actions.decrement}> - </Button>
      <Button onClick={actions.increment}> + </Button>
    </>
  );
}
