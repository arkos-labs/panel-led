import { useEffect, useRef, useState } from 'react';

interface UsePullToRefreshOptions {
    onRefresh: () => Promise<void>;
    threshold?: number;
    resistance?: number;
    enabled?: boolean;
}

export function usePullToRefresh({
    onRefresh,
    threshold = 80,
    resistance = 2.5,
    enabled = true
}: UsePullToRefreshOptions) {
    const [isPulling, setIsPulling] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);

    const startY = useRef(0);
    const currentY = useRef(0);

    useEffect(() => {
        if (!enabled) return;

        const handleTouchStart = (e: TouchEvent) => {
            // Ne déclencher que si on est en haut de la page
            if (window.scrollY > 0) return;

            startY.current = e.touches[0].clientY;
            setIsPulling(true);
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!isPulling || isRefreshing) return;
            if (window.scrollY > 0) {
                setIsPulling(false);
                return;
            }

            currentY.current = e.touches[0].clientY;
            const distance = Math.max(0, (currentY.current - startY.current) / resistance);

            setPullDistance(distance);

            // Empêcher le scroll si on tire vers le bas
            if (distance > 0) {
                e.preventDefault();
            }
        };

        const handleTouchEnd = async () => {
            if (!isPulling) return;

            setIsPulling(false);

            if (pullDistance >= threshold && !isRefreshing) {
                setIsRefreshing(true);
                try {
                    await onRefresh();
                } finally {
                    setIsRefreshing(false);
                    setPullDistance(0);
                }
            } else {
                setPullDistance(0);
            }
        };

        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd);

        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [enabled, isPulling, isRefreshing, pullDistance, threshold, resistance, onRefresh]);

    return {
        isPulling,
        isRefreshing,
        pullDistance,
        progress: Math.min(100, (pullDistance / threshold) * 100)
    };
}

// Composant d'indicateur de pull-to-refresh
interface PullToRefreshIndicatorProps {
    isPulling: boolean;
    isRefreshing: boolean;
    progress: number;
}

export function PullToRefreshIndicator({ isPulling, isRefreshing, progress }: PullToRefreshIndicatorProps) {
    if (!isPulling && !isRefreshing) return null;

    return (
        <div className={`ptr-indicator ${isPulling || isRefreshing ? 'active' : ''}`}>
            {isRefreshing ? (
                <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    <span>Actualisation...</span>
                </div>
            ) : (
                <div className="flex items-center gap-2">
                    <div className="relative h-4 w-4">
                        <svg className="transform -rotate-90" viewBox="0 0 36 36">
                            <circle
                                cx="18"
                                cy="18"
                                r="16"
                                fill="none"
                                stroke="rgba(255,255,255,0.3)"
                                strokeWidth="3"
                            />
                            <circle
                                cx="18"
                                cy="18"
                                r="16"
                                fill="none"
                                stroke="white"
                                strokeWidth="3"
                                strokeDasharray={`${progress} 100`}
                                strokeLinecap="round"
                            />
                        </svg>
                    </div>
                    <span>{progress >= 100 ? 'Relâchez pour actualiser' : 'Tirez pour actualiser'}</span>
                </div>
            )}
        </div>
    );
}
