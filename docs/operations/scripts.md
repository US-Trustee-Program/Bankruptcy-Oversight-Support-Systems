# Scripts

## pipeline

Shared scripts that execute in CI/CD pipeline on both the Flexion and USTP environment.

## utility

Adhoc helper scripts

### az-cosmos-add-user.sh

To simplify Cosmosdb administration, this script assigns a role to a principal for a target Cosmos Db account.

### az-delete-branch-resources.sh

Clean up Azure resources provisioned for a development branch deployment by hash id.

### az-sql-import-data.sh

Shell script will prepare the data file and execute bcp to upload data to a SQL server database. The script will target a directory folder with collection of csv to load data from. The data filename should be the same as the corresponding db table name. Also, ensure that a file secret with the user password has been set.

The below are dependencies needed for running this script.

#### bcp

The bulk copy program utility (bcp) is used to import/export data from SQL Server tables. This project leverage bcp to import data into an existing table from a comma/pipe delimited file for test.

#### Installation

OS X installion requires homebrew

```
# brew untap microsoft/mssql-preview if you installed the preview version
brew tap microsoft/mssql-release https://github.com/Microsoft/homebrew-mssql-release
brew update
brew install mssql-tools18
```

See [here](https://learn.microsoft.com/en-us/sql/tools/bcp-utility) for additional documentation.

### fix-import-data.sql

Fix known anonymized data set issues. This may be required after loading SQL server database from a data file.
