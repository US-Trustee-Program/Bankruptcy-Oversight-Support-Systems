/**
 * Read-only report: find bank names in the `banks` collection that collide
 * under case-insensitive, trimmed uniqueness (the rule enforced by
 * `BanksUseCase`, see backend/lib/use-cases/banks/banks.ts).
 *
 * Because that rule is enforced in the use case rather than by a database
 * constraint, any duplicates that existed before enforcement was added
 * remain in the collection. This script reports them; it does not modify
 * any data.
 *
 * Usage: `load()` is not available in MongoDB Compass's embedded shell
 * (it returns a [COMMON-90002] error). Open this file, copy its contents,
 * and paste them directly into an interactive mongosh-compatible shell
 * (e.g. Compass's shell) connected to the target database.
 */

(function () {
  const collection = db.getCollection('banks');

  const duplicateGroups = collection
    .aggregate([
      { $match: { documentType: 'BANK_PROFILE' } },
      {
        $group: {
          _id: { $toLower: { $trim: { input: '$name' } } },
          count: { $sum: 1 },
          ids: { $push: '$id' },
          names: { $push: '$name' },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } },
    ])
    .toArray();

  if (duplicateGroups.length === 0) {
    print('No duplicate bank names found.');
    return;
  }

  print(`Found ${duplicateGroups.length} duplicate bank name group(s):\n`);
  duplicateGroups.forEach((group) => {
    print(`  "${group._id}" (${group.count} banks)`);
    for (let i = 0; i < group.ids.length; i++) {
      print(`    - id=${group.ids[i]} name="${group.names[i]}"`);
    }
  });
  print('\nResolve each group manually (rename or inactivate the redundant entries).');
})();
