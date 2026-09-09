---
status: accepted
---

# api-aerial issues its own OAuth2 tokens for the Turkish Airlines OCN endpoint

Turkish Airlines will only authenticate against an OCN endpoint with OAuth 2.0
client credentials, which means we must hand them a token URI, client ID and
client secret and then validate the bearer they present. We are building that
token endpoint in api-aerial and signing with RS256 using the existing keypair
in `src/keys/`, rather than registering a confidential client in the Keycloak we
already run at `login.metisconnect.com`.

## Considered options

Keycloak was the cheaper path — configuration plus one middleware, no signing
keys of our own to hold or rotate, and we already validate Keycloak bearers
everywhere else. It was rejected in favour of keeping the partner-facing auth
surface inside api-aerial, alongside the endpoint it protects, instead of
coupling an airline's ability to notify us to our internal identity provider.

## Consequences

- api-aerial now owns signing-key lifecycle and rotation for a third party. There
  is no revocation: a leaked token stays valid until it expires, so expiry is
  the only lever and should be short.
- `src/keys/private_cert.pem` becomes load-bearing for inbound partner traffic,
  not just for the outbound Transavia assertion that currently uses it.
- The RSA-OAEP-SHA256 encryption Turkish Airlines requires for the credentials
  we send them is a one-time operation for handing over secrets, not part of the
  request path. Note the shared helpers in `src/utils/Encryption/` all use
  `oaepHash: "sha1"` and are the wrong tool for it.
- Bearer is the only accepted credential: HTTP Basic is removed outright rather
  than kept as a transitional fallback. Inbound notifications therefore fail
  until Turkish Airlines is configured against the new token endpoint, and
  coordinating that is outside our control. Accepted deliberately — Basic is
  rejecting every production call today, so there is no working path to
  preserve, and a dual-auth window would have risked becoming permanent.
