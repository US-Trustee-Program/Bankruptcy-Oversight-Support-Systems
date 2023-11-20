## Scripts

### pipeline

Shared scripts that execute in CI/CD pipeline on both the Flexion and USTP environment.

### utility

Adhoc helper scripts

#### az-sql-import-data.sh

The following are dependencies needed for running this script.

##### bcp

The bulk copy program utility (bcp) is used to import/export data from SQL Server tables. This project leverage bcp to import data into an existing table from a comma/pipe delimited file for test.

##### Installation

OS X installion requires homebrew

```
# brew untap microsoft/mssql-preview if you installed the preview version
brew tap microsoft/mssql-release https://github.com/Microsoft/homebrew-mssql-release
brew update
brew install mssql-tools18
```

See [here](https://learn.microsoft.com/en-us/sql/tools/bcp-utility) for additional documentation.
