async function loadConfiguration() {
  const hostName = window.location.hostname;
  let slotName = '';
  if (hostName && !hostName.includes('localhost') && hostName.includes('-webapp')) {
    slotName = window.location.hostname.split('-webapp')[1].split('.')[0];
  }
  const configurationUrl = `/configuration${slotName}.json`;
  const response = await fetch(configurationUrl);

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
