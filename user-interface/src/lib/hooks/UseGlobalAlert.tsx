import { useContext } from 'react';
import { GlobalAlertContext } from '@/App';

export function useGlobalAlert() {
  return useContext(GlobalAlertContext)?.current;
}
