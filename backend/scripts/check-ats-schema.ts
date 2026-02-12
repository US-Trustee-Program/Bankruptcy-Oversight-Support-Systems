#!/usr/bin/env tsx
/**
 * Check ATS database schema
 */

import * as dotenv from 'dotenv';
import { InvocationContext } from '@azure/functions';
import ApplicationContextCreator from '../function-apps/azure/application-context-creator';
import factory from '../lib/factory';
import { AbstractMssqlClient } from '../lib/adapters/gateways/abstract-mssql-client';

// Load environment variables
dotenv.config({ path: '.env' });

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

    // Access the executeQuery method through the gateway
    const result = await (gateway as any).executeQuery(context, query, []);

    console.log('TRUSTEES table columns:');
    console.log('========================');

    for (const col of result.results) {
      const maxLen = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : '';
      const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
      console.log(`  ${col.COLUMN_NAME.padEnd(30)} ${col.DATA_TYPE}${maxLen} ${nullable}`);
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

    const appointmentsResult = await (gateway as any).executeQuery(context, appointmentsQuery, []);

    if (appointmentsResult.results.length > 0) {
      console.log('\nCHAPTER_DETAILS table columns:');
      console.log('================================');

      for (const col of appointmentsResult.results) {
        const maxLen = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : '';
        const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
        console.log(`  ${col.COLUMN_NAME.padEnd(30)} ${col.DATA_TYPE}${maxLen} ${nullable}`);
      }
    }

    // Get a sample row to see actual data
    console.log('\n\nSample TRUSTEES row:');
    console.log('=====================');
    const sampleQuery = `SELECT TOP 1 * FROM TRUSTEES`;
    const sampleResult = await (gateway as any).executeQuery(context, sampleQuery, []);

    if (sampleResult.results.length > 0) {
      const sample = sampleResult.results[0];
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
