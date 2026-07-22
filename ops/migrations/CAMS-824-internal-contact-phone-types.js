/**
 * CAMS-824: Migrate internal contact phone field to typed phones array
 *
 * Transforms trustee internal contact from a single `phone` object to a `phones` array
 * where each entry carries an explicit type. Pre-existing phone numbers are migrated as
 * type 'direct' (the most defensible default for an office/internal contact number).
 *
 * Idempotent: only processes TRUSTEE documents where `internal.phone` exists and
 * `internal.phones` does not. Documents already migrated are skipped on re-run.
 *
 * AUDIT_INTERNAL_CONTACT snapshot documents are NOT touched — they are immutable history.
 *
 * Usage (mongosh):
 *   mongosh "<connection-string>" ops/migrations/CAMS-824-internal-contact-phone-types.js
 *
 * Or from an existing mongosh session already connected to the target database:
 *   load('ops/migrations/CAMS-824-internal-contact-phone-types.js')
 */

(function () {
  const collection = db.getCollection('trustees');

  const matching = collection.countDocuments({
    documentType: 'TRUSTEE',
    'internal.phone': { $exists: true },
    'internal.phones': { $exists: false },
  });

  print(`Found ${matching} TRUSTEE document(s) to migrate.`);

  if (matching === 0) {
    print('Nothing to do.');
    return;
  }

  const cursor = collection.find({
    documentType: 'TRUSTEE',
    'internal.phone': { $exists: true },
    'internal.phones': { $exists: false },
  });

  let updated = 0;

  cursor.forEach(function (doc) {
    const phone = doc.internal && doc.internal.phone;
    const typedPhones = [];

    if (phone && phone.number) {
      const typedPhone = { number: phone.number, type: 'direct' };
      if (phone.extension) {
        typedPhone.extension = phone.extension;
      }
      typedPhones.push(typedPhone);
    }

    collection.updateOne(
      { _id: doc._id },
      {
        $set: { 'internal.phones': typedPhones },
        $unset: { 'internal.phone': '' },
      },
    );

    updated++;
  });

  print(`Updated ${updated} document(s).`);
  print('Migration complete.');
})();
