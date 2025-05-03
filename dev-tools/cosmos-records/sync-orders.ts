import * as dotenv from 'dotenv';

export function syncOrders() {
  dotenv.config();
  const endpoint = process.env.ORDER_SYNC_ENDPOINT;
  if (!endpoint) {
    console.log('ORDER_SYNC_ENDPOINT environment variable required.');
    return;
  }
  fetch(endpoint, {
    body: JSON.stringify({
      txIdOverride: 0,
    }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
    .then((response) => {
      response
        .json()
        .then((data) => console.log('Loaded orders:', JSON.stringify(data, null, 2)))
        .catch((error) => console.log('Unable to read API response:', error));
    })
    .catch((error) => console.log('Unable to sync orders. Reason:', error.message, error));
}

syncOrders();
