# Fragment / iDos economy
The current local draft replaces direct FRAG cosmetics/rewards with Signals (SI). See SIGNALS.md for the current activation plan; the older FRAG plan below documents the previous version.
Title: 49HLIN0J. SDK: @idosgames/core 0.21.2.
## Current staging state
FRAG name is displayed. Demo points are separate from platform Main balance. No automatic conversion.
Catalog and protected loadout handlers are ready. Store and daily reward cycle are intentionally inactive until FRAG is bound.
## Activation (after publisher binds FRAG)
1. Verify Main.DisplayName = FRAG and Solana ContractAddress is the publisher's FRAG mint.
2. Set Render FRAGMENT_FRAG_MINT to that exact mint and FRAGMENT_IDOS_ECONOMY_ENABLED=true.
3. Activate Stores.fragment.Availability.Schedule.IsActive and Cycles.fragment_daily.Schedule.IsActive in iDos, preserving unrelated definitions.
4. Fund the platform reward pool according to iDos rules. No IOU or developer-share top-up is enabled by this change.
5. End-to-end test: SSO login; eligible win; claim; buy; equip; reload; login on a second device; verify inventory and Main balance.
## Security
Render verifies the iDos session itself. Browser inventory is never accepted.
CloudCode validates ownership from InventoryV2. Store purchases are atomic and capped to one per account.
Match confirmation uses a random 256-bit receipt, bound to the authenticated iDos UserID. CloudCode reads the HTTPS game server. Daily quests use Maximum aggregation and atomic claim semantics: replay cannot grant twice. Limits: practice win 10, human-room win 25, daily max100; existing participation and match-duration rules apply.
The free Render server still has ephemeral local match statistics and pending receipts. Purchases and equipment saved in iDos survive restarts; unconfirmed receipts do not. A durable server DB is needed before enabling paid production rewards.
## Deployment
Publish the full cloud-code.js revision after reading live CloudCode. Allow fragment-demo.onrender.com in CloudCode.Http and Blockchain.IframeConnectHosts. Build the actual static game with VITE_SERVER_URL=wss://fragment-demo.onrender.com; upload dist zip to iDos, not an iframe wrapper.

## Verified on 2026-10-08
TypeScript and production build passed. Gameplay, wallet, practice, economy persistence and platform security checks passed. Live DEV test used virtual CO only: purchase, server inventory reload, protected equip and fresh session restored the same account and equipped skin. Real FRAG purchase/payout test is pending mint binding and activation. Production Store configuration remains staged in this repository until FRAG is verified.
