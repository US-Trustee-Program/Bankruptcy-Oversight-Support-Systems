# ops

Contents here contains supporting operational scripts and tools outside the scope of the application code.

## /cloud-deployment

Bicep files to provision resources in the Azure cloud environment with support for both commercial and US gov regions. The bicep files are broken down to deploy a subset of what is needed by USTP Case Management System (CAMS). Use the **main bicep**, _ustp-cams.bicep_, to provision complete Azure resources.

Note the following assumptions:
- Account used to execute bicep code has the necessary permission to provision all resources.
- Resource Group is already provisioned in the target Azure subscription.

## /cloud-deployment/params

_ustp-cams.parameters.json.sample_ provides all parameter values that can be set when deploying with the main bicep. Note that because the main bicep has some defaults, not all parameters are required to be defined in the json file.

## /dataloader

Database tool to import data from csv.

## /helper-scripts

Shell scripts to execute instructions and Azure CLI commands to help automate deployment of application code. Also include adhoc scripts to assist operational and development tasks.
