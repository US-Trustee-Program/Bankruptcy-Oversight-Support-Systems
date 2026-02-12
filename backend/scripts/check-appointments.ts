import * as dotenv from 'dotenv';
import { InvocationContext } from '@azure/functions';
import ApplicationContextCreator from '../function-apps/azure/application-context-creator';
import factory from '../lib/factory';

dotenv.config({ path: '.env' });

type Row = Record<string, string | number | null>;

async function checkAppointments() {
  const invocationContext = new InvocationContext();
  const context = await ApplicationContextCreator.getApplicationContext({
    invocationContext,
    logger: ApplicationContextCreator.getLogger(invocationContext),
  });

  const gateway = factory.getAtsGateway(context);

  console.log('Checking CHAPTER_DETAILS table...\n');

  // Check if CHAPTER_DETAILS references ID or TRU_ID
  const query = `
    SELECT TOP 5
      CD.CD_ID,
      CD.TRU_ID as CD_TRU_ID,
      T.ID as T_ID,
      T.TRU_ID as T_TRU_ID,
      T.LAST_NAME,
      T.FIRST_NAME,
      CD.CHAPTER,
      CD.STATUS,
      CD.DISTRICT
    FROM CHAPTER_DETAILS CD
    LEFT JOIN TRUSTEES T ON CD.TRU_ID = T.ID
    WHERE T.ID IS NOT NULL
    ORDER BY CD.CD_ID
  `;

  const result = await gateway.executeQuery(context, query, []);
  const rows = result.results as Row[];

  console.log('Sample CHAPTER_DETAILS with TRUSTEES join:');
  console.log('===========================================');

  if (rows.length === 0) {
    console.log('No matching records found when joining on CD.TRU_ID = T.ID');

    // Try the other way
    const altQuery = `
      SELECT COUNT(*) as count
      FROM CHAPTER_DETAILS CD
      WHERE EXISTS (SELECT 1 FROM TRUSTEES T WHERE T.ID = CD.TRU_ID)
    `;
    const altResult = await gateway.executeQuery(context, altQuery, []);
    const altRows = altResult.results as Row[];
    console.log(`\nRecords that match when CD.TRU_ID = T.ID: ${altRows[0].count}`);

    // Check distinct TRU_ID values in CHAPTER_DETAILS
    const distinctQuery = `
      SELECT TOP 10 DISTINCT TRU_ID
      FROM CHAPTER_DETAILS
      WHERE TRU_ID IS NOT NULL
      ORDER BY TRU_ID
    `;
    const distinctResult = await gateway.executeQuery(context, distinctQuery, []);
    const distinctRows = distinctResult.results as Row[];
    console.log('\nSample TRU_ID values in CHAPTER_DETAILS:');
    for (const row of distinctRows) {
      console.log(`  ${row.TRU_ID}`);
    }
  } else {
    for (const row of rows) {
      console.log(`\nCD_ID: ${row.CD_ID}`);
      console.log(`  CD.TRU_ID: ${row.CD_TRU_ID} -> T.ID: ${row.T_ID}`);
      console.log(`  Trustee: ${row.FIRST_NAME} ${row.LAST_NAME}`);
      console.log(`  Chapter: ${row.CHAPTER}, Status: ${row.STATUS}`);
      console.log(`  District: ${row.DISTRICT}`);
    }
  }
}

checkAppointments().catch(console.error);
