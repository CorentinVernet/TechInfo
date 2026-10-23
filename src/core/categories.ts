export const CATEGORIES = ["web", "dev", "systems", "network-cloud", "security", "ai", "hardware", "bigtech-mobile", "selfhost", "gaming", "industry", "space", "other"] as const;
export const LEVELS = ["critical", "important", "follow", "minor"] as const;
export type Category = (typeof CATEGORIES)[number];
