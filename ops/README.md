# ops

Contents here contains supporting operational scripts and tools outside the scope of the application code.

## /bicep

Bicep files to provision resources in the Azure cloud environment with support for both commerial and US gov regions. The bicep files are broken down to deploy a subset of what is needed by USTP Case Management System (CAMS). Use the main bicep, _ustp-cams.bicep_, to provision complete Azure resources.

Note the following assumptions:
- Account used to execute bicep code has the necessary permission to provision resources.
- Resource Group already provision in Azure subscription.

## /dataloader

Database tool to import data from csv.

## /script

Shell scripts to execute instructions and Azure CLI commands to help automate deployment of application code. Also include adhoc scripts to assist operational and development tasks.
