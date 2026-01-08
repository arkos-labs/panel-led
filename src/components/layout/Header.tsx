import { Bell, Search, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface HeaderProps {
  title: string;
  alertCount?: number;
}

export function Header({ title, alertCount = 0 }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl px-6 transition-all duration-300">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un client, une livraison..."
            className="w-80 pl-10 bg-muted/50 border-input focus:bg-background transition-colors"
          />
        </div>

        <Button variant="ghost" size="icon" className="relative hover:bg-muted">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {alertCount > 0 && (
            <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-destructive text-destructive-foreground text-xs animate-pulse-subtle">
              {alertCount}
            </Badge>
          )}
        </Button>

        <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
            <User className="h-4 w-4" />
          </div>
        </Button>
      </div>
    </header>
  );
}
