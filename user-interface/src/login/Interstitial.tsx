import { PropsWithChildren } from 'react';
import { BlankPage } from './BlankPage';
import { LoadingSpinner, LoadingSpinnerProps } from '@/lib/components/LoadingSpinner';

type InterstitialProps = PropsWithChildren & LoadingSpinnerProps;

export function Interstitial(props: InterstitialProps) {
  return (
    <BlankPage>
      <LoadingSpinner id={props.id} caption={props.caption} />
      <div>{props.children}</div>
    </BlankPage>
  );
}
