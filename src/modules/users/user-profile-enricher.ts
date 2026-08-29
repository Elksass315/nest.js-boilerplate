export const USER_PROFILE_ENRICHER = Symbol('USER_PROFILE_ENRICHER');

export interface UserProfileEnricher {
  enrich(userIds: readonly string[]): Promise<Map<string, Record<string, unknown>>>;
}
