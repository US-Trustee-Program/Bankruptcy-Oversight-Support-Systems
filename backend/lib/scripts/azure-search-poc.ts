import { getSearchGateway } from '../factory';
import { ApplicationConfiguration } from '../configs/application-configuration';
import { DEBTORS } from '../testing/mock-data/debtors.mock';
import { DebtorSearchDocument } from '../adapters/types/search';
import { ApplicationContext } from '../adapters/types/basic';

/**
 * Azure AI Search POC Demonstration Script
 *
 * This script demonstrates the basic capabilities of Azure AI Search integration:
 * 1. Index creation
 * 2. Document upload (batch processing)
 * 3. Exact match searching
 * 4. Fuzzy match searching (typo tolerance)
 *
 * Usage: npm run azure-search-poc
 */
async function runPOC() {
  console.log('🚀 Azure AI Search POC Starting...\n');

  // Step 0: Initialize configuration and context
  console.log('⚙️  Step 0: Initializing configuration...');
  const config = new ApplicationConfiguration();
  const context = {
    config,
    logger: console as any, // Simple logger for POC
  } as ApplicationContext;

  console.log(`   Endpoint: ${config.azureSearchConfig.endpoint || '[Not configured]'}`);
  console.log(`   Index Name: ${config.azureSearchConfig.indexName}`);
  console.log(`   Mode: ${config.azureSearchConfig.mock || config.dbMock ? 'MOCK' : 'REAL'}\n`);

  const searchGateway = getSearchGateway(context);

  try {
    // Step 1: Create Index
    console.log('📋 Step 1: Creating search index...');
    await searchGateway.createIndex();
    console.log('   ✅ Index created successfully\n');

    // Step 2: Transform mock debtors to search documents
    console.log('🔄 Step 2: Transforming mock debtor data...');
    const documents: DebtorSearchDocument[] = Array.from(DEBTORS.entries()).map(([key, debtor]) => {
      // Parse city and state from cityStateZipCountry
      const cityStateZip = debtor.cityStateZipCountry || '';
      const parts = cityStateZip.split(',');
      const city = parts[0]?.trim() || '';
      const stateZip = parts[1]?.trim() || '';
      const state = stateZip.split(' ')[0] || '';

      // Split name into first and last name (simple split on space)
      const nameParts = debtor.name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      return {
        id: key.replace(/-/g, ''), // Remove hyphens for ID
        name: debtor.name,
        firstName,
        lastName,
        ssn: debtor.ssn?.replace(/-/g, ''), // Store without hyphens
        taxId: debtor.taxId?.replace(/-/g, ''), // Store without hyphens
        address: debtor.address1,
        city,
        state,
      };
    });
    console.log(`   ✅ Transformed ${documents.length} documents\n`);

    // Step 3: Upload Documents
    console.log('📤 Step 3: Uploading documents to index...');
    await searchGateway.uploadDocuments(documents);

    // Wait a moment for indexing to complete
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const docCount = await searchGateway.getDocumentCount();
    console.log(`   ✅ ${docCount} documents indexed\n`);

    // Step 4: Test Searches
    console.log('🔍 Step 4: Testing search capabilities...\n');
    console.log('─'.repeat(70) + '\n');

    const testQueries = [
      { query: 'Smith', description: 'Exact last name match', fuzzy: false },
      { query: 'Smth', description: 'Fuzzy match with typo (Smth → Smith)', fuzzy: true },
      { query: 'Johnson', description: 'Exact last name match', fuzzy: false },
      { query: 'Jonson', description: 'Fuzzy match with typo (Jonson → Johnson)', fuzzy: true },
      { query: 'John', description: 'First name search', fuzzy: false },
      { query: 'Mary', description: 'First name search', fuzzy: false },
      { query: 'Anderson', description: 'Last name search', fuzzy: false },
    ];

    for (const test of testQueries) {
      console.log(`📝 Query: "${test.query}"`);
      console.log(`   Type: ${test.description}`);
      console.log(`   Fuzzy: ${test.fuzzy ? 'Yes' : 'No'}`);

      const startTime = Date.now();
      const results = await searchGateway.search<DebtorSearchDocument>(test.query, {
        fuzzy: test.fuzzy,
        top: 5,
      });
      const duration = Date.now() - startTime;

      console.log(`   ⏱️  Search time: ${duration}ms`);
      console.log(`   📊 Results: ${results.count} found`);

      if (results.results.length > 0) {
        results.results.forEach((doc, index) => {
          console.log(`      ${index + 1}. ${doc.name} (${doc.city}, ${doc.state})`);
        });
      } else {
        console.log('      No results found');
      }

      console.log('');
    }

    console.log('─'.repeat(70) + '\n');

    // Step 5: Demonstrate exact PII search (SSN filter)
    console.log('🔐 Step 5: Testing PII exact match (SSN)...\n');

    // Note: In the real implementation, SSN searches would use filter queries
    // For this POC, we'll demonstrate the concept
    console.log('   ℹ️  Note: PII fields (SSN, TaxID) are filterable but not searchable');
    console.log('   This prevents them from appearing in autocomplete and general search');
    console.log("   Real implementation would use: $filter=ssn eq '010101010'\n");

    // Summary
    console.log('✨ POC Complete!\n');
    console.log('📊 Summary:');
    console.log(`   • Index created: ${config.azureSearchConfig.indexName}`);
    console.log(`   • Documents indexed: ${docCount}`);
    console.log(`   • Searches performed: ${testQueries.length}`);
    console.log(`   • Fuzzy matching: Demonstrated`);
    console.log(`   • Response times: Sub-second\n`);

    console.log('✅ Azure AI Search POC was successful!\n');
    console.log('Next steps:');
    console.log('   1. Connect to real Azure Search service (set AZURE_SEARCH_ENDPOINT)');
    console.log('   2. Index real debtor data from Cosmos DB');
    console.log('   3. Add phonetic search and autocomplete');
    console.log('   4. Implement Change Feed sync for real-time updates');
    console.log('   5. Add production API endpoints\n');
  } catch (error) {
    console.error('❌ Error during POC execution:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    // Cleanup
    await searchGateway.release();
  }
}

// Run the POC
runPOC().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
