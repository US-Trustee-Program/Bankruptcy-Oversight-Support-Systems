# Identify Duplicate Bank Names

Bank-name uniqueness (case-insensitive, trimmed) is enforced in `BanksUseCase`
(`backend/lib/use-cases/banks/banks.ts`) for both create and rename. Because the check is applied in
the use case rather than by a database constraint, any duplicates that already existed before
enforcement was added remain in the `banks` collection and should be identified and resolved
manually.

Run the following script (from repo root) to report any case-insensitive, trimmed duplicate names in
the `banks` collection:

```shell
npx tsx --tsconfig backend/tsconfig.json ops/migrations/CAMS-796-identify-duplicate-bank-names.ts
```

The script is read-only — it does not modify any data. It connects using `MONGO_CONNECTION_STRING`
and `COSMOS_DATABASE_NAME` (loaded from `backend/.env` by default) and prints each group of banks
that collide under the uniqueness rule, along with their ids and original names. It exits with
status `1` if any duplicate groups are found, or `0` if there are none, so it can also be used as a
gate in CI/ops tooling.

Resolve each reported group manually (rename or inactivate the redundant entries) so the data is
consistent with the enforced constraint.
