/** What a "Sync now" outcome says, wherever the button is (?sync=<status>). */
export const SYNC_FLASH: Record<string, string> = {
  ok: "Synced just now.",
  cooldown: "Synced less than 10 minutes ago; try again shortly.",
  "rate-limited": "OpenAlex's daily allowance is used up; the next scheduled sync will retry.",
  "not-found": "OpenAlex has no record for this ORCID.",
  error: "OpenAlex could not be reached; the next sync will retry.",
  skipped: "Nothing to sync for this account.",
};
