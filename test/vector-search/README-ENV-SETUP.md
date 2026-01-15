# Vector Search Test Environment Setup

This directory contains scripts for testing vector search functionality with MongoDB Atlas and PostgreSQL. These scripts require credentials that **must not** be committed to the repository.

## Quick Setup

1. **Copy the example environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` with your actual credentials:**
   ```bash
   # Use your preferred editor
   nano .env
   # or
   vim .env
   ```

3. **Fill in the required credentials:**
   - MongoDB Atlas connection string (username, password, cluster)
   - PostgreSQL password for local testing

4. **Verify `.env` is gitignored:**
   ```bash
   git status  # Should NOT show .env file
   ```

## Required Credentials

### MongoDB Atlas
- **ATLAS_CONNECTION_STRING**: Full MongoDB Atlas connection URI
  - Format: `mongodb+srv://username:password@cluster.mongodb.net/?appName=APP_NAME`  <!-- pragma: allowlist secret -->
  - Obtain from: MongoDB Atlas Dashboard → Database → Connect
- **ATLAS_DATABASE_NAME**: Database name (default: `cams-vector-test`)

### PostgreSQL
- **POSTGRES_PASSWORD**: Password for local PostgreSQL instance
  - Default user: `postgres`
  - Default database: `cams-local`
  - Default host: `localhost:5432`

## Scripts Using Environment Variables

All these scripts now load credentials from `.env`:

| Script | Purpose | Required Env Vars |
|--------|---------|-------------------|
| `seed-mongodb-atlas.ts` | Seed Atlas with test data | `ATLAS_CONNECTION_STRING` |
| `check-atlas-data.ts` | Verify Atlas data | `ATLAS_CONNECTION_STRING` |
| `test-mongodb-atlas-repository.ts` | Test Atlas repository | `ATLAS_CONNECTION_STRING` |
| `seed-postgresql-with-mockdata.ts` | Seed PostgreSQL with test data | `POSTGRES_PASSWORD` |
| `test-postgresql-repository.ts` | Test PostgreSQL repository | `POSTGRES_PASSWORD` |

## Security Notes

⚠️ **IMPORTANT**:
- Never commit `.env` to version control
- Never share your `.env` file
- Never commit hardcoded credentials
- Keep credentials in `.env` file only
- `.env` is automatically gitignored

## Troubleshooting

### Error: "ATLAS_CONNECTION_STRING environment variable is not set"
**Solution:** Create `.env` file from `.env.example` and fill in your Atlas credentials.

### Error: "POSTGRES_PASSWORD environment variable is not set"
**Solution:** Add `POSTGRES_PASSWORD=your-password` to your `.env` file.

### Scripts can't find `.env` file
**Solution:** Ensure `.env` is in the `test/vector-search/` directory, not the project root.

### Git is trying to commit my `.env` file
**Solution:** The file should already be gitignored. Run:
```bash
git rm --cached test/vector-search/.env
echo "test/vector-search/.env" >> .gitignore
```

## Example Usage

```bash
# 1. Set up environment
cd test/vector-search
cp .env.example .env
# Edit .env with your credentials

# 2. Seed MongoDB Atlas
npx tsx seed-mongodb-atlas.ts

# 3. Verify seeding
npx tsx check-atlas-data.ts

# 4. Test Atlas vector search
npx tsx test-mongodb-atlas-repository.ts

# 5. Seed PostgreSQL
npx tsx seed-postgresql-with-mockdata.ts

# 6. Test PostgreSQL vector search
npx tsx test-postgresql-repository.ts
```

## Adding New Secrets

If you need to add new secrets to the scripts:

1. Add the variable to `.env.example` with placeholder value
2. Document it in this README
3. Update the script to load from `process.env.YOUR_VAR_NAME`
4. Add validation to ensure the variable is set
5. Update your personal `.env` file with the real value

## Further Reading

- See `.env.example` for all available configuration options
- See individual script files for specific usage instructions
