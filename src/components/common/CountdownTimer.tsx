import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CountdownTimerProps {
    targetDate: Date;
}

export function CountdownTimer({ targetDate }: CountdownTimerProps) {
    const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);

    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = new Date();
            const diff = targetDate.getTime() - now.getTime();

            if (diff <= 0) {
                setTimeLeft(null); // Time's up
                return;
            }

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            setTimeLeft({ hours, minutes, seconds });
        };

        calculateTimeLeft(); // Initial calculation
        const timer = setInterval(calculateTimeLeft, 1000);

        return () => clearInterval(timer);
    }, [targetDate]);

    if (!timeLeft) {
        // Should be handled by parent to switch to "Time's up" UI, but rendering nothing here if controlled externally
        return null;
    }

    const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        timeZone: 'Europe/Paris'
    });

    const timeFormatter = new Intl.DateTimeFormat('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Paris'
    });

    return (
        <div className="flex flex-col gap-1 flex-1">
            <Button className="w-full gap-2 bg-orange-50 text-orange-700 font-medium cursor-not-allowed border-orange-200 opacity-100" size="sm" variant="outline" disabled>
                <Clock className="h-4 w-4 animate-pulse" />
                <span className="tabular-nums font-bold">
                    {String(timeLeft.hours).padStart(2, '0')}h {String(timeLeft.minutes).padStart(2, '0')}m {String(timeLeft.seconds).padStart(2, '0')}s
                </span>
            </Button>
            <span className="text-xs text-center text-muted-foreground font-medium">
                À rappeler le {dateFormatter.format(targetDate)} à {timeFormatter.format(targetDate).replace(':', 'h')}
            </span>
        </div>
    );
}
