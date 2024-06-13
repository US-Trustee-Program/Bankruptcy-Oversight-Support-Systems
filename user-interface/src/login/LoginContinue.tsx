import { getLoginProviderFromEnv } from './login-library';
import { BadConfiguration } from './BadConfiguration';
import { OktaProvider } from './providers/okta/OktaProvider';
import { OktaSession } from './providers/okta/OktaSession';
import { PropsWithChildren } from 'react';

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
