/**
 * Maps (category, typeId) → image path in /public/items/
 * For items with variants the default/unequipped/empty state is returned.
 * Pass `state` for charged/worn variants.
 */

import type { FloorItem } from '../types/game';
import { normalizeLookupName, resolveItemName } from './items';
import { getWaterContainerState } from './waterContainers';
import { itemsPath } from './assetPaths';

const ITEM_BASE = itemsPath('');

function normaliseItemName(name?: string): string | null {
    if (!name) return null;
    return name
        .trim()
        .toLowerCase()
        .replace(/[’']/g, "'")
        .replace(/\s+/g, ' ');
}
void normaliseItemName;

export function isTorchItem(item: FloorItem | undefined): boolean {
    if (!item) return false;
    const normalizedName = normalizeLookupName(item.rawName);
    return normalizedName === 'torch' || (item.category === 'Weapon' && item.typeId === 2);
}

const AVAILABLE_ITEM_IMAGES = new Set<string>([
    'anti_fire_potion.png', 'apple.png', 'armet.png', 'arrow.png', 'ashes.png', 'axe.png',
    'barbarian_doublet.png', 'barbarian_hide.png', 'basinet.png', 'belt.png', 'bezerker_helm.png',
    'blue_gem.png', 'blue_pants.png', 'bolt_blade_empty.png', 'bolt_blade_full.png', 'bones.png',
    'boots_of_speed.png', 'boulder.png', 'bow.png', 'bread.png', 'bro_potion_antivenin.png',
    'buckler.png', 'calista.png', 'cape.png', 'casque_n_coif.png', 'chain_mail_aketon.png',
    'champion_bones.png', 'cheese.png', 'chest_closed.png', 'chest_opened.png', 'choker.png',
    'cloak_of_night.png', 'club.png', 'compass.png', 'copper_coin.png', 'corbamite.png', 'corn.png',
    'crossbow.png', 'cross_key.png', 'crown_of_nerra.png', 'dagger.png', 'dagger_of_fear.png',
    'dane_potion.png', 'dee_potion.png', 'delta.png', 'dexhelm.png', 'diamond_edge.png',
    'dragon_spit.png', 'dragon_steak.png', 'drumstick.png', 'ee_potion_mana.png', 'ekkhard_cross.png',
    'elven_boots.png', 'elven_doublet.png', 'elven_huke.png', 'emerald_key.png', 'empty_flask.png',
    'etoile.png', 'eye_of_time_empty.png', 'eye_of_time_full.png', 'falchion.png', 'fine_robe_body.png',
    'fine_robe_legs.png', 'flamebain.png', 'flamitt_empty.png', 'flamitt_full.png', 'foot_plate.png',
    'ful_bomb.png', 'ful_potion.png', 'fury_empty.png', 'fury_full.png', 'gauntlets.png',
    'gem_of_ages.png', 'ghi.png', 'ghi_trousers.png', 'gloves.png', 'gold_coin.png',
    'greave_of_darc.png', 'greave_of_lyte.png', 'green_gem.png', 'gunna.png', 'halter.png',
    'hardcleave.png', 'helmet.png', 'helm_of_darc.png', 'helm_of_lyte.png', 'hide_shield.png',
    'horn_of_fear.png', 'hosen.png', 'illumulet_lit.png', 'illumulet_unlit.png', 'iron_key.png',
    'jewel_symal_equipped.png', 'jewel_symal_unequipped.png', 'key_of_b.png', 'kirtle.png',
    'ku_potion.png', 'large_shield.png', 'leather_boots.png', 'leather_jerkin.png', 'leather_pants.png',
    'leg_mail.png', 'leg_plate.png', 'lock_picks.png', 'long_bow.png', 'mace.png', 'mace_of_order.png',
    'magical_box_blue.png', 'magical_box_green.png', 'magnifier.png', 'mail_aketon.png', 'master_key.png',
    'ma_potion_stamina.png', 'mirror_of_dawn.png', 'mithral_aketon.png', 'mithral_mail.png',
    'mon_potion.png', 'moonstone.png', 'morningstar.png', 'neck_plate.png', 'neta_potion.png',
    'onyx_key.png', 'orange_gem.png', 'pendant_feral.png', 'plate_mail.png', 'plate_of_darc.png',
    'plate_of_lyte.png', 'poison_dart.png', 'poleyn_of_darc.png', 'poleyn_of_lyte.png', 'powertowers.png',
    'rabbits_foot.png', 'rapier.png', 'ra_key.png', 'robe_body.png', 'robe_legs.png',
    'robe_of_the_kite_lord.png', 'rock.png', 'rocket.png', 'rope.png', 'ros_potion.png', 'ruby_key.png',
    'sabre.png', 'samurai_sword.png', 'sandals.png', 'sapphire_key.png', 'sceptre_of_lyf.png',
    'screamer_slice.png', 'scroll.png', 'shield_of_darc.png', 'shield_of_lyte.png', 'silk_shirt.png',
    'silver_coin.png', 'skeleton_key.png', 'slayer.png', 'sling.png', 'small_shield.png', 'snake_staff.png',
    'solid_key.png', 'speedbow.png', 'square_key.png', 'staff.png', 'staff_of_claws_empty.png',
    'staff_of_claws_full.png', 'staff_of_manar.png', 'stick.png', 'stone_club.png', 'stormring_empty.png',
    'stormring_full.png', 'suede_boots.png', 'suede_doublet.png', 'sword.png', 'tabard.png',
    'teowand.png', 'the_conduit.png', 'the_firestaff.png', 'the_firestaff_complete.png', 'the_hellion.png',
    'the_inquisitor.png', 'throwing_star.png', 'topaz_key.png', 'torch_lit.png', 'torch_unlit.png',
    'torch_used_1.png', 'torch_used_2.png', 'torso_plate.png', 'tourquoise_key.png', 'tunic.png',
    'um_potion.png', 'ven_potion.png', 'vilmains_hat.png', 'vi_potion.png', 'vorpal_blade.png',
    'wand.png', 'water.png', 'waterskin_empty.png', 'water_flask.png', 'water_waterskin_full.png',
    'winged_key.png', 'wooden_shield.png', 'worm_round.png', 'ya_potion.png', 'yew_staff.png',
    'zokathra_spell.png', 'zo_potion.png',
]);

const NAME_IMG_ALIASES: Record<string, string> = {
    'torch': 'torch_unlit.png',
    'the firestaff (complete)': 'the_firestaff_complete.png',
    'the firestaff complete': 'the_firestaff_complete.png',
    'staff of claws': 'staff_of_claws_full.png',
    'bolt blade': 'bolt_blade_full.png',
    'fury': 'fury_full.png',
    'storm ring': 'stormring_full.png',
    'stormring': 'stormring_full.png',
    'eye of time': 'eye_of_time_full.png',
    'jewel symal': 'jewel_symal_unequipped.png',
    'illumulet': 'illumulet_unlit.png',
    'waterskin': 'waterskin_empty.png',
    'waterskin (water)': 'water_waterskin_full.png',
    'gold key': 'solid_key.png',
    'health potion': 'vi_potion.png',
    'stamina potion': 'mon_potion.png',
    'mana potion': 'ee_potion_mana.png',
    'antidote': 'bro_potion_antivenin.png',
    'strength potion': 'ku_potion.png',
    'dexterity potion': 'ros_potion.png',
    'wisdom potion': 'dane_potion.png',
    'vitality potion': 'neta_potion.png',
    'bro potion': 'bro_potion_antivenin.png',
    'shield potion': 'ya_potion.png',
    'ven potion': 'ven_potion.png',
    'ful bomb': 'ful_bomb.png',
    'empty flask': 'empty_flask.png',
    'water flask': 'water_flask.png',
    'cross of neta': 'cross_key.png',
};

function slugifyItemName(name: string): string {
    return name
        .replace(/[()]/g, ' ')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_+/g, '_');
}

function getDerivedFilename(rawName?: string): string | undefined {
    const normalizedName = normalizeLookupName(rawName);
    if (!normalizedName) return undefined;

    const aliasFilename = NAME_IMG_ALIASES[normalizedName];
    if (aliasFilename) return aliasFilename;

    const directFilename = `${slugifyItemName(normalizedName)}.png`;
    if (AVAILABLE_ITEM_IMAGES.has(directFilename)) return directFilename;

    return undefined;
}

function getNameOverrideImage(rawName?: string): string | undefined {
    const filename = getDerivedFilename(rawName);
    return filename ? ITEM_BASE + filename : undefined;
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
    if (litAt === undefined) return ITEM_BASE + 'torch_lit.png'; // unlit floor torch
    const elapsed = Date.now() - litAt;
    const TORCH_LIFETIME_MS = 15 * 60 * 1000;
    const TORCH_STATE_MS    =  5 * 60 * 1000;
    let idx: number;
    if      (elapsed >= TORCH_LIFETIME_MS)  idx = 0;
    else if (elapsed >= TORCH_STATE_MS * 2) idx = 1;
    else if (elapsed >= TORCH_STATE_MS)     idx = 2;
    else                                     idx = 3;
    return ITEM_BASE + TORCH_STATE_IMAGES[idx];
}

export function getInventoryItemImage(item: FloorItem): string {
    if (isTorchItem(item)) return ITEM_BASE + 'torch_unlit.png';
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
// Canonical DM1 potion type ids from the extracted game_db.
const POTION_IMG: Record<number, string> = {
      3: 'ven_potion.png',
      6: 'ros_potion.png',
      7: 'ku_potion.png',
      8: 'dane_potion.png',
      9: 'neta_potion.png',
     10: 'bro_potion_antivenin.png',
     11: 'mon_potion.png',
     12: 'ya_potion.png',
     13: 'ee_potion_mana.png',
     14: 'vi_potion.png',
     15: 'water_flask.png',
     19: 'ful_bomb.png',
     20: 'empty_flask.png',
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
    return ITEM_BASE + (filename ?? CATEGORY_FALLBACK[category] ?? 'compass.png');
}

export function getFloorItemImage(item: FloorItem): string {
    const waterState = getWaterContainerState(item);
    if (waterState) {
        if (waterState.kind === 'waterskin') {
            return ITEM_BASE + (waterState.charges > 0 ? 'water_waterskin_full.png' : 'waterskin_empty.png');
        }
        return ITEM_BASE + (waterState.charges > 0 ? 'water_flask.png' : 'empty_flask.png');
    }
    return getItemImage(item.category, item.typeId, item.rawName);
}
