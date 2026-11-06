#!/bin/bash
# Tears down the sync-trustee-case-appointments harness containers. Data is not persisted.
podman pod stop cams-sync-trustee-case-appointments-pod 2>/dev/null || true
podman pod rm -f cams-sync-trustee-case-appointments-pod 2>/dev/null || true
echo "Stopped."
