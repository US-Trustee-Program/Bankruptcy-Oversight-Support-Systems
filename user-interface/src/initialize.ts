async function loadConfiguration() {
  console.log('Fetching configuration.json.');
  const response = await fetch('/configuration.json');

  if (!response.ok) {
    throw new Error(`Failed to fetch configuration.json.`);
  }

  window.CAMS_CONFIGURATION = await response.json();
  console.log('Configuration loaded.');
}

async function mountCamsApplication() {
  import('./index');
}

loadConfiguration()
  .then(mountCamsApplication)
  .catch(() => {
    throw new Error(
      'Unable to start CAMS application. Please try again later. If the problem persists, please contact USTP support.',
    );
  });
