# test-data

## Generate SQL

```sh
npm run test-data
```

SQL statements are written to `data/test-data.sql`.

## Fixtures

Fixtures are declarations of test data. Fixtures declare records to be inserted into the database.

Scripts that generate fixtures are found in the `test-data/fixtures` directory.

Fixtures use the domain model to declare the test data to be generated.

### Adding a Fixture

1. Use descriptive source file and function names to describe the feature or problem domain the fixtures are built to represent.
1. Create a new `.ts` script in the `test-data/fixtures` directory.
1. Export a function that builds one or more fixtures.
1. Multiple functions can be defined in a given source file.
1. Functions must return a `DatabaseRecords` object. The function prototype is `(): DatabaseRecords`;
1. Import the function into the `test-data/index.ts` file. Add it to the `fixturesToCreate` array.

## Domain Models

See existing scripts in the `test-data/domain` directory for examples.

The domain model consists of TypeScript interfaces that guide the definition of object literals used to describe a fixture.

The domain model is responsible for mapping the domain to the underlying records in the database.

## Tables

See existing scripts in the `test-data/tables` directory for examples.

Supported tables are modeled in TypeScript and are used by code generation to generate SQL
from the domain model.
