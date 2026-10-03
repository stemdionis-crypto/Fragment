# Publishing Fragment

## Free concept demo on Render

The root `render.yaml` provisions one free Node.js web service, with both the
client and WebSocket server. Connect the repository through Render Blueprints:
https://dashboard.render.com/select-repo?type=blueprint

Select `stemdionis-crypto/Fragment`, branch `main`, and confirm the preview shows
one **Free** web service and no paid databases or disks. Deploy the Blueprint.
Render provides the HTTPS URL. Wallet sign-in automatically uses its trusted
`RENDER_EXTERNAL_URL`. Custom domains still need `FRAGMENT_PUBLIC_ORIGIN`.

The service deploys after GitHub checks pass. Do not configure the optional
`FRAGMENT_DEPLOY_HOOK` as well: native Render auto-deploy handles this demo.

Free services sleep after inactivity, so opening the game can take time to wake
the server. Profiles are stored in temporary files and are lost on server
restarts/redeploys. The main menu and shop explicitly label this limitation.
No local profiles or wallet access tokens are uploaded to the hosting service.

For a later release, switch to a paid service with persistent storage or an
external database, keep one game server instance, and remove `VITE_DEMO_MODE`
only after persistence is verified. Wallet links cannot restore discarded
demo profiles.

References: https://render.com/docs/free and https://render.com/docs/blueprint-spec

Publish this `fragment` directory as the repository root. The parent directory
contains a different game, Here Lies. Do not upload that parent's index.html.
Opening either project's HTML through file:// does not start its development
server. For local play run `Запустить игру.cmd` and open http://localhost:5174/.

## How changes become visible

1. Edit the local files; Vite updates the local game while `npm run dev` runs.
2. Commit and push the changes to the GitHub repository's `main` branch.
3. GitHub Actions checks types, puzzle rules, wallet proofs, practice, economy,
   and builds the client.
4. After successful checks, Actions calls the hosting deployment hook if the
   repository secret `FRAGMENT_DEPLOY_HOOK` is configured.
5. Hosting rebuilds the server and client; the public URL serves the new build.

Saving a local file alone does not upload it to GitHub. The first publication
needs a repository and hosting configuration. This workflow does not itself
create a hosting account or a live public game.

## Hosting requirements

Use a Node.js or Docker service supporting WebSockets, HTTPS and persistent
storage. The HTTP client and WebSocket game server share one public origin.
GitHub Pages alone cannot run this game's multiplayer server.

- Build: `npm ci --include=dev && npm run build`
- Start: `npm start`
- Health endpoint: `/health`
- Node.js: 22
- `PORT`: set by the hosting service (default 2567).
- `FRAGMENT_PUBLIC_ORIGIN`: exact HTTPS public origin without a trailing slash,
  for example `https://fragment.example.com`; required for wallet signing.
- `FRAGMENT_DATA_DIR`: a directory on a persistent volume. For the included
  Dockerfile, mount writable persistent storage at `/app/.data`.
- Run one instance: active rooms and matchmaking are kept in process memory.

Keep `.data`, device access tokens, wallet keypairs and `.env` out of GitHub.
Do not set `FRAGMENT_DEBUG` in production. Never bake keys into client assets.
The default translation service works without an AI API key.

Restarting/redeploying interrupts active matches. Persistent storage keeps
profiles, balances, cosmetics and wallet bindings across deploys.

## Docker

```sh
docker build -t fragment .
docker run --rm -p 2567:2567 -v fragment-data:/app/.data \
  -e FRAGMENT_PUBLIC_ORIGIN=http://localhost:2567 fragment
```

Open http://localhost:2567/ to test this production build locally.
