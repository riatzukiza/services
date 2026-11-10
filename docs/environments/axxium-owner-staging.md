# Axxium owner staging

This operator-only profile qualifies the Services identity seed with an
admitted Axxium staging image. Its Compose project, database, seal key and
identity ledger are private to this slot. It listens on host loopback port
18874. It requires neither public ingress nor mailbox configuration.

Under the service environment receiver lock, stage the Compose file and
`contracts/axxium/identity/foresight-tree.edn` in
`/srv/open-hax/environments/staging/axxium-owner`. Set `AXXIUM_IMAGE` to the
verified image ID in the Axxium staging receipt and set a distinct
`DB_PASSWORD` in the slot's private `.env`. Create a fresh Ed25519 private
signing key as `private/actor.pem`, a fresh base64 32-byte seal key as
`private/identity.key`, and a writable `identity/` directory. Files and
directories mounted as private state must be owned by container UID 1000
and inaccessible to other users. Use `docker compose up -d --wait --pull never`
for this project only, then check health and the exact image and seed hashes.

Forward local port 18874 over SSH to remote loopback port 18874. Provision a
dedicated Google web client with exactly
`http://127.0.0.1:18874/api/auth/google/callback` as its redirect URI.
Install its JSON only as `private/google-client.json`. Sign in through
the forwarded portal. Compare the provider-verified Google subject of the
staging actor to the active Google-bound production administrator on the host.
After a match, set `AXXIUM_IDENTITY_ROOT_OPERATOR_ACTOR_ID` to the staging
actor and `AXXIUM_IDENTITY_ROOT_DID` to
`did:web:127.0.0.1:18874:actors:err` in the staging environment. Recreate only
the staging app under the same lock.

Read back the seed from the owner session. Use a separate staging account to
verify denial on a seeded child. Verify that the owner can suspend and resume
the same child and that the final tree matches the initial state. Keep
authentication material out of the receipts.
