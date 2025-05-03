import { GlobalAlertContext } from '@/App';
import { useContext } from 'react';

export function useGlobalAlert() {
  return useContext(GlobalAlertContext)?.current;
}
