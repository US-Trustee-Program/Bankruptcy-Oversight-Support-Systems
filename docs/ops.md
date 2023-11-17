# ops

Contents here contains supporting operational scripts and tools outside the scope of the application code.

## /cloud-deployment

Bicep files to provision resources in the Azure cloud environment with support for both commercial and US gov regions. The bicep files are broken down to deploy a subset of what is needed by USTP Case Management System (CAMS). Use the **main bicep**, _main.bicep_, to provision complete Azure resources.

Note the following assumptions:

- Account used to execute bicep code has the necessary permission to provision all resources.
- Prior to running the _ustp-cams.bicep_ file, the _ustp-cams-kv-app-config-setup.bicep_ file must be run first with the **deployNetworkConfig** param set to false
- After running the _ustp-cams.bicep_ file, the _ustp-cams-kv-app-config-setup.bicep_ file must be run first with the **deployNetworkConfig** param set to **true**

### /cloud-deployment/lib

Contains reusable templates for provisioning Azure resources used as modules in other bicep files.

### /cloud-deployment/params

_ustp-cams.parameters.json.sample_ provides all parameter values that can be set when deploying with the main bicep. Note that because the main bicep has some defaults, not all parameters are required to be defined in the json file.

## /dataloader

Database tool to import data from csv.

## /scripts

Shell scripts to execute instructions and Azure CLI commands to help automate deployment of application code. Also include adhoc scripts to assist operational and development tasks.

### /scripts/pipeline

Shell scripts executed in the CI/CD pipeline.

### /scripts/utility

Contain standalone helper scripts executed on local dev machines.

## /git-setup

Execute set-up-git-hooks.sh from root of repository to configure pre-commit hooks and leverage a commit template.

# Tools

The following are dependencies needed for local development and execution.

## bcp

The bulk copy program utility (bcp) is used to import/export data from SQL Server tables. This project leverage bcp to import data into an existing table from a comma/pipe delimited file for test.

### Installation

OS X installion requires homebrew

```
# brew untap microsoft/mssql-preview if you installed the preview version
brew tap microsoft/mssql-release https://github.com/Microsoft/homebrew-mssql-release
brew update
brew install mssql-tools18
```

See [here](https://learn.microsoft.com/en-us/sql/tools/bcp-utility) for additional documentation.
