// Shared naming formulas for resources that main.bicep and network.bicep both
// need to agree on: network.bicep creates the vnet/subnets, main.bicep only
// consumes them via `existing` references (CAMS-760, Option E — the two were
// split so the network tier could become its own Deployment Stack). Before
// this file existed, both templates duplicated these formulas verbatim with
// nothing enforcing they stayed in sync; a drift would only surface as a
// deploy-time `ResourceNotFound` on the `existing` lookups. Importing these
// functions instead makes that drift structurally impossible rather than
// relying on a failure to catch it.

@export()
func virtualNetworkName(stackName string) string => 'vnet-${stackName}'

@export()
func webappName(stackName string) string => '${stackName}-webapp'

@export()
func webappSubnetName(stackName string) string => 'snet-${webappName(stackName)}'

@export()
func apiFunctionName(stackName string) string => '${stackName}-node-api'

@export()
func apiFunctionSubnetName(stackName string) string => 'snet-${apiFunctionName(stackName)}'

@export()
func dataflowsFunctionName(stackName string) string => '${stackName}-dataflows'

@export()
func dataflowsSubnetName(stackName string) string => 'snet-${dataflowsFunctionName(stackName)}'

@export()
func privateEndpointSubnetName(stackName string) string => 'snet-${stackName}-private-endpoints'

// Branch-qualified (not fixed) Key Vault secret names for the per-branch ACS
// email resources (CAMS-760, GH #2749 bug shape) — acs-email.bicep writes
// these into the SHARED app-config Key Vault from inside main.bicep's
// per-branch stack, so a fixed name would get captured by every branch's
// stack and deleted on that branch's teardown. backend-api-deploy.bicep
// reads the same qualified name via @Microsoft.KeyVault(...) — keep both
// call sites importing these functions rather than reconstructing the
// suffix independently.
@export()
func acsConnectionStringSecretName(stackName string) string => 'ACS-EMAIL-CONNECTION-STRING-${stackName}'

@export()
func acsSenderAddressSecretName(stackName string) string => 'ACS-EMAIL-SENDER-ADDRESS-${stackName}'

// The read-only SQL managed identity is created once in app-shared-setup.bicep
// (fixed name shared by main and every branch) and looked up by name via
// `existing` in backend-api-deploy.bicep/dataflows-resource-deploy.bicep.
// Both call sites must fall back to the same formula the creator uses when
// sqlServerIdentityName isn't explicitly passed, or the `existing` lookup
// targets an identity that was never created.
@export()
func sqlIdentityName(stackName string) string => 'id-sql-${stackName}-readonly'
