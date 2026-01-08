import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Download } from 'lucide-react';
import { toast } from 'sonner';

export function PWAPrompt() {
    const [showInstallPrompt, setShowInstallPrompt] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('SW Registered:', r);
        },
        onRegisterError(error) {
            console.log('SW registration error', error);
        },
    });

    // Gérer l'événement d'installation PWA
    useEffect(() => {
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowInstallPrompt(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
        };
    }, []);

    // Notification de mise à jour disponible
    useEffect(() => {
        if (needRefresh) {
            toast.info('Mise à jour disponible', {
                description: 'Une nouvelle version de l\'application est disponible',
                action: {
                    label: 'Mettre à jour',
                    onClick: () => updateServiceWorker(true)
                },
                duration: Infinity
            });
        }
    }, [needRefresh, updateServiceWorker]);

    // Notification app prête hors ligne
    useEffect(() => {
        if (offlineReady) {
            toast.success('Application prête', {
                description: 'L\'application est maintenant disponible hors ligne',
                duration: 5000
            });
        }
    }, [offlineReady]);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            toast.success('Application installée', {
                description: 'Vous pouvez maintenant utiliser l\'app depuis votre écran d\'accueil'
            });
        }

        setDeferredPrompt(null);
        setShowInstallPrompt(false);
    };

    if (!showInstallPrompt) return null;

    return (
        <div className="fixed bottom-20 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96">
            <div className="bg-white rounded-lg shadow-2xl border border-border p-4 animate-slide-up">
                <div className="flex items-start gap-3">
                    <div className="bg-primary/10 rounded-lg p-2">
                        <Download className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-sm mb-1">Installer l'application</h3>
                        <p className="text-xs text-muted-foreground mb-3">
                            Installez Arkos Logistics sur votre appareil pour un accès rapide et hors ligne
                        </p>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                onClick={handleInstallClick}
                                className="flex-1"
                            >
                                Installer
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowInstallPrompt(false)}
                            >
                                Plus tard
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Hook pour vérifier si l'app est installée
export function useIsInstalled() {
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        // Vérifier si l'app est en mode standalone (installée)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        const isIOSStandalone = (window.navigator as any).standalone === true;

        setIsInstalled(isStandalone || isIOSStandalone);
    }, []);

    return isInstalled;
}

// Hook pour détecter le type d'appareil
export function useDeviceType() {
    const [deviceType, setDeviceType] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

    useEffect(() => {
        const checkDeviceType = () => {
            const width = window.innerWidth;

            if (width < 768) {
                setDeviceType('mobile');
            } else if (width < 1024) {
                setDeviceType('tablet');
            } else {
                setDeviceType('desktop');
            }
        };

        checkDeviceType();
        window.addEventListener('resize', checkDeviceType);

        return () => {
            window.removeEventListener('resize', checkDeviceType);
        };
    }, []);

    return deviceType;
}

// Hook pour détecter l'orientation
export function useOrientation() {
    const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

    useEffect(() => {
        const checkOrientation = () => {
            setOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
        };

        checkOrientation();
        window.addEventListener('resize', checkOrientation);
        window.addEventListener('orientationchange', checkOrientation);

        return () => {
            window.removeEventListener('resize', checkOrientation);
            window.removeEventListener('orientationchange', checkOrientation);
        };
    }, []);

    return orientation;
}
