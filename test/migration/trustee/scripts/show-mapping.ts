/**
 * Show data mapping from ATS to CAMS trustee collection
 *
 * Fetches one trustee from ATS, runs it through the current cleansing pipeline,
 * and prints the source data alongside the transformed CAMS output so the
 * mapping can be visually confirmed.
 *
 * Usage (from repo root):
 *   npx tsx --tsconfig backend/tsconfig.json test/migration/trustee/scripts/show-mapping.ts
 */

import * as dotenv from 'dotenv';
import { InvocationContext } from '@azure/functions';
import ApplicationContextCreator from '../../../../backend/function-apps/azure/application-context-creator';
import factory from '../../../../backend/lib/factory';
import { transformTrusteeRecord } from '../../../../backend/lib/adapters/gateways/ats/cleansing/ats-mappings';

dotenv.config({ path: 'backend/.env' });

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

  // Fetch one trustee from ATS
  const trustees = await gateway.getTrusteesPage(context, null, 1);

  if (trustees.length === 0) {
    console.log('No trustees found in ATS');
    return;
  }

  const atsTrustee = trustees[0];

  console.log('\n1️⃣  SOURCE DATA FROM ATS TRUSTEES TABLE:');
  console.log('─'.repeat(60));
  console.log(JSON.stringify(atsTrustee, null, 2));

  // Run through the current cleansing pipeline
  const { cleanAppointments, failedAppointments, stats } =
    await gateway.getTrusteeAppointments(context, atsTrustee.ID);

  console.log('\n2️⃣  CHAPTER_DETAILS → CLEANSED APPOINTMENTS:');
  console.log('─'.repeat(60));
  console.log(`  Total raw rows : ${stats.total}`);
  console.log(`  Clean          : ${stats.clean}`);
  console.log(`  Auto-recovered : ${stats.autoRecoverable}`);
  console.log(`  Problematic    : ${stats.problematic}`);
  console.log(`  Uncleansable   : ${stats.uncleansable}`);
  console.log(`  Skipped        : ${stats.skipped}`);

  if (cleanAppointments.length > 0) {
    console.log(`\n  First clean appointment:`);
    console.log(JSON.stringify(cleanAppointments[0], null, 2));

    // Flag any archived appointments the CAMS-772 fix would override
    const archived = cleanAppointments.filter((a) => a.status === 'inactive' && (
      a.appointmentType === 'case-by-case' ||
      a.appointmentType === 'elected' ||
      a.appointmentType === 'converted-case'
    ));
    if (archived.length > 0) {
      console.log(`\n  ℹ️  CAMS-772: ${archived.length} appointment(s) set to inactive via ARCHIVE_DATE:`);
      for (const a of archived) {
        console.log(`    ${a.appointmentType} / ${a.courtId} — effectiveDate=${a.effectiveDate}`);
      }
    }
  }

  if (failedAppointments.length > 0) {
    console.log(`\n  First failed appointment (${failedAppointments[0].classification}):`);
    console.log(JSON.stringify(failedAppointments[0].atsAppointment, null, 2));
  }

  // Transform trustee record
  const trusteeInput = transformTrusteeRecord(atsTrustee);

  console.log('\n3️⃣  TRANSFORMED TRUSTEE (before saving to MongoDB):');
  console.log('─'.repeat(60));
  console.log(JSON.stringify(trusteeInput, null, 2));

  console.log('\n4️⃣  TRANSFORMED APPOINTMENTS (clean output → MongoDB):');
  console.log('─'.repeat(60));
  if (cleanAppointments.length > 0) {
    console.log(JSON.stringify(cleanAppointments[0], null, 2));
  } else {
    console.log('  (no clean appointments)');
  }

  console.log('\n' + '='.repeat(80));
  console.log(' FIELD MAPPING SUMMARY');
  console.log('='.repeat(80));
  console.log(`
ATS TRUSTEES Table → MongoDB trustees Collection:
  ID               → legacy.truId (stored as string)
  FIRST_NAME       → firstName, concatenated into name
  MIDDLE           → middleName, concatenated into name
  LAST_NAME        → lastName, concatenated into name
  COMPANY          → public.companyName
  DISP_ON_WEB      → controls which address set (primary vs A2) becomes public

  Public Address (DISP_ON_WEB_A2='y' uses A2 fields; otherwise uses primary):
  STREET / STREET_A2   → public.address.address1
  STREET1 / STREET1_A2 → public.address.address2
  CITY / CITY_A2       → public.address.city
  STATE / STATE_A2     → public.address.state
  ZIP + ZIP_PLUS       → public.address.zipCode (formatted as ZIP-PLUS4)

  Contact Info:
  TELEPHONE        → public.phone.number & internal.phone.number (formatted)
  EMAIL_ADDRESS    → public.email & internal.email

ATS CHAPTER_DETAILS Table → MongoDB trustee-appointments Collection:
  TRU_ID           → links to trustee via trusteeId
  DISTRICT         → courtId (via DISTRICT_TO_COURT_MAP)
  SERVING_STATE    → used for multi-district state expansion
  CHAPTER          → chapter (normalized: '7', '11', '12', '13')
  STATUS           → appointmentType + status (via TOD_STATUS_MAP)
  APPOINTED_DATE   → appointedDate
  STATUS_EFF_DATE  → effectiveDate
  ARCHIVE_DATE     → CAMS-772: when non-null for case-by-case/elected/converted-case,
                     overrides status → 'inactive', effectiveDate → ARCHIVE_DATE

Special Chapter Codes:
  12CBC → chapter: '12', appointmentType: 'case-by-case'
  13CBC → chapter: '13', appointmentType: 'case-by-case'
  11 + STATUS=V/VR → chapter: '11-subchapter-v'
`);
}

showMapping().catch(console.error);
