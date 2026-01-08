import { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { toast } from 'sonner';

export function OfflineIndicator() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [showBanner, setShowBanner] = useState(false);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            setShowBanner(false);
            toast.success('Connexion rétablie', {
                icon: <Wifi className="h-4 w-4" />,
                duration: 3000
            });
        };

        const handleOffline = () => {
            setIsOnline(false);
            setShowBanner(true);
            toast.error('Vous êtes hors ligne', {
                icon: <WifiOff className="h-4 w-4" />,
                duration: Infinity
            });
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Vérifier l'état initial
        if (!navigator.onLine) {
            handleOffline();
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (!showBanner) return null;

    return (
        <div className={`offline-banner ${showBanner ? 'show' : ''}`}>
            <div className="flex items-center justify-center gap-2">
                <WifiOff className="h-4 w-4" />
                <span>Mode hors ligne - Les données seront synchronisées à la reconnexion</span>
            </div>
        </div>
    );
}
