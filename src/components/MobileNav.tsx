import { Home, Truck, Wrench, Package, BarChart3, Menu } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface MobileNavProps {
    onMenuClick?: () => void;
}

export function MobileNav({ onMenuClick }: MobileNavProps) {
    const location = useLocation();
    const navigate = useNavigate();

    const navItems = [
        { icon: Home, label: 'Accueil', path: '/' },
        { icon: Truck, label: 'Livraisons', path: '/livraisons' },
        { icon: Wrench, label: 'Installations', path: '/installations' },
        { icon: Package, label: 'Stock', path: '/stock' },
        { icon: Menu, label: 'Menu', onClick: onMenuClick },
    ];

    return (
        <nav className="mobile-nav md:hidden">
            <div className="flex items-center justify-around py-2 px-2">
                {navItems.map((item, index) => {
                    const Icon = item.icon;
                    const isActive = item.path && location.pathname === item.path;

                    return (
                        <button
                            key={index}
                            onClick={() => {
                                if (item.onClick) {
                                    item.onClick();
                                } else if (item.path) {
                                    navigate(item.path);
                                }
                            }}
                            className={cn(
                                'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all touch-target no-select haptic-light',
                                isActive
                                    ? 'text-primary bg-primary/10'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                            )}
                        >
                            <Icon className={cn('h-5 w-5', isActive && 'scale-110')} />
                            <span className="text-xs font-medium">{item.label}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
