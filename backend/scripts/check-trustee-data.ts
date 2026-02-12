import * as dotenv from 'dotenv';
import { InvocationContext } from '@azure/functions';
import ApplicationContextCreator from '../function-apps/azure/application-context-creator';
import factory from '../lib/factory';

dotenv.config({ path: '.env' });

type Row = Record<string, string | number | null>;

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
  const totalResult = await gateway.executeQuery(context, totalQuery, []);
  const totalRows = totalResult.results as Row[];
  console.log(`Total records in TRUSTEES: ${totalRows[0].total}`);

  // Check records with TRU_ID
  const withIdQuery = `SELECT COUNT(*) as total FROM TRUSTEES WHERE TRU_ID IS NOT NULL`;
  const withIdResult = await gateway.executeQuery(context, withIdQuery, []);
  const withIdRows = withIdResult.results as Row[];
  console.log(`Records with TRU_ID: ${withIdRows[0].total}`);

  // Check records without TRU_ID
  const withoutIdQuery = `SELECT COUNT(*) as total FROM TRUSTEES WHERE TRU_ID IS NULL`;
  const withoutIdResult = await gateway.executeQuery(context, withoutIdQuery, []);
  const withoutIdRows = withoutIdResult.results as Row[];
  console.log(`Records with NULL TRU_ID: ${withoutIdRows[0].total}`);

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
  const sampleResult = await gateway.executeQuery(context, sampleQuery, []);
  const sampleRows = sampleResult.results as Row[];

  for (const row of sampleRows) {
    console.log(`\n  ID: ${row.ID} | TRU_ID: ${row.TRU_ID}`);
    console.log(`  Name: ${row.FIRST_NAME} ${row.LAST_NAME}`);
    console.log(`  Company: ${row.COMPANY}`);
    console.log(`  Location: ${row.CITY}, ${row.STATE}`);
  }
}

checkData().catch(console.error);
