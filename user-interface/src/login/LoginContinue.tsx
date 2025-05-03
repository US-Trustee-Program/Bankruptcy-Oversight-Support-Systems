import { PropsWithChildren } from 'react';

import { BadConfiguration } from './BadConfiguration';
import { getLoginProviderFromEnv } from './login-library';
import { OktaProvider } from './providers/okta/OktaProvider';
import { OktaSession } from './providers/okta/OktaSession';

export function LoginContinue(props: PropsWithChildren) {
  const provider = getLoginProviderFromEnv();
  let providerComponent;
  switch (provider) {
    case 'okta':
      providerComponent = (
        <OktaProvider>
          <OktaSession>{props.children}</OktaSession>
        </OktaProvider>
      );
      break;
    default:
      providerComponent = (
        <BadConfiguration message={`Unexpected continuation path for provider '${provider}'.`} />
      );
  }

  return providerComponent;
}
