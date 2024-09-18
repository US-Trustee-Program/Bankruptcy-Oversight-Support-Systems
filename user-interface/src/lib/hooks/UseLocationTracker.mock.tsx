import { useEffect } from 'react';
import useLocationTracker from './UseLocationTracker';

type TestComponentProps = {
  location?: string;
  target?: string;
  updateLocation?: boolean;
};

export default function TestComponent(props: TestComponentProps) {
  const { previousLocation, homeTab, updateLocation } = useLocationTracker();

  useEffect(() => {
    if (props.location) {
      updateLocation(props.location);
    }
    if (props.updateLocation) {
      updateLocation();
    }
    if (props.target) {
      window.name = props.target;
    }
  }, []);

  return (
    <div>
      <a
        className="back-button"
        href={previousLocation || '#'}
        target={homeTab || '_self'}
        rel="noopener noreferrer"
      >
        Link
      </a>
    </div>
  );
}
