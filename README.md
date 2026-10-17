# 📻 Fragment

**A cooperative browser puzzle game where talking is the puzzle.**

Four players each see only part of the answer. An old radio listens to their chat, turns obvious words into static and learns repeated descriptions. To solve the puzzles, the team must invent a shared language.

Built by **Dionis and Zhenya**, a two-person team from Kazakhstan. Status: **live beta**.

## Play, pitch and demo

- **Play on iDos Games:** https://idosgames.com/app/49HLIN0J/
- **Direct game:** https://49hlin0j.idos.games/
- **Current English pitch:** https://youtu.be/5g_Kz23V3bo
- **Earlier project video:** https://youtu.be/nmlSiMs5xgM
- **Presentation:** https://stemdionis-crypto.github.io/Fragment/
- **Source code:** https://github.com/stemdionis-crypto/Fragment

The earlier videos show previous trial catalogues. The current game has **ten active trial types**, with **four trials per match**. The English pitch describes the iDos integration and FRAG/Signals economy.

### Quick start for judges

1. Open the iDos game page and click **Play Now**, or use the direct game link.
2. Select **EN** for the English interface.
3. Try the three-step interactive tutorial, then choose **Play with bots** and **Turn the radio on**. Bot practice is available to guests; no token purchase is needed.
4. Describe the clue under **You know** to its named teammate. Your clue is for that teammate's control. Use the clue they give you to set **your own** control, then confirm your answer.
5. Chat is turn-based: send up to three messages, or pass early. Controls can be adjusted during another player's turn.
6. To play with other people, sign in through iDos or verify a Solana wallet, then use a room code or random matchmaking.

The Render free instance may take around a minute to wake after inactivity. If connecting stalls, wait and try again. If iDos asks you to sign in again, use the iDos sign-in button.

## Current release

The October 17, 2026 update contains matching client and server changes. GitHub is the source for the Render backend and the locally built iDos static client.

| Feature | Current status |
| --- | --- |
| Multiplayer, room codes and random matchmaking | Implemented |
| Four challenges per match, drawn from ten active trial types | Implemented |
| Three-step interactive tutorial | Implemented |
| Bot practice with contextual clue interpretation, clarification and corrections | Implemented; unusual metaphors can still need clarification |
| iDos account login, nickname editing, profiles, inventory and equipment saving | Implemented |
| Verified Solana wallet binding and profile recovery | Implemented |
| Match statistics and leaderboard | Implemented |
| FRAG on Solana and Signals packages purchased through iDos | Implemented |
| Cosmetic characters, accessories, room decoration and victory effects | Implemented; off-chain inventory |
| Durable backend account storage in PostgreSQL | Implemented |
| NFT cosmetics and on-chain victory Fragments | Planned; not minted by the current game |
| Learning from an on-chain collection of previous Fragments | Planned |
| External LLM-based companion reasoning or radio judge | Not used by the current companion logic |

### What changed in the October 17 update

- Companions remember hypotheses, ask clarifying questions and accept corrections. They use their own clues and visible chat, not the hidden solution.
- Bot messages do not train the radio or increase suspicion. Common helper words are protected from learning.
- Retuning preserves completed trials and deals new answers for the current trial. New clues must be shared and controls set again. Failed attempts identify the affected controls.
- Bot practice has no countdown and can be left freely. A stalled or expired iDos login no longer blocks guest practice; connecting to a wallet is not required.
- The original Fragment soundtrack loops continuously across menu and match, becomes quieter during play and has a saved music-volume setting.
- Multiplayer matches have a fifteen-minute limit. Leaving an active matchmaking match pauses matchmaking for five minutes. A brief connection loss has a sixty-second reconnect grace period.
- The interface identifies your control, explains suspicion changes and includes an interactive tutorial.

## Gameplay

A match contains **four challenges**, beginning with direct clue exchange and progressing through a catalogue of **ten active trial types**. Picture sets and private clues vary between matches.

Every player owns a control. The public rule explains how clues become answers; private clues are held by teammates or distributed across their card hands. Players must communicate through chat without giving the radio an obvious word or number.

A direct forbidden clue adds suspicion; a wrong team answer also adds suspicion. Solving a trial lowers it. At full suspicion, or after exhausting the trial's three attempts, the radio retunes without erasing completed stages.

A win generates a server-side **Fragment record** of the match and the team's language. This record is not currently an NFT.

See [the trial catalogue](TRIALS.md).

## Solana, FRAG and Signals

**FRAG is the Solana token. Signals (SI) are a separate, non-transferable in-game currency.**

FRAG mint: `5M2cQA6uMVQixayHPCVcVnd3YZnazM3S4gwf3hQoidos`  
Decimals: **6**

The store uses iDos to purchase Signals packages from the player's platform FRAG balance. Signals are then spent on cosmetics. Signals cannot be withdrawn or converted back to FRAG.

| FRAG | Signals |
| ---: | ---: |
| 250 | 1 |
| 125,000 | 500 |
| 250,000 | 1,000 |
| 500,000 | 2,000 |
| 1,000,000 | 4,000 |

The client discovers the live offers and prices from iDos and validates the approved package structure. The platform handles payment and wallet top-up. The game does not sign a token transfer or hardcode a payout wallet.

The three paid character skins cost **1,000 / 1,500 / 2,500 Signals**. Accessories and room decoration start at **300 Signals**; free defaults are available.

Qualifying human matches award **10 Signals for a win** or **3 for a loss**, with a **50-Signal daily UTC cap**. Qualification requires a match lasting at least sixty seconds and at least two distinct connected human accounts with two messages each. Results and rewards are deduplicated per account and round.

**Bot practice gives no economic rewards.** Purchased Signals are excluded from lifetime-earned leaderboard totals. These rules limit basic farming; they do not prove that two accounts represent two different people.

Gameplay and inventory run off-chain for responsive matches. Solana currently contributes verified wallet identity and the FRAG payment asset. NFT ownership of cosmetics and victory records is a future step.

## Architecture and persistence

- **Client:** TypeScript, Vite and browser UI/audio.
- **Game server:** Node.js and authoritative WebSocket rooms, hosted on Render.
- **Platform:** `@idosgames/core` for iDos accounts, store, inventory and Cloud Code integration.
- **Account storage:** PostgreSQL in production; isolated local JSON storage for development.
- **Companions:** deterministic contextual parser and dialogue memory; no external model API is required for their reasoning.

iDos inventory and equipment are saved through the platform. Backend account state, verified identities, match statistics and reward bookkeeping use durable storage. Unfinished rooms remain in memory and can be interrupted by a server restart.

The radio detects plain terms and repeated expressions; it is not an unrestricted language model. Companions may ask for a clearer description when a metaphor is ambiguous.

See [account storage](idos/ACCOUNT-STORAGE.md), [deployment](DEPLOYMENT.md) and [iDos update workflow](idos/UPDATES.md).

## Run locally

Use **Node.js 22** and npm.

```bash
npm ci
npm run dev
```

The development server uses port **2567** and the client uses **http://localhost:5174**. Online play still requires a linked iDos identity or verified wallet; guest practice does not.

For an isolated Windows preview with a local test profile, separate data and no production database:

```powershell
powershell -NoProfile -File scripts/preview-local.ps1
```

This preview uses **http://127.0.0.1:5190** and a local server on port **2590**. It skips platform identity only in local preview mode. The release script explicitly disables that mode.

Production:

```bash
npm run build
npm start
```

Configure `DATABASE_URL` and the documented production environment before hosting. Do not put credentials, wallet keys or database URLs in the frontend or repository.

## Verification

```bash
npm run typecheck
npm run check
npm run check:accounts
npm run check:idos
node --import tsx scripts/check-bot-conversation.ts
node --import tsx scripts/check-clue-channel.ts
node --import tsx scripts/check-hand-chat.ts
node --import tsx scripts/check-local-flow.ts
node --import tsx scripts/check-cooperative-match.ts
npm run build
```

Tests cover trial uniqueness, radio filtering, companion clue interpretation and ambiguity, profile recovery, wallet authentication, reward deduplication, top-up guards, retune persistence and matchmaking leave restrictions.

The cooperative match test uses ordinary WebSocket chat, the test player's own clues and public information; it does not read hidden answers. Automated checks do not establish human retention or demand.

## Updating the game

`npm run release:idos` checks TypeScript, builds the actual game locally and creates a static ZIP in `releases/`. Upload that ZIP through iDos MCP; no paid Engine build is needed. A backend change also requires deploying the matching GitHub commit to Render. Follow [idos/UPDATES.md](idos/UPDATES.md).

## Team and next steps

Dionis and Zhenya develop and test Fragment together. The next priorities are playtests with real teams, clearer onboarding, stronger reasons to replay and community growth through gameplay clips. Optional cosmetics are the current monetization model; NFT features remain planned.

- [Telegram](https://t.me/FragmentGame_Official)
- [TikTok](https://www.tiktok.com/@fragment178)

## License

The package metadata declares MIT.
