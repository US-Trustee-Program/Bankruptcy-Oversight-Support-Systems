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
 * Usage (mongosh):
 *   mongosh "<connection-string>" ops/migrations/CAMS-825-software-vendor-phone-types.js
 *
 * Or from an existing mongosh session already connected to the target database:
 *   load('ops/migrations/CAMS-825-software-vendor-phone-types.js')
 */

(function () {
  const collection = db.getCollection('bankruptcy-software');

  const cursor = collection.find({
    documentType: 'BANKRUPTCY_SOFTWARE',
    'contact.phone': { $exists: true },
    'contact.phones': { $exists: false },
  });

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
  });
})();
