# Self-contained fake-Okta OIDC provider for the ui-sandbox.
#
# Built from its own package.json (own express/jose/mongodb versions) rather than the monorepo
# root - this container's whole reason to exist is to be independent of the root node_modules
# install, which has an unrelated broken dependency (path-to-regexp, absent from the root
# lockfile's node_modules tree despite being pinned via root package.json overrides) that
# otherwise blocks any express-based process from starting locally.
FROM node:24.20.0-bookworm-slim

WORKDIR /app

COPY test/ui-sandbox/fake-okta/package*.json ./
RUN npm install

COPY test/ui-sandbox/fake-okta/server.ts ./
COPY test/ui-sandbox/fake-okta/users.ts ./
COPY test/ui-sandbox/fake-okta/seed-users.ts ./

EXPOSE 8443

CMD ["npx", "tsx", "server.ts"]
