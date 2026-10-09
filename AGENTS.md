# Fragment release workflow

For iDos updates, use `idos/UPDATES.md` and `npm run release:idos`.
Build locally and upload the static ZIP through iDos MCP. Do not run paid Engine builds, media generation, or purchase credits unless explicitly requested.
Keep `49HLIN0J` as the live title and Render as the WebSocket backend. Use the actual game build, never an iframe wrapper.
Check MCP title access before uploading. Publish only when requested; otherwise upload a test version. Verify the build status and gameplay before claiming success.
If backend files change, deploy the matching GitHub commit to Render and verify Live. A static ZIP does not update the backend.
