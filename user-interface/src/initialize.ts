async function loadConfiguration() {
  try {
    console.log('Fetching configuration.json.');
    const response = await fetch('/configuration.json');

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Failed to fetch configuration.json: ${response.status} ${response.statusText}`,
        errorText,
      );
      throw new Error(
        `Failed to fetch configuration.json: ${response.status} ${response.statusText}. Server response: ${errorText}`,
      );
    }

    window.CAMS_CONFIGURATION = await response.json();
    console.log('Configuration loaded.');
  } catch (error) {
    console.error('Error loading application configuration:', error);
    const rootElement = document.getElementById('root');
    const errorMessage = `Critical error: Failed to load application configuration. Please try again later or contact support. Details: ${error instanceof Error ? error.message : String(error)}`;
    if (rootElement) {
      rootElement.innerHTML = `<div style="padding: 20px; text-align: center; color: red;"><h3>${errorMessage}</h3></div>`;
    } else {
      document.body.innerHTML = `<div style="padding: 20px; text-align: center; color: red;"><h3>${errorMessage} (Root element not found)</h3></div>`;
    }
    return;
  }
}

async function mountCamsApplication() {
  import('./index');
}

loadConfiguration().then(mountCamsApplication).catch(console.error);
