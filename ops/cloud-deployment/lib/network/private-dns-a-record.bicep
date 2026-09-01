/*
  Title:        private-dns-a-record.bicep
  Description:  Declares ONE A record in an EXISTING private DNS zone.

  Exists because a privateEndpoint's privateDnsZoneGroup keys its
  registration by zone NAME, not by zone resource id. An endpoint pointed at
  two zones that share a name writes exactly ONE record, into a zone chosen
  arbitrarily -- confirmed live on throwaway resources 2026-08-24, where the
  same two-config group landed the record in the FIRST zone when the configs
  were added one at a time and in the SECOND when they were sent in a single
  PUT. Declaring each record explicitly is deterministic and scales to any
  number of same-named zones. See sql-hub.bicep for the caller.

  The zone is never created here -- it belongs to the consumer. A record is a
  CHILD of the zone, so a missing zone fails the whole deployment with
  ParentResourceNotFound rather than degrading. Callers whose zone list is
  operator-supplied should precheck with zone_exists_for (see
  _vnet-link-check.sh); azure-deploy-sql-hub-setup.sh does.
*/

@description('Name of the EXISTING private DNS zone this record is written into. The zone is never created here -- it belongs to the consumer.')
param privateDnsZoneName string

@description('Record name relative to the zone, e.g. the SQL server\'s short name.')
param recordName string

@description('IPv4 address the record resolves to.')
param ipAddress string

@description('Record TTL in seconds. Deliberately NOT the 10s a privateDnsZoneGroup writes: that low value suits a record Azure rewrites on every endpoint change, whereas this one is pinned to a static address that cannot change (see sql-hub.bicep), so there is nothing to propagate quickly.')
param ttl int = 3600

resource privateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' existing = {
  name: privateDnsZoneName
}

// aRecords is REPLACED wholesale, not merged: this declares that the name
// resolves to exactly one address. Pointing a hostname at a single shared
// Private Endpoint is the only use here, but a caller that ever needs a
// multi-address record set must widen this param rather than call the module
// twice -- a second call would overwrite the first, not append to it.
resource aRecord 'Microsoft.Network/privateDnsZones/A@2020-06-01' = {
  parent: privateDnsZone
  name: recordName
  properties: {
    ttl: ttl
    aRecords: [
      {
        ipv4Address: ipAddress
      }
    ]
  }
}

output recordFqdn string = '${recordName}.${privateDnsZoneName}'
