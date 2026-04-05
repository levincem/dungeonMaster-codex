/**
 * Maps (category, typeId) → image path in /public/items/
 * For items with variants the default/unequipped/empty state is returned.
 * Pass `state` for charged/worn variants.
 */

const BASE = '/items/';

// ─── Weapon images ────────────────────────────────────────────────────────────
const WEAPON_IMG: Record<number, string> = {
     0: 'vorpal_blade.png',
     2: 'fury_empty.png',
     8: 'arrow.png',
     9: 'slayer.png',
    10: 'rocket.png',
    16: 'torch_unlit.png',
    17: 'gem_of_ages.png',
    18: 'etoile.png',
    19: 'yew_staff.png',
    20: 'staff_of_claws_empty.png',
    21: 'staff.png',
    22: 'wand.png',
    23: 'teowand.png',
    25: 'axe.png',
    26: 'the_hellion.png',   // Executioner → closest match
    27: 'dagger_of_fear.png',
    32: 'dagger.png',
    33: 'falchion.png',
    34: 'rapier.png',
    35: 'sabre.png',
    36: 'sword.png',
    40: 'bow.png',
    41: 'crossbow.png',
    42: 'long_bow.png',
    48: 'rock.png',
    49: 'poison_dart.png',
    50: 'throwing_star.png',
    56: 'sling.png',
    63: 'master_key.png',
};

// ─── Weapon variant images (charged / worn states) ────────────────────────────
export const WEAPON_VARIANTS: Record<number, { empty: string; full: string }> = {
     2: { empty: 'fury_empty.png',            full: 'fury_full.png'            },
    20: { empty: 'staff_of_claws_empty.png',  full: 'staff_of_claws_full.png'  },
    16: { empty: 'torch_unlit.png',           full: 'torch_lit.png'            },
};

/** Torch images by state index (0=burnt, 1=used_2, 2=used_1, 3=lit) */
export const TORCH_STATE_IMAGES = [
    'torch_unlit.png',   // 0 burnt out
    'torch_used_2.png',  // 1 almost dead
    'torch_used_1.png',  // 2 worn
    'torch_lit.png',     // 3 fresh / lit
];

/**
 * Return the correct torch image for a given item id and the torchBurnStart map.
 * Falls back to torch_lit if the torch hasn't been lit yet (fresh floor item).
 */
export function getTorchImage(itemId: string, torchBurnStart: Record<string, number>): string {
    const litAt = torchBurnStart[itemId];
    if (litAt === undefined) return BASE + 'torch_lit.png'; // unlit floor torch
    const elapsed = Date.now() - litAt;
    const TORCH_LIFETIME_MS = 15 * 60 * 1000;
    const TORCH_STATE_MS    =  5 * 60 * 1000;
    let idx: number;
    if      (elapsed >= TORCH_LIFETIME_MS)  idx = 0;
    else if (elapsed >= TORCH_STATE_MS * 2) idx = 1;
    else if (elapsed >= TORCH_STATE_MS)     idx = 2;
    else                                     idx = 3;
    return BASE + TORCH_STATE_IMAGES[idx];
}

// ─── Armor images ─────────────────────────────────────────────────────────────
const ARMOR_IMG: Record<number, string> = {
     0: 'cape.png',
     1: 'cloak_of_night.png',
     2: 'elven_doublet.png',
     3: 'leather_jerkin.png',
     4: 'suede_doublet.png',
     5: 'robe_of_the_kite_lord.png',
     6: 'robe_body.png',
     7: 'barbarian_doublet.png',
     8: 'ghi.png',
     9: 'plate_mail.png',
    10: 'tunic.png',
    11: 'silk_shirt.png',
    12: 'gunna.png',
    13: 'tabard.png',
    14: 'halter.png',
    15: 'kirtle.png',
    16: 'leather_boots.png',
    17: 'sandals.png',
    18: 'hosen.png',
    19: 'chain_mail_aketon.png',
    20: 'elven_boots.png',
    21: 'suede_boots.png',
    22: 'blue_pants.png',
    23: 'mail_aketon.png',
    24: 'leg_mail.png',
    25: 'leather_pants.png',
    26: 'robe_legs.png',
    27: 'fine_robe_legs.png',
    28: 'ghi_trousers.png',
    29: 'barbarian_hide.png',
    30: 'greave_of_lyte.png',
    31: 'greave_of_darc.png',
    32: 'helmet.png',
    33: 'armet.png',
    34: 'crown_of_nerra.png',
    35: 'vilmains_hat.png',
    36: 'casque_n_coif.png',
    37: 'basinet.png',
    38: 'helm_of_lyte.png',
    39: 'helm_of_darc.png',
    40: 'neck_plate.png',
    41: 'torso_plate.png',
    42: 'leg_plate.png',
    43: 'foot_plate.png',
    44: 'poleyn_of_lyte.png',
    45: 'poleyn_of_darc.png',
    46: 'plate_of_lyte.png',
    47: 'plate_of_darc.png',
    48: 'gauntlets.png',
    49: 'gloves.png',
    50: 'shield_of_lyte.png',
    51: 'shield_of_darc.png',
    52: 'buckler.png',
    54: 'hide_shield.png',
    56: 'belt.png',
    57: 'large_shield.png',
};

// ─── Potion images ────────────────────────────────────────────────────────────
// DM1 raw typeId encoding for potions (bits 5-7 = power, bits 0-4 = type slot)
// We map the 10 known dungeon IDs to their images:
const POTION_IMG: Record<number, string> = {
      0: 'mon_potion.png',
     40: 'ya_potion.png',
     50: 'ma_potion_stamina.png',
     60: 'vi_potion.png',
     72: 'ee_potion_mana.png',
     92: 'zo_potion.png',
    100: 'ful_potion.png',
    112: 'ku_potion.png',
    120: 'neta_potion.png',
    127: 'bro_potion_antivenin.png',
    // game_db clean IDs (fallback)
      1: 'um_potion.png',
      2: 'dee_potion.png',
      3: 'zo_potion.png',
      4: 'ful_potion.png',
      8: 'ya_potion.png',
      9: 'ma_potion_stamina.png',
     10: 'ee_potion_mana.png',
     11: 'neta_potion.png',
     13: 'mon_potion.png',
     14: 'um_potion.png',
     15: 'ku_potion.png',
     16: 'vi_potion.png',
     17: 'mon_potion.png',
     18: 'anti_fire_potion.png',
     24: 'water_waterskin_full.png',
};

// ─── Misc images ──────────────────────────────────────────────────────────────
const MISC_IMG: Record<number, string> = {
     0: 'compass.png',
     1: 'waterskin_empty.png',
     2: 'torch_unlit.png',
     3: 'dragon_steak.png',
     4: 'drumstick.png',
     5: 'corn.png',
     6: 'bread.png',
     7: 'water_flask.png',
     8: 'apple.png',
     9: 'cheese.png',
    10: 'ful_bomb.png',
    11: 'zokathra_spell.png',
    12: 'corbamite.png',
    13: 'copper_coin.png',
    14: 'silver_coin.png',
    15: 'gold_coin.png',
    16: 'jewel_symal_unequipped.png',
    17: 'illumulet_unlit.png',
    18: 'moonstone.png',
    19: 'magnifier.png',
    21: 'lock_picks.png',
    22: 'rope.png',
    23: 'mirror_of_dawn.png',
    24: 'ashes.png',
    25: 'magical_box_blue.png',
    26: 'scroll.png',
    27: 'pendant_feral.png',
    28: 'bones.png',
    29: 'apple.png',
    30: 'corn.png',
    31: 'bread.png',
    32: 'rabbits_foot.png',
    35: 'drumstick.png',
    36: 'dragon_steak.png',
    37: 'worm_round.png',
    38: 'screamer_slice.png',
    39: 'moonstone.png',
    40: 'empty_flask.png',
    41: 'water_flask.png',
    42: 'magical_box_green.png',
    43: 'delta.png',
    44: 'ekkhard_cross.png',
    45: 'rope.png',
    46: 'rabbits_foot.png',
    47: 'choker.png',
    48: 'iron_key.png',
    49: 'key_of_b.png',
    50: 'winged_key.png',
    51: 'topaz_key.png',
    52: 'cross_key.png',
    56: 'chest_closed.png',
};

// ─── Container images ─────────────────────────────────────────────────────────
const CONTAINER_IMG: Record<number, string> = {
    0: 'chest_closed.png',
};

// ─── Fallbacks by category ────────────────────────────────────────────────────
const CATEGORY_FALLBACK: Record<string, string> = {
    Weapon:    'sword.png',
    Armor:     'leather_jerkin.png',
    Potion:    'mon_potion.png',
    Misc:      'compass.png',
    Scroll:    'scroll.png',
    Container: 'chest_closed.png',
};

// ─── Public API ───────────────────────────────────────────────────────────────

export function getItemImage(category: string, typeId: number): string {
    let filename: string | undefined;
    switch (category) {
        case 'Weapon':    filename = WEAPON_IMG[typeId];    break;
        case 'Armor':     filename = ARMOR_IMG[typeId];     break;
        case 'Potion':    filename = POTION_IMG[typeId];    break;
        case 'Misc':      filename = MISC_IMG[typeId];      break;
        case 'Container': filename = CONTAINER_IMG[typeId]; break;
    }
    return BASE + (filename ?? CATEGORY_FALLBACK[category] ?? 'compass.png');
}
