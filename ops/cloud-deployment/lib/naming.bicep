// Shared naming formulas for resources that main.bicep and network.bicep both
// need to agree on: network.bicep creates the vnet/subnets, main.bicep only
// consumes them via `existing` references (CAMS-760, Option E — the two were
// split so the network tier could become its own Deployment Stack). Before
// this file existed, both templates duplicated these formulas verbatim with
// nothing enforcing they stayed in sync; a drift would only surface as a
// deploy-time `ResourceNotFound` on the `existing` lookups. Importing these
// functions instead makes that drift structurally impossible rather than
// relying on a failure to catch it (PR #2757 review).

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
