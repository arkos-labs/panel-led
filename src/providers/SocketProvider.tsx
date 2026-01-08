import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { supabase } from '@/lib/supabaseClient';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({ socket: null, isConnected: false });

export const useSocket = () => useContext(SocketContext);

/**
 * Hook pour s'abonner aux mises à jour temps réel
 * @param type 'clients' | 'stock' | 'all'
 * @param onUpdate Callback à exécuter
 */
export const useSocketUpdate = (type: string, onUpdate: () => void) => {
    const { socket } = useSocket();

    // Legacy Socket.IO Hook
    useEffect(() => {
        if (!socket) return;
        const handler = (data: { type: string }) => {
            if (type === 'all' || data.type === type) {
                onUpdate();
            }
        };
        socket.on('update', handler);
        return () => { socket.off('update', handler); };
    }, [socket, type, onUpdate]);

    // Supabase Realtime Hook (Production)
    useEffect(() => {
        // If we are relying on Supabase Realtime instead of custom socket
        if (type === 'clients' || type === 'all') {
            const channelId = `realtime-clients-${Math.random().toString(36).substr(2, 9)}`;
            console.log(`🔌 Subscribing to Supabase Realtime channel: ${channelId}`);

            const channel = supabase
                .channel(channelId)
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'clients' },
                    (payload) => {
                        console.log('🔄 Ultra-Fresh Update: Client change detected!', payload.eventType);
                        onUpdate();
                    }
                )
                .subscribe();

            return () => {
                console.log(`🔌 Unsubscribing channel: ${channelId}`);
                supabase.removeChannel(channel);
            };
        }
    }, [type, onUpdate]);
};

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const queryClient = useQueryClient();

    useEffect(() => {
        // En production sur Vercel, on ne peut pas utiliser le serveur socket custom via HTTP
        // On désactive le socket si on est en HTTPS (sauf localhost) pour éviter les erreurs "Mixed Content"
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

        if (!isLocal) {
            console.warn("Socket.io désactivé en production (Vercel). Utilisation du polling/Supabase uniquement.");
            return;
        }

        // On utilise l'IP de l'URL courante pour contacter le serveur sur le port 3001
        const API_BASE = `http://${window.location.hostname}:3001`;
        const newSocket = io(API_BASE);

        newSocket.on('connect', () => {
            console.log('📡 WebSocket Connecté');
            setIsConnected(true);
        });

        newSocket.on('disconnect', () => {
            console.log('🔌 WebSocket Déconnecté');
            setIsConnected(false);
        });

        newSocket.on('update', (data: { type: string; timestamp: string }) => {
            console.log(`🔄 Mise à jour temps réel reçue: ${data.type}`);

            // Invalider les requêtes React Query correspondantes
            if (data.type === 'clients') {
                queryClient.invalidateQueries({ queryKey: ['clients'] });
                queryClient.invalidateQueries({ queryKey: ['livraisons'] });
                queryClient.invalidateQueries({ queryKey: ['installations'] });
            } else if (data.type === 'stock') {
                queryClient.invalidateQueries({ queryKey: ['stock'] });
                queryClient.invalidateQueries({ queryKey: ['stock-global'] });
            }

            toast.info(`Données mises à jour (${data.type})`, {
                description: `Rafraîchissement automatique à ${new Date(data.timestamp).toLocaleTimeString()}`,
                duration: 3000
            });
        });

        setSocket(newSocket);

        return () => {
            newSocket.close();
        };
    }, [queryClient]);

    return (
        <SocketContext.Provider value={{ socket, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
};
