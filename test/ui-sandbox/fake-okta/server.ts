#!/usr/bin/env tsx
/**
 * A real (if minimal) OIDC provider standing in for Okta in the ui-sandbox.
 *
 * Why a real OIDC server instead of the backend's existing `mock` login provider: the `mock`
 * provider (backend/lib/testing/mock-gateways/mock-oauth2-gateway.ts) swaps out the entire
 * backend authorization gateway, bypassing okta-gateway.ts/HumbleVerifier.ts entirely - it never
 * exercises the real Okta code path, and its user list is a hardcoded array
 * (common/src/cams/test-utilities/mock-user.ts) an agent can't add fixtures to at will. This
 * server instead speaks the actual OIDC surface @okta/jwt-verifier and @okta/okta-auth-js expect,
 * backed by a Mongo `okta.users` collection anyone can seed/edit - full control over principals,
 * real code path.
 *
 * Endpoints implemented (the minimum both libraries actually touch - see file header comments
 * inline for how each was confirmed against node_modules):
 *   GET  /oauth2/default/.well-known/openid-configuration  - okta-auth-js reads this on the
 *                                                              frontend to discover authorize/
 *                                                              token endpoints
 *   GET  /oauth2/default/v1/keys                            - JWKS; @okta/jwt-verifier defaults
 *                                                              jwksUri to {issuer}/v1/keys when
 *                                                              not given one explicitly (backend
 *                                                              never passes jwksUri)
 *   GET  /oauth2/default/v1/authorize                       - renders the fixture-user picker,
 *                                                              the form's action posts back here
 *   POST /oauth2/default/v1/authorize                        - validates the picked fixture user,
 *                                                              mints an auth code, redirects to
 *                                                              redirect_uri with code+state
 *   POST /oauth2/default/v1/token                            - PKCE-verified code exchange for a
 *                                                              signed access token + id token
 *   GET  /oauth2/default/v1/userinfo                         - okta-gateway.ts's getUser() calls
 *                                                              this directly with the bearer
 *                                                              token (authorization-configuration
 *                                                              .ts hardcodes this path, no
 *                                                              discovery-doc lookup)
 *
 * @okta/jwt-verifier's assertIssuer (node_modules/@okta/jwt-verifier/lib.js) hard-rejects any
 * issuer that doesn't match /^https:\/\//, with no config hook available to the backend's call
 * site (HumbleVerifier.ts constructs OktaJwtVerifier with no `testing` option) - so this server
 * must terminate real TLS even for local dev. Run scripts/generate-cert.sh once before starting.
 */
import { readFileSync } from 'fs';
import { randomBytes, createHash } from 'crypto';
import { resolve } from 'path';
import https from 'https';
import express from 'express';
import { MongoClient } from 'mongodb';
import { SignJWT, exportJWK, importPKCS8, importSPKI } from 'jose';
import type { FakeOktaUser } from './users';
import { OKTA_DB_NAME, OKTA_USERS_COLLECTION } from './users';

const PORT = Number(process.env.FAKE_OKTA_PORT) || 8443;
const ISSUER = process.env.FAKE_OKTA_ISSUER || `https://localhost:${PORT}/oauth2/default`;
const AUDIENCE = 'api://default';
const MONGO_CONNECTION_STRING =
  process.env.MONGO_CONNECTION_STRING || 'mongodb://localhost:27017/cams-e2e?retrywrites=false';

const CERT_DIR = resolve(__dirname, 'certs');
const KEY_ID = 'sandbox-fake-okta-key-1';

// In-memory only - fine for a throwaway local dev server, never reused across restarts.
type PendingAuth = {
  redirectUri: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  clientId: string;
  sub: string;
};
const pendingAuthByCode = new Map<string, PendingAuth>();
const usedAuthCodes = new Set<string>();

function base64url(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Fixture user fields (name/email) and echoed query params both land in the sign-in page's HTML
// - escape both, since either could contain markup (a fixture with an unescaped name/email is an
// easy mistake to make when editing seed-users.ts).
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function loadKeys() {
  const privateKeyPem = readFileSync(resolve(CERT_DIR, 'jwt-signing-key.pem'), 'utf-8').trim();
  const publicKeyPem = readFileSync(resolve(CERT_DIR, 'jwt-signing-key.pub.pem'), 'utf-8').trim();
  const privateKey = await importPKCS8(privateKeyPem, 'RS256');
  const publicKey = await importSPKI(publicKeyPem, 'RS256');
  const jwk = await exportJWK(publicKey);
  return { privateKey, jwk: { ...jwk, use: 'sig', alg: 'RS256', kid: KEY_ID } };
}

async function findUser(sub: string): Promise<FakeOktaUser | null> {
  const client = await MongoClient.connect(MONGO_CONNECTION_STRING);
  try {
    const db = client.db(OKTA_DB_NAME);
    return await db.collection<FakeOktaUser>(OKTA_USERS_COLLECTION).findOne({ sub });
  } finally {
    await client.close();
  }
}

async function listUsers(): Promise<FakeOktaUser[]> {
  const client = await MongoClient.connect(MONGO_CONNECTION_STRING);
  try {
    const db = client.db(OKTA_DB_NAME);
    return await db.collection<FakeOktaUser>(OKTA_USERS_COLLECTION).find({}).toArray();
  } finally {
    await client.close();
  }
}

async function main() {
  const { privateKey, jwk } = await loadKeys();
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // okta-auth-js fetches the discovery doc via CORS from the frontend's own origin before ever
  // navigating anywhere - the real Okta service allows this from any origin, so this must too.
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    // okta-auth-js sends its own SDK-identifying headers (e.g. x-okta-user-agent-extended) that
    // vary by version - reflect whatever the preflight actually asked for rather than
    // maintaining an enumerated list that drifts out of sync with the SDK.
    res.setHeader(
      'Access-Control-Allow-Headers',
      req.headers['access-control-request-headers'] || 'Content-Type, Authorization',
    );
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.get('/oauth2/default/.well-known/openid-configuration', (_req, res) => {
    res.json({
      issuer: ISSUER,
      authorization_endpoint: `${ISSUER}/v1/authorize`,
      token_endpoint: `${ISSUER}/v1/token`,
      userinfo_endpoint: `${ISSUER}/v1/userinfo`,
      jwks_uri: `${ISSUER}/v1/keys`,
      response_types_supported: ['code'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      code_challenge_methods_supported: ['S256'],
      grant_types_supported: ['authorization_code'],
      scopes_supported: ['openid', 'profile', 'email'],
    });
  });

  app.get('/oauth2/default/v1/keys', (_req, res) => {
    res.json({ keys: [jwk] });
  });

  app.get('/oauth2/default/v1/authorize', async (req, res) => {
    const { redirect_uri, state, code_challenge, code_challenge_method, client_id } = req.query;
    const users = await listUsers();
    const options = users
      .map(
        (u) =>
          `<option value="${escapeHtml(u.sub)}">${escapeHtml(u.name)} (${escapeHtml(u.email)})</option>`,
      )
      .join('');
    res.type('html').send(`
      <!doctype html>
      <html>
        <body>
          <h1 id="okta-sign-in">Fake Okta Sign-In (ui-sandbox)</h1>
          <form method="POST" action="/oauth2/default/v1/authorize">
            <input type="hidden" name="redirect_uri" value="${escapeHtml(redirect_uri)}" />
            <input type="hidden" name="state" value="${escapeHtml(state)}" />
            <input type="hidden" name="code_challenge" value="${escapeHtml(code_challenge)}" />
            <input type="hidden" name="code_challenge_method" value="${escapeHtml(code_challenge_method)}" />
            <input type="hidden" name="client_id" value="${escapeHtml(client_id)}" />
            <label for="sub">Choose a fixture user:</label>
            <select id="sub" name="sub" data-testid="fake-okta-user-select">${options}</select>
            <button type="submit" data-testid="fake-okta-submit">Sign In</button>
          </form>
        </body>
      </html>
    `);
  });

  app.post('/oauth2/default/v1/authorize', async (req, res) => {
    const { redirect_uri, state, code_challenge, code_challenge_method, client_id, sub } = req.body;
    const user = await findUser(sub);
    if (!user) {
      res.status(400).send(`Unknown fixture user: ${sub}`);
      return;
    }

    const code = base64url(randomBytes(32));
    pendingAuthByCode.set(code, {
      redirectUri: redirect_uri,
      state,
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method || 'S256',
      clientId: client_id,
      sub,
    });

    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('code', code);
    if (state) redirectUrl.searchParams.set('state', state);
    res.redirect(redirectUrl.toString());
  });

  app.post('/oauth2/default/v1/token', async (req, res) => {
    const { code, code_verifier, grant_type } = req.body;
    if (grant_type !== 'authorization_code') {
      res.status(400).json({ error: 'unsupported_grant_type' });
      return;
    }
    const pending = pendingAuthByCode.get(code);
    if (!pending || usedAuthCodes.has(code)) {
      res.status(400).json({ error: 'invalid_grant' });
      return;
    }

    if (pending.codeChallengeMethod === 'S256') {
      const expected = base64url(
        createHash('sha256')
          .update(code_verifier ?? '')
          .digest(),
      );
      if (expected !== pending.codeChallenge) {
        res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE mismatch' });
        return;
      }
    }
    usedAuthCodes.add(code);
    pendingAuthByCode.delete(code);

    const user = await findUser(pending.sub);
    if (!user) {
      res.status(400).json({ error: 'invalid_grant', error_description: 'User no longer exists' });
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const commonClaims = {
      sub: user.sub,
      groups: user.groups,
      name: user.name,
      email: user.email,
    };

    const accessToken = await new SignJWT(commonClaims)
      .setProtectedHeader({ alg: 'RS256', kid: KEY_ID })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt(now)
      .setExpirationTime(now + 60 * 60)
      .sign(privateKey);

    const idToken = await new SignJWT(commonClaims)
      .setProtectedHeader({ alg: 'RS256', kid: KEY_ID })
      .setIssuer(ISSUER)
      .setAudience(pending.clientId)
      .setIssuedAt(now)
      .setExpirationTime(now + 60 * 60)
      .sign(privateKey);

    res.json({
      access_token: accessToken,
      id_token: idToken,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'openid profile email',
    });
  });

  app.get('/oauth2/default/v1/userinfo', async (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      res.status(401).json({ error: 'invalid_token' });
      return;
    }
    // The access token's own claims already carry sub/name/email (set at /v1/token above) -
    // decode without re-verifying here, since HumbleVerifier.ts already verified the signature
    // via /v1/keys before okta-gateway.ts ever calls this endpoint. Still guard the decode
    // itself: a malformed/non-JWT bearer token must produce the OIDC-required 401, not an
    // unhandled JSON.parse exception surfacing as a 500.
    let payload: { sub?: string; name?: string; email?: string };
    try {
      const [, encodedPayload] = token.split('.');
      payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf-8'));
    } catch {
      res.status(401).json({ error: 'invalid_token' });
      return;
    }
    res.json({
      sub: payload.sub,
      name: payload.name,
      email: payload.email,
      preferred_username: payload.email,
      given_name: payload.name?.split(' ')[0] ?? payload.name,
      family_name: payload.name?.split(' ').slice(1).join(' ') || payload.name,
      email_verified: true,
    });
  });

  const httpsOptions = {
    key: readFileSync(resolve(CERT_DIR, 'key.pem')),
    cert: readFileSync(resolve(CERT_DIR, 'cert.pem')),
  };

  https.createServer(httpsOptions, app).listen(PORT, () => {
    console.log(`Fake Okta server listening on ${ISSUER}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
