# Signals economy — local draft, not published

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

No top-up offers have been created. The top-up screen shows an unavailable message until configured.
Legacy server demo balances and earned totals are archived as `legacyDemoBalance` / `legacyDemoEarned`; they are not converted into purchasable SI. Inventory, identity and match stats are preserved.
Use durable storage for reward receipts and rate limits before production. Ephemeral Render disk still risks losing receipts or resetting the daily cap after restart.

Local checks: `npm run typecheck`, `npx tsx scripts/check-signals.ts`, `npm run check:idos`, `npm run build`.
