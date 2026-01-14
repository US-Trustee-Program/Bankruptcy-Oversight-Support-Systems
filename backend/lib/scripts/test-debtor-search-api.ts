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

import * as dotenv from 'dotenv';
import axios, { AxiosInstance } from 'axios';
import * as jwt from 'jsonwebtoken';
import { DEBTORS } from '../testing/mock-data/debtors.mock';
import {
  DebtorSearchDocument,
  SearchResultItem,
  FacetResult,
  SuggestionResult,
} from '../adapters/types/search';

// Load environment variables
dotenv.config();

// Generate a mock JWT token for testing
function generateMockToken(): string {
  const key = 'mock-secret'; // pragma: allowlist secret
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    aud: 'api://default',
    sub: 'user@fake.com', // Use a valid mock user subject
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
    Authorization: `Bearer ${mockToken}`,
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

async function testEndpoint(name: string, fn: () => Promise<unknown>): Promise<boolean> {
  try {
    log(`Testing: ${name}`, colors.yellow);
    await fn();
    logSuccess(`${name} - Success`);
    return true;
  } catch (error) {
    logError(`${name} - Failed`);
    const err = error as { response?: { status: number; data: unknown }; message?: string };
    if (err.response) {
      console.error('  Status:', err.response.status);
      console.error('  Data:', JSON.stringify(err.response.data, null, 2));
    } else if (err.message) {
      console.error('  Error:', err.message);
    } else {
      console.error('  Error:', error);
    }
    return false;
  }
}

async function main() {
  logSection('Debtor Search API Test Suite');

  // Check environment configuration
  logInfo('Environment Configuration:');
  logInfo(`CAMS_LOGIN_PROVIDER: ${process.env.CAMS_LOGIN_PROVIDER || 'NOT SET'}`);
  if (process.env.CAMS_LOGIN_PROVIDER !== 'mock') {
    logError('CAMS_LOGIN_PROVIDER must be set to "mock" for this test to work');
    logInfo('Please set CAMS_LOGIN_PROVIDER=mock in your .env file and restart the Express server');
    process.exit(1);
  }

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

  // Test 5: Basic Search tests
  logSection('5. Basic Search Tests');

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
          data.results.forEach((r: DebtorSearchDocument, i: number) => {
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
        params: { q: 'son', top: 3, skip: 0 },
      });
      logInfo(`Page 1: ${response1.data.data.results.length} results`);
      logInfo(`Has next: ${response1.data.meta.pagination.hasNext}`);

      const response2 = await api.get('/debtors/search', {
        params: { q: 'son', top: 3, skip: 3 },
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

  // Test 8: NEW - Hit Highlighting Test
  logSection('8. Hit Highlighting Test');
  results.push(
    await testEndpoint('Search with highlighting', async () => {
      const response = await api.get('/debtors/search', {
        params: {
          q: 'John',
          highlight: 'name,firstName,lastName',
        },
      });

      const data = response.data.data;
      if (data.items && data.items.length > 0) {
        logInfo('Highlighted Results:');
        data.items.forEach((item: SearchResultItem<DebtorSearchDocument>, i: number) => {
          console.log(`    ${i + 1}. Score: ${item.score.toFixed(2)}`);
          console.log(`       Document: ${item.document.name}`);
          if (item.highlights) {
            Object.entries(item.highlights).forEach(([field, values]: [string, string[]]) => {
              console.log(`       ${field}: ${values.join(', ')}`);
            });
          }
        });
      }
      return response;
    }),
  );

  // Test 9: NEW - Faceted Search Test
  logSection('9. Faceted Search Test');
  results.push(
    await testEndpoint('Search with facets', async () => {
      const response = await api.get('/debtors/search', {
        params: {
          q: 'son',
          facets: 'state,city',
        },
      });

      const data = response.data.data;
      if (data.facets) {
        logInfo('Facets:');
        Object.entries(data.facets).forEach(([field, values]: [string, FacetResult[]]) => {
          console.log(`    ${field}:`);
          values.slice(0, 5).forEach((facet: FacetResult) => {
            console.log(`      - ${facet.value}: ${facet.count} documents`);
          });
        });
      }
      return response;
    }),
  );

  // Test 10: NEW - Filter Test
  logSection('10. Filter Test');
  results.push(
    await testEndpoint('Search with filter', async () => {
      const response = await api.get('/debtors/search', {
        params: {
          q: 'son',
          filter: "state eq 'NY'",
        },
      });

      const data = response.data.data;
      logInfo(`Results found with filter: ${data.totalCount}`);
      if (data.results.length > 0) {
        logInfo('Filtered Results (all should be from NY):');
        data.results.forEach((r: DebtorSearchDocument, i: number) => {
          console.log(`    ${i + 1}. ${r.name} (${r.city}, ${r.state})`);
        });
      }
      return response;
    }),
  );

  // Test 11: NEW - Autocomplete Suggestions Test
  logSection('11. Autocomplete Suggestions Test');
  results.push(
    await testEndpoint('Get suggestions for "Jo"', async () => {
      const response = await api.get('/debtors/search/suggest', {
        params: {
          q: 'Jo',
          top: 5,
        },
      });

      const data = response.data.data;
      logInfo(`Suggestions found: ${data.suggestions.length}`);
      if (data.suggestions.length > 0) {
        logInfo('Suggestions:');
        data.suggestions.forEach((s: SuggestionResult, i: number) => {
          console.log(`    ${i + 1}. ${s.text}`);
          if (s.highlightedText) {
            console.log(`       Highlighted: ${s.highlightedText}`);
          }
        });
      }
      return response;
    }),
  );

  // Test 12: Combined Features Test
  logSection('12. Combined Features Test');
  results.push(
    await testEndpoint('Search with multiple features', async () => {
      const response = await api.get('/debtors/search', {
        params: {
          q: 'Smith',
          fuzzy: true,
          highlight: 'name,firstName,lastName',
          facets: 'state',
          top: 3,
        },
      });

      const data = response.data.data;
      logInfo(`Results found: ${data.totalCount}`);

      if (data.items && data.items.length > 0) {
        logInfo('Results with scoring and highlighting:');
        data.items.forEach((item: SearchResultItem<DebtorSearchDocument>, i: number) => {
          console.log(`    ${i + 1}. ${item.document.name} (Score: ${item.score})`);
        });
      }

      if (data.facets && data.facets.state) {
        logInfo(`State facet count: ${data.facets.state.length}`);
      }

      return response;
    }),
  );

  // Test 13: Error handling
  logSection('13. Error Handling Tests');
  results.push(
    await testEndpoint('Search with empty query', async () => {
      try {
        await api.get('/debtors/search', { params: { q: '' } });
        throw new Error('Should have failed with empty query');
      } catch (error) {
        const err = error as { response?: { status: number } };
        if (err.response && err.response.status === 400) {
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
      } catch (error) {
        const err = error as { response?: { status: number } };
        if (err.response && err.response.status === 400) {
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
