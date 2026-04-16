import type { ChampionCombat, ChampionVitals, Projectile } from '../runtimeTypes';
import type { ChampionEquipment } from '../../types/game';

type AttackResultMessage = {
    success: boolean;
    message: string;
    ts: number;
};

type ProjectileAttackXpPatch = Partial<{
    championXP: unknown;
    championTemporaryXP: unknown;
    party: unknown;
}>;

type BuildProjectileAttackSuccessPatchParams = {
    championCombat: Record<number, ChampionCombat>;
    championId: number;
    newCombat: ChampionCombat;
    championVitals: Record<number, ChampionVitals>;
    championEquipment: Record<number, ChampionEquipment>;
    nextEquip: ChampionEquipment;
    attackXpPatch: ProjectileAttackXpPatch | null;
    projectiles: Projectile[];
    projectile: Projectile;
    displayName: string;
    buildAttackResultMessage: (message: string, success?: boolean) => AttackResultMessage;
};

export function buildProjectileAttackSuccessPatch(
    params: BuildProjectileAttackSuccessPatchParams,
) {
    return {
        championCombat: {
            ...params.championCombat,
            [params.championId]: params.newCombat,
        },
        championVitals: params.championVitals,
        championEquipment: {
            ...params.championEquipment,
            [params.championId]: params.nextEquip,
        },
        ...(params.attackXpPatch ?? {}),
        projectiles: [...params.projectiles, params.projectile],
        lastCastResult: params.buildAttackResultMessage(params.displayName, true),
    };
}

export function buildMissingAmmoAttackPatch(
    buildAttackResultMessage: (message: string, success?: boolean) => AttackResultMessage,
) {
    return {
        lastCastResult: buildAttackResultMessage('Aucune munition compatible dans le carquois.'),
    };
}
