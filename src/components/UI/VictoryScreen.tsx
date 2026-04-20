import { useEffect, useState } from 'react';
import { miscPath } from '../../data/assetPaths';
import { useI18n } from '../../i18n';

const greyLordSprite = `${import.meta.env.BASE_URL}sprites/creatures/creature_26.png`;

export const VictoryScreen = () => {
    const text = useI18n().victory;
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
                        {text.congratulations}
                    </div>
                    <img
                        src={greyLordSprite}
                        alt={text.greyLordAlt}
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
                        {text.greyLord}
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
                        {text.theEnd}
                    </div>
                    <img
                        src={miscPath('Dm_logo.png')}
                        alt={text.dungeonMasterAlt}
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
