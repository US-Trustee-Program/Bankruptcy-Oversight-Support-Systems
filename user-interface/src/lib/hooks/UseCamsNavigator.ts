import { useLocation, useNavigate, Location, NavigateOptions } from 'react-router-dom';

function getFinalDestination(
  destination: string,
  location: globalThis.Location | Location = window.location,
) {
  let qParams: string = '';
  const msRoutingName = 'x-ms-routing-name';
  if (location.search?.includes(msRoutingName)) {
    const query: Record<string, string> = location.search
      .substring(1)
      .split('&')
      .reduce<Record<string, string>>(
        (acc, item) => {
          const [key, val] = item.split('=');
          if (key && val) {
            acc[key] = val;
          }
          return acc;
        },
        {} as Record<string, string>,
      );
    if (query[msRoutingName]) {
      qParams += `?${msRoutingName}=${query[msRoutingName]}`;
    }
  }
  return destination + qParams;
}

export const redirectTo = (
  destination: string,
  location: globalThis.Location | Location = window.location,
) => {
  window.location.assign(getFinalDestination(destination, location));
};

export default function useCamsNavigator() {
  const location = useLocation();
  const navigate = useNavigate();

  const navigateTo = (destination: string, state?: object) => {
    navigate(getFinalDestination(destination, location), { state } as NavigateOptions);
  };

  return {
    navigateTo,
    redirectTo,
  };
}
