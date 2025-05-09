async function loadConfiguration() {
  console.log('Fetching configuration.json.');
  const response = await fetch('/configuration.json');

  if (!response.ok) {
    throw new Error(`Failed to fetch configuration.json.`);
  }

  window.CAMS_CONFIGURATION = await response.json();
  console.log('Configuration loaded.');
}

function generateErrorHtml(error: Error) {
  console.error('Failed to load configuration.json.', error);
  const rootElement = document.getElementById('root');
  const errorMessage =
    'Failed to load application configuration. Please try again later or contact support.';
  if (rootElement) {
    rootElement.innerHTML = `<div><h3>${errorMessage}</h3></div>`;
  } else {
    document.body.innerHTML = `<div><h3>(Root element not found)</h3></div>`;
  }
}

async function mountCamsApplication() {
  import('./index');
}

loadConfiguration().then(mountCamsApplication).catch(generateErrorHtml);
