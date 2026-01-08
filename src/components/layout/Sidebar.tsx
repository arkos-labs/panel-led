import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Truck,
  Wrench,
  Package,
  Map,
  Calendar,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

const menuGroups = [
  {
    title: null, // Main dashboard section
    items: [
      { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    ]
  },
  {
    title: 'CLIENTS',
    items: [
      { id: 'clients', label: 'Clients à contacter', icon: UserPlus },
      { id: 'clients-en-cours', label: 'Clients en cours', icon: Users },
      { id: 'historique', label: 'Clients Terminés', icon: CheckCircle2 },
    ]
  },
  {
    title: 'OPÉRATIONS',
    items: [
      { id: 'livraisons', label: 'Livraisons', icon: Truck },
      { id: 'installations', label: 'Installations', icon: Wrench },
      { id: 'stock', label: 'Stock', icon: Package },
      { id: 'carte', label: 'Carte', icon: Map },
      { id: 'calendrier', label: 'Calendrier', icon: Calendar },
      { id: 'messages', label: 'Messagerie', icon: MessageSquare },
    ]
  }
];

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen transition-all duration-300 ease-in-out border-r border-sidebar-border bg-sidebar text-sidebar-foreground',
        collapsed ? 'w-20' : 'w-64'
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sidebar-primary to-purple-600 shadow-lg shadow-sidebar-primary/20">
              <Zap className="h-5 w-5 text-white" />
            </div>
            {!collapsed && (
              <div className="animate-fade-in">
                <h1 className="text-lg font-bold text-white">LED Logistic</h1>
                <p className="text-xs text-sidebar-foreground/60">GESTION & PLANNING</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-hidden px-3 py-2 space-y-3">
          {menuGroups.map((group, groupIndex) => (
            <div key={groupIndex} className="space-y-1">
              {group.title && !collapsed && (
                <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40 animate-fade-in">
                  {group.title}
                </h3>
              )}

              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => onViewChange(item.id)}
                    className={cn(
                      'sidebar-item w-full',
                      isActive ? 'sidebar-item-active' : ''
                    )}
                  >
                    <Icon className={cn('h-5 w-5 flex-shrink-0', isActive ? 'text-white' : 'text-sidebar-foreground/70')} />
                    {!collapsed && (
                      <span className="truncate font-medium animate-fade-in">{item.label}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Settings */}
        <div className="border-t border-sidebar-border p-2">
          <button className="sidebar-item w-full">
            <Settings className="h-5 w-5 flex-shrink-0 text-sidebar-foreground/70" />
            {!collapsed && <span className="font-medium animate-fade-in">Paramètres</span>}
          </button>
        </div>

        {/* Collapse Button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-sidebar-accent text-sidebar-foreground shadow-md transition-colors hover:bg-sidebar-accent/80"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
