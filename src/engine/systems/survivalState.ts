import type { Champion } from '../../types/champion';
import type { ChampionEquipment } from '../../types/game';
import type { ActivePotionBoost, ChampionTemporaryXP, ChampionVitals, DamageEvent } from '../runtimeTypes';
import type { ChampionXP, SkillKey } from '../../data/skillProgression';

type SurvivalState = {
    party: Champion[];
    championVitals: Record<number, ChampionVitals>;
    championEquipment: Record<number, ChampionEquipment>;
    championXP: Record<number, ChampionXP>;
    championTemporaryXP: Record<number, ChampionTemporaryXP>;
    level?: number;
    damageEvents?: DamageEvent[];
    elapsedGameTimeTicks: number;
    lastSurvivalEffectGameTick: number;
    freezeLifeRemainingTicks: number;
    lastPartyMoveGameTick: number;
    activePotionBoosts: ActivePotionBoost[];
};

type EffectiveStats = {
    health: number;
    stamina: number;
    mana: number;
    wisdom: number;
    vitality: number;
};

type SurvivalDeps = {
    sleepSurvivalIntervalTicks: number;
    awakeSurvivalIntervalTicks: number;
    originalTimerTickSeconds: number;
    poisonTickIntervalSec: number;
    foodDrainScale: number;
    waterDrainScale: number;
    maxFood: number;
    maxWater: number;
    sleepStatRelaxIntervalMask: number;
    awakeStatRelaxIntervalMask: number;
    normalizeChampionVitalsForChampion: (champion: Champion, vitals: ChampionVitals) => ChampionVitals;
    getEffectiveChampionStatsRuntime: (
        champion: Champion,
        equip: ChampionEquipment | undefined,
        activePotionBoosts: ActivePotionBoost[],
        currentVitals: ChampionVitals | undefined,
    ) => EffectiveStats;
    getChampionSkillLevelFromXP: (
        championXP: ChampionXP | undefined,
        temporaryXP: ChampionTemporaryXP | undefined,
        skillKey: SkillKey,
        options?: { bonusLevels?: number },
    ) => number;
    getEquipmentSkillLevelModifier: (skillKey: 'wizard' | 'priest', equip: ChampionEquipment | undefined) => number;
    normalizeChampionTemporaryXP: (xp: ChampionTemporaryXP | undefined) => ChampionTemporaryXP;
    computeOriginalTimeCriteria: (gameTimeTicks: number) => number;
    applyChampionStaminaDeltaOriginal: (
        vitals: ChampionVitals,
        maxStamina: number,
        delta: number,
    ) => ChampionVitals;
    applyLimits: (min: number, value: number, max: number) => number;
    clampFoodWater: (value: number, max: number) => number;
    getChampionStatRelaxTargets: (
        champion: Champion,
        equip: ChampionEquipment | undefined,
        activePotionBoosts: ActivePotionBoost[],
    ) => ChampionVitals['currentStats'];
    relaxChampionCurrentStatsTowardMaximum: (
        currentStats: ChampionVitals['currentStats'],
        targets: ChampionVitals['currentStats'],
    ) => ChampionVitals['currentStats'];
};

export type AdvanceSurvivalTimeResult = {
    championVitals: Record<number, ChampionVitals>;
    championTemporaryXP: Record<number, ChampionTemporaryXP>;
    damageEvents?: DamageEvent[];
    elapsedGameTimeTicks: number;
    lastSurvivalEffectGameTick: number;
    freezeLifeRemainingTicks: number;
    advancedMs: number;
};

function buildPoisonDamageEvent(
    level: number,
    championId: number,
    amount: number,
): DamageEvent {
    return {
        id: `champ_poison_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        level,
        target: 'champion',
        championId,
        amount,
        kind: 'poison',
        ts: Date.now(),
    };
}

export function advanceSurvivalTimeState(
    state: SurvivalState,
    stepCount: number,
    deps: SurvivalDeps,
    options?: { sleeping?: boolean },
): AdvanceSurvivalTimeResult {
    let elapsedGameTimeTicks = state.elapsedGameTimeTicks;
    let lastSurvivalEffectGameTick = state.lastSurvivalEffectGameTick;
    let freezeLifeRemainingTicks = state.freezeLifeRemainingTicks;
    const championVitals: Record<number, ChampionVitals> = { ...state.championVitals };
    let championTemporaryXP: Record<number, ChampionTemporaryXP> = { ...state.championTemporaryXP };
    let damageEvents = state.damageEvents;
    const sleeping = options?.sleeping ?? false;
    const survivalIntervalTicks = sleeping
        ? deps.sleepSurvivalIntervalTicks
        : deps.awakeSurvivalIntervalTicks;

    for (let step = 0; step < stepCount; step += 1) {
        elapsedGameTimeTicks += 1;
        if (freezeLifeRemainingTicks > 0) {
            freezeLifeRemainingTicks -= 1;
        }
        const timeCriteria = deps.computeOriginalTimeCriteria(elapsedGameTimeTicks);
        const timeSinceLastPartyMove = elapsedGameTimeTicks - state.lastPartyMoveGameTick;
        const applySurvivalTick = (elapsedGameTimeTicks - lastSurvivalEffectGameTick) >= survivalIntervalTicks;
        if (applySurvivalTick) {
            lastSurvivalEffectGameTick = elapsedGameTimeTicks;
        }

        for (const champ of state.party) {
            const current = championVitals[champ.id];
            if (!current || current.hp <= 0) continue;

            const normalizedCurrent = deps.normalizeChampionVitalsForChampion(champ, current);
            const effective = deps.getEffectiveChampionStatsRuntime(
                champ,
                state.championEquipment[champ.id] ?? {},
                state.activePotionBoosts,
                normalizedCurrent,
            );
            const maxHP = effective.health;
            const maxStamina = effective.stamina;
            const maxMana = effective.mana;
            const championEquipment = state.championEquipment[champ.id];
            const wizardSkill =
                deps.getChampionSkillLevelFromXP(
                    state.championXP[champ.id],
                    championTemporaryXP[champ.id],
                    'wizard',
                    { bonusLevels: deps.getEquipmentSkillLevelModifier('wizard', championEquipment) },
                ) +
                deps.getChampionSkillLevelFromXP(
                    state.championXP[champ.id],
                    championTemporaryXP[champ.id],
                    'priest',
                    { bonusLevels: deps.getEquipmentSkillLevelModifier('priest', championEquipment) },
                );

            let next = normalizedCurrent;
            const currentTemporaryXP = deps.normalizeChampionTemporaryXP(championTemporaryXP[champ.id]);
            let championTempChanged = false;
            const nextTemporaryXPForChampion = { ...currentTemporaryXP };
            for (const skillKey of Object.keys(nextTemporaryXPForChampion) as SkillKey[]) {
                if (nextTemporaryXPForChampion[skillKey] <= 0) continue;
                nextTemporaryXPForChampion[skillKey] -= 1;
                championTempChanged = true;
            }
            if (championTempChanged) {
                championTemporaryXP = {
                    ...championTemporaryXP,
                    [champ.id]: nextTemporaryXPForChampion,
                };
            }

            if (applySurvivalTick) {
                if (
                    maxMana > 0 &&
                    next.mana < maxMana &&
                    timeCriteria < (effective.wisdom + wizardSkill)
                ) {
                    let manaGain = Math.floor(maxMana / 40);
                    if (sleeping) {
                        manaGain <<= 1;
                    }
                    manaGain += 1;
                    const staminaCost = manaGain * Math.max(7, 16 - wizardSkill);
                    next = deps.applyChampionStaminaDeltaOriginal(next, maxStamina, -staminaCost);
                    next = {
                        ...next,
                        mana: next.mana + Math.min(manaGain, maxMana - next.mana),
                    };
                } else if (next.mana > maxMana) {
                    next = { ...next, mana: next.mana - 1 };
                }

                let staminaGainCycleCount = 4;
                let staminaMagnitude = maxStamina;
                while (next.stamina < (staminaMagnitude >>= 1)) {
                    staminaGainCycleCount += 2;
                }

                let staminaDelta = 0;
                let staminaAmount = deps.applyLimits(1, (maxStamina >> 8) - 1, 6);
                if (sleeping) {
                    staminaAmount <<= 1;
                }
                if (timeSinceLastPartyMove > 80) {
                    staminaAmount += 1;
                    if (timeSinceLastPartyMove > 250) {
                        staminaAmount += 1;
                    }
                }

                let food = next.food;
                let water = next.water;
                do {
                    const staminaAboveHalf = staminaGainCycleCount <= 4;
                    if (food < -512) {
                        if (staminaAboveHalf) {
                            staminaDelta -= staminaAmount;
                            food -= 2 * deps.foodDrainScale;
                        }
                    } else {
                        if (food >= 0) {
                            staminaDelta += staminaAmount;
                        }
                        food -= (staminaAboveHalf ? 2 : staminaGainCycleCount >> 1) * deps.foodDrainScale;
                    }

                    if (water < -512) {
                        if (staminaAboveHalf) {
                            staminaDelta -= staminaAmount;
                            water -= deps.waterDrainScale;
                        }
                    } else {
                        if (water >= 0) {
                            staminaDelta += staminaAmount;
                        }
                        water -= (staminaAboveHalf ? 1 : staminaGainCycleCount >> 2) * deps.waterDrainScale;
                    }
                    staminaGainCycleCount -= 1;
                } while (staminaGainCycleCount > 0 && ((next.stamina + staminaDelta) < maxStamina));

                next = deps.applyChampionStaminaDeltaOriginal(next, maxStamina, staminaDelta);
                next = {
                    ...next,
                    food: deps.clampFoodWater(food, deps.maxFood),
                    water: deps.clampFoodWater(water, deps.maxWater),
                };

                if (
                    next.hp < maxHP &&
                    next.stamina >= (maxStamina >> 2) &&
                    timeCriteria < (effective.vitality + 12)
                ) {
                    let healthGain = (maxHP >> 7) + 1;
                    if (sleeping) {
                        healthGain <<= 1;
                    }
                    if (state.championEquipment[champ.id]?.neck?.category === 'Misc' && state.championEquipment[champ.id]?.neck?.typeId === 38) {
                        healthGain += (healthGain >> 1) + 1;
                    }
                    next = {
                        ...next,
                        hp: Math.min(maxHP, next.hp + healthGain),
                    };
                }

                const statRelaxMask = sleeping
                    ? deps.sleepStatRelaxIntervalMask
                    : deps.awakeStatRelaxIntervalMask;
                if ((elapsedGameTimeTicks & statRelaxMask) === 0) {
                    const statRelaxTargets = deps.getChampionStatRelaxTargets(
                        champ,
                        state.championEquipment[champ.id],
                        state.activePotionBoosts,
                    );
                    next = {
                        ...next,
                        currentStats: deps.relaxChampionCurrentStatsTowardMaximum(next.currentStats, statRelaxTargets),
                    };
                }
            }

            if (next.poisonEntries.length > 0) {
                const updatedEntries: { remaining: number; nextTickIn: number }[] = [];
                for (const entry of next.poisonEntries) {
                    const nextTickIn = entry.nextTickIn - deps.originalTimerTickSeconds;
                    if (nextTickIn > 0) {
                        updatedEntries.push({ ...entry, nextTickIn });
                        continue;
                    }
                    const poisonDamage = Math.max(1, Math.floor(entry.remaining / 64));
                    next = {
                        ...next,
                        hp: Math.max(0, next.hp - poisonDamage),
                    };
                    damageEvents = [
                        ...(damageEvents ?? []),
                        buildPoisonDamageEvent(state.level ?? 0, champ.id, poisonDamage),
                    ];
                    const nextRemaining = entry.remaining - 1;
                    if (nextRemaining > 0) {
                        updatedEntries.push({ remaining: nextRemaining, nextTickIn: deps.poisonTickIntervalSec });
                    }
                }
                next = { ...next, poisonEntries: updatedEntries };
            }

            championVitals[champ.id] = next;
        }
    }

    return {
        championVitals,
        championTemporaryXP,
        ...(damageEvents !== state.damageEvents ? { damageEvents } : {}),
        elapsedGameTimeTicks,
        lastSurvivalEffectGameTick,
        freezeLifeRemainingTicks,
        advancedMs: stepCount * (deps.originalTimerTickSeconds * 1000),
    };
}

export function isPartyRestedState(
    state: Pick<SurvivalState, 'party' | 'championVitals' | 'championEquipment' | 'activePotionBoosts'>,
    deps: Pick<SurvivalDeps, 'getEffectiveChampionStatsRuntime'>,
): boolean {
    return state.party.every((champ) => {
        const vitals = state.championVitals[champ.id];
        if (!vitals || vitals.hp <= 0) return true;
        const effective = deps.getEffectiveChampionStatsRuntime(
            champ,
            state.championEquipment[champ.id] ?? {},
            state.activePotionBoosts,
            vitals,
        );
        return vitals.hp >= effective.health && vitals.stamina >= effective.stamina && vitals.mana >= effective.mana;
    });
}
