import { useEffect, useState } from 'react';

export function useWallClock(intervalMs = 200): number {
    const [nowMs, setNowMs] = useState(() => Date.now());

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            setNowMs(Date.now());
        }, intervalMs);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [intervalMs]);

    return nowMs;
}

export function useTemporalFlag(untilTs: number, intervalMs = 150): boolean {
    return useWallClock(intervalMs) < untilTs;
}
