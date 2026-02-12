import * as dotenv from 'dotenv';
import { InvocationContext } from '@azure/functions';
import ApplicationContextCreator from '../function-apps/azure/application-context-creator';
import factory from '../lib/factory';

dotenv.config({ path: '.env' });

async function checkData() {
  const invocationContext = new InvocationContext();
  const context = await ApplicationContextCreator.getApplicationContext({
    invocationContext,
    logger: ApplicationContextCreator.getLogger(invocationContext),
  });

  const gateway = factory.getAtsGateway(context);

  console.log('Checking TRUSTEES table data...\n');

  // Check total records
  const totalQuery = `SELECT COUNT(*) as total FROM TRUSTEES`;
  const totalResult = await (gateway as any).executeQuery(context, totalQuery, []);
  console.log(`Total records in TRUSTEES: ${totalResult.results[0].total}`);

  // Check records with TRU_ID
  const withIdQuery = `SELECT COUNT(*) as total FROM TRUSTEES WHERE TRU_ID IS NOT NULL`;
  const withIdResult = await (gateway as any).executeQuery(context, withIdQuery, []);
  console.log(`Records with TRU_ID: ${withIdResult.results[0].total}`);

  // Check records without TRU_ID
  const withoutIdQuery = `SELECT COUNT(*) as total FROM TRUSTEES WHERE TRU_ID IS NULL`;
  const withoutIdResult = await (gateway as any).executeQuery(context, withoutIdQuery, []);
  console.log(`Records with NULL TRU_ID: ${withoutIdResult.results[0].total}`);

  // Get sample records (using ID instead of TRU_ID)
  console.log('\nSample records (first 3):');
  const sampleQuery = `
    SELECT TOP 3
      ID,
      TRU_ID,
      LAST_NAME,
      FIRST_NAME,
      COMPANY,
      CITY,
      STATE
    FROM TRUSTEES
    ORDER BY ID
  `;
  const sampleResult = await (gateway as any).executeQuery(context, sampleQuery, []);

  for (const row of sampleResult.results) {
    console.log(`\n  ID: ${row.ID} | TRU_ID: ${row.TRU_ID}`);
    console.log(`  Name: ${row.FIRST_NAME} ${row.LAST_NAME}`);
    console.log(`  Company: ${row.COMPANY}`);
    console.log(`  Location: ${row.CITY}, ${row.STATE}`);
  }
}

checkData().catch(console.error);
