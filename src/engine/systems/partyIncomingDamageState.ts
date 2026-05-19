import type { Champion } from '../../types/champion';
import type { ChampionEquipment, FloorItem } from '../../types/game';
import type { EquipmentStatBonuses } from '../../data/equipment';
import type {
    ActivePotionBoost,
    ChampionVitals,
    DamageEvent,
    PartyShield,
    ProjectileEffect,
} from '../runtimeTypes';
import { applyChampionDeathDropsToPartyState } from './partyDeathState';

type PartyDamageState = {
    level: number;
    position: [number, number];
    party: Champion[];
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    floorItems: FloorItem[];
    deadChampions: Record<number, Champion>;
    selectedChampionIndex: number;
    damageEvents: DamageEvent[];
    activeShields: PartyShield[];
    activePotionBoosts: ActivePotionBoost[];
    championCombat?: unknown;
};

type PartyDamageDeps = {
    buildChampionDamageEvent: (
        level: number,
        championId: number,
        damage: number,
        kind?: 'normal' | 'poison',
        sourceName?: string,
    ) => DamageEvent;
    buildDeathDrop: (state: {
        level: number;
        position: [number, number];
        party: Champion[];
        championInventories: Record<number, FloorItem[]>;
        championEquipment: Record<number, ChampionEquipment>;
        floorItems: FloorItem[];
        deadChampions: Record<number, Champion>;
    }, championId: number, nowMs: number) => {
        party: Champion[];
        floorItems: FloorItem[];
        championInventories: Record<number, FloorItem[]>;
        championEquipment: Record<number, ChampionEquipment>;
        deadChampions: Record<number, Champion>;
    };
};

type IncomingAttackResolver = (
    state: Pick<
        PartyDamageState,
        'level'
        | 'position'
        | 'party'
        | 'championInventories'
        | 'championEquipment'
        | 'floorItems'
        | 'deadChampions'
        | 'selectedChampionIndex'
        | 'damageEvents'
        | 'activeShields'
        | 'activePotionBoosts'
        | 'championCombat'
    >,
    champion: Champion,
    currentVitals: ChampionVitals,
    attack: number,
    attackType: string,
    allowedSlots: readonly string[],
    nowMs: number,
) => { damage: number; nextVitals: ChampionVitals };

function finalizePartyDamagePatch(
    state: PartyDamageState,
    championVitals: Record<number, ChampionVitals>,
    nextVitals: Record<number, ChampionVitals>,
    damageEvents: DamageEvent[],
    newlyDead: readonly number[],
    nowMs: number,
    deps: PartyDamageDeps,
): Record<string, unknown> | null {
    if (nextVitals === championVitals && damageEvents === state.damageEvents) return null;

    const patch: Record<string, unknown> = {
        championVitals: nextVitals,
        ...(damageEvents !== state.damageEvents ? { damageEvents } : {}),
    };

    const deathPatch = applyChampionDeathDropsToPartyState(
        state,
        newlyDead,
        nowMs,
        { buildDeathDrop: deps.buildDeathDrop },
    );
    if (deathPatch) {
        Object.assign(patch, deathPatch);
    }

    return patch;
}

export function applyFrontRowWallBumpDamageState(
    state: Pick<
        PartyDamageState,
        'level'
        | 'position'
        | 'party'
        | 'championInventories'
        | 'championEquipment'
        | 'floorItems'
        | 'deadChampions'
        | 'selectedChampionIndex'
        | 'damageEvents'
        | 'activeShields'
        | 'activePotionBoosts'
        | 'championCombat'
    >,
    championVitals: Record<number, ChampionVitals>,
    nowMs: number,
    deps: PartyDamageDeps & { resolveChampionIncomingAttack: IncomingAttackResolver },
): Record<string, unknown> | null {
    const frontChampions = state.party
        .slice(0, 2)
        .filter((champion) => (championVitals[champion.id]?.hp ?? 0) > 0);

    if (frontChampions.length === 0) return null;

    let nextVitals = championVitals;
    let damageEvents = state.damageEvents;
    const newlyDead: number[] = [];

    for (const champion of frontChampions) {
        const current = nextVitals[champion.id];
        if (!current || current.hp <= 0) continue;
        const resolved = deps.resolveChampionIncomingAttack(
            state,
            champion,
            current,
            1,
            'Impact',
            ['torso', 'legs'],
            nowMs,
        );
        const damage = resolved.damage;
        const next = resolved.nextVitals;
        if (next !== current) {
            if (nextVitals === championVitals) nextVitals = { ...championVitals };
            nextVitals[champion.id] = next;
        }
        if (damage <= 0) continue;
        damageEvents = [...damageEvents, deps.buildChampionDamageEvent(state.level, champion.id, damage)];
        if (next.hp === 0) newlyDead.push(champion.id);
    }

    return finalizePartyDamagePatch(
        state,
        championVitals,
        nextVitals,
        damageEvents,
        newlyDead,
        nowMs,
        deps,
    );
}

export function applyPartySpellBacklashDamageState<DamageClass extends string>(
    state: Pick<
        PartyDamageState,
        'level'
        | 'position'
        | 'party'
        | 'championInventories'
        | 'championEquipment'
        | 'floorItems'
        | 'deadChampions'
        | 'selectedChampionIndex'
        | 'damageEvents'
        | 'activeShields'
        | 'activePotionBoosts'
    >,
    championVitals: Record<number, ChampionVitals>,
    effect: Exclude<ProjectileEffect, 'physical'>,
    rawDamage: number,
    nowMs: number,
    sourceName: string | undefined,
    deps: PartyDamageDeps & {
        rollOriginalPartyWideAttack: (rawAttack: number) => number;
        getProjectileDamageClass: (effect: Exclude<ProjectileEffect, 'physical'>) => DamageClass;
        getChampionAdjustedAttackFromResistance: (
            champion: Champion,
            equip: ChampionEquipment,
            adjustedAttack: number,
            damageClass: DamageClass,
            runtimeBonuses: Partial<EquipmentStatBonuses> | undefined,
        ) => number;
        getChampionRuntimeBonuses: (
            champion: Champion,
            vitals: ChampionVitals,
            activePotionBoosts: ActivePotionBoost[],
        ) => Partial<EquipmentStatBonuses> | undefined;
        getActiveShieldDefense: (
            activeShields: PartyShield[],
            nowMs: number,
            kind: 'fire' | 'magic',
            championId: number,
        ) => number;
    },
): Record<string, unknown> | null {
    const livingChampions = state.party.filter((champion) => (championVitals[champion.id]?.hp ?? 0) > 0);
    if (livingChampions.length === 0 || rawDamage <= 0) return null;

    const damageClass = deps.getProjectileDamageClass(effect);
    let nextVitals = championVitals;
    let damageEvents = state.damageEvents;
    const newlyDead: number[] = [];

    for (const champion of livingChampions) {
        const current = nextVitals[champion.id];
        if (!current || current.hp <= 0) continue;

        let adjustedAttack = deps.rollOriginalPartyWideAttack(rawDamage);
        const equip = state.championEquipment[champion.id] ?? {};
        adjustedAttack = deps.getChampionAdjustedAttackFromResistance(
            champion,
            equip,
            adjustedAttack,
            damageClass,
            deps.getChampionRuntimeBonuses(champion, current, state.activePotionBoosts),
        );
        if (damageClass === 'fire') {
            adjustedAttack -= deps.getActiveShieldDefense(state.activeShields, nowMs, 'fire', champion.id);
        } else if (damageClass === 'magic') {
            adjustedAttack -= deps.getActiveShieldDefense(state.activeShields, nowMs, 'magic', champion.id);
        }
        if (adjustedAttack <= 0) continue;

        const damage = Math.max(1, adjustedAttack);
        const next = {
            ...current,
            hp: Math.max(0, current.hp - damage),
        };
        if (next.hp === current.hp) continue;
        if (nextVitals === championVitals) nextVitals = { ...championVitals };
        nextVitals[champion.id] = next;
        damageEvents = [...damageEvents, deps.buildChampionDamageEvent(state.level, champion.id, damage, 'normal', sourceName)];
        if (next.hp === 0) newlyDead.push(champion.id);
    }

    return finalizePartyDamagePatch(
        state,
        championVitals,
        nextVitals,
        damageEvents,
        newlyDead,
        nowMs,
        deps,
    );
}

export function applyPartyWideIncomingAttackState(
    state: Pick<PartyDamageState, keyof PartyDamageState>,
    championVitals: Record<number, ChampionVitals>,
    rawAttack: number,
    attackType: string,
    allowedSlots: readonly string[],
    nowMs: number,
    spread: boolean,
    sourceName: string | undefined,
    deps: PartyDamageDeps & {
        rollOriginalPartyWideAttack: (rawAttack: number) => number;
        resolveChampionIncomingAttack: (
            state: PartyDamageState,
            champion: Champion,
            currentVitals: ChampionVitals,
            attack: number,
            attackType: string,
            allowedSlots: readonly string[],
            nowMs: number,
        ) => { damage: number; nextVitals: ChampionVitals };
    },
): Record<string, unknown> | null {
    const livingChampions = state.party.filter((champion) => (championVitals[champion.id]?.hp ?? 0) > 0);
    if (livingChampions.length === 0 || rawAttack <= 0) return null;

    let nextVitals = championVitals;
    let damageEvents = state.damageEvents;
    const newlyDead: number[] = [];

    for (const champion of livingChampions) {
        const current = nextVitals[champion.id];
        if (!current || current.hp <= 0) continue;

        const resolved = deps.resolveChampionIncomingAttack(
            state,
            champion,
            current,
            spread ? deps.rollOriginalPartyWideAttack(rawAttack) : rawAttack,
            attackType,
            allowedSlots,
            nowMs,
        );
        if (resolved.nextVitals !== current) {
            if (nextVitals === championVitals) nextVitals = { ...championVitals };
            nextVitals[champion.id] = resolved.nextVitals;
        }
        if (resolved.damage <= 0) continue;

        damageEvents = [
            ...damageEvents,
            deps.buildChampionDamageEvent(state.level, champion.id, resolved.damage, 'normal', sourceName),
        ];
        if (resolved.nextVitals.hp === 0) newlyDead.push(champion.id);
    }

    return finalizePartyDamagePatch(
        state,
        championVitals,
        nextVitals,
        damageEvents,
        newlyDead,
        nowMs,
        deps,
    );
}

type RuntimeWallBumpState = Pick<
    PartyDamageState,
    | 'level'
    | 'position'
    | 'party'
    | 'championInventories'
    | 'championEquipment'
    | 'floorItems'
    | 'deadChampions'
> & {
    selectedChampionIndex?: number | null;
    damageEvents?: DamageEvent[];
    activeShields?: PartyShield[];
    activePotionBoosts?: ActivePotionBoost[];
    championCombat?: unknown;
};

type RuntimeIncomingAttackState = Pick<
    PartyDamageState,
    | 'level'
    | 'position'
    | 'party'
    | 'championInventories'
    | 'championEquipment'
    | 'floorItems'
    | 'deadChampions'
    | 'damageEvents'
    | 'activeShields'
    | 'activePotionBoosts'
> & {
    selectedChampionIndex?: number | null;
    championCombat?: unknown;
};

export function applyFrontRowWallBumpDamageRuntimeState(
    state: RuntimeWallBumpState,
    championVitals: Record<number, ChampionVitals>,
    nowMs = Date.now(),
    deps: PartyDamageDeps & { resolveChampionIncomingAttack: IncomingAttackResolver },
): Record<string, unknown> | null {
    return applyFrontRowWallBumpDamageState(
        {
            ...state,
            selectedChampionIndex: state.selectedChampionIndex ?? 0,
            damageEvents: state.damageEvents ?? [],
            activeShields: state.activeShields ?? [],
            activePotionBoosts: state.activePotionBoosts ?? [],
        },
        championVitals,
        nowMs,
        deps,
    );
}

export function applyPartySpellBacklashDamageRuntimeState<DamageClass extends string>(
    state: Pick<
        RuntimeIncomingAttackState,
        | 'level'
        | 'position'
        | 'party'
        | 'championInventories'
        | 'championEquipment'
        | 'floorItems'
        | 'deadChampions'
        | 'selectedChampionIndex'
        | 'damageEvents'
        | 'activeShields'
        | 'activePotionBoosts'
    >,
    championVitals: Record<number, ChampionVitals>,
    effect: Exclude<ProjectileEffect, 'physical'>,
    rawDamage: number,
    nowMs = Date.now(),
    sourceName: string | undefined,
    deps: PartyDamageDeps & {
        rollOriginalPartyWideAttack: (rawAttack: number) => number;
        getProjectileDamageClass: (effect: Exclude<ProjectileEffect, 'physical'>) => DamageClass;
        getChampionAdjustedAttackFromResistance: (
            champion: Champion,
            equip: ChampionEquipment,
            adjustedAttack: number,
            damageClass: DamageClass,
            runtimeBonuses: Partial<EquipmentStatBonuses> | undefined,
        ) => number;
        getChampionRuntimeBonuses: (
            champion: Champion,
            vitals: ChampionVitals,
            activePotionBoosts: ActivePotionBoost[],
        ) => Partial<EquipmentStatBonuses> | undefined;
        getActiveShieldDefense: (
            activeShields: PartyShield[],
            nowMs: number,
            kind: 'fire' | 'magic',
            championId: number,
        ) => number;
    },
): Record<string, unknown> | null {
    return applyPartySpellBacklashDamageState(
        {
            ...state,
            selectedChampionIndex: state.selectedChampionIndex ?? 0,
        },
        championVitals,
        effect,
        rawDamage,
        nowMs,
        sourceName,
        deps,
    );
}

export function applyPartyWideIncomingAttackRuntimeState(
    state: RuntimeIncomingAttackState,
    championVitals: Record<number, ChampionVitals>,
    rawAttack: number,
    attackType: string,
    allowedSlots: readonly string[],
    nowMs = Date.now(),
    spread: boolean,
    sourceName: string | undefined,
    deps: PartyDamageDeps & {
        rollOriginalPartyWideAttack: (rawAttack: number) => number;
        resolveChampionIncomingAttack: (
            state: RuntimeIncomingAttackState,
            champion: Champion,
            currentVitals: ChampionVitals,
            attack: number,
            attackType: string,
            allowedSlots: readonly string[],
            nowMs: number,
        ) => { damage: number; nextVitals: ChampionVitals };
    },
): Record<string, unknown> | null {
    return applyPartyWideIncomingAttackState(
        {
            ...state,
            selectedChampionIndex: state.selectedChampionIndex ?? 0,
        },
        championVitals,
        rawAttack,
        attackType,
        allowedSlots,
        nowMs,
        spread,
        sourceName,
        deps,
    );
}

export function applyPartyFallImpactDamageRuntimeState(
    state: RuntimeIncomingAttackState,
    championVitals: Record<number, ChampionVitals>,
    landingLevel: number,
    landingPosition: [number, number],
    nowMs = Date.now(),
    deps: PartyDamageDeps & {
        rollOriginalPartyWideAttack: (rawAttack: number) => number;
        resolveChampionIncomingAttack: (
            state: RuntimeIncomingAttackState,
            champion: Champion,
            currentVitals: ChampionVitals,
            attack: number,
            attackType: string,
            allowedSlots: readonly string[],
            nowMs: number,
        ) => { damage: number; nextVitals: ChampionVitals };
    },
): Record<string, unknown> | null {
    return applyPartyWideIncomingAttackRuntimeState(
        {
            ...state,
            level: landingLevel,
            position: landingPosition,
        },
        championVitals,
        20,
        'Blunt',
        ['legs', 'feet'],
        nowMs,
        false,
        undefined,
        deps,
    );
}
