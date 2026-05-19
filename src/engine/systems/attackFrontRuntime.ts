import type { ChampionTemporaryXP, ChampionXP, SkillKey } from '../../data/skillProgression';
import type { WeaponAttackOption } from '../../data/weaponAttacks';
import type { Champion } from '../../types/champion';
import type { ChampionEquipment, CreatureInstance, FloorItem } from '../../types/game';
import type { EquipSlotKey } from '../../types/items';
import type {
    ActiveFluxcage,
    ActivePotionBoost,
    ChampionCombat,
    ChampionVitals,
    Direction,
    Projectile,
    SpellLight,
    PartyShield,
    DamageEvent,
    SpellVisualEvent,
} from '../runtimeTypes';
import { resolveAttackSelection } from './attackSelection';
import { isChampionInRearRank } from './attackFrontContext';
import { getTranslations } from '../../i18n';
import { isMagicBoxItem } from '../../data/itemChargeState';

const runtimeText = getTranslations().runtime;

type AttackFrontRuntimeState = {
    championCombat: Record<number, ChampionCombat>;
    party: Champion[];
    championEquipment: Record<number, ChampionEquipment>;
    activePotionBoosts: ActivePotionBoost[];
    championVitals: Record<number, ChampionVitals>;
    championInventories: Record<number, FloorItem[]>;
    projectiles: Projectile[];
    level: number;
    position: [number, number];
    direction: Direction;
    creatures: CreatureInstance[];
    openDoors: Set<string>;
    openPits?: Set<string>;
    openWalls?: Set<string>;
    activeFluxcages?: ActiveFluxcage[];
    brokenDoors: Set<string>;
    floorItems: FloorItem[];
    championXP: Record<number, ChampionXP>;
    championTemporaryXP: Record<number, ChampionTemporaryXP>;
    elapsedGameTimeTicks: number;
    lastCreatureAttackGameTick: number;
    damageEvents: DamageEvent[];
    spellVisualEvents: SpellVisualEvent[];
    freezeLifeRemainingTicks: number;
    seeThroughWallsUntil: number;
    spellLights: SpellLight[];
    activeShields: PartyShield[];
};

type AttackFrontRuntimeDeps = {
    getWeaponAttackOptions: (item: FloorItem | null | undefined) => WeaponAttackOption[];
    getRequiredAmmoRawClass: (item: FloorItem | undefined) => number | null;
    getAttackCooldownSeconds: (option: WeaponAttackOption | null) => number;
    isAttackOptionUsableAtMastery: (option: WeaponAttackOption, masteryLevel: number) => boolean;
    getAttackUnusableReason: (option: WeaponAttackOption, masteryLevel: number) => string | null;
    isPhysicalAttack: (option: WeaponAttackOption | null) => boolean;
    isShootAttack: (option: WeaponAttackOption | null) => boolean;
    isThrowAttack: (option: WeaponAttackOption | null) => boolean;
    getChampionMasteryLevel: (championId: number, champion: Champion, skill: SkillKey) => number;
    findCompatibleAmmo: (
        equip: ChampionEquipment | undefined,
        requiredRawClass: number | null,
    ) => { slot: string; item: FloorItem } | null;
    getRightHandStats: (
        equip: ChampionEquipment | undefined,
    ) => { name: string; dmgMin: number; dmgMax: number; cooldownSec: number; skill: SkillKey };
    createChampionCombatState: (cooldownSec: number, defenseModifier?: number) => ChampionCombat;
    applyChampionAttackVitals: (
        champion: Champion,
        equip: ChampionEquipment,
        activePotionBoosts: ActivePotionBoost[],
        currentVitals: ChampionVitals | undefined,
        selectedAttack: WeaponAttackOption | null,
    ) => { nextVitals: ChampionVitals } | null;
    getActionCharges: (item: FloorItem | undefined) => number | null;
    updateEquippedItemCharges: (
        equip: ChampionEquipment,
        slot: 'rightHand' | 'leftHand',
        remainingCharges: number | null,
    ) => ChampionEquipment;
    buildAttackResultMessage: (message: string, success?: boolean) => unknown;
    buildPhysicalProjectileAttackPatch: (args: {
        selectedAttack: WeaponAttackOption;
        state: AttackFrontRuntimeState;
        championId: number;
        champion: Champion;
        equip: ChampionEquipment;
        attackItem: FloorItem | null | undefined;
        attackItemSlot: EquipSlotKey | null;
        currentStamina: number | undefined;
        newCombat: ChampionCombat;
        selectedSkill: SkillKey;
        championVitals: Record<number, ChampionVitals>;
    }) => Record<string, unknown> | null;
    buildSupportedUtilityAttackPatch: (args: {
        selectedAttack: WeaponAttackOption;
        state: AttackFrontRuntimeState;
        championId: number;
        champion: Champion;
        championVitals: Record<number, ChampionVitals>;
        equip: ChampionEquipment;
        chargedEquip: ChampionEquipment;
        newCombat: ChampionCombat;
        selectedSkill: SkillKey;
        rightHand: FloorItem | null | undefined;
    }) => Record<string, unknown> | null;
    resolveAttackFrontContext: (
        level: number,
        position: [number, number],
        direction: Direction,
        creatures: CreatureInstance[],
        party: Champion[],
        championId: number,
    ) => { target: CreatureInstance | null };
    resolveCombatItem: (
        equip: ChampionEquipment | undefined,
    ) => { slot: EquipSlotKey; item: FloorItem } | null;
    buildAttackMeleeStatePatch: (args: {
        state: AttackFrontRuntimeState;
        championId: number;
        champion: Champion;
        equip: ChampionEquipment;
        championVitals: Record<number, ChampionVitals>;
        selectedAttack: WeaponAttackOption | null;
        target: CreatureInstance | null;
        newCombat: ChampionCombat;
        fallbackSkill: SkillKey;
    }) => Record<string, unknown>;
    onPartyAttack: () => void;
};

export function runAttackFrontRuntime(
    state: AttackFrontRuntimeState,
    championId: number,
    attackType: number | undefined,
    deps: AttackFrontRuntimeDeps,
): Record<string, unknown> | null {
    const combat = state.championCombat[championId];
    if (!combat || combat.cooldown > 0) return null;

    const champion = state.party.find((entry) => entry.id === championId);
    if (!champion) return null;

    const equip = state.championEquipment[championId] ?? {};
    const rightHand = equip.rightHand;
    const resolvedCombatItem = deps.resolveCombatItem(equip);
    const attackItem = resolvedCombatItem?.item ?? rightHand;
    const attackItemSlot = resolvedCombatItem?.slot ?? (rightHand ? 'rightHand' : null);
    const availableAttacks = deps.getWeaponAttackOptions(attackItem);
    const attackSelection = resolveAttackSelection(
        { attackType, availableAttacks },
        {
            getMasteryLevel: (skill) => deps.getChampionMasteryLevel(championId, champion, skill),
            hasCompatibleAmmo: () => {
                const requiredAmmoRawClass = deps.getRequiredAmmoRawClass(attackItem ?? undefined);
                return Boolean(deps.findCompatibleAmmo(equip, requiredAmmoRawClass));
            },
            isAttackUsableAtMastery: deps.isAttackOptionUsableAtMastery,
            getAttackUnusableReason: deps.getAttackUnusableReason,
            isShootAttack: deps.isShootAttack,
        },
    );
    const selectedAttack = attackSelection.selectedAttack;
    const selectedSkill = attackSelection.selectedSkill;

    if (attackSelection.blockedMessage) {
        return {
            lastCastResult: deps.buildAttackResultMessage(attackSelection.blockedMessage),
        };
    }

    const attackFrontContext = deps.resolveAttackFrontContext(
        state.level,
        state.position,
        state.direction,
        state.creatures,
        state.party,
        championId,
    );
    const rearRankContactAttack =
        isChampionInRearRank(state.party, championId) &&
        attackFrontContext.target &&
        (!selectedAttack || (
            deps.isPhysicalAttack(selectedAttack) &&
            !deps.isThrowAttack(selectedAttack) &&
            !deps.isShootAttack(selectedAttack)
        ));

    if (rearRankContactAttack) {
        return {
            lastCastResult: deps.buildAttackResultMessage(runtimeText.targetOutOfReach),
        };
    }

    const stats = deps.getRightHandStats(state.championEquipment[championId]);
    const cooldownSec = selectedAttack
        ? deps.getAttackCooldownSeconds(selectedAttack)
        : stats.cooldownSec;
    const newCombat = deps.createChampionCombatState(
        cooldownSec,
        selectedAttack?.attack.defenseModifier ?? 0,
    );
    const vitalsUpdate = deps.applyChampionAttackVitals(
        champion,
        state.championEquipment[championId] ?? {},
        state.activePotionBoosts,
        state.championVitals[championId],
        selectedAttack,
    );
    const championVitals = vitalsUpdate
        ? { ...state.championVitals, [championId]: vitalsUpdate.nextVitals }
        : state.championVitals;
    const rightHandCharges = deps.getActionCharges(rightHand);
    const consumeOnUse = selectedAttack?.enumName === 'Freeze Life' && isMagicBoxItem(rightHand);

    if (selectedAttack?.requiresCharges && rightHandCharges !== null && rightHandCharges <= 0) {
        return {
            championCombat: { ...state.championCombat, [championId]: newCombat },
            championVitals,
            lastCastResult: deps.buildAttackResultMessage(
                runtimeText.attackUnavailable(selectedAttack.displayName, runtimeText.noChargesRemaining),
            ),
        };
    }

    const chargedEquip = consumeOnUse && rightHand
        ? (() => {
            const nextEquip = { ...equip };
            delete nextEquip.rightHand;
            return nextEquip;
        })()
        : selectedAttack?.requiresCharges
            ? deps.updateEquippedItemCharges(
            equip,
            'rightHand',
            rightHandCharges === null ? null : Math.max(0, rightHandCharges - 1),
        )
            : equip;

    if (selectedAttack && (deps.isThrowAttack(selectedAttack) || deps.isShootAttack(selectedAttack))) {
        const projectileAttackPatch = deps.buildPhysicalProjectileAttackPatch({
            selectedAttack,
            state,
            championId,
            champion,
            equip,
            attackItem,
            attackItemSlot,
            currentStamina: vitalsUpdate?.nextVitals.stamina,
            newCombat,
            selectedSkill,
            championVitals,
        });
        if (projectileAttackPatch) {
            return projectileAttackPatch;
        }
    }

    if (selectedAttack && !deps.isPhysicalAttack(selectedAttack)) {
        const handled = deps.buildSupportedUtilityAttackPatch({
            selectedAttack,
            state,
            championId,
            champion,
            championVitals,
            equip,
            chargedEquip,
            newCombat,
            selectedSkill,
            rightHand,
        });
        if (handled) return handled;
        return {
            championCombat: { ...state.championCombat, [championId]: newCombat },
            championVitals,
            lastCastResult: deps.buildAttackResultMessage(
                runtimeText.originalActionNotImplemented(selectedAttack.displayName),
            ),
        };
    }

    const { target } = attackFrontContext;

    deps.onPartyAttack();
    return deps.buildAttackMeleeStatePatch({
        state,
        championId,
        champion,
        equip,
        championVitals,
        selectedAttack,
        target,
        newCombat,
        fallbackSkill: stats.skill,
    });
}
