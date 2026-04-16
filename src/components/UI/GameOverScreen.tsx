import { useStore } from '../../engine/store';

export const GameOverScreen = () => {
    const returnToTitle = useStore((state) => state.returnToTitle);

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
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 28,
                textAlign: 'center',
            }}>
                <div style={{
                    fontFamily: '"Times New Roman", serif',
                    fontSize: 'clamp(34px, 5vw, 68px)',
                    letterSpacing: 4,
                    textTransform: 'uppercase',
                }}>
                    Game Over
                </div>
                <button
                    type="button"
                    onClick={returnToTitle}
                    style={{
                        minWidth: 220,
                        padding: '12px 20px',
                        borderRadius: 8,
                        border: '1px solid rgba(193, 150, 74, 0.82)',
                        background: 'linear-gradient(180deg, #8b6324, #5f4215)',
                        color: '#f6e3b3',
                        fontFamily: '"Times New Roman", serif',
                        fontSize: 18,
                        letterSpacing: 1.5,
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        boxShadow: '0 10px 20px rgba(0,0,0,0.28)',
                    }}
                >
                    Return To Title
                </button>
            </div>
        </div>
    );
};
