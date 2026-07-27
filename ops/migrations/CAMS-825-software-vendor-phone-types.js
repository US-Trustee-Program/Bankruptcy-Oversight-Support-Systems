/**
 * CAMS-825: Migrate software vendor contact phone field to typed phones array
 *
 * Transforms BANKRUPTCY_SOFTWARE contact from a single `phone` object to a `phones`
 * array where each entry carries an explicit type. Pre-existing phone numbers are
 * migrated as type 'direct' (the most defensible default for a legacy contact number).
 *
 * Idempotent: only processes BANKRUPTCY_SOFTWARE documents where `contact.phone` exists
 * and `contact.phones` does not. Documents already migrated are skipped on re-run.
 *
 * AUDIT_BANKRUPTCY_SOFTWARE snapshot documents are NOT touched — they are immutable history.
 *
 * Dry run by default: reports what would change without writing anything. Set the CONFIRM
 * environment variable to 'true' to actually apply the changes.
 *
 * Usage (mongosh):
 *   mongosh "<connection-string>" ops/migrations/CAMS-825-software-vendor-phone-types.js
 *   CONFIRM=true mongosh "<connection-string>" ops/migrations/CAMS-825-software-vendor-phone-types.js
 *
 * Or from an existing mongosh session already connected to the target database:
 *   load('ops/migrations/CAMS-825-software-vendor-phone-types.js')
 *   process.env.CONFIRM = 'true'; load('ops/migrations/CAMS-825-software-vendor-phone-types.js')
 */

(function () {
  const DRY_RUN = process.env.CONFIRM !== 'true';
  const collection = db.getCollection('bankruptcy-software');

  const matching = collection.countDocuments({
    documentType: 'BANKRUPTCY_SOFTWARE',
    'contact.phone': { $exists: true },
    'contact.phones': { $exists: false },
  });

  print(`Found ${matching} BANKRUPTCY_SOFTWARE document(s) to migrate.`);

  if (matching === 0) {
    print('Nothing to do.');
    return;
  }

  if (DRY_RUN) {
    print("DRY RUN: no documents will be modified. Set CONFIRM='true' to apply changes.");
  }

  const cursor = collection.find({
    documentType: 'BANKRUPTCY_SOFTWARE',
    'contact.phone': { $exists: true },
    'contact.phones': { $exists: false },
  });

  let updated = 0;

  cursor.forEach(function (doc) {
    const phone = doc.contact && doc.contact.phone;
    const typedPhones = [];

    if (phone && phone.number) {
      const typedPhone = { number: phone.number, type: 'direct' };
      if (phone.extension) {
        typedPhone.extension = phone.extension;
      }
      typedPhones.push(typedPhone);
    }

    if (DRY_RUN) {
      print(`  Would update ${doc._id}: contact.phones = ${JSON.stringify(typedPhones)}`);
    } else {
      collection.updateOne(
        { _id: doc._id },
        {
          $set: { 'contact.phones': typedPhones },
          $unset: { 'contact.phone': '' },
        },
      );
    }

    updated++;
  });

  if (DRY_RUN) {
    print(`DRY RUN: ${updated} document(s) would be updated. Set CONFIRM='true' to apply.`);
  } else {
    print(`Updated ${updated} document(s).`);
    print('Migration complete.');
  }
})();
