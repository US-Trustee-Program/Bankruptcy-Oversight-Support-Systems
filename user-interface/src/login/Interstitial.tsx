import { PropsWithChildren } from 'react';
import { BlankPage } from './BlankPage';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';

export type InterstitialProps = PropsWithChildren & {
  message: string;
};

export function Interstitial(props: InterstitialProps) {
  return (
    <BlankPage>
      <LoadingSpinner caption={props.message} />
      <div>{props.children}</div>
    </BlankPage>
  );
}
