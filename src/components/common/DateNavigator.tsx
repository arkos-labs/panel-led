import { format, addDays, subDays, startOfWeek, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

interface DateNavigatorProps {
    selectedDate: Date;
    onDateChange: (date: Date) => void;
    className?: string;
}

const ZONE_DOT_COLORS: Record<number, string> = {
    1: "bg-blue-500",   // Lundi
    2: "bg-cyan-500",   // Mardi
    3: "bg-amber-500",  // Mercredi
    4: "bg-orange-500", // Jeudi
    5: "bg-red-500",    // Vendredi
    6: "bg-indigo-500", // Samedi (if needed)
    7: "bg-emerald-500",// Dimanche (if needed)
};

export function DateNavigator({ selectedDate, onDateChange, className }: DateNavigatorProps) {
    // Obtenir le début de la semaine (Lundi)
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });

    // Générer les 5 jours de la semaine (Lundi à Vendredi)
    const weekDays = Array.from({ length: 5 }).map((_, i) => addDays(weekStart, i));

    const handlePrevDay = () => onDateChange(subDays(selectedDate, 1));
    const handleNextDay = () => onDateChange(addDays(selectedDate, 1));

    return (
        <div className={cn("flex flex-col items-center gap-6", className)}>
            {/* Sélecteur Principal (Pill) */}
            <div className="flex items-center gap-4 bg-white/80 backdrop-blur-md border border-slate-200 shadow-xl rounded-full px-4 py-3 min-w-[450px] justify-between transition-all hover:shadow-2xl">
                <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full hover:bg-slate-100 text-slate-400"
                    onClick={handlePrevDay}
                >
                    <ChevronLeft className="h-5 w-5" />
                </Button>

                <Popover>
                    <PopoverTrigger asChild>
                        <div className="flex items-center gap-8 cursor-pointer group px-4">
                            <div className="bg-blue-50 p-2 rounded-lg group-hover:bg-blue-100 transition-colors">
                                <CalendarIcon className="h-6 w-6 text-blue-600" />
                            </div>

                            <div className="flex items-center gap-3">
                                <span className="text-xl font-bold text-slate-800 capitalize">
                                    {format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })}
                                </span>
                                <ChevronDown className="h-5 w-5 text-slate-400 group-hover:text-slate-600 transition-transform group-data-[state=open]:rotate-180" />
                            </div>
                        </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="center">
                        <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={(date) => date && onDateChange(date)}
                            initialFocus
                            locale={fr}
                        />
                    </PopoverContent>
                </Popover>

                <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full hover:bg-slate-100 text-slate-400"
                    onClick={handleNextDay}
                >
                    <ChevronRight className="h-5 w-5" />
                </Button>
            </div>

            {/* Mini Navigation (Semaine) */}
            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide max-w-full">
                {weekDays.map((date) => {
                    const isSelected = isSameDay(date, selectedDate);
                    const dayIndex = date.getDay() === 0 ? 7 : date.getDay(); // 1=Lundi, ..., 5=Vendredi

                    return (
                        <button
                            key={date.toISOString()}
                            onClick={() => onDateChange(date)}
                            className={cn(
                                "flex items-center gap-2 px-6 py-2.5 rounded-full border transition-all text-[10px] font-black tracking-widest uppercase flex-shrink-0",
                                isSelected
                                    ? "bg-white border-slate-200 shadow-lg text-slate-900 scale-105 ring-1 ring-slate-100"
                                    : "bg-slate-100/40 border-transparent text-slate-400 hover:bg-white hover:border-slate-200 hover:text-slate-600"
                            )}
                        >
                            <div className={cn("w-2 h-2 rounded-full shadow-sm", ZONE_DOT_COLORS[dayIndex])} />
                            {format(date, 'EEEE dd/MM', { locale: fr }).toUpperCase()}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
