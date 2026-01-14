#!/usr/bin/env node

/**
 * Test script for debtor search API endpoints
 *
 * This script tests the debtor search API endpoints by:
 * 1. Initializing the search index
 * 2. Syncing mock debtor data
 * 3. Performing various searches
 * 4. Getting index statistics
 *
 * Usage: npm run test-debtor-api
 *
 * Note: Requires the express server to be running on port 7071
 *       with CAMS_LOGIN_PROVIDER='mock' environment variable
 */

import axios, { AxiosInstance } from 'axios';
import * as jwt from 'jsonwebtoken';
import { DEBTORS } from '../testing/mock-data/debtors.mock';
import { DebtorSearchDocument } from '../adapters/types/search';

// Generate a mock JWT token for testing
function generateMockToken(): string {
  const key = 'mock-secret'; // pragma: allowlist secret
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    aud: 'api://default',
    sub: 'user',
    iss: 'http://localhost:7071',
    exp: now + 3600, // 1 hour expiration
    groups: [],
  };
  return jwt.sign(claims, key);
}

const mockToken = generateMockToken();

const API_BASE_URL = 'http://localhost:7071/api';
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${mockToken}`,
  },
});

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

function log(message: string, color: string = colors.reset) {
  console.log(color + message + colors.reset);
}

function logSuccess(message: string) {
  log('✅ ' + message, colors.green);
}

function logError(message: string) {
  log('❌ ' + message, colors.red);
}

function logInfo(message: string) {
  log('ℹ️  ' + message, colors.blue);
}

function logSection(title: string) {
  console.log('\n' + colors.bright + colors.magenta + '═'.repeat(60) + colors.reset);
  log(title, colors.bright + colors.magenta);
  console.log(colors.bright + colors.magenta + '═'.repeat(60) + colors.reset + '\n');
}

async function testEndpoint(name: string, fn: () => Promise<any>): Promise<boolean> {
  try {
    log(`Testing: ${name}`, colors.yellow);
    const result = await fn();
    logSuccess(`${name} - Success`);
    return true;
  } catch (error: any) {
    logError(`${name} - Failed`);
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('  Error:', error.message);
    }
    return false;
  }
}

async function main() {
  logSection('Debtor Search API Test Suite');

  const results: boolean[] = [];

  // Test 1: Initialize search index
  logSection('1. Initialize Search Index');
  results.push(
    await testEndpoint('POST /api/debtors/search/init', async () => {
      const response = await api.post('/debtors/search/init');
      logInfo(`Response: ${response.data.data.message}`);
      return response;
    }),
  );

  // Test 2: Get initial stats
  logSection('2. Get Initial Index Statistics');
  results.push(
    await testEndpoint('GET /api/debtors/search/stats', async () => {
      const response = await api.get('/debtors/search/stats');
      logInfo(`Document count: ${response.data.data.documentCount}`);
      return response;
    }),
  );

  // Test 3: Sync mock debtor data
  logSection('3. Sync Mock Debtor Data');

  // Transform mock debtors to search documents
  const documents: DebtorSearchDocument[] = Array.from(DEBTORS.entries())
    .slice(0, 10) // Use first 10 for testing
    .map(([key, debtor]) => {
      const cityStateZip = debtor.cityStateZipCountry || '';
      const parts = cityStateZip.split(',');
      const city = parts[0]?.trim() || '';
      const stateZip = parts[1]?.trim() || '';
      const state = stateZip.split(' ')[0] || '';

      const nameParts = debtor.name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      return {
        id: key.replace(/-/g, ''),
        name: debtor.name,
        firstName,
        lastName,
        ssn: debtor.ssn?.replace(/-/g, ''),
        taxId: debtor.taxId?.replace(/-/g, ''),
        address: debtor.address1,
        city,
        state,
      };
    });

  results.push(
    await testEndpoint('POST /api/debtors/search/sync', async () => {
      const response = await api.post('/debtors/search/sync', { documents });
      logInfo(`Documents processed: ${response.data.data.documentsProcessed}`);
      return response;
    }),
  );

  // Wait for indexing
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Test 4: Get updated stats
  logSection('4. Get Updated Index Statistics');
  results.push(
    await testEndpoint('GET /api/debtors/search/stats (after sync)', async () => {
      const response = await api.get('/debtors/search/stats');
      logInfo(`Document count: ${response.data.data.documentCount}`);
      return response;
    }),
  );

  // Test 5: Search tests
  logSection('5. Search Tests');

  const searchTests = [
    { q: 'Smith', fuzzy: false, description: 'Exact search for "Smith"' },
    { q: 'Smth', fuzzy: true, description: 'Fuzzy search for "Smth"' },
    { q: 'John', fuzzy: false, description: 'Search for first name "John"' },
    { q: 'Johnson', fuzzy: false, description: 'Exact search for "Johnson"' },
    { q: 'Jonson', fuzzy: true, description: 'Fuzzy search for "Jonson"' },
    { q: 'Anderson', fuzzy: false, description: 'Search for "Anderson"' },
    { q: 'xyz', fuzzy: false, description: 'Search for non-existent name' },
  ];

  for (const test of searchTests) {
    results.push(
      await testEndpoint(test.description, async () => {
        const response = await api.get('/debtors/search', {
          params: {
            q: test.q,
            fuzzy: test.fuzzy,
            top: 5,
          },
        });

        const data = response.data.data;
        logInfo(`Query: "${test.q}" (fuzzy: ${test.fuzzy})`);
        logInfo(`Results found: ${data.totalCount}`);

        if (data.results.length > 0) {
          logInfo('Results:');
          data.results.forEach((r: any, i: number) => {
            console.log(`    ${i + 1}. ${r.name} (${r.city}, ${r.state})`);
          });
        }

        return response;
      }),
    );
  }

  // Test 6: Pagination test
  logSection('6. Pagination Test');
  results.push(
    await testEndpoint('Search with pagination', async () => {
      const response1 = await api.get('/debtors/search', {
        params: { q: '', top: 3, skip: 0 },
      });
      logInfo(`Page 1: ${response1.data.data.results.length} results`);
      logInfo(`Has next: ${response1.data.meta.pagination.hasNext}`);

      const response2 = await api.get('/debtors/search', {
        params: { q: '', top: 3, skip: 3 },
      });
      logInfo(`Page 2: ${response2.data.data.results.length} results`);
      logInfo(`Has previous: ${response2.data.meta.pagination.hasPrevious}`);

      return response2;
    }),
  );

  // Test 7: Field selection test
  logSection('7. Field Selection Test');
  results.push(
    await testEndpoint('Search with field selection', async () => {
      const response = await api.get('/debtors/search', {
        params: {
          q: 'Smith',
          fields: 'id,name',
        },
      });

      if (response.data.data.results.length > 0) {
        const firstResult = response.data.data.results[0];
        logInfo('Fields returned: ' + Object.keys(firstResult).join(', '));
      }

      return response;
    }),
  );

  // Test 8: Error handling
  logSection('8. Error Handling Tests');
  results.push(
    await testEndpoint('Search with empty query', async () => {
      try {
        await api.get('/debtors/search', { params: { q: '' } });
        throw new Error('Should have failed with empty query');
      } catch (error: any) {
        if (error.response && error.response.status === 400) {
          logInfo('Correctly rejected empty query');
          return { data: 'success' };
        }
        throw error;
      }
    }),
  );

  results.push(
    await testEndpoint('Search with short query', async () => {
      try {
        await api.get('/debtors/search', { params: { q: 'a' } });
        throw new Error('Should have failed with short query');
      } catch (error: any) {
        if (error.response && error.response.status === 400) {
          logInfo('Correctly rejected short query');
          return { data: 'success' };
        }
        throw error;
      }
    }),
  );

  // Summary
  logSection('Test Summary');
  const passed = results.filter((r) => r).length;
  const failed = results.filter((r) => !r).length;
  const total = results.length;

  console.log(`${colors.bright}Total Tests: ${total}${colors.reset}`);
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  if (failed > 0) {
    console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
  }

  const successRate = ((passed / total) * 100).toFixed(1);
  if (failed === 0) {
    logSuccess(`All tests passed! (${successRate}% success rate)`);
  } else {
    logError(`Some tests failed! (${successRate}% success rate)`);
  }

  console.log('\n' + colors.bright + colors.blue + '🏁 Test suite completed' + colors.reset);
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
main().catch((error) => {
  logError('Fatal error running tests:');
  console.error(error);
  process.exit(1);
});
