// Only truly alternate player-facing potion labels stay here. Canonical DM
// names are resolved directly from the packaged item tables.
export const POTION_NAME_TO_RUNTIME_TYPE_ID: Record<string, number> = {
    'dexterity potion': 6,
    'strength potion': 7,
    'wisdom potion': 8,
    'vitality potion': 9,
    antidote: 10,
    'bro potion': 10,
    'stamina potion': 11,
    'shield potion': 12,
    'mana potion': 13,
    'health potion': 14,
};

// Safe fallback kept until the original wound-defense table is guaranteed to be
// available at every bootstrap point.
export const FALLBACK_WOUND_DEFENSE_FACTORS = [16, 32, 48, 64, 80, 96];
