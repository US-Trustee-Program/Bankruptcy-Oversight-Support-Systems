import { useEffect } from 'react';
import './Home.scss';

function Home() {
  useEffect(() => {
    window.location.assign('/my-cases');
  });

  return <></>;
}

export default Home;
