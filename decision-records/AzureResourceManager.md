# Azure Resource Manager

## Context

The use of Infrastructure-as-Code (IaC) to manage deployments is required by USTP. Several options exist. Flexion experience is generally focused on the use of Terraform, but the requirement to deploy to an Azure environment precipitates questions about whether we need to use a cloud-agnostic language like Terraform, or whether something Azure-specific would be better.

The Azure provider for Terraform seems to be disliked by many and since Azure is stipulated as the cloud platform, the cloud-agnostic nature of Terraform is unlikely to be needed.

Azure provides [Azure Resource Manager](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/overview) as an Azure-specific option. It is usable with JSON files known as [ARM Templates](https://learn.microsoft.com/en-us/azure/azure-resource-manager/templates/overview) or a Domain-Specific Language named [Bicep](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/overview?tabs=bicep). There is also a GitHub Action named [azure/arm-deploy](https://github.com/Azure/arm-deploy) available for use with both ARM Templates and Bicep files.

## Decision

We will utilize Azure Resource Manager with Bicep files. Bicep files offer several benefits over ARM Templates, the most important of which is the concise nature of the DSL over the use of JSON.

## Status

Proposed

## Consequences
