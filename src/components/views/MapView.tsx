import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Client } from '@/types/logistics';
import { Search, Calendar, Truck, Route, Flag, AlertTriangle, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useSocketUpdate } from '@/providers/SocketProvider';
import { supabase } from '@/lib/supabaseClient';
import { mapSupabaseClient, cn, isZoneMatch } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OptimizerService } from '@/services/optimizer';
import { format, startOfWeek, addDays, isSameDay, isValid, parseISO, addWeeks, subWeeks } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getClientDeliveryDate } from '@/lib/business-logic';
import { getCommandoDayForDept } from '@/lib/regions';

// Custom Premium markers using CSS
const createPremiumIcon = (color: string, number?: number) => {
  return L.divIcon({
    html: `
            <div style="
                background-color: ${color};
                width: 32px;
                height: 32px;
                border: 3px solid white;
                border-radius: 50% 50% 50% 0;
                transform: rotate(-45deg);
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            ">
                <div style="
                    transform: rotate(45deg);
                    color: white;
                    font-weight: 900;
                    font-size: ${number ? '10px' : '14px'};
                    font-family: sans-serif;
                ">
                    ${number || '•'}
                </div>
            </div>
        `,
    className: 'custom-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 32]
  });
};

const premiumIcons = {
  black: createPremiumIcon('#000000'),   // Dépôt
};

function MapController({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (center && Array.isArray(center) && !isNaN(center[0])) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  return null;
}

const ZONE_CONFIG: Record<string, { center: [number, number], zoom: number }> = {
  'FR': { center: [46.603354, 1.888334], zoom: 6 },
  'GP': { center: [16.265, -61.55], zoom: 9 },
  'MQ': { center: [14.6415, -61.0242], zoom: 10 },
  'CORSE': { center: [42.0396, 9.0129], zoom: 8 },
};

export function MapView() {
  const [selectedZone, setSelectedZone] = useState<string>('FR');
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const { data, error: supErr } = await supabase.from('clients').select('*');
      if (supErr) throw supErr;
      if (data) {
        const mapped = data.map(mapSupabaseClient).filter(c => c.lat && c.lon);
        setClients(mapped.map(c => ({
          ...c,
          coordinates: [Number(c.lat), Number(c.lon)]
        })));
      }
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchClients(); }, []);
  useSocketUpdate('clients', fetchClients);

  const dateMeta = useMemo(() => {
    const dStr = selectedDate || format(new Date(), 'yyyy-MM-dd');
    const d = parseISO(dStr);
    const ref = isValid(d) ? d : new Date();
    if (ref.getDay() === 0) ref.setDate(ref.getDate() + 1);
    const ws = startOfWeek(ref, { weekStartsOn: 1 });

    // Jours de la semaine avec dates formatées
    const days = [0, 1, 2, 3, 4].map(i => ({
      name: format(addDays(ws, i), 'EEEE', { locale: fr }),
      dateDisplay: format(addDays(ws, i), 'dd/MM'),
      fullDate: addDays(ws, i)
    }));

    return {
      weekStart: ws,
      weekEnd: addDays(ws, 4),
      display: `DU ${format(ws, 'dd MMM').toUpperCase()} AU ${format(addDays(ws, 4), 'dd MMM yyyy').toUpperCase()}`,
      days
    };
  }, [selectedDate]);

  const availableWeeks = useMemo(() => {
    const list = [];
    let current = startOfWeek(new Date(), { weekStartsOn: 1 });
    for (let i = -2; i < 15; i++) {
      const w = addWeeks(current, i);
      list.push({
        value: format(w, 'yyyy-MM-dd'),
        label: `Lundi ${format(w, 'dd MMMM yyyy', { locale: fr })}`
      });
    }
    return list;
  }, []);

  const handlePrevWeek = () => setSelectedDate(format(subWeeks(parseISO(selectedDate), 1), 'yyyy-MM-dd'));
  const handleNextWeek = () => setSelectedDate(format(addWeeks(parseISO(selectedDate), 1), 'yyyy-MM-dd'));

  const filtered = useMemo(() => {
    return clients.filter(c => {
      if (!isZoneMatch(c.zone_pays, selectedZone)) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!(c.nom || '').toLowerCase().includes(s) && !(c.ville || '').toLowerCase().includes(s)) return false;
      }
      const dStr = getClientDeliveryDate(c);
      if (dStr) {
        const t = new Date(dStr).getTime();
        if (t >= dateMeta.weekStart.getTime() && t <= dateMeta.weekEnd.getTime()) return true;
        return false;
      }
      return true;
    });
  }, [clients, selectedZone, search, dateMeta]);

  const pathsData = useMemo(() => {
    const paths: any[] = [];
    let order: any[] = [];
    let curPos: [number, number] = [48.8566, 2.3522];
    const dayCols = ['#2563eb', '#0891b2', '#ca8a04', '#ea580c', '#dc2626'];

    [0, 1, 2, 3, 4].forEach(idx => {
      const dayDate = addDays(dateMeta.weekStart, idx);
      const dayClients = filtered.filter(c => {
        const d = getClientDeliveryDate(c);
        if (d) return isSameDay(new Date(d), dayDate);
        const dept = (c.codePostal || '').substring(0, 2);
        return getCommandoDayForDept(dept) === (idx + 1);
      });

      if (dayClients.length > 0) {
        const res = OptimizerService.simulateTourSync(
          dayDate,
          dayClients,
          8, 0, 22,
          { returnToDepot: idx === 4, preserveOrder: false },
          { lat: curPos[0], lon: curPos[1], id: `START_${idx}` }
        );

        const p: [number, number][] = [curPos];
        if (res?.sortedClients) {
          res.sortedClients.forEach((s: any) => { if (s.lat) p.push([s.lat, s.lon]); });
          order = [...order, ...res.sortedClients];
          const last = res.sortedClients[res.sortedClients.length - 1];
          if (last?.lat) curPos = [last.lat, last.lon];
        }
        if (idx === 4) p.push([48.8566, 2.3522]);
        paths.push({ path: p, color: dayCols[idx], name: dateMeta.days[idx].name, date: dateMeta.days[idx].dateDisplay });
      }
    });
    return { paths, order };
  }, [filtered, dateMeta]);

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] space-y-4 font-sans">
      {/* PANNEAU DE CONTRÔLE PREMIUM */}
      <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-6 shadow-2xl space-y-6 relative z-[100]">
        <div className="flex flex-col xl:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-6">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-800 p-5 rounded-[1.5rem] shadow-xl shadow-blue-200 ring-4 ring-blue-50">
              <Truck className="h-9 w-9 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase italic leading-none">Tournée Serpent</h2>
              <div className="flex items-center gap-3 mt-2">
                <Badge className="bg-blue-600/10 text-blue-700 border-none font-black text-[10px] px-3 py-1 uppercase tracking-widest">{dateMeta.display}</Badge>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-[1.5rem] border-2 border-slate-200">
              <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl hover:bg-white hover:shadow-lg transition-all" onClick={handlePrevWeek}>
                <ChevronLeft className="h-6 w-6 text-slate-700" />
              </Button>

              <Select value={selectedDate} onValueChange={setSelectedDate}>
                <SelectTrigger className="w-[340px] h-12 border-none bg-transparent font-black text-slate-800 text-lg hover:text-blue-600 transition-colors flex items-center">
                  <Calendar className="h-5 w-5 mr-3 text-blue-600 shrink-0" />
                  <div className="truncate text-left"><SelectValue /></div>
                </SelectTrigger>
                <SelectContent className="rounded-[1.5rem] border-2 border-slate-100 shadow-2xl">
                  {availableWeeks.map(w => (
                    <SelectItem key={w.value} value={w.value} className="font-bold py-4 text-slate-700 focus:bg-blue-50">{w.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl hover:bg-white hover:shadow-lg transition-all" onClick={handleNextWeek}>
                <ChevronRight className="h-6 w-6 text-slate-700" />
              </Button>
            </div>

            {/* LÉGENDE DES JOURS AVEC DATES PRÉCISES */}
            <div className="flex flex-wrap justify-center gap-3">
              {dateMeta.days.map((day, i) => {
                const colors = ['bg-blue-600', 'bg-cyan-600', 'bg-yellow-600', 'bg-orange-600', 'bg-red-600'];
                return (
                  <div key={i} className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                    <div className={cn("w-2.5 h-2.5 rounded-full shadow-sm", colors[i])} />
                    <span className="text-[10px] font-black uppercase text-slate-500">{day.name} {day.dateDisplay}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex bg-slate-100 p-2 rounded-[1.5rem] border-2">
            {['FR', 'GP', 'MQ', 'CORSE'].map(z => (
              <Button key={z} variant={selectedZone === z ? 'default' : 'ghost'} size="sm" className={cn("h-11 px-6 font-black text-xs rounded-2xl transition-all", selectedZone === z ? "bg-white shadow-xl text-blue-600 border border-slate-100" : "text-slate-400")} onClick={() => setSelectedZone(z)}>{z}</Button>
            ))}
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-4 border-t border-slate-100 pt-6">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
            <Input placeholder="Rechercher par nom ou code postal..." className="pl-12 h-14 border-2 border-slate-100 rounded-2xl focus:ring-[6px] ring-blue-50/50 focus:border-blue-200 text-lg font-medium transition-all" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-4">
            <Badge className="bg-slate-900 border-none px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-lg shadow-slate-200">{filtered.length} CLIENTS DANS LE SERPENT</Badge>
          </div>
        </div>
      </div>

      {/* CARTE */}
      <div className="flex-1 rounded-[3.5rem] overflow-hidden border-[12px] border-white shadow-[0_45px_100px_-20px_rgba(0,0,0,0.25)] relative bg-slate-200 group/map">
        <MapContainer center={ZONE_CONFIG[selectedZone].center} zoom={ZONE_CONFIG[selectedZone].zoom} style={{ height: '100%', width: '100%' }}>
          <MapController center={ZONE_CONFIG[selectedZone].center} zoom={ZONE_CONFIG[selectedZone].zoom} />
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />

          {pathsData.paths.map((s, i) => (
            <Polyline key={i} positions={s.path} color={s.color} weight={12} opacity={0.6} dashArray="20, 25" lineCap="round">
              <Popup>
                <div className="p-2 text-center">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.name}</div>
                  <div className="font-black text-slate-800 text-xl uppercase italic">{s.date}</div>
                </div>
              </Popup>
            </Polyline>
          ))}

          <Marker position={[48.8566, 2.3522]} icon={premiumIcons.black}>
            <Popup><div className="text-center font-black p-3 uppercase italic text-blue-700 flex items-center gap-2"><Flag className="h-5 w-5 text-red-600" /> DÉPART DÉPÔT PARIS</div></Popup>
          </Marker>

          {pathsData.order.map((c, i) => {
            const s = (c.statut || '').toUpperCase();
            let color = '#ef4444';
            if (s.includes('TERMIN')) color = '#22c55e';
            else if (s.includes('LIVR') || s.includes('COURS')) color = '#f97316';
            else if (s.includes('PLANIFI') && !s.includes('À PLANIFIER')) color = '#3b82f6'; // Bleu (Planifié)
            else if (s.includes('PLANIFI')) color = '#94a3b8'; // Gris (À planifier)

            return (
              <Marker key={c.id || i} position={c.coordinates} icon={createPremiumIcon(color, i + 1)}>
                <Popup>
                  <div className="p-4 min-w-[240px]">
                    <div className="flex justify-between items-center mb-3">
                      <Badge className="bg-blue-600 text-white border-none px-3 py-1 font-black italic rounded-lg">ÉTAPE {i + 1}</Badge>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{format(parseISO(selectedDate), 'MMMM yyyy', { locale: fr })}</span>
                      </div>
                    </div>
                    <div className="font-black text-slate-800 text-2xl leading-none uppercase mb-2 tracking-tight overflow-hidden text-ellipsis">{c.nom}</div>
                    <div className="text-xs font-bold text-slate-500 mb-5 leading-relaxed">{c.adresse}, {c.ville}</div>
                    <div className="flex justify-between items-center border-t border-slate-100 pt-4">
                      <Badge variant="outline" className="text-[10px] font-black uppercase text-slate-600 border-2 border-slate-100 px-3 py-1.5 rounded-xl">{c.statut}</Badge>
                      <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 flex items-center gap-2">
                        <Info className="h-3 w-3 text-blue-400" />
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{c.codePostal}</span>
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {loading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[40px] z-[2000] flex flex-col items-center justify-center transition-all">
            <div className="relative w-32 h-32 mb-10">
              <div className="absolute inset-0 border-[12px] border-slate-100 rounded-full"></div>
              <div className="absolute inset-0 border-[12px] border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <Truck className="absolute inset-0 m-auto h-12 w-12 text-blue-600 animate-pulse" />
            </div>
            <h3 className="text-4xl font-black text-blue-950 uppercase italic tracking-tighter text-center max-w-lg leading-tight">
              Génération du trajet<br /><span className="text-blue-600 drop-shadow-sm">Semaine Optimisée</span>
            </h3>
          </div>
        )}
      </div>
    </div>
  );
}
