#!/usr/bin/env tsx
import * as dotenv from 'dotenv';
import * as path from 'path';
import { MongoClient } from 'mongodb';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '.env') });

const uri = process.env.ATLAS_CONNECTION_STRING;

if (!uri) {
  console.error('❌ Error: ATLAS_CONNECTION_STRING environment variable is not set');
  console.error('Please create a .env file in test/vector-search/ with your Atlas credentials');
  console.error('See .env.example for the required format');
  process.exit(1);
}

async function main() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✓ Connected to Atlas');

    const db = client.db('cams-vector-test');
    const collection = db.collection('cases');

    const count = await collection.countDocuments({ documentType: 'SYNCED_CASE' });
    console.log(`Total cases: ${count}`);

    const johnSmith = await collection.findOne({ 'debtor.name': 'John Smith' });
    console.log(`Found John Smith: ${johnSmith ? 'YES' : 'NO'}`);
    if (johnSmith) {
      console.log(`  Case ID: ${johnSmith.caseId}`);
      console.log(`  Has vector: ${johnSmith.keywordsVector ? 'YES (' + johnSmith.keywordsVector.length + ' dims)' : 'NO'}`);
    }

    await client.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
