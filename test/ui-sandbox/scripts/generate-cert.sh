#!/bin/bash
# Generates a self-signed TLS cert/key for the fake-okta server. @okta/jwt-verifier
# (backend/lib/adapters/gateways/okta/HumbleVerifier.ts) hard-requires an https:// issuer
# with no config hook to disable that check, so the fake Okta server must terminate real TLS
# even for local dev - plain HTTP is rejected before any request is made.
#
# Regenerate any time (e.g. if expired) - nothing else in the sandbox depends on the key
# staying stable across runs.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERT_DIR="${SCRIPT_DIR}/../fake-okta/certs"
mkdir -p "${CERT_DIR}"

openssl req -x509 -newkey rsa:2048 -keyout "${CERT_DIR}/key.pem" -out "${CERT_DIR}/cert.pem" \
  -days 365 -nodes -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

# Separate keypair used to sign JWTs (as opposed to the TLS termination keypair above) - kept
# distinct so rotating one doesn't require touching the other, matching how a real IdP separates
# its transport cert from its token-signing keys.
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "${CERT_DIR}/jwt-signing-key.pem"
openssl rsa -pubout -in "${CERT_DIR}/jwt-signing-key.pem" -out "${CERT_DIR}/jwt-signing-key.pub.pem"

echo "Generated TLS cert/key and JWT signing keypair in ${CERT_DIR}"
