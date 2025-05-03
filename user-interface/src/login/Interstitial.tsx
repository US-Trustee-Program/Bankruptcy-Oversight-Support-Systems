import { LoadingSpinner, LoadingSpinnerProps } from '@/lib/components/LoadingSpinner';
import { PropsWithChildren } from 'react';

import { BlankPage } from './BlankPage';

export type InterstitialProps = LoadingSpinnerProps & PropsWithChildren;

export function Interstitial(props: InterstitialProps) {
  return (
    <BlankPage>
      <LoadingSpinner caption={props.caption} id={props.id} />
      <div>{props.children}</div>
    </BlankPage>
  );
}
