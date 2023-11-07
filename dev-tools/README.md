# test-data

## Generate SQL

```sh
npm run test-data
```

SQL statements are written to `data/test-data.json`.

## Fixtures

Fixtures are declarations of test data. Fixtures declare records to be inserted into the database.

Scripts that generate fixtures are found in the `test-data/fixtures` directory.

Fixtures use the domain model to declare the test data to be generated.

### Adding a Fixture

1. Use descriptive source file and function names to describe the feature or problem domain the
   fixtures are built to represent.
1. Create a new `.ts` script in the `test-data/fixtures` directory.
1. Export a function that builds one or more fixtures.
1. Multiple functions can be defined in a given source file.
1. Functions must return a `DatabaseRecords` object. The function prototype is
   `(): DatabaseRecords`;
1. Import the function into the `test-data/scripts/index.ts` file. Add it to the `fixturesToCreate`
   array.

## Scripts

The Scripts folder contains stand-alone scripts that generate sql output.

### Case Parties

The caseParties.ts script generates SQL statements for inserting case parties, such as debtors into
the AO_PY table.

caseParties.ts takes input from a file piped into it on stdin.
File format for input is in the form of CS Case Id and Court Id separated by comma, per line.

Example input file format:

```csv
12345,0208
23456,0208
34578,0210
```

To run the script:

```sh
ts-node test-data/scripts/caseParties.ts < input_file
```

### Update Case Party Addresses

The updateCasePartyAddresses.ts script generates SQL statements to update case party addresses in the AO_PY table.

updateCasePartyAddresses.ts takes input from a file piped into it on stdin.
File format for input is in the form of CS Case Id, Court Id and role separated by comma, per line.

Example input file format:

```csv
12345,0208,db
23456,0208,db
34578,0210,db
```

To run the script:

```sh
# Assumes the CSV input is in the `data` directory with file name `input_file.csv`.
cat data/input_file.csv | ts-node test-data/scripts/updateCasePartyAddresses.ts > data/update.sql
```

## Domain Models

See existing scripts in the `test-data/domain` directory for examples.

The domain model consists of TypeScript interfaces that guide the definition of object literals used
to describe a fixture.

The domain model is responsible for mapping the domain to the underlying records in the database.

## Tables

See existing scripts in the `test-data/tables` directory for examples.

Supported tables are modeled in TypeScript and are used by code generation to generate SQL from the
domain model.
