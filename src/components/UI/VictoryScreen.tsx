import { useEffect, useState } from 'react';
import { miscPath } from '../../data/assetPaths';

const greyLordSprite = `${import.meta.env.BASE_URL}sprites/creatures/creature_26.png`;

export const VictoryScreen = () => {
    const [showEndCard, setShowEndCard] = useState(false);

    useEffect(() => {
        const timer = window.setTimeout(() => setShowEndCard(true), 5000);
        return () => window.clearTimeout(timer);
    }, []);

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: '#000',
            color: '#e8d7a4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
        }}>
            {!showEndCard ? (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 24,
                    textAlign: 'center',
                }}>
                    <div style={{
                        fontFamily: '"Times New Roman", serif',
                        fontSize: 'clamp(28px, 4vw, 52px)',
                        letterSpacing: 2,
                        textTransform: 'uppercase',
                    }}>
                        Congratulations!
                    </div>
                    <img
                        src={greyLordSprite}
                        alt="Grey Lord"
                        draggable={false}
                        style={{
                            width: 'min(38vw, 360px)',
                            imageRendering: 'pixelated',
                            filter: 'drop-shadow(0 0 28px rgba(255, 240, 170, 0.18))',
                        }}
                    />
                    <div style={{
                        fontFamily: '"Times New Roman", serif',
                        fontSize: 'clamp(18px, 2vw, 28px)',
                        letterSpacing: 1.5,
                    }}>
                        Grey Lord
                    </div>
                </div>
            ) : (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 28,
                    textAlign: 'center',
                }}>
                    <div style={{
                        fontFamily: '"Times New Roman", serif',
                        fontSize: 'clamp(34px, 5vw, 64px)',
                        letterSpacing: 4,
                        textTransform: 'uppercase',
                    }}>
                        The End
                    </div>
                    <img
                        src={miscPath('Dm_logo.png')}
                        alt="Dungeon Master"
                        draggable={false}
                        style={{
                            width: 'min(42vw, 520px)',
                            objectFit: 'contain',
                            filter: 'drop-shadow(0 18px 48px rgba(0,0,0,0.85))',
                        }}
                    />
                </div>
            )}
        </div>
    );
};
