# Identify Duplicate Bank Names

Bank-name uniqueness (case-insensitive, trimmed) is enforced in `BanksUseCase`
(`backend/lib/use-cases/banks/banks.ts`) for both create and rename. Because the check is applied in
the use case rather than by a database constraint, any duplicates that already existed before
enforcement was added remain in the `banks` collection and should be identified and resolved
manually.

Run the following script (mongosh) to report any case-insensitive, trimmed duplicate names in the
`banks` collection:

```shell
mongosh "<connection-string>" ops/migrations/CAMS-796-identify-duplicate-bank-names.js
```

Or from an existing mongosh session already connected to the target database:

```shell
load('ops/migrations/CAMS-796-identify-duplicate-bank-names.js')
```

The script is read-only — it does not modify any data. It prints each group of banks that collide
under the uniqueness rule, along with their ids and original names.

Resolve each reported group manually (rename or inactivate the redundant entries) so the data is
consistent with the enforced constraint.
