import { useRef, useState } from 'react';
import Alert, { AlertRefType, UswdsAlertStyle } from '../lib/components/uswds/Alert';
import './AlertAccessibilityTest.scss';

/**
 * Test page for accessibility testing of Alert component with NVDA.
 * This page allows manual testing of how NVDA reads alerts when they appear dynamically.
 */
export function AlertAccessibilityTest() {
  const alertRef = useRef<AlertRefType>(null);
  const [showAlert, setShowAlert] = useState(false);

  const handleToggleAlert = () => {
    if (showAlert) {
      alertRef.current?.hide();
      setShowAlert(false);
    } else {
      alertRef.current?.show();
      setShowAlert(true);
    }
  };

  return (
    <div className="alert-accessibility-test">
      <h1>Alert Accessibility Test Page</h1>

      <p>
        This page is for testing NVDA screen reader compatibility with dynamically appearing alerts.
      </p>

      <button onClick={handleToggleAlert} className="usa-button" aria-expanded={showAlert}>
        {showAlert ? 'Hide Alert' : 'Show Alert'}
      </button>

      <div style={{ marginTop: '2rem' }}>
        <Alert
          ref={alertRef}
          id="test-alert"
          type={UswdsAlertStyle.Info}
          title="This is the alert title"
          message="This is the alert message content."
          slim={true}
          show={showAlert}
        />
      </div>

      <section style={{ marginTop: '3rem' }}>
        <h2>Instructions for Testing</h2>
        <ol>
          <li>Start NVDA screen reader</li>
          <li>Load this page</li>
          <li>Tab to the Show Alert button</li>
          <li>Press Enter to show the alert</li>
          <li>Listen to what NVDA announces</li>
          <li>Use NVDA + Down Arrow to read the content if needed</li>
        </ol>

        <h3>What should happen</h3>
        <p>
          When the alert appears, NVDA should announce both the title and the message. Currently, it
          may only announce the message and skip the title.
        </p>

        <h3>Current Implementation</h3>
        <ul>
          <li>Alert has role=status (or alert for errors)</li>
          <li>Alert has aria-live=polite (or assertive for errors)</li>
          <li>Title is rendered as &lt;h4&gt; with class usa-alert__heading</li>
          <li>Slim alerts with titles use usa-alert--compact-with-title class</li>
        </ul>
      </section>
    </div>
  );
}

export default AlertAccessibilityTest;
