#!/usr/bin/env tsx
/**
 * Check ATS database schema
 */

import * as dotenv from 'dotenv';
import { InvocationContext } from '@azure/functions';
import ApplicationContextCreator from '../function-apps/azure/application-context-creator';
import factory from '../lib/factory';

// Load environment variables
dotenv.config({ path: '.env' });

type Row = Record<string, string | number | null>;

async function checkSchema() {
  console.log('Checking ATS database schema...\n');

  const invocationContext = new InvocationContext();
  const context = await ApplicationContextCreator.getApplicationContext({
    invocationContext,
    logger: ApplicationContextCreator.getLogger(invocationContext),
  });

  const gateway = factory.getAtsGateway(context);

  try {
    // Get column information for TRUSTEES table
    const query = `
      SELECT
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'TRUSTEES'
      ORDER BY ORDINAL_POSITION
    `;

    const result = await gateway.executeQuery(context, query, []);
    const rows = result.results as Row[];

    console.log('TRUSTEES table columns:');
    console.log('========================');

    for (const col of rows) {
      const maxLen = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : '';
      const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
      console.log(`  ${String(col.COLUMN_NAME).padEnd(30)} ${col.DATA_TYPE}${maxLen} ${nullable}`);
    }

    // Also check for CHAPTER_DETAILS table (appointments)
    const appointmentsQuery = `
      SELECT
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'CHAPTER_DETAILS'
      ORDER BY ORDINAL_POSITION
    `;

    const appointmentsResult = await gateway.executeQuery(context, appointmentsQuery, []);
    const appointmentRows = appointmentsResult.results as Row[];

    if (appointmentRows.length > 0) {
      console.log('\nCHAPTER_DETAILS table columns:');
      console.log('================================');

      for (const col of appointmentRows) {
        const maxLen = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : '';
        const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
        console.log(
          `  ${String(col.COLUMN_NAME).padEnd(30)} ${col.DATA_TYPE}${maxLen} ${nullable}`,
        );
      }
    }

    // Get a sample row to see actual data
    console.log('\n\nSample TRUSTEES row:');
    console.log('=====================');
    const sampleQuery = `SELECT TOP 1 * FROM TRUSTEES`;
    const sampleResult = await gateway.executeQuery(context, sampleQuery, []);
    const sampleRows = sampleResult.results as Row[];

    if (sampleRows.length > 0) {
      const sample = sampleRows[0];
      for (const [key, value] of Object.entries(sample)) {
        if (value !== null && value !== undefined) {
          console.log(`  ${key}: ${value}`);
        }
      }
    }
  } catch (error) {
    console.error('Error checking schema:', error);
  }
}

checkSchema().catch(console.error);
