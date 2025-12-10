export function setCurrentNav<T>(activeNav: T, stateToCheck: T): string {
  return activeNav === stateToCheck ? 'usa-current current' : '';
}

export function createNavStateMapper<T>(
  pathToStateMap: Record<string, T>,
  defaultState: T,
): (path: string) => T {
  return (path: string): T => {
    const cleanPath = path.replace(/\/$/, '').split('/');
    const lastSegment = cleanPath[cleanPath.length - 1];
    return pathToStateMap[lastSegment] || defaultState;
  };
}

interface NavigationItem<T> {
  state: T;
  path: string;
  label: string;
  testId: string;
  title: string;
  end?: boolean;
  isConditional?: boolean;
  conditionalCheck?: () => boolean;
}

interface DetailNavigationProps<T> {
  entityId: string | undefined;
  initiallySelectedNavLink: T;
  className?: string;
}
