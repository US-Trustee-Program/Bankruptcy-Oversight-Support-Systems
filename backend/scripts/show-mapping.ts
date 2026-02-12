#!/usr/bin/env tsx
/**
 * Show data mapping from ATS to CAMS trustee collection
 */

import * as dotenv from 'dotenv';
import { InvocationContext } from '@azure/functions';
import ApplicationContextCreator from '../function-apps/azure/application-context-creator';
import factory from '../lib/factory';
import {
  transformTrusteeRecord,
  transformAppointmentRecord,
} from '../lib/adapters/gateways/ats/ats-mappings';
import { AtsTrusteeRecord, AtsAppointmentRecord } from '../lib/adapters/types/ats.types';

dotenv.config({ path: '.env' });

async function showMapping() {
  const invocationContext = new InvocationContext();
  const context = await ApplicationContextCreator.getApplicationContext({
    invocationContext,
    logger: ApplicationContextCreator.getLogger(invocationContext),
  });

  const gateway = factory.getAtsGateway(context);

  console.log('='.repeat(80));
  console.log(' DATA MAPPING: ATS → CAMS Trustee Collection');
  console.log('='.repeat(80));

  // Get a sample trustee from ATS
  const trustees = await gateway.getTrusteesPage(context, null, 1);

  if (trustees.length === 0) {
    console.log('No trustees found in ATS');
    return;
  }

  const atsTrustee = trustees[0];

  console.log('\n1️⃣  SOURCE DATA FROM ATS TRUSTEES TABLE:');
  console.log('─'.repeat(60));
  console.log(JSON.stringify(atsTrustee, null, 2));

  // Get appointments for this trustee
  const atsAppointments = await gateway.getTrusteeAppointments(context, atsTrustee.ID);

  console.log('\n2️⃣  SOURCE DATA FROM ATS CHAPTER_DETAILS TABLE:');
  console.log('─'.repeat(60));
  if (atsAppointments.length > 0) {
    console.log(`Found ${atsAppointments.length} appointment(s) for trustee ${atsTrustee.ID}`);
    console.log('\nFirst appointment:');
    console.log(JSON.stringify(atsAppointments[0], null, 2));
  } else {
    console.log('No appointments found for this trustee');
  }

  // Transform the trustee record
  const trusteeInput = transformTrusteeRecord(atsTrustee);

  console.log('\n3️⃣  TRANSFORMED TRUSTEE (before saving to MongoDB):');
  console.log('─'.repeat(60));
  console.log(JSON.stringify(trusteeInput, null, 2));

  // Transform appointments
  const transformedAppointments = [];
  for (const atsAppt of atsAppointments) {
    try {
      const transformed = transformAppointmentRecord(atsAppt);
      transformedAppointments.push(transformed);
    } catch (error) {
      console.log(`Warning: Could not transform appointment: ${error.message}`);
    }
  }

  if (transformedAppointments.length > 0) {
    console.log('\n4️⃣  TRANSFORMED APPOINTMENTS:');
    console.log('─'.repeat(60));
    console.log(JSON.stringify(transformedAppointments[0], null, 2));
  }

  // Show what the final MongoDB document would look like
  console.log('\n5️⃣  FINAL MONGODB TRUSTEE DOCUMENT:');
  console.log('─'.repeat(60));

  // This is a simulation of what would be saved
  const mongoDocument: any = {
    _id: 'trustee-' + Math.random().toString(36).substring(7), // MongoDB would generate this
    trusteeId: 'trustee-' + Math.random().toString(36).substring(7), // CAMS would generate this
    name: trusteeInput.name,
    public: trusteeInput.public,
    legacy: trusteeInput.legacy,
    createdBy: {
      id: 'SYSTEM',
      name: 'ATS Migration',
    },
    createdOn: new Date().toISOString(),
    updatedBy: {
      id: 'SYSTEM',
      name: 'ATS Migration',
    },
    updatedOn: new Date().toISOString(),
  };

  // Add internal contact if present
  if (trusteeInput.internal) {
    mongoDocument.internal = trusteeInput.internal;
  }

  console.log(JSON.stringify(mongoDocument, null, 2));

  if (transformedAppointments.length > 0) {
    console.log('\n6️⃣  MONGODB TRUSTEE_APPOINTMENT DOCUMENT:');
    console.log('─'.repeat(60));

    const appointmentDoc = {
      _id: 'appointment-' + Math.random().toString(36).substring(7),
      appointmentId: 'appointment-' + Math.random().toString(36).substring(7),
      trusteeId: mongoDocument.trusteeId,
      ...transformedAppointments[0],
      createdBy: {
        id: 'SYSTEM',
        name: 'ATS Migration',
      },
      createdOn: new Date().toISOString(),
      updatedBy: {
        id: 'SYSTEM',
        name: 'ATS Migration',
      },
      updatedOn: new Date().toISOString(),
    };

    console.log(JSON.stringify(appointmentDoc, null, 2));
  }

  console.log('\n' + '='.repeat(80));
  console.log(' FIELD MAPPING SUMMARY');
  console.log('='.repeat(80));
  console.log(`
ATS TRUSTEES Table → MongoDB trustees Collection:
  ID               → legacy.truId (stored as string)
  FIRST_NAME       → Concatenated into 'name' field
  MIDDLE           → Concatenated into 'name' field
  LAST_NAME        → Concatenated into 'name' field
  COMPANY          → public.companyName

  Public Address:
  STREET           → public.address.address1
  STREET1          → public.address.address2
  CITY             → public.address.city
  STATE            → public.address.state
  ZIP + ZIP_PLUS   → public.address.zipCode (formatted as ZIP-PLUS4)

  Internal Address (if present):
  STREET_A2        → internal.address.address1
  STREET1_A2       → internal.address.address2
  CITY_A2          → internal.address.city
  STATE_A2         → internal.address.state
  ZIP_A2 + ZIP_PLUS_A2 → internal.address.zipCode (formatted as ZIP-PLUS4)

  Contact Info:
  TELEPHONE        → public.phone.number & internal.phone.number (formatted)
  EMAIL_ADDRESS    → public.email & internal.email

ATS CHAPTER_DETAILS Table → MongoDB trustee_appointments Collection:
  TRU_ID           → Links to trustee via trusteeId
  DISTRICT         → Maps to courtId via lookup
  DIVISION         → divisionCode
  CHAPTER          → chapter (normalized, e.g., '7', '11', '12', '13')
  STATUS           → Maps to appointmentType (e.g., 'PA' → 'panel', '1' → 'trustee')
  APPOINTED_DATE   → appointedDate
  STATUS_EFF_DATE  → effectiveDate

Special Chapter Mappings:
  '7CBC'  → chapter: '7',  appointmentType: 'caseByCase'
  '12CBC' → chapter: '12', appointmentType: 'caseByCase'
  '13CBC' → chapter: '13', appointmentType: 'caseByCase'
  `);
}

showMapping().catch(console.error);
