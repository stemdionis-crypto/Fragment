import { PLATFORM_RATING_TIERS, RATING_REWARD_STEP, RATING_REWARD_SIGNALS } from '../shared/economy';
// Merge into a freshly read Quest section; preserve all unrelated definitions.
export function withBotRatingQuests<T extends { Quests?: Record<string, unknown> }>(definitions: T) {
  const result = structuredClone(definitions);
  result.Quests ??= {};
  for (let tier = 1; tier <= PLATFORM_RATING_TIERS; tier++) {
    const id = 'fragment_bot_rating_' + tier;
    result.Quests[id] = {
      QuestID: id, Identity: { DisplayName: `Fragment bot rating ${tier * RATING_REWARD_STEP}` },
      Linking: { CycleIDs: [] },
      Objectives: { rating: { ObjectiveID: 'rating', Source: 'ServerApi', MetricID: 'fragment_bot_rating_peak', AggregationMethod: 'Maximum', TargetValue: tier * RATING_REWARD_STEP } },
      Reward: { Grant: { Standard: { Entries: [{ Type: 'VirtualCurrency', CurrencyID: 'SI', Amount: RATING_REWARD_SIGNALS }] } } },
    };
  }
  return result;
}
