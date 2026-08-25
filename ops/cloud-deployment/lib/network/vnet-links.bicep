
param privateDnsZoneName string = 'privatelink.azurewebsites.us'

@description('Provide a name used for labeling related resources')
param stackName string

@description('Application\'s target virtual network resource id')
param virtualNetworkId string

@description('Optional array of resource ids of virtual network to link to private dns zone')
param linkVnetIds array = []

// Azure allows only ONE virtual network link per (vnet, zone) pair, regardless
// of the link resource's own name. Set true when the caller has already
// confirmed (via an out-of-band existence check, since bicep cannot query
// "does any link exist for this vnet+zone" without knowing its exact name)
// that some link already satisfies this vnet's resolution into the zone --
// skips creating a second, differently-named link that Azure would otherwise
// reject with a Conflict.
param vnetLinkAlreadyExists bool = false

// Fallback to public resolution when this zone returns an authoritative
// NXDOMAIN for a name it holds no record for.
//
// Why this matters here specifically: these are privatelink zones for a SQL
// server SHARED by main and every branch. The moment any Private Endpoint
// exists against that server, Azure CNAMEs its public FQDN into the
// privatelink namespace SERVER-WIDE. A VNet that is NOT linked to a private
// zone still resolves that CNAME publicly and keeps working. A VNet that IS
// linked to a zone lacking a matching A record gets an authoritative NXDOMAIN
// and fails hard -- so the link, which looks like a safety measure, is what
// converts "resolves publicly, works" into getaddrinfo ENOTFOUND. That is the
// mechanism behind main's SQL outage: a torn-down branch's PE deleted the
// shared A record out from under main, which was linked to that zone.
//
// NxDomainRedirect makes Azure's recursive resolver retry publicly instead of
// returning NXDOMAIN, turning that class of incident into graceful degradation
// rather than an outage. It is also what makes a zero-downtime cutover between
// Private Endpoints possible at all: deleting an old PE deletes its records, so
// there is always a window with no record, and this is what covers it.
//
// Requires api-version 2024-06-01 or higher (the property does not exist on
// 2020-06-01). CONFIRMED AVAILABLE IN AZURE GOVERNMENT, verified live against
// this tenant: Gov ARM advertises 2024-06-01 for this type, and a GET on an
// existing Gov link at that version returns resolutionPolicy. Only applies to
// privatelink zones and A/AAAA/CNAME queries, which is exactly this use case.
@allowed([
  'Default'
  'NxDomainRedirect'
])
param resolutionPolicy string = 'NxDomainRedirect'

resource ustpPrivateDnsZone 'Microsoft.Network/privateDnsZones@2024-06-01' existing = {
  name: privateDnsZoneName
}

resource ustpPrivateDnsZoneVnetLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = if (!vnetLinkAlreadyExists) {
  parent: ustpPrivateDnsZone
  location: 'global'
  properties: {
    registrationEnabled: false
    resolutionPolicy: resolutionPolicy
    virtualNetwork: {
      id: virtualNetworkId
    }
  }
  name: '${privateDnsZoneName}-vnet-link-${stackName}'
}

// optional step to include additional link to existing PrivateDnsZone
resource ustpAdditionalVnetLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = [
  for vnetId in linkVnetIds: {
    parent: ustpPrivateDnsZone
    location: 'global'
    properties: {
      registrationEnabled: false
      resolutionPolicy: resolutionPolicy
      virtualNetwork: {
        id: vnetId
      }
    }
    name: 'vnet-link-${uniqueString(resourceGroup().id, vnetId)}'
  }
]

output privateDnsZoneName string = ustpPrivateDnsZone.name
