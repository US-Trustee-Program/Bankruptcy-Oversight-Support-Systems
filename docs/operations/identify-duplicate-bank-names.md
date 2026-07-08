# Identify Duplicate Bank Names

Bank-name uniqueness (case-insensitive, trimmed) is enforced in `BanksUseCase`
(`backend/lib/use-cases/banks/banks.ts`) for both create and rename. Because the check is applied in
the use case rather than by a database constraint, any duplicates that already existed before
enforcement was added remain in the `banks` collection and should be identified and resolved
manually.

Run the following aggregation against the CosmosDB (Mongo API) `banks` collection to report any
case-insensitive, trimmed duplicate names:

```javascript
db.banks.aggregate([
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
]);
```

Each returned document represents a group of banks that collide under the uniqueness rule. Resolve
each group manually (rename or inactivate the redundant entries) so the data is consistent with the
enforced constraint. Running the query and finding no results confirms there are no pre-existing
duplicates to resolve.
