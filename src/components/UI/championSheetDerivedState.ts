import type { Direction } from '../../engine/runtimeTypes';
import type { EquipSlotKey } from '../../types/items';
import type { CardinalDir, ChampionEquipment, FloorItem, GameTile } from '../../types/game';

export type SheetSeverity = 'normal' | 'warning' | 'critical';

export type ChampionPotionBonusState = {
    mana: number;
    strength: number;
    dexterity: number;
    wisdom: number;
    vitality: number;
    antiMagic: number;
    antiFire: number;
    luck: number;
};

export type ChampionSheetVitalsSummary = {
    hp: number;
    stamina: number;
    mana: number;
    food: number;
    water: number;
    foodSeverity: SheetSeverity;
    waterSeverity: SheetSeverity;
    woundText: string;
};

export type ChampionSheetLoadSummary = {
    weight: number;
    maxWeight: number;
    overloaded: boolean;
    loadWarn: boolean;
    loadSeverity: SheetSeverity;
};

export type ChampionSheetStatusTone = 'positive' | 'warning' | 'negative';

export type ChampionSheetStatusBadge = {
    key: string;
    label: string;
    tone: ChampionSheetStatusTone;
};

export type ChampionSheetFrontWallContext<TMechanism> = {
    facingFountain: boolean;
    facingAltar: boolean;
    frontWallItemMechanism: TMechanism | null;
    canDismissChampion: boolean;
};

type PartyChampionLike = {
    id: number;
};

type ChampionCurrentStats = Partial<{
    luck: number;
    strength: number;
    dexterity: number;
    wisdom: number;
    vitality: number;
    antiMagic: number;
    antiFire: number;
}>;

type ChampionSheetChampionLike = {
    health: number;
    stamina: number;
    strength: number;
    dexterity: number;
    wisdom: number;
    vitality: number;
    antiMagic: number;
    antiFire: number;
    luck: number;
};

export function getChampionPotionBonusesForSheet(
    champion: ChampionSheetChampionLike,
    vitals: { currentStats?: ChampionCurrentStats } | undefined,
    activePotionBoosts: Array<{
        championId: number;
        stat: 'strength' | 'dexterity' | 'wisdom' | 'vitality' | 'antiMagic' | 'antiFire';
        amount: number;
        expiresAt: number;
    }>,
    championId: number,
    now = Date.now(),
): ChampionPotionBonusState {
    const timedBonuses = activePotionBoosts.reduce<ChampionPotionBonusState>(
        (sum, boost) => {
            if (boost.championId !== championId || boost.expiresAt <= now) return sum;
            return { ...sum, [boost.stat]: sum[boost.stat] + boost.amount };
        },
        {
            mana: 0,
            strength: 0,
            dexterity: 0,
            wisdom: 0,
            vitality: 0,
            antiMagic: 0,
            antiFire: 0,
            luck: 0,
        },
    );
    const currentStats = vitals?.currentStats;
    if (!currentStats) return timedBonuses;
    return {
        ...timedBonuses,
        strength: timedBonuses.strength + ((currentStats.strength ?? champion.strength) - champion.strength),
        dexterity: timedBonuses.dexterity + ((currentStats.dexterity ?? champion.dexterity) - champion.dexterity),
        wisdom: timedBonuses.wisdom + ((currentStats.wisdom ?? champion.wisdom) - champion.wisdom),
        vitality: timedBonuses.vitality + ((currentStats.vitality ?? champion.vitality) - champion.vitality),
        antiMagic: timedBonuses.antiMagic + ((currentStats.antiMagic ?? champion.antiMagic) - champion.antiMagic),
        antiFire: timedBonuses.antiFire + ((currentStats.antiFire ?? champion.antiFire) - champion.antiFire),
        luck: timedBonuses.luck + ((currentStats.luck ?? champion.luck) - champion.luck),
    };
}

export function findActivePartyChampion<TChampion extends PartyChampionLike>(
    party: TChampion[],
    activePartyMemberId: number | null,
): TChampion | null {
    if (activePartyMemberId === null) return null;
    return party.find((champion) => champion.id === activePartyMemberId) ?? null;
}

export function buildChampionSheetVitalsSummary(args: {
    champion: ChampionSheetChampionLike;
    vitals: {
        hp?: number;
        stamina?: number;
        mana?: number;
        food?: number;
        water?: number;
        wounds?: Partial<Record<'head' | 'torso' | 'rightHand' | 'leftHand' | 'legs' | 'feet', boolean>>;
    } | undefined;
    effectiveMana: number;
    maxFood: number;
    maxWater: number;
    criticalFoodThreshold: number;
    lowFoodThreshold: number;
    criticalWaterThreshold: number;
    lowWaterThreshold: number;
    injuredLegsLabel: string;
    injuredFeetLabel: string;
}): ChampionSheetVitalsSummary {
    const {
        champion,
        criticalFoodThreshold,
        criticalWaterThreshold,
        effectiveMana,
        injuredFeetLabel,
        injuredLegsLabel,
        lowFoodThreshold,
        lowWaterThreshold,
        maxFood,
        maxWater,
        vitals,
    } = args;
    const hp = vitals?.hp ?? champion.health;
    const stamina = vitals?.stamina ?? champion.stamina;
    const mana = vitals?.mana ?? effectiveMana;
    const food = vitals?.food ?? maxFood;
    const water = vitals?.water ?? maxWater;
    const foodSeverity = food <= criticalFoodThreshold ? 'critical' : food <= lowFoodThreshold ? 'warning' : 'normal';
    const waterSeverity = water <= criticalWaterThreshold ? 'critical' : water <= lowWaterThreshold ? 'warning' : 'normal';
    const woundText = [
        vitals?.wounds?.legs ? injuredLegsLabel : null,
        vitals?.wounds?.feet ? injuredFeetLabel : null,
    ].filter(Boolean).join(' · ');

    return {
        hp,
        stamina,
        mana,
        food,
        water,
        foodSeverity,
        waterSeverity,
        woundText,
    };
}

export function buildChampionSheetLoadSummary(args: {
    weight: number;
    maxWeight: number;
}): ChampionSheetLoadSummary {
    const { weight, maxWeight } = args;
    const overloaded = weight > maxWeight;
    const loadWarn = !overloaded && (weight * 8) > (maxWeight * 5);
    return {
        weight,
        maxWeight,
        overloaded,
        loadWarn,
        loadSeverity: overloaded ? 'critical' : loadWarn ? 'warning' : 'normal',
    };
}

export function buildChampionSheetStatusBadges(args: {
    vitals: {
        wounds?: Partial<Record<'head' | 'torso' | 'rightHand' | 'leftHand' | 'legs' | 'feet', boolean>>;
        poisonEntries?: { remaining: number; nextTickIn: number }[];
    } | undefined;
    foodSeverity: SheetSeverity;
    waterSeverity: SheetSeverity;
    loadSummary: ChampionSheetLoadSummary;
    potionBonuses: ChampionPotionBonusState;
    poisonedLabel: string;
    woundedLabel: string;
    hungryLabel: string;
    thirstyLabel: string;
    encumberedLabel: string;
    overloadedLabel: string;
    boostedLabel: string;
}): ChampionSheetStatusBadge[] {
    const statuses: ChampionSheetStatusBadge[] = [];
    const hasWound = Object.values(args.vitals?.wounds ?? {}).some(Boolean);
    const hasPoison = (args.vitals?.poisonEntries?.length ?? 0) > 0;
    const hasBoost = Object.values(args.potionBonuses).some((value) => value > 0);

    if (hasPoison) {
        statuses.push({ key: 'poisoned', label: args.poisonedLabel, tone: 'negative' });
    }
    if (hasWound) {
        statuses.push({ key: 'wounded', label: args.woundedLabel, tone: 'negative' });
    }
    if (args.waterSeverity !== 'normal') {
        statuses.push({
            key: 'thirsty',
            label: args.thirstyLabel,
            tone: args.waterSeverity === 'critical' ? 'negative' : 'warning',
        });
    }
    if (args.foodSeverity !== 'normal') {
        statuses.push({
            key: 'hungry',
            label: args.hungryLabel,
            tone: args.foodSeverity === 'critical' ? 'negative' : 'warning',
        });
    }
    if (args.loadSummary.overloaded) {
        statuses.push({ key: 'overloaded', label: args.overloadedLabel, tone: 'negative' });
    } else if (args.loadSummary.loadWarn) {
        statuses.push({ key: 'encumbered', label: args.encumberedLabel, tone: 'warning' });
    }
    if (hasBoost) {
        statuses.push({ key: 'boosted', label: args.boostedLabel, tone: 'positive' });
    }

    return statuses;
}

export function buildChampionSheetFrontWallContext<TMechanism>(args: {
    level: number;
    position: [number, number];
    direction: Direction;
    firedSensors: Set<string>;
    getTileAt: (level: number, tileX: number, tileY: number) => GameTile | undefined;
    hasEffectiveOriginalWallOverlayAt: (level: number, tileX: number, tileY: number, face: CardinalDir, overlayName: string) => boolean;
    isAltarWallFace: (level: number, tileX: number, tileY: number, face: CardinalDir, getTileAt: (level: number, tileX: number, tileY: number) => GameTile | undefined) => boolean;
    getMechanismsAtFace: (level: number, tileX: number, tileY: number, face: CardinalDir) => TMechanism[];
    isFrontWallMechanism: (mechanism: TMechanism) => boolean;
}): ChampionSheetFrontWallContext<TMechanism> {
    const { direction, firedSensors, getMechanismsAtFace, getTileAt, hasEffectiveOriginalWallOverlayAt, isAltarWallFace, isFrontWallMechanism, level, position } = args;
    const frontTileY = direction === 'NORTH' ? position[0] - 1 : direction === 'SOUTH' ? position[0] + 1 : position[0];
    const frontTileX = direction === 'EAST' ? position[1] + 1 : direction === 'WEST' ? position[1] - 1 : position[1];
    const frontWallFace: CardinalDir = direction === 'NORTH' ? 'South' : direction === 'SOUTH' ? 'North' : direction === 'EAST' ? 'West' : 'East';
    const frontTile = getTileAt(level, frontTileX, frontTileY);
    const isFrontWall = !!frontTile && (frontTile.type === 'Wall' || frontTile.type === 'TrickWall');
    // Fountain interaction is keyed by the authoritative wall-overlay export.
    // Relying only on tile lookup can miss valid cases when a consumer has not
    // resolved the front wall tile yet, especially for random-resolved faces.
    const facingFountain = hasEffectiveOriginalWallOverlayAt(level, frontTileX, frontTileY, frontWallFace, 'Fountain');
    const facingAltar = isFrontWall && isAltarWallFace(level, frontTileX, frontTileY, frontWallFace, getTileAt);
    const frontWallItemMechanism = isFrontWall
        ? getMechanismsAtFace(level, frontTileX, frontTileY, frontWallFace).find((mechanism) => isFrontWallMechanism(mechanism)) ?? null
        : null;

    return {
        facingFountain,
        facingAltar,
        frontWallItemMechanism,
        canDismissChampion: level === 0 && !firedSensors.has('0_64'),
    };
}

export function getFirstEquipTargetSlot(
    item: FloorItem,
    equip: ChampionEquipment,
    getEquippableSlots: (item: FloorItem) => EquipSlotKey[],
): EquipSlotKey | undefined {
    const slots = getEquippableSlots(item);
    return slots.find((slot) => !equip[slot]) ?? slots[0];
}
