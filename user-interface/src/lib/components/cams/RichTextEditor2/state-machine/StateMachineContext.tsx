import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { EditorStateMachine, EditorState, EditorEvent } from './StateMachine';

interface StateMachineContextValue {
  stateMachine: EditorStateMachine;
  currentState: EditorState;
  dispatch: (event: EditorEvent) => void;
}

const StateMachineContext = createContext<StateMachineContextValue | null>(null);

export interface StateMachineProviderProps {
  children: React.ReactNode;
}

export function StateMachineProvider({ children }: StateMachineProviderProps) {
  const stateMachineRef = useRef<EditorStateMachine>(new EditorStateMachine());
  const [currentState, setCurrentState] = useState<EditorState>(EditorState.IDLE);

  useEffect(() => {
    const stateMachine = stateMachineRef.current;

    // Subscribe to state changes
    stateMachine.onStateChange((newState) => {
      setCurrentState(newState);
    });

    // Initialize current state
    setCurrentState(stateMachine.getCurrentState());

    // Cleanup is not needed as the state machine doesn't have cleanup requirements
    // and the ref will be cleaned up when component unmounts
  }, []);

  const dispatch = (event: EditorEvent) => {
    stateMachineRef.current.dispatch(event);
  };

  const contextValue: StateMachineContextValue = {
    stateMachine: stateMachineRef.current,
    currentState,
    dispatch,
  };

  return (
    <StateMachineContext.Provider value={contextValue}>{children}</StateMachineContext.Provider>
  );
}

export function useStateMachine(): StateMachineContextValue {
  const context = useContext(StateMachineContext);
  if (!context) {
    throw new Error('useStateMachine must be used within a StateMachineProvider');
  }
  return context;
}
