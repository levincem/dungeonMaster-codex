import { useEffect, useState } from 'react';
import { preloadDungeonData } from '../../data/dungeonData';

const RUNE_IDS = [
    'bro', 'dain', 'des', 'ee', 'ew', 'ful', 'gor',
    'ir', 'kath', 'ku', 'lo', 'mon', 'neta', 'oh', 'on',
    'pal', 'ra', 'ros', 'sar', 'um', 'ven', 'vi', 'ya', 'zo',
];

const CREATURE_IDS = Array.from({ length: 27 }, (_, i) => i);

const IMAGE_ASSETS: string[] = [
    ...RUNE_IDS.map(id => `/runes/${id}.png`),
    ...CREATURE_IDS.map(id => `/sprites/creatures/creature_${id}.png`),
    '/portraits/screen1.png',
    '/portraits/screen2.png',
    '/misc/Dm_logo.png',
    '/misc/wall_switch_green_out.png',
    '/misc/wall_switch_red_out.png',
    '/textures/wall.png',
    '/textures/floor.png',
    '/textures/ceiling.png',
    '/textures/door.png',
];

function preloadImage(src: string): Promise<void> {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = img.onerror = () => resolve();
        img.src = src;
    });
}

interface Props {
    onDone?: () => void | Promise<void>;
    autoStart?: boolean;
}

export const LoadingScreen = ({ onDone, autoStart = true }: Props) => {
    const totalAssets = IMAGE_ASSETS.length + 1;
    const [loaded, setLoaded] = useState(autoStart ? 0 : totalAssets);
    const [fadeOut, setFadeOut] = useState(false);
    const pct = totalAssets > 0 ? Math.round((loaded / totalAssets) * 100) : 0;

    useEffect(() => {
        if (!autoStart) return;

        let active = true;
        let count = 0;
        let finished = false;

        const finishOne = async () => {
            if (!active || finished) return;
            count += 1;
            setLoaded(count);
            if (count === totalAssets) {
                finished = true;
                setFadeOut(true);
                await new Promise(resolve => window.setTimeout(resolve, 500));
                if (active && onDone) await onDone();
            }
        };

        for (const src of IMAGE_ASSETS) {
            preloadImage(src).then(() => {
                void finishOne();
            });
        }

        preloadDungeonData().then(() => {
            void finishOne();
        }).catch(() => {
            void finishOne();
        });

        return () => {
            active = false;
        };
    }, [autoStart, onDone, totalAssets]);

    return (
        <div style={{
            position: 'fixed', inset: 0,
            background: '#050508',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            zIndex: 9999,
            opacity: fadeOut ? 0 : 1,
            transition: 'opacity 0.5s ease',
            pointerEvents: fadeOut ? 'none' : 'all',
        }}>
            <div style={{
                position: 'absolute', inset: 0,
                background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.85) 100%)',
                pointerEvents: 'none',
            }} />

            <img
                src="/logo.png"
                alt="Dungeon Master"
                draggable={false}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                style={{
                    maxWidth: 420,
                    width: '60vw',
                    objectFit: 'contain',
                    marginBottom: 48,
                    imageRendering: 'auto',
                    filter: 'drop-shadow(0 0 32px rgba(180,120,40,0.5))',
                }}
            />

            <div style={{
                fontSize: 11,
                letterSpacing: 8,
                color: 'rgba(180,140,60,0.55)',
                marginBottom: 48,
                fontFamily: '"Courier New", monospace',
                textTransform: 'uppercase',
            }}>
                Dungeon Master
            </div>

            <div style={{
                width: 320,
                height: 3,
                background: 'rgba(255,255,255,0.07)',
                borderRadius: 2,
                overflow: 'hidden',
                position: 'relative',
            }}>
                <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: `${pct}%`,
                    background: 'linear-gradient(90deg, #7a4a10, #d4a030)',
                    borderRadius: 2,
                    boxShadow: '0 0 8px rgba(200,140,30,0.7)',
                    transition: 'width 0.15s linear',
                }} />
            </div>

            <div style={{
                marginTop: 14,
                fontSize: 10,
                letterSpacing: 4,
                color: 'rgba(180,140,60,0.45)',
                fontFamily: '"Courier New", monospace',
            }}>
                {pct} %
            </div>
        </div>
    );
};
