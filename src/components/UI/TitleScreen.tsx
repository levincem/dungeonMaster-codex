import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { hasPersistedSave } from '../../engine/saveGame';
import { miscPath, texturesPath } from '../../data/assetPaths';

interface Props {
    onEnter: () => void;
    onResume?: () => void;
}

export const TitleScreen = ({ onEnter, onResume }: Props) => {
    const [hasSave] = useState(() => hasPersistedSave());
    const [opening, setOpening] = useState(false);
    const [logoVisible, setLogoVisible] = useState(false);
    const [showScene, setShowScene] = useState(false);

    useEffect(() => {
        const logoTimer = window.setTimeout(() => setLogoVisible(true), 120);
        const sceneTimer = window.setTimeout(() => setShowScene(true), 2120);
        return () => {
            window.clearTimeout(logoTimer);
            window.clearTimeout(sceneTimer);
        };
    }, []);

    const doorTransition = useMemo(
        () => opening ? 'transform 0.95s ease-in-out, opacity 0.95s ease-in-out' : 'transform 0.46s ease, opacity 0.46s ease',
        [opening],
    );

    const handleEnter = () => {
        if (opening) return;
        setOpening(true);
        window.setTimeout(() => onEnter(), 980);
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
            background: '#000',
        }}>
            <div style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 79%) minmax(280px, 21%)',
                alignItems: 'stretch',
                padding: 0,
                gap: 0,
                opacity: showScene ? 1 : 0,
                transform: showScene ? 'scale(1)' : 'scale(1.015)',
                transition: 'opacity 0.7s ease, transform 0.7s ease',
                pointerEvents: showScene ? 'auto' : 'none',
            }}>
                <div style={{
                    position: 'relative',
                    minHeight: '94vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    background: '#000',
                }}>
                    <div style={{
                        position: 'relative',
                        width: '100%',
                        height: '100%',
                        minHeight: '100vh',
                    }}>
                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            boxShadow: '0 34px 90px rgba(0,0,0,0.6)',
                            overflow: 'hidden',
                            background: '#000',
                        }}>
                            <div style={{
                                position: 'absolute',
                                inset: 0,
                                background: '#000',
                            }} />
                            <img
                                src={miscPath('porte_entree_gauche.png')}
                                alt=""
                                draggable={false}
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    transform: opening ? 'translateX(-46%)' : 'translateX(0)',
                                    opacity: opening ? 0.92 : 1,
                                    transition: doorTransition,
                                    willChange: 'transform, opacity',
                                }}
                            />
                            <img
                                src={miscPath('porte_entree_droite.png')}
                                alt=""
                                draggable={false}
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    transform: opening ? 'translateX(46%)' : 'translateX(0)',
                                    opacity: opening ? 0.92 : 1,
                                    transition: doorTransition,
                                    willChange: 'transform, opacity',
                                }}
                            />
                            <img
                                src={miscPath('cadre_entree.png')}
                                alt=""
                                draggable={false}
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    pointerEvents: 'none',
                                }}
                            />
                        </div>
                    </div>
                </div>

                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    justifyContent: 'stretch',
                    padding: 0,
                    backgroundImage:
                        `linear-gradient(180deg, rgba(0,0,0,0.1), rgba(0,0,0,0.3)), url(${texturesPath('wall.png')}?v=2)`,
                    backgroundSize: 'cover, 256px 256px',
                    backgroundPosition: 'center, center',
                    boxShadow: 'inset 0 0 0 1px rgba(134, 102, 55, 0.22), inset 0 0 90px rgba(0,0,0,0.55)',
                }} />
            </div>

            <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: showScene ? 1 : 0,
                pointerEvents: showScene ? 'auto' : 'none',
                transition: 'opacity 0.45s ease',
            }}>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 18,
                }}>
                    <button
                        type="button"
                        onClick={handleEnter}
                        style={buttonBase}
                    >
                        <img
                            src={miscPath('wall_switch_green_out.png')}
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
                            src={miscPath('wall_switch_red_out.png')}
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
                </div>
            </div>

            <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: showScene ? 'transparent' : '#000',
                opacity: logoVisible ? 1 : 0,
                pointerEvents: 'none',
                transition: 'opacity 1.45s ease, background 0.8s ease',
            }}>
                <img
                    src={miscPath('Dm_logo.png')}
                    alt="Dungeon Master"
                    draggable={false}
                    style={{
                        width: showScene ? 'min(34vw, 520px)' : 'min(46vw, 700px)',
                        objectFit: 'contain',
                        filter: 'drop-shadow(0 18px 48px rgba(0,0,0,0.85))',
                        transform: logoVisible
                            ? (showScene ? 'translate(5vw, -35vh) scale(0.74)' : 'translate(0, 0) scale(1)')
                            : 'translateY(-18px) scale(0.985)',
                        transition: 'width 0.8s ease, transform 1.65s ease',
                    }}
                />
            </div>
        </div>
    );
};
