import { portraitsPath } from './assetPaths';
import { getDungeonDataSync } from './dungeonData';
import type { Champion, ChampionClass, ChampionSkills } from '../types/champion';

export type { Champion, ChampionClass, ChampionSkills } from '../types/champion';

type RawChampion = Omit<Champion, 'id' | 'class' | 'color' | 'equipment' | 'portrait'> & {
    portraitId: number;
    skills: ChampionSkills;
};

type RawDungeon = {
    champions: RawChampion[];
};

export const CLASS_COLORS: Record<ChampionClass, string> = {
    Fighter: '#c0392b',
    Ninja: '#27ae60',
    Wizard: '#8e44ad',
    Priest: '#2980b9',
};

const PORTRAITS: Record<number, string> = {
    0: portraitsPath('elija.png'),
    1: portraitsPath('halk.png'),
    2: portraitsPath('syra.png'),
    3: portraitsPath('hissssa.png'),
    4: portraitsPath('zed.png'),
    5: portraitsPath('chani.png'),
    6: portraitsPath('hawk.png'),
    7: portraitsPath('boris.png'),
    8: portraitsPath('mophus.png'),
    9: portraitsPath('leif.png'),
    10: portraitsPath('wuTse.png'),
    11: portraitsPath('alex.png'),
    12: portraitsPath('linflas.png'),
    13: portraitsPath('azizi.png'),
    14: portraitsPath('iaido.png'),
    15: portraitsPath('gando.png'),
    16: portraitsPath('stamm.png'),
    17: portraitsPath('leyla.png'),
    18: portraitsPath('tiggy.png'),
    19: portraitsPath('sonja.png'),
    20: portraitsPath('nabi.png'),
    21: portraitsPath('gothmog.png'),
    22: portraitsPath('wuuf.png'),
    23: portraitsPath('daroou.png'),
};

function sumSkillLevels(levels: [number, number, number, number]): number {
    return levels[0] + levels[1] + levels[2] + levels[3];
}

function toSkillTuple(levels: number[] | undefined): [number, number, number, number] {
    return [
        levels?.[0] ?? 0,
        levels?.[1] ?? 0,
        levels?.[2] ?? 0,
        levels?.[3] ?? 0,
    ];
}

function normalizeSkills(skills: {
    fighter?: number[];
    ninja?: number[];
    priest?: number[];
    wizard?: number[];
}): ChampionSkills {
    return {
        fighter: toSkillTuple(skills.fighter),
        ninja: toSkillTuple(skills.ninja),
        priest: toSkillTuple(skills.priest),
        wizard: toSkillTuple(skills.wizard),
    };
}

function deriveChampionClass(skills: ChampionSkills): ChampionClass {
    const totals: Array<[ChampionClass, number]> = [
        ['Fighter', sumSkillLevels(skills.fighter)],
        ['Ninja', sumSkillLevels(skills.ninja)],
        ['Priest', sumSkillLevels(skills.priest)],
        ['Wizard', sumSkillLevels(skills.wizard)],
    ];

    totals.sort((a, b) => b[1] - a[1]);
    return totals[0]?.[0] ?? 'Fighter';
}

const rawChampions = getDungeonDataSync<RawDungeon>().champions ?? [];
const ORIGINAL_STAMINA_SCALE = 10;

export const CHAMPIONS: Champion[] = rawChampions
    .map((champion) => {
        const skills = normalizeSkills(champion.skills);
        const championClass = deriveChampionClass(skills);
        return {
            id: champion.portraitId,
            name: champion.name,
            title: champion.title,
            gender: champion.gender,
            class: championClass,
            health: champion.health,
            stamina: champion.stamina * ORIGINAL_STAMINA_SCALE,
            mana: champion.mana,
            luck: champion.luck,
            strength: champion.strength,
            dexterity: champion.dexterity,
            wisdom: champion.wisdom,
            vitality: champion.vitality,
            antiMagic: champion.antiMagic,
            antiFire: champion.antiFire,
            skills,
            color: CLASS_COLORS[championClass],
            equipment: [],
            portrait: PORTRAITS[champion.portraitId] ?? portraitsPath('elija.png'),
        };
    })
    .sort((a, b) => a.id - b.id);

export const CHAMPION_BY_ID: Record<number, Champion> = Object.fromEntries(
    CHAMPIONS.map((champion) => [champion.id, champion]),
);
