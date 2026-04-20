// Compatibility bridge between canonical runtime item names and the asset
// filenames that still follow older project naming conventions.

export const ITEM_IMAGE_NAME_ALIASES: Record<string, string> = {
    torch: 'torch_unlit.png',
    flamitt: 'flamitt_empty.png',
    'staff of claws': 'staff_of_claws_full.png',
    'bolt blade': 'bolt_blade_full.png',
    fury: 'fury_full.png',
    'storm ring': 'stormring_full.png',
    stormring: 'stormring_full.png',
    'eye of time': 'eye_of_time_full.png',
    'jewel symal': 'jewel_symal_unequipped.png',
    illumulet: 'illumulet_unlit.png',
    waterskin: 'waterskin_empty.png',
    'waterskin (water)': 'water_waterskin_full.png',
    'gold key': 'solid_key.png',
    'health potion': 'vi_potion.png',
    'stamina potion': 'mon_potion.png',
    'mana potion': 'ee_potion_mana.png',
    antidote: 'bro_potion_antivenin.png',
    'strength potion': 'ku_potion.png',
    'dexterity potion': 'ros_potion.png',
    'wisdom potion': 'dane_potion.png',
    'vitality potion': 'neta_potion.png',
    'bro potion': 'bro_potion_antivenin.png',
    'shield potion': 'ya_potion.png',
    robe: 'robe_body.png',
    zokathra: 'zokathra_spell.png',
    chest: 'chest_closed.png',
    'cross of neta': 'cross_key.png',
};

// Legacy typeId -> filename maps are still needed as a last resort for items
// whose runtime names do not yet match the shipped asset filenames 1:1.
export const LEGACY_WEAPON_TYPE_IMAGE_MAP: Record<number, string> = {
    33: 'falchion.png',
    48: 'rock.png',
    49: 'poison_dart.png',
    50: 'throwing_star.png',
    56: 'sling.png',
};

export const LEGACY_ARMOR_TYPE_IMAGE_MAP: Record<number, string> = {};

export const LEGACY_POTION_TYPE_IMAGE_MAP: Record<number, string> = {
     10: 'bro_potion_antivenin.png',
     13: 'ee_potion_mana.png',
};

export const LEGACY_MISC_TYPE_IMAGE_MAP: Record<number, string> = {
    52: 'cross_key.png',
};

export const LEGACY_CONTAINER_TYPE_IMAGE_MAP: Record<number, string> = {};

export const CATEGORY_IMAGE_FALLBACK: Record<string, string> = {
    Weapon: 'sword.png',
    Armor: 'leather_jerkin.png',
    Potion: 'mon_potion.png',
    Misc: 'compass.png',
    Scroll: 'scroll.png',
    Container: 'chest_closed.png',
};
