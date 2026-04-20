import type { Champion } from '../../types/champion';
import type { ChampionEquipment, FloorItem } from '../../types/game';
import type {
    ActivePoisonCloud,
    ActivePotionBoost,
    ChampionCombat,
    ChampionVitals,
    DamageEvent,
    PartyShield,
    Projectile,
    SpellVisualEvent,
} from '../runtimeTypes';
import { buildProjectileDroppedItem } from './projectileDroppedItem';

type ProjectilePartyImpact = {
    damage: number;
    attackType: string;
    poisonAttack: number;
};

type DeathDropPatch = {
    party: Champion[];
    floorItems: FloorItem[];
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    deadChampions: Record<number, Champion>;
};

type PartyWidePatch = {
    party?: Champion[];
    championVitals?: Record<number, ChampionVitals>;
    championInventories?: Record<number, FloorItem[]>;
    championEquipment?: Record<number, ChampionEquipment>;
    floorItems?: FloorItem[];
    deadChampions?: Record<number, Champion>;
    selectedChampionIndex?: number;
    damageEvents?: DamageEvent[];
};

type DirectIncomingResolution = {
    damage: number;
    nextVitals: ChampionVitals;
};

type ProjectilePartyHitState = {
    level: number;
    position: [number, number];
    party: Champion[];
    championVitals: Record<number, ChampionVitals>;
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    floorItems: FloorItem[];
    deadChampions: Record<number, Champion>;
    selectedChampionIndex: number;
    damageEvents: DamageEvent[];
    spellVisualEvents: SpellVisualEvent[];
    activePoisonClouds: ActivePoisonCloud[];
    activeShields: PartyShield[];
    activePotionBoosts: ActivePotionBoost[];
    championCombat: Record<number, ChampionCombat>;
    lastCreatureAttackGameTick: number;
};

type ProjectilePartyHitDeps = {
    resolveProjectileImpact: (projectile: Projectile) => ProjectilePartyImpact;
    resolveChampionIncomingAttack: (
        state: {
            championEquipment: Record<number, ChampionEquipment>;
            activePotionBoosts: ActivePotionBoost[];
            activeShields: PartyShield[];
        },
        champion: Champion,
        currentVitals: ChampionVitals,
        rawAttack: number,
        attackType: string,
        now: number,
    ) => DirectIncomingResolution;
    buildChampionDamageEvent: (level: number, championId: number, amount: number) => DamageEvent;
    applyPoisonCharacter: (vitals: ChampionVitals, poisonAttack: number) => ChampionVitals;
    randomInt: (max: number) => number;
    buildDeathDrop: (
        state: {
            level: number;
            position: [number, number];
            party: Champion[];
            championInventories: Record<number, FloorItem[]>;
            championEquipment: Record<number, ChampionEquipment>;
            floorItems: FloorItem[];
            deadChampions: Record<number, Champion>;
        },
        championId: number,
        now: number,
    ) => DeathDropPatch;
    applyPartySpellBacklashDamage: (
        state: {
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
        },
        championVitals: Record<number, ChampionVitals>,
        effect: 'fireball' | 'lightning' | 'poison_cloud',
        rawDamage: number,
        now: number,
    ) => PartyWidePatch | null;
    applyPartyWideIncomingAttack: (
        state: {
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
            championCombat: Record<number, ChampionCombat>;
        },
        championVitals: Record<number, ChampionVitals>,
        attack: number,
        now: number,
    ) => PartyWidePatch | null;
    rollExplosionBurstAttack: (effect: 'fireball' | 'lightning' | 'poison_cloud', attack: number) => number;
    buildActivePoisonCloud: (
        level: number,
        x: number,
        y: number,
        attack: number,
        currentGameTick: number,
        visualScale: number,
    ) => ActivePoisonCloud;
    buildDroppedItem: (item: FloorItem, level: number, x: number, y: number) => FloorItem;
    getThrownExplosionVisualScale: (attack?: number) => number;
    gridSize: number;
};

export type ProjectilePartyHitResult = {
    party: Champion[];
    championVitals: Record<number, ChampionVitals>;
    championInventories: Record<number, FloorItem[]>;
    championEquipment: Record<number, ChampionEquipment>;
    floorItems: FloorItem[];
    deadChampions: Record<number, Champion>;
    selectedChampionIndex: number;
    damageEvents: DamageEvent[];
    spellVisualEvents: SpellVisualEvent[];
    activePoisonClouds: ActivePoisonCloud[];
};

export function applyProjectilePartyHit(
    projectile: Projectile,
    projectileLevel: number,
    x: number,
    y: number,
    currentGameTick: number,
    now: number,
    state: ProjectilePartyHitState,
    deps: ProjectilePartyHitDeps,
): ProjectilePartyHitResult {
    let party = state.party;
    let championVitals = state.championVitals;
    let championInventories = state.championInventories;
    let championEquipment = state.championEquipment;
    let floorItems = state.floorItems;
    let deadChampions = state.deadChampions;
    let selectedChampionIndex = state.selectedChampionIndex;
    let damageEvents = state.damageEvents;
    let spellVisualEvents = state.spellVisualEvents;
    let activePoisonClouds = state.activePoisonClouds;

    const impact = deps.resolveProjectileImpact(projectile);
    const targetChampion = party.find((champion) => champion.id === projectile.targetChampionId)
        ?? party.find((champion) => (championVitals[champion.id]?.hp ?? 0) > 0);

    if (targetChampion) {
        const currentVitals = championVitals[targetChampion.id];
        if (currentVitals && currentVitals.hp > 0 && impact.damage > 0) {
            let targetChampionDropped = false;
            const resolved = deps.resolveChampionIncomingAttack(
                {
                    championEquipment,
                    activePotionBoosts: state.activePotionBoosts,
                    activeShields: state.activeShields,
                },
                targetChampion,
                currentVitals,
                impact.damage,
                impact.attackType,
                now,
            );
            if (resolved.nextVitals !== currentVitals) {
                championVitals = {
                    ...championVitals,
                    [targetChampion.id]: resolved.nextVitals,
                };
            }
            if (resolved.damage > 0) {
                damageEvents = [
                    ...damageEvents,
                    deps.buildChampionDamageEvent(projectileLevel, targetChampion.id, resolved.damage),
                ];
                if (impact.poisonAttack > 0 && resolved.nextVitals.hp > 0 && deps.randomInt(2) !== 0) {
                    championVitals[targetChampion.id] = deps.applyPoisonCharacter(
                        championVitals[targetChampion.id]!,
                        impact.poisonAttack,
                    );
                    if ((championVitals[targetChampion.id]?.hp ?? 0) === 0) {
                        targetChampionDropped = true;
                        const partial = deps.buildDeathDrop(
                            {
                                level: state.level,
                                position: state.position,
                                party,
                                championInventories,
                                championEquipment,
                                floorItems,
                                deadChampions,
                            },
                            targetChampion.id,
                            now,
                        );
                        party = partial.party;
                        floorItems = partial.floorItems;
                        championInventories = partial.championInventories;
                        championEquipment = partial.championEquipment;
                        deadChampions = partial.deadChampions;
                        selectedChampionIndex = party.length > 0 ? Math.min(selectedChampionIndex, party.length - 1) : 0;
                    }
                }
                if (!targetChampionDropped && championVitals[targetChampion.id]?.hp === 0) {
                    const partial = deps.buildDeathDrop(
                        {
                            level: state.level,
                            position: state.position,
                            party,
                            championInventories,
                            championEquipment,
                            floorItems,
                            deadChampions,
                        },
                        targetChampion.id,
                        now,
                    );
                    party = partial.party;
                    floorItems = partial.floorItems;
                    championInventories = partial.championInventories;
                    championEquipment = partial.championEquipment;
                    deadChampions = partial.deadChampions;
                    selectedChampionIndex = party.length > 0 ? Math.min(selectedChampionIndex, party.length - 1) : 0;
                }
            }
        }
    }

    if (projectile.effect === 'fireball' || projectile.effect === 'lightning') {
        const splash = deps.applyPartySpellBacklashDamage(
            {
                level: state.level,
                position: state.position,
                party,
                championInventories,
                championEquipment,
                floorItems,
                deadChampions,
                selectedChampionIndex,
                damageEvents,
                activeShields: state.activeShields,
                activePotionBoosts: state.activePotionBoosts,
            },
            championVitals,
            projectile.effect,
            deps.rollExplosionBurstAttack(projectile.effect, Math.max(1, Math.round(projectile.remainingRange ?? 0))),
            now,
        );
        if (splash) {
            party = splash.party ?? party;
            championVitals = splash.championVitals ?? championVitals;
            championInventories = splash.championInventories ?? championInventories;
            championEquipment = splash.championEquipment ?? championEquipment;
            floorItems = splash.floorItems ?? floorItems;
            deadChampions = splash.deadChampions ?? deadChampions;
            selectedChampionIndex = splash.selectedChampionIndex ?? selectedChampionIndex;
            damageEvents = splash.damageEvents ?? damageEvents;
        }
    } else if (projectile.effect === 'poison_cloud') {
        const splash = deps.applyPartyWideIncomingAttack(
            {
                level: state.level,
                position: state.position,
                party,
                championInventories,
                championEquipment,
                floorItems,
                deadChampions,
                selectedChampionIndex,
                damageEvents,
                activeShields: state.activeShields,
                activePotionBoosts: state.activePotionBoosts,
                championCombat: state.championCombat,
            },
            championVitals,
            deps.rollExplosionBurstAttack('poison_cloud', Math.max(1, Math.round(projectile.remainingRange ?? 0))),
            now,
        );
        if (splash) {
            party = splash.party ?? party;
            championVitals = splash.championVitals ?? championVitals;
            championInventories = splash.championInventories ?? championInventories;
            championEquipment = splash.championEquipment ?? championEquipment;
            floorItems = splash.floorItems ?? floorItems;
            deadChampions = splash.deadChampions ?? deadChampions;
            selectedChampionIndex = splash.selectedChampionIndex ?? selectedChampionIndex;
            damageEvents = splash.damageEvents ?? damageEvents;
        }
        if (activePoisonClouds === state.activePoisonClouds) activePoisonClouds = [...activePoisonClouds];
        activePoisonClouds.push(
            deps.buildActivePoisonCloud(
                projectileLevel,
                x,
                y,
                Math.max(1, projectile.remainingRange ?? 0),
                currentGameTick,
                (projectile.visualScale ?? 1) * 1.08,
            ),
        );
    }

    const partyImpactEffect = projectile.effect === 'physical' ? projectile.explosionOnImpact : projectile.effect;
    if (partyImpactEffect) {
        spellVisualEvents = [
            ...spellVisualEvents,
            {
                id: `spellimpact_party_${now}_${Math.random().toString(36).slice(2)}`,
                level: projectileLevel,
                x,
                y,
                height: deps.gridSize * 0.08,
                effect: partyImpactEffect,
                visualScale: projectile.effect === 'physical'
                    ? deps.getThrownExplosionVisualScale(projectile.explosionAttack)
                    : projectile.visualScale,
                ts: now,
                kind: 'creature',
            },
        ];
    }

    if (projectile.effect === 'physical' && projectile.physicalItem && !projectile.explosionOnImpact) {
        if (floorItems === state.floorItems) floorItems = [...floorItems];
        floorItems.push(
            buildProjectileDroppedItem(
                projectile.physicalItem,
                projectileLevel,
                x,
                y,
                projectile.direction,
                deps.buildDroppedItem,
            ),
        );
    }

    return {
        party,
        championVitals,
        championInventories,
        championEquipment,
        floorItems,
        deadChampions,
        selectedChampionIndex,
        damageEvents,
        spellVisualEvents,
        activePoisonClouds,
    };
}
