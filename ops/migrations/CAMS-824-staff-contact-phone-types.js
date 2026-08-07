/**
 * CAMS-824: Migrate staff contact phone field to typed phones array
 *
 * Transforms trustee staff/assistant contact from a single `phone` object to a `phones`
 * array where each entry carries an explicit type. Pre-existing phone numbers are migrated
 * as type 'direct' (the most defensible default for a legacy contact number), matching
 * CAMS-824-internal-contact-phone-types.js's convention for trustee internal contact.
 *
 * Idempotent: only processes TRUSTEE_STAFF documents where `contact.phone` exists and
 * `contact.phones` does not. Documents already migrated are skipped on re-run.
 *
 * AUDIT_STAFF snapshot documents are NOT touched — they are immutable history.
 *
 * Usage: `load()` is not available in MongoDB Compass's embedded shell
 * (it returns a [COMMON-90002] error). Open this file, copy its contents,
 * and paste them directly into an interactive mongosh-compatible shell
 * (e.g. Compass's shell) connected to the target database.
 */

(function () {
  const collection = db.getCollection('trustees');

  const matching = collection.countDocuments({
    documentType: 'TRUSTEE_STAFF',
    'contact.phone': { $exists: true },
    'contact.phones': { $exists: false },
  });

  print(`Found ${matching} TRUSTEE_STAFF document(s) to migrate.`);

  if (matching === 0) {
    print('Nothing to do.');
    return;
  }

  const cursor = collection.find({
    documentType: 'TRUSTEE_STAFF',
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

    collection.updateOne(
      { _id: doc._id },
      {
        $set: { 'contact.phones': typedPhones },
        $unset: { 'contact.phone': '' },
      },
    );

    updated++;
  });

  print(`Updated ${updated} document(s).`);
  print('Migration complete.');
})();
