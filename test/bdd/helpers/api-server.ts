import { Application } from 'express';
import request, { SuperTest, Test } from 'supertest';
import { Server } from 'http';

// Import the Express app creator from backend
let app: Application;
let testServer: SuperTest<Test>;
let httpServer: Server;

// Use a specific test port to avoid conflicts
const TEST_PORT = 4000;

/**
 * Initialize the test API server
 * This starts a real HTTP server on port 4000 for testing
 * React components can make real HTTP requests to http://localhost:4000
 */
export async function initializeTestServer(): Promise<SuperTest<Test>> {
  if (testServer && httpServer) {
    return testServer;
  }

  // Dynamically import the backend server
  const { createApp } = await import('../../../backend/express/server.ts');

  // Create the Express app
  app = createApp();

  // Start listening on test port
  await new Promise<void>((resolve) => {
    httpServer = app.listen(TEST_PORT, () => {
      console.log(`[BDD Test Server] Listening on http://localhost:${TEST_PORT}`);
      resolve();
    });
  });

  // Also wrap with supertest for convenience
  testServer = request(app);

  return testServer;
}

/**
 * Get the test server instance
 * Throws an error if not initialized
 */
export function getTestServer(): SuperTest<Test> {
  if (!testServer) {
    throw new Error('Test server not initialized. Call initializeTestServer() first.');
  }
  return testServer;
}

/**
 * Reset the test server (useful between tests if needed)
 */
export async function resetTestServer(): Promise<void> {
  await cleanupTestServer();
  await initializeTestServer();
}

/**
 * Cleanup function - closes the HTTP server
 * Call this in afterAll() to properly shut down
 */
export async function cleanupTestServer(): Promise<void> {
  if (httpServer) {
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    httpServer = null as any;
  }
  testServer = null as any;
  app = null as any;
}

/**
 * Get the test server port
 */
export function getTestServerPort(): number {
  return TEST_PORT;
}
