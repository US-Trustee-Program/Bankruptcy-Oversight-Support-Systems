// CAMS trustees data-pattern profile for the trustee data report harness fixtures.
//
// Run read-only in mongosh against the environment's CAMS database:
//   mongosh "<connection string>" --quiet --file cams-trustees-patterns.js
// Every result is a count; no trustee names or contact details are printed.

const trustees = db.trustees;
const TRUSTEE = { documentType: 'TRUSTEE' };
const count = (filter) => trustees.countDocuments({ ...TRUSTEE, ...filter });
const blank = { $in: [null, ''] };

printjson({
  // Totals and TOD links (S18, S29-S31)
  trustees: count({}),
  noTruIds: count({
    $or: [{ 'legacy.truIds': { $exists: false } }, { 'legacy.truIds': { $size: 0 } }],
  }),
  oneTruId: count({ 'legacy.truIds': { $size: 1 } }),
  severalTruIds: count({ 'legacy.truIds.1': { $exists: true } }),
  nonNumericTruId: count({ 'legacy.truIds': { $elemMatch: { $not: /^[0-9]+$/ } } }),

  // Names (S07, S08)
  nameUnknown: count({ name: 'Unknown' }),
  hasMiddleName: count({ middleName: { $nin: [null, ''] } }),
  nameAllCaps: count({ $expr: { $eq: ['$name', { $toUpper: '$name' }] } }),

  // Contact details (S03, S05, S09, S10, S13)
  phoneExtension: count({ 'public.phone.extension': { $nin: [null, ''] } }),
  phoneNotDashed: count({
    'public.phone.number': { $exists: true, $not: /^[0-9]{3}-[0-9]{3}-[0-9]{4}$/ },
  }),
  noPhone: count({ 'public.phone.number': blank }),
  noEmail: count({ 'public.email': blank }),
  emailHasUpper: count({ 'public.email': /[A-Z]/ }),
  companyName: count({ 'public.companyName': { $nin: [null, ''] } }),
  publicAddress2: count({ 'public.address.address2': { $nin: [null, ''] } }),
  publicZipPlus4: count({ 'public.address.zipCode': /^[0-9]{5}-[0-9]{4}$/ }),
  publicZipOther: count({
    'public.address.zipCode': { $exists: true, $not: /^[0-9]{5}(-[0-9]{4})?$/ },
  }),
  internalAddress: count({ 'internal.address': { $exists: true, $ne: null } }),
  internalPhoneOrEmail: count({
    $or: [
      { 'internal.phone.number': { $nin: [null, ''] } },
      { 'internal.email': { $nin: [null, ''] } },
    ],
  }),
});
