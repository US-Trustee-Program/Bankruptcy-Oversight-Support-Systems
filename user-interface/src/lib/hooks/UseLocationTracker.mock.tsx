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
    <div className="back-button" data-href={previousLocation} data-target={homeTab}>
      Link
    </div>
  );
}
