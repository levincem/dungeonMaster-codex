/**
 * Maps (category, typeId) → image path in /public/items/
 * For items with variants the default/unequipped/empty state is returned.
 * Pass `state` for charged/worn variants.
 */

import type { FloorItem } from '../types/game';
import { resolveItemName } from './items';
import { getWaterContainerState } from './waterContainers';

const BASE = '/items/';

function normaliseItemName(name?: string): string | null {
    if (!name) return null;
    return name
        .trim()
        .toLowerCase()
        .replace(/[’']/g, "'")
        .replace(/\s+/g, ' ');
}

export function isTorchItem(item: FloorItem | undefined): boolean {
    if (!item) return false;
    const normalizedName = normaliseItemName(item.rawName);
    return normalizedName === 'torch' || (item.category === 'Weapon' && item.typeId === 2);
}

const NAME_IMG_OVERRIDES: Record<string, string> = {
    'torch': 'torch_unlit.png',
    'the firestaff': 'the_firestaff.png',
    'the firestaff (complete)': 'the_firestaff_complete.png',
    'the firestaff complete': 'the_firestaff_complete.png',
    'master key': 'master_key.png',
    'staff of claws': 'staff_of_claws_full.png',
    'fury': 'fury_full.png',
    'rapier': 'rapier.png',
    'sabre': 'sabre.png',
    'samurai sword': 'samurai_sword.png',
    'delta': 'delta.png',
    'diamond edge': 'diamond_edge.png',
    'the inquisitor': 'the_inquisitor.png',
    'hardcleave': 'hardcleave.png',
    'mace of order': 'mace_of_order.png',
    'morningstar': 'morningstar.png',
    'club': 'club.png',
    'staff of manar': 'staff_of_manar.png',
    'staff': 'staff.png',
    'snake staff': 'snake_staff.png',
    'dragon spit': 'dragon_spit.png',
    'sceptre of lyf': 'sceptre_of_lyf.png',
    'horn of fear': 'horn_of_fear.png',
    'speedbow': 'speedbow.png',
    'dagger': 'dagger.png',
    'falchion': 'falchion.png',
    'sword': 'sword.png',
    'axe': 'axe.png',
    'bow': 'bow.png',
    'crossbow': 'crossbow.png',
    'arrow': 'arrow.png',
    'throwing star': 'throwing_star.png',
    'stick': 'stick.png',
    'wand': 'wand.png',
    'teowand': 'teowand.png',
    'mace': 'mace.png',
    'stone club': 'stone_club.png',
    'slayer': 'slayer.png',
    'sling': 'sling.png',
    'rock': 'rock.png',
    'poison dart': 'poison_dart.png',
    'yew staff': 'yew_staff.png',
    'bolt blade': 'bolt_blade_full.png',
    'flamitt': 'flamitt_full.png',
    'storm ring': 'stormring_full.png',
    'stormring': 'stormring_full.png',
    'the hellion': 'the_hellion.png',
    'calista': 'calista.png',
    'cape': 'cape.png',
    'cloak of night': 'cloak_of_night.png',
    'elven doublet': 'elven_doublet.png',
    'leather jerkin': 'leather_jerkin.png',
    'robe': 'robe_body.png',
    'robe of the kite lord': 'robe_of_the_kite_lord.png',
    'robe (body)': 'robe_body.png',
    'robe (legs)': 'robe_legs.png',
    'fine robe (body)': 'fine_robe_body.png',
    'fine robe (legs)': 'fine_robe_legs.png',
    'kirtle': 'kirtle.png',
    'tabard': 'tabard.png',
    'gunna': 'gunna.png',
    'ghi': 'ghi.png',
    'ghi trousers': 'ghi_trousers.png',
    'blue pants': 'blue_pants.png',
    'sandals': 'sandals.png',
    'hide shield': 'hide_shield.png',
    'halter': 'halter.png',
    'barbarian hide': 'barbarian_hide.png',
    'leather boots': 'leather_boots.png',
    'leather pants': 'leather_pants.png',
    'suede boots': 'suede_boots.png',
    'large shield': 'large_shield.png',
    'hosen': 'hosen.png',
    'helmet': 'helmet.png',
    'basinet': 'basinet.png',
    "casque'n coif": 'casque_n_coif.png',
    'armet': 'armet.png',
    'crown of nerra': 'crown_of_nerra.png',
    'buckler': 'buckler.png',
    'mail aketon': 'mail_aketon.png',
    'leg mail': 'leg_mail.png',
    'torso plate': 'torso_plate.png',
    'leg plate': 'leg_plate.png',
    'foot plate': 'foot_plate.png',
    'plate of lyte': 'plate_of_lyte.png',
    'plate of darc': 'plate_of_darc.png',
    'poleyn of lyte': 'poleyn_of_lyte.png',
    'poleyn of darc': 'poleyn_of_darc.png',
    'greave of lyte': 'greave_of_lyte.png',
    'greave of darc': 'greave_of_darc.png',
    'helm of lyte': 'helm_of_lyte.png',
    'helm of darc': 'helm_of_darc.png',
    'shield of lyte': 'shield_of_lyte.png',
    'shield of darc': 'shield_of_darc.png',
    'elven boots': 'elven_boots.png',
    'plate mail': 'plate_mail.png',
    'chain mail aketon': 'chain_mail_aketon.png',
    'tunic': 'tunic.png',
    'silk shirt': 'silk_shirt.png',
    'elven huke': 'elven_huke.png',
    'mithral aketon': 'mithral_aketon.png',
    'mithral mail': 'mithral_mail.png',
    'bezerker helm': 'bezerker_helm.png',
    'wooden shield': 'wooden_shield.png',
    'small shield': 'small_shield.png',
    'boots of speed': 'boots_of_speed.png',
    'flamebain': 'flamebain.png',
    'blue gem': 'blue_gem.png',
    'orange gem': 'orange_gem.png',
    'green gem': 'green_gem.png',
    'ra key': 'ra_key.png',
    'ruby key': 'ruby_key.png',
    'emerald key': 'emerald_key.png',
    'tourquoise key': 'tourquoise_key.png',
    'solid key': 'solid_key.png',
    'skeleton key': 'skeleton_key.png',
    'square key': 'square_key.png',
    'water': 'water.png',
    'power towers': 'powertowers.png',
    'eye of time': 'eye_of_time_full.png',
    'magical box (blue)': 'magical_box_blue.png',
    'magical box (green)': 'magical_box_green.png',
    'compass': 'compass.png',
    'waterskin': 'waterskin_empty.png',
    'water flask': 'water_flask.png',
    'jewel symal': 'jewel_symal_unequipped.png',
    'illumulet': 'illumulet_unlit.png',
    'ashes': 'ashes.png',
    'bones': 'bones.png',
    'copper coin': 'copper_coin.png',
    'silver coin': 'silver_coin.png',
    'gold coin': 'gold_coin.png',
    'iron key': 'iron_key.png',
    'key of b': 'key_of_b.png',
    'winged key': 'winged_key.png',
    'topaz key': 'topaz_key.png',
    'cross key': 'cross_key.png',
    'gold key': 'solid_key.png',
    'sapphire key': 'sapphire_key.png',
    'onyx key': 'onyx_key.png',
    'boulder': 'boulder.png',
    'bread': 'bread.png',
    'cheese': 'cheese.png',
    'corn': 'corn.png',
    'apple': 'apple.png',
    'screamer slice': 'screamer_slice.png',
    'worm round': 'worm_round.png',
    'drumstick': 'drumstick.png',
    'dragon steak': 'dragon_steak.png',
    'gem of ages': 'gem_of_ages.png',
    'ekkhard cross': 'ekkhard_cross.png',
    'moonstone': 'moonstone.png',
    'pendant feral': 'pendant_feral.png',
    "rabbit's foot": 'rabbits_foot.png',
    'corbamite': 'corbamite.png',
    'choker': 'choker.png',
    'magnifier': 'magnifier.png',
    'chest': 'chest_closed.png',
    'empty flask': 'empty_flask.png',
    'health potion': 'vi_potion.png',
    'stamina potion': 'ma_potion_stamina.png',
    'mana potion': 'ee_potion_mana.png',
    'antidote': 'bro_potion_antivenin.png',
    'strength potion': 'ku_potion.png',
    'dexterity potion': 'ros_potion.png',
    'wisdom potion': 'dane_potion.png',
    'vitality potion': 'neta_potion.png',
    'anti-magic potion': 'mon_potion.png',
    'anti-fire potion': 'anti_fire_potion.png',
    'waterskin (water)': 'water_waterskin_full.png',
    'ven potion': 'ven_potion.png',
    'ros potion': 'ros_potion.png',
    'ku potion': 'ku_potion.png',
    'dane potion': 'dane_potion.png',
    'neta potion': 'neta_potion.png',
    'bro potion': 'bro_potion_antivenin.png',
    'ma potion': 'ma_potion_stamina.png',
    'ya potion': 'ya_potion.png',
    'ee potion': 'ee_potion_mana.png',
    'vi potion': 'vi_potion.png',
    'ful bomb': 'ful_bomb.png',
    'zokathra': 'zokathra_spell.png',
    'cross of neta': 'cross_key.png',
};

function getNameOverrideImage(rawName?: string): string | undefined {
    const key = normaliseItemName(rawName);
    if (!key) return undefined;
    const filename = NAME_IMG_OVERRIDES[key];
    return filename ? BASE + filename : undefined;
}

// ─── Weapon images ────────────────────────────────────────────────────────────
const WEAPON_IMG: Record<number, string> = {
     0: 'vorpal_blade.png',
     2: 'fury_empty.png',
     8: 'arrow.png',
     9: 'slayer.png',
    10: 'rocket.png',
    13: 'samurai_sword.png',
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
     2: { empty: 'torch_unlit.png',           full: 'torch_lit.png'            },
     3: { empty: 'flamitt_empty.png',         full: 'flamitt_full.png'         },
     4: { empty: 'staff_of_claws_empty.png',  full: 'staff_of_claws_full.png'  },
     5: { empty: 'bolt_blade_empty.png',      full: 'bolt_blade_full.png'      },
     6: { empty: 'fury_empty.png',            full: 'fury_full.png'            },
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

export function getInventoryItemImage(item: FloorItem): string {
    if (isTorchItem(item)) return BASE + 'torch_unlit.png';
    return getFloorItemImage(item);
}

export function getEquippedItemImage(item: FloorItem, torchBurnStart: Record<string, number>): string {
    if (isTorchItem(item)) return getTorchImage(item.id, torchBurnStart);
    return getFloorItemImage(item);
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

export function getItemImage(category: string, typeId: number, rawName?: string): string {
    const resolvedName = resolveItemName(category as FloorItem['category'] | 'Scroll' | 'Container', typeId, rawName);
    const nameOverride = getNameOverrideImage(resolvedName);
    if (nameOverride) return nameOverride;

    let filename: string | undefined;
    switch (category) {
        case 'Weapon':
        case 'Armor':
        case 'Misc':
            // Legacy typeId image maps are now last-resort only.
            filename = undefined;
            break;
        case 'Potion':    filename = POTION_IMG[typeId];    break;
        case 'Container': filename = CONTAINER_IMG[typeId]; break;
    }
    if (!filename) {
        switch (category) {
            case 'Weapon':    filename = WEAPON_IMG[typeId]; break;
            case 'Armor':     filename = ARMOR_IMG[typeId]; break;
            case 'Misc':      filename = MISC_IMG[typeId]; break;
        }
    }
    return BASE + (filename ?? CATEGORY_FALLBACK[category] ?? 'compass.png');
}

export function getFloorItemImage(item: FloorItem): string {
    const waterState = getWaterContainerState(item);
    if (waterState) {
        if (waterState.kind === 'waterskin') {
            return BASE + (waterState.charges > 0 ? 'water_waterskin_full.png' : 'waterskin_empty.png');
        }
        return BASE + (waterState.charges > 0 ? 'water_flask.png' : 'empty_flask.png');
    }
    return getItemImage(item.category, item.typeId, item.rawName);
}
