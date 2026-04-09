import { useMemo, useState, type CSSProperties } from 'react';
import { hasPersistedSave } from '../../engine/saveGame';

interface Props {
    onEnter: () => void;
    onResume?: () => void;
}

export const TitleScreen = ({ onEnter, onResume }: Props) => {
    const [hasSave] = useState(() => hasPersistedSave());
    const [opening, setOpening] = useState(false);

    const doorTransition = useMemo(
        () => opening ? 'transform 0.72s ease, opacity 0.72s ease' : 'transform 0.42s ease, opacity 0.42s ease',
        [opening],
    );

    const handleEnter = () => {
        if (opening) return;
        setOpening(true);
        window.setTimeout(() => onEnter(), 720);
    };

    const handleResume = () => {
        if (!hasSave || opening || !onResume) return;
        onResume();
    };

    const buttonBase: CSSProperties = {
        width: 216,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '10px 14px',
        background: 'rgba(12, 8, 4, 0.76)',
        border: '1px solid rgba(170, 134, 72, 0.6)',
        borderRadius: 10,
        boxShadow: '0 14px 28px rgba(0,0,0,0.32)',
        backdropFilter: 'blur(4px)',
        cursor: 'pointer',
        transition: 'transform 0.14s ease, border-color 0.14s ease, box-shadow 0.14s ease, opacity 0.14s ease',
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            overflow: 'hidden',
            background:
                'radial-gradient(circle at 50% 18%, rgba(184,132,44,0.24), transparent 28%), linear-gradient(180deg, #0d0b08 0%, #19140c 30%, #090807 100%)',
        }}>
            <div style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'url(/textures/wall.png?v=2)',
                backgroundSize: '256px 256px',
                opacity: 0.11,
                mixBlendMode: 'screen',
            }} />

            <div style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                gridTemplateColumns: '1.2fr 0.85fr',
                alignItems: 'center',
                padding: '7vh 7vw',
                gap: '4vw',
            }}>
                <div style={{
                    position: 'relative',
                    minHeight: '64vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <div style={{
                        position: 'absolute',
                        inset: '8% 0 0',
                        display: 'flex',
                        justifyContent: 'center',
                        pointerEvents: 'none',
                    }}>
                        <img
                            src="/misc/Dm_logo.png"
                            alt="Dungeon Master"
                            draggable={false}
                            style={{
                                width: 'min(36vw, 520px)',
                                objectFit: 'contain',
                                filter: 'drop-shadow(0 12px 40px rgba(0,0,0,0.8))',
                            }}
                        />
                    </div>

                    <div style={{
                        position: 'relative',
                        width: 'min(52vw, 760px)',
                        aspectRatio: '1.26 / 1',
                        marginTop: '16vh',
                    }}>
                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: 26,
                            background:
                                'linear-gradient(180deg, rgba(56,42,22,0.9) 0%, rgba(24,18,10,0.95) 100%)',
                            boxShadow: '0 30px 70px rgba(0,0,0,0.45)',
                            overflow: 'hidden',
                        }}>
                            <div style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: '22%',
                                backgroundImage: 'url(/textures/wall.png?v=2)',
                                backgroundSize: '200px 200px',
                                filter: 'brightness(0.64)',
                            }} />
                            <div style={{
                                position: 'absolute',
                                right: 0,
                                top: 0,
                                bottom: 0,
                                width: '22%',
                                backgroundImage: 'url(/textures/wall.png?v=2)',
                                backgroundSize: '200px 200px',
                                filter: 'brightness(0.64)',
                            }} />

                            <div style={{
                                position: 'absolute',
                                left: '22%',
                                right: '22%',
                                top: '13%',
                                bottom: '12%',
                                borderRadius: 12,
                                background:
                                    'linear-gradient(180deg, rgba(12,10,7,0.96) 0%, rgba(30,20,8,0.98) 100%)',
                                border: '2px solid rgba(126,92,40,0.85)',
                                boxShadow: 'inset 0 0 0 1px rgba(224,176,84,0.1), inset 0 0 48px rgba(0,0,0,0.46)',
                                overflow: 'hidden',
                            }}>
                                <div style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: 0,
                                    bottom: 0,
                                    width: '50%',
                                    backgroundImage: 'url(/textures/door.png?v=2)',
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'left center',
                                    borderRight: '1px solid rgba(0,0,0,0.6)',
                                    transform: opening ? 'translateX(-96%)' : 'translateX(0)',
                                    opacity: opening ? 0.18 : 1,
                                    transition: doorTransition,
                                }} />
                                <div style={{
                                    position: 'absolute',
                                    right: 0,
                                    top: 0,
                                    bottom: 0,
                                    width: '50%',
                                    backgroundImage: 'url(/textures/door.png?v=2)',
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'right center',
                                    borderLeft: '1px solid rgba(0,0,0,0.6)',
                                    transform: opening ? 'translateX(96%)' : 'translateX(0)',
                                    opacity: opening ? 0.18 : 1,
                                    transition: doorTransition,
                                }} />
                                <div style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background:
                                        'radial-gradient(circle at 50% 48%, rgba(224,190,110,0.38), rgba(160,110,32,0.14) 34%, rgba(0,0,0,0.78) 78%)',
                                    opacity: opening ? 1 : 0.26,
                                    transition: 'opacity 0.72s ease',
                                }} />
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    justifyContent: 'center',
                    gap: 18,
                    paddingTop: '10vh',
                }}>
                    <button
                        type="button"
                        onClick={handleEnter}
                        style={buttonBase}
                    >
                        <img
                            src="/misc/wall_switch_green_out.png"
                            alt=""
                            draggable={false}
                            style={{ width: 56, height: 56, objectFit: 'contain', imageRendering: 'crisp-edges' }}
                        />
                        <span style={{
                            color: '#d7c288',
                            fontSize: 18,
                            letterSpacing: 1.8,
                            textTransform: 'uppercase',
                            fontFamily: '"Times New Roman", serif',
                            textAlign: 'left',
                        }}>
                            Enter The Dungeon
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={handleResume}
                        disabled={!hasSave}
                        style={{
                            ...buttonBase,
                            opacity: hasSave ? 1 : 0.46,
                            cursor: hasSave ? 'pointer' : 'not-allowed',
                        }}
                        title={hasSave ? 'Reprendre la sauvegarde' : 'Aucune sauvegarde disponible'}
                    >
                        <img
                            src="/misc/wall_switch_red_out.png"
                            alt=""
                            draggable={false}
                            style={{ width: 56, height: 56, objectFit: 'contain', imageRendering: 'crisp-edges' }}
                        />
                        <span style={{
                            color: '#d7c288',
                            fontSize: 18,
                            letterSpacing: 1.8,
                            textTransform: 'uppercase',
                            fontFamily: '"Times New Roman", serif',
                            textAlign: 'left',
                        }}>
                            Resume
                        </span>
                    </button>

                    <div style={{
                        marginTop: 10,
                        maxWidth: 340,
                        color: 'rgba(214,190,138,0.66)',
                        fontSize: 13,
                        lineHeight: 1.5,
                        letterSpacing: 0.4,
                    }}>
                        {hasSave
                            ? 'Resume charge maintenant la derniere sauvegarde persistante.'
                            : 'Resume s activera automatiquement des qu une sauvegarde existera.'}
                    </div>
                </div>
            </div>
        </div>
    );
};
