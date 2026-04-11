const SCROLL_TEXT_FIXUPS: Record<string, string> = {
    RTCUT: 'SHORTCUT',
    ACK: 'TURN BACK',
    'WELCOME BACK\nBRAVE\nADVENTURERS.': 'WELCOME\nBRAVE\nADVENTURERS.',
    'COME BACK\nBRAVE\nADVENTURERS.': 'WELCOME\nBRAVE\nADVENTURERS.',
    'BRAVE\nADVENTURERS.': 'WELCOME\nBRAVE\nADVENTURERS.',
    'AVE\nADVENTURERS.': 'WELCOME\nBRAVE\nADVENTURERS.',
    'ADVENTURERS.': 'WELCOME\nBRAVE\nADVENTURERS.',
};

export function normalizeScrollText(rawText?: string): string | undefined {
    if (!rawText) return rawText;
    return SCROLL_TEXT_FIXUPS[rawText] ?? rawText;
}
