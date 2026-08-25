@description('Name of the Log Analytics workspace to grant read/query access to. The caller must scope this module to the resource group containing the workspace.')
param workspaceName string

@description('Principal ID of the managed identity or service principal to grant access.')
param principalId string

// Log Analytics Reader. Grants both workspace-metadata read and query-data access via its
// */read control-plane action -- sufficient for LogsQueryClient.queryWorkspace(). This would
// stop being sufficient if the target workspace ever enables protected tables or
// DataActionsOnly mode, since those require an explicit DataActions-based role
// (e.g. Log Analytics Data Reader) instead of a */read-based control-plane role.
var logAnalyticsReaderRoleId = '73c42c96-874c-492b-b04d-ab87d138a893'

resource workspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' existing = {
  name: workspaceName
}

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(logAnalyticsReaderRoleId, principalId, workspace.id)
  scope: workspace
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      logAnalyticsReaderRoleId
    )
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}
