import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { DashboardView } from '@/components/views/DashboardView';
import { StockView } from '@/components/views/StockView';
import { ClientsView } from '@/components/views/ClientsView';
import { ClientsEnCoursView } from '@/components/views/ClientsEnCoursView';
import { LivraisonsView } from '@/components/views/LivraisonsView';
import { InstallationsView } from '@/components/views/InstallationsView';
import { MapView } from '@/components/views/MapView';
import { CalendarView } from '@/components/views/CalendarView';
import { HistoryView } from '@/components/views/HistoryView';
import { ClientDetailsView } from '@/components/views/ClientDetailsView';
import { MessagesView } from '@/components/views/MessagesView';

// import { mockStock } from '@/data/mockData';

const viewTitles: Record<string, string> = {
  dashboard: 'Tableau de bord',
  clients: 'Clients à contacter',
  'clients-en-cours': 'Clients en cours',
  livraisons: 'Planning Livraisons',
  installations: 'Planning Installations',
  stock: 'Gestion des Stocks',
  historique: 'Clients Terminés',
  'client-details': 'Détail du Chantier',
  carte: 'Carte',
  calendrier: 'Calendrier',
  messages: 'Messagerie Dispatch',
};

const Index = () => {
  // Initialize from LocalStorage or default to 'dashboard'
  const [activeView, setActiveView] = useState(() => {
    return localStorage.getItem('lastActiveView') || 'dashboard';
  });

  // Save to LocalStorage whenever view changes
  useEffect(() => {
    localStorage.setItem('lastActiveView', activeView);
  }, [activeView]);
  const [selectedClient, setSelectedClient] = useState<any>(null); // Using any to avoid complex type drilling for now, or import Client

  // Calculate alerts (requires stock API now)
  const stockAlerts = 0; // Temporarily 0 until we fetch real stock

  const handleViewDetails = (client: any) => {
    setSelectedClient(client);
    setActiveView('client-details');
  };

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardView />;
      case 'clients':
        return <ClientsView />;
      case 'clients-en-cours':
        return <ClientsEnCoursView />;
      case 'livraisons':
        return <LivraisonsView />;
      case 'installations':
        return <InstallationsView />;
      case 'stock':
        return <StockView />;
      case 'historique':
        return <HistoryView onViewDetails={handleViewDetails} />;
      case 'client-details':
        // Import ClientDetailsView logic here
        // We need to dinamically import or assume it's imported at top
        return (
          // @ts-ignore - Component created above but not yet imported in this file content block
          <ClientDetailsView client={selectedClient} onBack={() => setActiveView('historique')} />
        );
      case 'carte':
        return <MapView />;
      case 'calendrier':
        return <CalendarView />;
      case 'messages':
        return <MessagesView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />

      <div className="pl-20 lg:pl-64 transition-all duration-300">
        <Header title={viewTitles[activeView]} alertCount={stockAlerts} />

        <main className="p-6">
          {renderView()}
        </main>
      </div>
    </div>
  );
};

export default Index;
