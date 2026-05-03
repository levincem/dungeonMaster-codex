export type OriginalGeneratorConfig = {
    typeId: number;
    countRaw: number;
    randomized: boolean;
    hpMultiplier: number;
    ticks: number;
    spawnX: number;
    spawnY: number;
};

const ORIGINAL_GENERATOR_CONFIGS: Record<string, OriginalGeneratorConfig> = {
    '2_545': { typeId: 16, countRaw: 2, randomized: true, hpMultiplier: 0, ticks: 141, spawnX: 24, spawnY: 28 },
    '3_118': { typeId: 15, countRaw: 2, randomized: false, hpMultiplier: 0, ticks: 145, spawnX: 4, spawnY: 23 },
    '3_119': { typeId: 15, countRaw: 2, randomized: false, hpMultiplier: 0, ticks: 155, spawnX: 4, spawnY: 15 },
    '3_122': { typeId: 15, countRaw: 2, randomized: false, hpMultiplier: 0, ticks: 163, spawnX: 10, spawnY: 17 },
    '3_123': { typeId: 6, countRaw: 2, randomized: false, hpMultiplier: 0, ticks: 163, spawnX: 8, spawnY: 14 },
    '3_125': { typeId: 7, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 163, spawnX: 7, spawnY: 23 },
    '3_128': { typeId: 15, countRaw: 2, randomized: false, hpMultiplier: 0, ticks: 163, spawnX: 15, spawnY: 6 },
    '3_131': { typeId: 15, countRaw: 2, randomized: false, hpMultiplier: 0, ticks: 145, spawnX: 24, spawnY: 5 },
    '3_415': { typeId: 6, countRaw: 4, randomized: true, hpMultiplier: 0, ticks: 131, spawnX: 0, spawnY: 17 },
    '4_383': { typeId: 13, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 136, spawnX: 12, spawnY: 5 },
    '4_542': { typeId: 1, countRaw: 4, randomized: true, hpMultiplier: 0, ticks: 131, spawnX: 0, spawnY: 17 },
    '5_194': { typeId: 12, countRaw: 4, randomized: false, hpMultiplier: 0, ticks: 145, spawnX: 25, spawnY: 18 },
    '5_318': { typeId: 3, countRaw: 2, randomized: false, hpMultiplier: 0, ticks: 145, spawnX: 29, spawnY: 17 },
    '5_519': { typeId: 3, countRaw: 2, randomized: true, hpMultiplier: 0, ticks: 141, spawnX: 0, spawnY: 19 },
    '5_560': { typeId: 12, countRaw: 2, randomized: true, hpMultiplier: 0, ticks: 130, spawnX: 7, spawnY: 28 },
    '5_561': { typeId: 17, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 144, spawnX: 10, spawnY: 28 },
    '5_563': { typeId: 12, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 134, spawnX: 11, spawnY: 27 },
    '7_237': { typeId: 12, countRaw: 4, randomized: true, hpMultiplier: 0, ticks: 217, spawnX: 2, spawnY: 19 },
    '7_240': { typeId: 8, countRaw: 2, randomized: true, hpMultiplier: 0, ticks: 163, spawnX: 17, spawnY: 8 },
    '7_241': { typeId: 8, countRaw: 2, randomized: true, hpMultiplier: 0, ticks: 163, spawnX: 24, spawnY: 20 },
    '7_248': { typeId: 12, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 145, spawnX: 13, spawnY: 15 },
    '7_445': { typeId: 2, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 136, spawnX: 12, spawnY: 6 },
    '7_446': { typeId: 10, countRaw: 3, randomized: true, hpMultiplier: 0, ticks: 154, spawnX: 3, spawnY: 9 },
    '8_484': { typeId: 4, countRaw: 2, randomized: true, hpMultiplier: 0, ticks: 127, spawnX: 23, spawnY: 0 },
    '8_514': { typeId: 4, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 150, spawnX: 9, spawnY: 27 },
    '9_453': { typeId: 2, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 138, spawnX: 2, spawnY: 31 },
    '9_455': { typeId: 2, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 138, spawnX: 16, spawnY: 29 },
    '9_472': { typeId: 0, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 134, spawnX: 21, spawnY: 7 },
    '9_474': { typeId: 3, countRaw: 4, randomized: true, hpMultiplier: 0, ticks: 129, spawnX: 27, spawnY: 15 },
    '9_526': { typeId: 3, countRaw: 4, randomized: true, hpMultiplier: 3, ticks: 134, spawnX: 5, spawnY: 12 },
    '10_486': { typeId: 17, countRaw: 4, randomized: true, hpMultiplier: 0, ticks: 134, spawnX: 17, spawnY: 29 },
    '10_492': { typeId: 17, countRaw: 4, randomized: true, hpMultiplier: 6, ticks: 129, spawnX: 25, spawnY: 20 },
    '10_493': { typeId: 17, countRaw: 4, randomized: true, hpMultiplier: 6, ticks: 129, spawnX: 29, spawnY: 3 },
    '10_498': { typeId: 16, countRaw: 4, randomized: true, hpMultiplier: 6, ticks: 129, spawnX: 3, spawnY: 16 },
    '10_501': { typeId: 20, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 134, spawnX: 6, spawnY: 22 },
    '11_470': { typeId: 19, countRaw: 2, randomized: true, hpMultiplier: 0, ticks: 134, spawnX: 15, spawnY: 6 },
    '11_488': { typeId: 21, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 134, spawnX: 16, spawnY: 1 },
    '11_672': { typeId: 21, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 134, spawnX: 27, spawnY: 11 },
    '11_673': { typeId: 21, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 134, spawnX: 21, spawnY: 11 },
    '12_308': { typeId: 11, countRaw: 1, randomized: false, hpMultiplier: 5, ticks: 170, spawnX: 7, spawnY: 1 },
    '12_345': { typeId: 11, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 145, spawnX: 14, spawnY: 10 },
    '12_347': { typeId: 11, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 145, spawnX: 12, spawnY: 10 },
    '12_349': { typeId: 11, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 145, spawnX: 19, spawnY: 4 },
    '12_457': { typeId: 11, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 145, spawnX: 12, spawnY: 12 },
    '12_458': { typeId: 11, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 145, spawnX: 13, spawnY: 10 },
    '12_459': { typeId: 11, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 145, spawnX: 13, spawnY: 12 },
    '12_465': { typeId: 11, countRaw: 1, randomized: false, hpMultiplier: 3, ticks: 137, spawnX: 2, spawnY: 18 },
    '12_504': { typeId: 11, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 134, spawnX: 18, spawnY: 11 },
    '12_506': { typeId: 11, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 134, spawnX: 19, spawnY: 10 },
    '12_507': { typeId: 11, countRaw: 1, randomized: false, hpMultiplier: 0, ticks: 134, spawnX: 20, spawnY: 9 },
};

export function getOriginalGeneratorConfig(level: number, sensorIndex: number): OriginalGeneratorConfig | null {
    return ORIGINAL_GENERATOR_CONFIGS[`${level}_${sensorIndex}`] ?? null;
}

export function getAllOriginalGeneratorConfigs(): Readonly<Record<string, OriginalGeneratorConfig>> {
    return ORIGINAL_GENERATOR_CONFIGS;
}
