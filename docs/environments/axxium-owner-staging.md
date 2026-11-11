# Axxium owner staging

This operator-only profile qualifies the Services identity seed with an
admitted Axxium staging image. Its Compose project, database, seal key and
identity ledger are private to this slot. It listens on host loopback port
18874. It requires neither public ingress nor mailbox configuration.

Under the service environment receiver lock, stage the Compose file and
`contracts/axxium/identity/foresight-tree.edn` in
`/srv/open-hax/environments/staging/axxium-owner` as `compose.yaml` and
`foresight-tree.edn`. Set `AXXIUM_IMAGE` to the verified image ID in the Axxium
staging receipt and set a distinct `DB_PASSWORD` in the slot's mode-0600 `.env`.
Create a fresh Ed25519 signing key as `private/actor.pem`, a fresh base64
32-byte seal key as `private/identity.key`, and a writable `identity/`
directory. Private mount contents must be owned by container UID 1000 and
inaccessible to other users.

Use the slot's `.env` for both phases. Omit the two owner settings entirely
during the initial sign-in phase. Compose leaves the bare keys unset when no
value is supplied, and Axxium rejects empty strings as invalid owner settings.
Clear inherited variables so they cannot override the file.

```sh
slot=/srv/open-hax/environments/staging/axxium-owner
stage_compose() {
  env -u AXXIUM_IMAGE -u DB_PASSWORD \
    -u AXXIUM_IDENTITY_ROOT_OPERATOR_ACTOR_ID -u AXXIUM_IDENTITY_ROOT_DID \
    docker compose --project-name axxium-owner-staging \
      --project-directory "$slot" --env-file "$slot/.env" \
      -f "$slot/compose.yaml" "$@"
}
stage_compose up -d --wait --pull never
```

Hold `/srv/open-hax/environments/.receiver.lock` for host configuration and
Compose changes. Release it while waiting for browser sign-in. After startup,
check health, the running image and mounted seed hashes against their receipts,
and the seed startup result. The current seed has one root and 36 descendants.
Expect zero refusals and verify the complete tree after binding the owner.

Forward local port 18874 over SSH to remote loopback port 18874. Provision a
dedicated Google web client with exactly
`http://127.0.0.1:18874/api/auth/google/callback` as its redirect URI.
Install its JSON only as `private/google-client.json`. After `/api/auth/config`
reports Google enabled for the exact loopback origin, use **Continue with
Google** and confirm the provider returns to the forwarded portal. On the host,
match the verified Google subject of the new staging human to the subject of
the active Google-bound production administrator. Require a live staging
session issued for that actor during the sign-in. Compare the provider and
subject in private and record only the match result. Keep the session cookie
in the browser.

Under the receiver lock, add `AXXIUM_IDENTITY_ROOT_OPERATOR_ACTOR_ID` with
the matched **staging** actor ID and `AXXIUM_IDENTITY_ROOT_DID` with
`did:web:127.0.0.1:18874:actors:err` to the slot's `.env` together. Keep the
signing key and database in place and recreate only the app.

```sh
stage_compose up -d --no-deps --force-recreate --wait --pull never axxium
```

Read back that the running app loaded both owner settings and that the seed
startup result reports zero refusals. Record the match and outcome without
printing the actor ID, rendered Compose environment, or credentials.

Before the authorization checks, record the byte count and SHA-256 of the
slot's `identity/ledger.edn`.

From the matched Google session, list the tree in the portal and verify the
root and all seeded descendants. In a separate authenticated staging session,
verify the unrelated actor sees none of the seeded tree and receives HTTP 403
from `/api/identity/admin` for `suspend` on a seeded, uncredentialed child.
The matched Google owner should still see that child active. Suspend and resume
the same child as the owner, checking the portal state after each operation and
confirming the final tree matches the initial tree.

After the authorization checks, verify the original ledger byte prefix hash
is unchanged and inspect the appended records in place. The unrelated
attempt records a denied policy decision. The owner operations each record an
allowed decision and a resource update for the same child. Record only the
outcomes and hashes in the receipt.
