// ─── DM1 Rune system ──────────────────────────────────────────────────────────
// 4 families × 6 runes = 24 runes total.
// Source of truth: Old_data/game_db.json (runeSymbols + spells)
//
// Casting rule: power rune FIRST, then 1–3 additional runes.
// mana cost = round(manaBase × manaFactor / 8)
// manaFactor per power rune: LO=8, UM=12, ON=16, EE=20, PAL=24, MON=28

export type RuneFamily = 'power' | 'element' | 'form' | 'alignment';
export type CastSkill  = 'fighter' | 'ninja' | 'priest' | 'wizard';

export interface RuneDef {
    id: string;          // lowercase key, matches public/runes/{id}_on/off.png
    name: string;
    family: RuneFamily;
    level: number;       // 1–6 within family (column in game_db uiPos)
    manaFactor?: number; // power runes only
    hasImage: boolean;
}

// ─── 24 runes ─────────────────────────────────────────────────────────────────
export const RUNES: RuneDef[] = [
    // ── Power (row 0) ──────────────────────────────────────────────────────────
    { id: 'lo',   name: 'Lo',   family: 'power',     level: 1, manaFactor:  8, hasImage: true },
    { id: 'um',   name: 'Um',   family: 'power',     level: 2, manaFactor: 12, hasImage: true },
    { id: 'on',   name: 'On',   family: 'power',     level: 3, manaFactor: 16, hasImage: true },
    { id: 'ee',   name: 'Ee',   family: 'power',     level: 4, manaFactor: 20, hasImage: true },
    { id: 'pal',  name: 'Pal',  family: 'power',     level: 5, manaFactor: 24, hasImage: true },
    { id: 'mon',  name: 'Mon',  family: 'power',     level: 6, manaFactor: 28, hasImage: true },

    // ── Element (row 1) ────────────────────────────────────────────────────────
    { id: 'ya',   name: 'Ya',   family: 'element',   level: 1, hasImage: true },
    { id: 'vi',   name: 'Vi',   family: 'element',   level: 2, hasImage: true },
    { id: 'oh',   name: 'Oh',   family: 'element',   level: 3, hasImage: true },
    { id: 'kath', name: 'Kath', family: 'element',   level: 4, hasImage: true },
    { id: 'ful',  name: 'Ful',  family: 'element',   level: 5, hasImage: true },
    { id: 'des',  name: 'Des',  family: 'element',   level: 6, hasImage: true },

    // ── Form (row 2) ───────────────────────────────────────────────────────────
    { id: 'zo',   name: 'Zo',   family: 'form',      level: 1, hasImage: true },
    { id: 'neta', name: 'Neta', family: 'form',      level: 2, hasImage: true },
    { id: 'ven',  name: 'Ven',  family: 'form',      level: 3, hasImage: true },
    { id: 'ku',   name: 'Ku',   family: 'form',      level: 4, hasImage: true },
    { id: 'ir',   name: 'Ir',   family: 'form',      level: 5, hasImage: true },
    { id: 'bro',  name: 'Bro',  family: 'form',      level: 6, hasImage: true },

    // ── Alignment (row 3) ──────────────────────────────────────────────────────
    { id: 'gor',  name: 'Gor',  family: 'alignment', level: 1, hasImage: true },
    { id: 'sar',  name: 'Sar',  family: 'alignment', level: 2, hasImage: true },
    { id: 'ros',  name: 'Ros',  family: 'alignment', level: 3, hasImage: true },
    { id: 'ew',   name: 'Ew',   family: 'alignment', level: 4, hasImage: true },
    { id: 'ra',   name: 'Ra',   family: 'alignment', level: 5, hasImage: true },
    { id: 'dain', name: 'Dain', family: 'alignment', level: 6, hasImage: true },
];

export const RUNES_BY_ID: Record<string, RuneDef> =
    Object.fromEntries(RUNES.map(r => [r.id, r]));

export const RUNES_BY_FAMILY: Record<RuneFamily, RuneDef[]> = {
    power:     RUNES.filter(r => r.family === 'power'),
    element:   RUNES.filter(r => r.family === 'element'),
    form:      RUNES.filter(r => r.family === 'form'),
    alignment: RUNES.filter(r => r.family === 'alignment'),
};

// ─── Spell effects ────────────────────────────────────────────────────────────
export type SpellEffect =
    | 'light'        | 'heal'        | 'fireball'   | 'lightning'
    | 'poison_bolt'  | 'poison_cloud'| 'shield'     | 'fire_shield'| 'open'
    | 'darkness'     | 'invisibility'| 'see_through_walls'| 'plasma'
    | 'reveal_hidden'| 'disrupt_nonmaterial'
    | 'potion'       | 'footprints'  | 'unknown';

export interface SpellDef {
    runes: string[];       // power rune first, then spell runes
    name: string;
    effect: SpellEffect;
    manaCost: number;      // = round(manaBase × powerRune.manaFactor / 8)
    manaBase: number;      // base cost from game_db (power-independent)
    castSkill: CastSkill;  // skill that governs this spell
    description: string;
    confirmed?: boolean;   // sourced from in-game text
}

// ─── Build 6 power variants from a spell definition ──────────────────────────
const POWERS      = ['lo', 'um', 'on', 'ee', 'pal', 'mon'] as const;
const MANA_FACTORS = [8, 12, 16, 20, 24, 28] as const; // matching LO→MON

function variants(
    manaBase: number,
    castSkill: CastSkill,
    spellRunes: string[],
    names: [string, string, string, string, string, string],
    effect: SpellEffect,
    descriptions: [string, string, string, string, string, string],
    confirmed = false,
): SpellDef[] {
    return POWERS.map((p, i) => ({
        runes: [p, ...spellRunes],
        name: names[i],
        effect,
        manaCost: Math.round(manaBase * MANA_FACTORS[i] / 8),
        manaBase,
        castSkill,
        description: descriptions[i],
        confirmed,
    }));
}

// ─── Known spells (power rune always first) ───────────────────────────────────
export const SPELLS: SpellDef[] = [

    // ── Torch : Power + FUL ───────────────────────────────────────────────────
    // Confirmed: "INVOKE FUL FOR A MAGIC TORCH"
    ...variants(1, 'wizard', ['ful'],
        ['Torche (faible)', 'Torche', 'Torche (forte)', 'Torche (vive)', 'Torche (intense)', 'Torche Suprême'],
        'light',
        ['Crée une faible lumière.', 'Crée une source de lumière.', 'Crée une lumière puissante.',
         'Crée une lumière très vive.', 'Lumière intense.', 'Lumière aveuglante.'],
        true),

    // ── Light : Power + OH + IR + RA ─────────────────────────────────────────
    // Confirmed: "LIGHT / OH IR RA"
    ...variants(3, 'wizard', ['oh', 'ir', 'ra'],
        ['Lumière (faible)', 'Lumière', 'Lumière (forte)', 'Lumière (vive)', 'Lumière (intense)', 'Lumière Suprême'],
        'light',
        ['Crée une lumière soutenue.', 'Lumière puissante et durable.', 'Lumière puissante.',
         'Lumière très puissante.', 'Lumière intense et durable.', 'Lumière maximale.'],
        true),

    // ── Fireball : Power + FUL + IR ──────────────────────────────────────────
    // Confirmed: "FIREBALL / FUL IR"
    ...variants(4, 'wizard', ['ful', 'ir'],
        ['Boule de Feu (faible)', 'Boule de Feu', 'Boule de Feu (forte)', 'Grand Feu', 'Inferno', 'Inferno Suprême'],
        'fireball',
        ['Petite boule de feu.', 'Lance une boule de feu.', 'Boule de feu puissante.',
         'Boule de feu dévastatrice.', 'Explosion de feu massive.', 'Puissance de feu maximale.'],
        true),

    // ── Fire Shield : Power + FUL + BRO + NETA ───────────────────────────────
    // Confirmed: "FIRE SHIELD / FUL BRO NETA"
    ...variants(3, 'wizard', ['ful', 'bro', 'neta'],
        ['Bouclier de Feu (faible)', 'Bouclier de Feu', 'Bouclier de Feu (fort)',
         'Bouclier de Feu (vif)', 'Bouclier de Feu (intense)', 'Bouclier de Feu Suprême'],
        'fire_shield',
        ['Légère protection contre le feu.', 'Bouclier de feu.', 'Bouclier de feu puissant.',
         'Bouclier de feu très puissant.', 'Bouclier de feu intense.', 'Protection de feu maximale.'],
        true),

    // ── Lightning Bolt : Power + OH + KATH + RA ──────────────────────────────
    // Confirmed: "LIGHTNING BOLT / OH KATH RA"
    ...variants(5, 'wizard', ['oh', 'kath', 'ra'],
        ['Éclair (faible)', 'Éclair', 'Éclair Fort', 'Grand Éclair', 'Foudre', 'Foudre Suprême'],
        'lightning',
        ['Petit éclair.', 'Frappe d\'un éclair.', 'Éclair puissant.',
         'Éclair dévastateur.', 'Foudre dévastatrice.', 'Puissance électrique maximale.'],
        true),

    // ── Poison Cloud : Power + OH + VEN ──────────────────────────────────────
    // Confirmed: "OH VEN CAST A CLOUD OF POISON"
    ...variants(3, 'wizard', ['oh', 'ven'],
        ['Nuage Toxique (faible)', 'Nuage Toxique', 'Nuage Toxique (fort)',
         'Grand Nuage Toxique', 'Brume Mortelle', 'Brume Mortelle Suprême'],
        'poison_cloud',
        ['Nuage de poison léger.', 'Nuage de poison.', 'Nuage de poison puissant.',
         'Nuage de poison dévastateur.', 'Brume mortelle.', 'Poison maximal.'],
        true),

    // ── Poison Bolt : Power + DES + VEN ──────────────────────────────────────
    // Confirmed: "DES VEN WILL CONJURE A POISON SPELL"
    ...variants(3, 'wizard', ['des', 'ven'],
        ['Dard Toxique (faible)', 'Dard Toxique', 'Dard Toxique (fort)',
         'Grand Dard Toxique', 'Flèche Mortelle', 'Flèche Mortelle Suprême'],
        'poison_bolt',
        ['Projectile de poison léger.', 'Projectile de poison.', 'Projectile de poison puissant.',
         'Projectile dévastateur.', 'Flèche empoisonnée mortelle.', 'Poison maximal.'],
        true),

    // ── Magic Shield : Power + YA + IR ───────────────────────────────────────
    ...variants(2, 'wizard', ['des', 'ew'],
        ['Affaiblit l\'immateriel (faible)', 'Affaiblit l\'immateriel', 'Affaiblit l\'immateriel (fort)',
         'Grand Affaiblissement', 'Disruption spectrale', 'Disruption absolue'],
        'disrupt_nonmaterial',
        ['Projectile faible contre les etres non materiels.', 'Projectile magique contre les etres non materiels.',
         'Projectile puissant contre les etres non materiels.', 'Affaiblit fortement les creatures immaterielles.',
         'Disruption spectrale majeure.', 'Disruption maximale des etres non materiels.'],
        true),

    // Confirmed: "MAGIC SHIELD / YA IR"
    ...variants(3, 'fighter', ['ya', 'ir'],
        ['Armure Magique (faible)', 'Armure Magique', 'Armure Magique (forte)',
         'Grande Armure Magique', 'Armure Suprême', 'Armure Absolue'],
        'shield',
        ['Légère protection magique.', 'Protection magique.', 'Protection magique puissante.',
         'Forte protection magique.', 'Protection quasi absolue.', 'Protection maximale.'],
        true),

    // ── Darkness : Power + DES + IR + SAR ────────────────────────────────────
    ...variants(2, 'wizard', ['des', 'ir', 'sar'],
        ['Obscurité (faible)', 'Obscurité', 'Obscurité (forte)',
         'Grande Obscurité', 'Ténèbres', 'Ténèbres Absolues'],
        'darkness',
        ['Éteint les sources de lumière proches.', 'Éteint les sources de lumière.',
         'Plonge la zone dans l\'obscurité.', 'Grande zone d\'obscurité.',
         'Ténèbres profondes.', 'Obscurité absolue.'],
        true),

    // ── Invisibility : Power + OH + EW + SAR ─────────────────────────────────
    // Confirmed: "INVISIBILITY / OH EW SAR"
    ...variants(5, 'wizard', ['oh', 'ew', 'sar'],
        ['Invisibilité (faible)', 'Invisibilité', 'Invisibilité (forte)',
         'Grande Invisibilité', 'Invisibilité Totale', 'Invisibilité Absolue'],
        'invisibility',
        ['Rend le groupe légèrement invisible.', 'Rend le groupe invisible.',
         'Invisibilité prolongée.', 'Invisibilité puissante.',
         'Invisibilité totale.', 'Invisibilité absolue.'],
        true),

    // ── Magic Vision : Power + OH + EW + RA ──────────────────────────────────
    // Confirmed: "OH EW RA BESTOWS MAGIC VISION"
    ...variants(4, 'wizard', ['oh', 'ew', 'ra'],
        ['Vision Magique (faible)', 'Vision Magique', 'Vision Magique (forte)',
         'Grande Vision Magique', 'Vision Suprême', 'Vision Absolue'],
        'see_through_walls',
        ['Révèle légèrement les objets cachés.', 'Révèle les objets invisibles et portes secrètes.',
         'Vision magique puissante.', 'Grande vision magique.',
         'Vision suprême.', 'Vision absolue.'],
        true),

    // ── Open Door : Power + ZO ────────────────────────────────────────────────
    ...variants(4, 'priest', ['oh', 'gor', 'ros'],
        ['Revelation (faible)', 'Revelation', 'Revelation (forte)',
         'Grande Revelation', 'Revelation Supreme', 'Revelation Absolue'],
        'reveal_hidden',
        ['Fait luire brievement les elements caches.', 'Fait apparaitre les faux murs, dalles et fosses cachees.',
         'Revelation prolongee des elements caches.', 'Grande revelation de l\'architecture cachee.',
         'Revele durablement les elements caches.', 'Revele au maximum les pieges et passages caches.'],
        true),

    // Confirmed: "SOME DOORS CAN BE OPENED WITH A ZO SPELL"
    ...variants(2, 'priest', ['zo'],
        ['Ouvre-Serrure (faible)', 'Ouvre-Serrure', 'Ouvre-Serrure (fort)',
         'Grand Ouvre-Serrure', 'Maître Crocheteur', 'Passe-Muraille'],
        'open',
        ['Ouvre les serrures simples.', 'Ouvre portes et serrures.',
         'Ouvre les serrures solides.', 'Ouvre les serrures magiques.',
         'Ouvre n\'importe quelle serrure.', 'Ouvre toutes les portes et barrières.'],
        true),

    // ── Heal (minor) : Power + OH + BRO ──────────────────────────────────────
    ...variants(3, 'priest', ['oh', 'bro'],
        ['Faible Soin', 'Soin', 'Soin Moyen', 'Grand Soin', 'Soin Supérieur', 'Soin Suprême'],
        'heal',
        ['Restaure quelques points de vie.', 'Restaure des points de vie.',
         'Restaure beaucoup de points de vie.', 'Restaure énormément de points de vie.',
         'Soin quasi complet.', 'Restaure tous les points de vie.']),

    // ── Heal (major) : Power + OH + BRO + RA ─────────────────────────────────
    ...variants(5, 'priest', ['oh', 'bro', 'ra'],
        ['Soin Majeur (faible)', 'Soin Majeur', 'Soin Majeur (fort)',
         'Grand Soin Majeur', 'Résurrection Partielle', 'Soin Absolu'],
        'heal',
        ['Restaure modérément les blessures.', 'Restaure les blessures modérées.',
         'Soin puissant.', 'Soin très puissant.',
         'Restaure presque toutes les blessures.', 'Restaure toutes les blessures.']),

    // ── Potion de Santé : Power + VI + BRO + RA ──────────────────────────────
    // Confirmed: "CASTING VI INTO A FLASK CREATES A SERUM THAT HEALS WOUNDS"
    ...variants(4, 'priest', ['vi', 'bro', 'ra'],
        ['Potion de Soin (faible)', 'Potion de Soin', 'Potion de Soin (forte)',
         'Grande Potion de Soin', 'Potion Supérieure', 'Élixir de Vie'],
        'potion',
        ['Crée une petite potion de soin.', 'Crée une potion de soin.',
         'Crée une potion de soin puissante.', 'Crée une grande potion de soin.',
         'Crée une potion supérieure.', 'Crée un élixir de vie.'],
        true),

    // ── Antidote : Power + VI + BRO ──────────────────────────────────────────
    // Confirmed: "CASTING VI BRO INTO A FLASK CREATES A SERUM FOR CURING POISON"
    ...variants(3, 'priest', ['vi', 'bro'],
        ['Antidote (faible)', 'Antidote', 'Antidote (fort)',
         'Grand Antidote', 'Antidote Suprême', 'Antidote Absolu'],
        'potion',
        ['Crée un faible antidote.', 'Crée un antidote contre le poison.',
         'Crée un antidote puissant.', 'Crée un grand antidote.',
         'Crée un antidote suprême.', 'Crée un antidote absolu.'],
        true),

    // ── Potion d'Endurance : Power + YA ──────────────────────────────────────
    // Confirmed: "YA WILL CREATE A STAMINA POTION"
    ...variants(2, 'fighter', ['ya'],
        ['Potion d\'Endurance (faible)', 'Potion d\'Endurance', 'Potion d\'Endurance (forte)',
         'Grande Potion d\'Endurance', 'Potion Suprême d\'Endurance', 'Élixir d\'Endurance'],
        'potion',
        ['Crée une petite potion d\'endurance.', 'Crée une potion d\'endurance.',
         'Crée une potion d\'endurance puissante.', 'Crée une grande potion d\'endurance.',
         'Crée une potion suprême d\'endurance.', 'Crée un élixir d\'endurance.'],
        true),

    // ── Potion de Bouclier : Power + YA + BRO ────────────────────────────────
    // Confirmed: "YA BRO CREATES A MAGICAL SHIELD POTION"
    ...variants(3, 'fighter', ['ya', 'bro'],
        ['Potion de Bouclier (faible)', 'Potion de Bouclier', 'Potion de Bouclier (forte)',
         'Grande Potion de Bouclier', 'Potion Suprême de Bouclier', 'Élixir de Bouclier'],
        'potion',
        ['Crée une petite potion de bouclier.', 'Crée une potion de bouclier magique.',
         'Crée une potion de bouclier puissante.', 'Crée une grande potion de bouclier.',
         'Crée une potion suprême de bouclier.', 'Crée un élixir de bouclier.'],
        true),

    // ── Potion de Mana : Power + ZO + BRO + RA ───────────────────────────────
    // Confirmed: "ZO BRO RA CREATES A PURE MANA POTION"
    ...variants(4, 'wizard', ['zo', 'bro', 'ra'],
        ['Potion de Mana (faible)', 'Potion de Mana', 'Potion de Mana (forte)',
         'Grande Potion de Mana', 'Potion Suprême de Mana', 'Élixir de Mana'],
        'potion',
        ['Crée une petite potion de mana.', 'Crée une potion de mana.',
         'Crée une potion de mana puissante.', 'Crée une grande potion de mana.',
         'Crée une potion suprême de mana.', 'Crée un élixir de mana.'],
        true),

    // ── Traces Magiques : Power + YA + BRO + ROS ─────────────────────────────
    // Confirmed: "YA BRO ROS LEAVES A TRAIL OF MAGIC FOOTPRINTS"
    ...variants(2, 'priest', ['ya', 'bro', 'ros'],
        ['Traces Magiques (faible)', 'Traces Magiques', 'Traces Magiques (fortes)',
         'Grandes Traces Magiques', 'Traces Suprêmes', 'Traces Absolues'],
        'footprints',
        ['Laisse de légères empreintes lumineuses.', 'Laisse des empreintes magiques pour marquer le chemin.',
         'Empreintes magiques durables.', 'Grandes empreintes magiques.',
         'Empreintes suprêmes.', 'Empreintes absolues.'],
        true),

    // ── Zokathra : Power + ZO + KATH + RA ────────────────────────────────────
    // Confirmed: "ZOKATHRA MIGHT CREATE A PLASMA THAT COULD BURN THROUGH THE AMALGAM"
    ...variants(6, 'wizard', ['zo', 'kath', 'ra'],
        ['Zokathra (faible)', 'Zokathra', 'Zokathra (fort)',
         'Grand Zokathra', 'Zokathra Suprême', 'Plasma Absolu'],
        'plasma',
        ['Crée un faible plasma magique.', 'Crée un plasma pouvant dissoudre certaines barrières.',
         'Plasma magique puissant.', 'Grand plasma magique.',
         'Plasma suprême.', 'Plasma absolu.'],
        true),
];

// ─── Lookup ───────────────────────────────────────────────────────────────────
const SPELL_MAP: Map<string, SpellDef> = new Map(
    SPELLS.map(s => [s.runes.join(','), s])
);

/** Find a matching spell for a given rune sequence (power rune first). */
export function findSpell(runeIds: string[]): SpellDef | null {
    return SPELL_MAP.get(runeIds.join(',')) ?? null;
}

/** Get the spell-casting skill level for a champion's skills object. */
export function getSkillLevel(
    skills: Record<CastSkill, [number, number, number, number]>,
    skill: CastSkill,
): number {
    const s = skills[skill];
    // skill array = [sub1_level, sub1_xp, sub2_level, sub2_xp]
    return Math.max(s[0], s[2]);
}
