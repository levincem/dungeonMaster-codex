export type ChampionClass = 'Fighter' | 'Ninja' | 'Wizard' | 'Priest';

export interface ChampionSkills {
    fighter: [number, number, number, number];
    ninja: [number, number, number, number];
    priest: [number, number, number, number];
    wizard: [number, number, number, number];
}

export interface Champion {
    id: number;
    name: string;
    title: string;
    gender: 'M' | 'F';
    class: ChampionClass;
    health: number;
    stamina: number;
    mana: number;
    luck: number;
    strength: number;
    dexterity: number;
    wisdom: number;
    vitality: number;
    antiMagic: number;
    antiFire: number;
    skills: ChampionSkills;
    color: string;
    equipment: string[];
    portrait: string;
}
