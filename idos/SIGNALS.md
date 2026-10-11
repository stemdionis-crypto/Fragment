# Signals economy — live iDos configuration

SI is a non-transferable virtual currency. FRAG is only used to buy SI packages.
Cosmetics use the `signal` price option and spend SI. No SI withdrawal or conversion back to FRAG.

Rewards: human win 10, qualifying loss 3, bots 0, daily UTC cap 50.
The room must last 60 seconds and have at least two distinct connected human accounts with two messages each. Each account/round can earn once. This limits basic farming; it cannot prove that two wallets are two different people.
Skins cost 1,000 / 1,500 / 2,500; accessories and decor start at 300.

Before launch (requires separate publication authorization):
1. Merge `signals-currency.json` into the live virtual currencies, preserving other currencies.
2. Review and publish the staged store and quests. They remain inactive locally.
3. Publish the revised cloud code. New signal stats and daily cycle are separate from legacy FRAG/demo stats.
4. Enable `FRAGMENT_SIGNALS_ENABLED=true` on the matching Render server.
5. Decide the FRAG prices for SI packages. Create offers named `fragment_signal_pack_<id>` with option `frag`, exactly one CryptoCurrency/Main cost and exactly one VirtualCurrency/SI reward. Place them in active storefront slots. The client discovers packages and prices from iDos; no exchange rate is fabricated in code.
6. Correct/verify FRAG mint decimals in platform config before charging. Test exact debit/credit and account restoration.

Approved on 2026-10-11: four repeatable Web packages use the `frag` option: 125,000 FRAG → 500 SI, 250,000 FRAG → 1,000 SI, 500,000 FRAG → 2,000 SI, and 1,000,000 FRAG → 4,000 SI. Offers are named `fragment_signal_pack_<SI amount>` and appear in matching slots under `fragment/topups`. `signal-pack.json` records all four in `Offers` and their slots in `Section`; `Offer` retains the 1,000 SI offer for compatibility. Merge them into the existing store; do not replace the cosmetics catalogue. The client discovers live offers, so package changes do not require rebuilding the game.
Main.SpendableInGame is enabled. ConvertibleToVirtual remains disabled: purchases use Store, not a separate conversion endpoint. FRAG uses the Solana mint `5M2cQA6uMVQixayHPCVcVnd3YZnazM3S4gwf3hQoidos` with 6 decimals.
Payment is from the player's iDos balance. On idosgames.com the SDK opens the site's wallet top-up when the balance is insufficient. There is no direct wallet integration in the embedded game. Package price changes require the user to reopen the purchase UI; concurrent duplicate submissions are blocked.
The live store and build are verified without spending real FRAG. A funded player must still verify the first actual debit of 250,000 FRAG and credit of 1,000 SI.
Legacy server demo balances and earned totals are archived as `legacyDemoBalance` / `legacyDemoEarned`; they are not converted into purchasable SI. Inventory, identity and match stats are preserved.
Use durable storage for reward receipts and rate limits before production. Ephemeral Render disk still risks losing receipts or resetting the daily cap after restart.

Local checks: `npm run typecheck`, `npx tsx scripts/check-signals.ts`, `npx tsx scripts/check-topups.ts`, `npm run check:idos`, `npm run build`.
