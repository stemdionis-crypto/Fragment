# Profiles and leaderboard

Production requires a PostgreSQL `DATABASE_URL` in Render's secret environment.
Do not expose the connection string in client code, the iDos configuration or Git.
The server refuses to start on Render without durable storage. Local development
and isolated tests retain file storage.

`fragment_account_state` contains the authoritative profiles, wallet links,
match/reward replay keys and pending iDos statistics synchronization. Device
access tokens are hashed with SHA-256. Writes are serialized and confirmed only
after commit; failed writes restore the previous in-memory state. A database
revision prevents overlapping server instances from overwriting newer data.
Run one game-server instance. A rolling deployment may reject writes on the old
instance after the new instance takes ownership; clients reconnect to the new one.

An existing local profile file is imported only into an empty database. Preserve
it before moving servers: Render's old temporary disk does not survive a deploy.
Profiles, inventory and balances already saved in iDos are restored on iDos login;
old local-only wallet links cannot be recovered from iDos automatically.

Every completed match sets a durable pending-sync flag for iDos accounts,
including practice and unqualified matches. The authenticated server submits a
verified receipt independently of reward claims, retries transient failures, and
retries pending work on login. Expired authentication requires another login.
CloudCode saves statistics even when no Signals reward is eligible. Quest rewards
remain server-verified and replay-safe. An old acknowledgement never clears newer
results.

Rankings include iDos and wallet accounts. Purchased Signals do not contribute
to earned-Signals ranking. Best time requires two distinct participating humans.
Guest profiles and zero-result rows are excluded.

Deployment order:
1. Configure and verify PostgreSQL; keep the current server running meanwhile.
2. Run `npm run check:accounts`, `npm run check:idos`, `npm run typecheck`.
3. Publish `idos/cloud-code.js` preserving the existing HTTP allowlist.
4. Deploy the matching GitHub commit to Render; verify `/api/storage-health`
   returns `{"durable":true}` and test reconnect/profile restoration.
5. Build/upload the iDos static game with `npm run release:idos`.

Active multiplayer rooms remain in memory. A server restart interrupts an ongoing
match; saved accounts, completed results and purchases remain durable.
