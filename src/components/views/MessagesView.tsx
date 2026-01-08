import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, User, Truck, Clock, Link, Eye } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Message {
    id: string;
    driver_id: string;
    content: string;
    direction: 'from_driver' | 'to_driver';
    created_at: string;
    sender_name?: string;
    is_read: boolean;
}

interface Conversation {
    driverId: string;
    driverName: string;
    lastMessage: Message;
    unreadCount: number;
}

export function MessagesView() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);

    // Fetch all messages to group them
    const fetchConversations = async () => {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .order('created_at', { ascending: true });

        if (error || !data) return;

        const groups: Record<string, Message[]> = {};
        data.forEach((msg: Message) => {
            if (!groups[msg.driver_id]) groups[msg.driver_id] = [];
            groups[msg.driver_id].push(msg);
        });

        const convs: Conversation[] = Object.keys(groups).map(dId => {
            const msgs = groups[dId];
            const last = msgs[msgs.length - 1];
            const unread = msgs.filter(m => m.direction === 'from_driver' && !m.is_read).length;
            return {
                driverId: dId,
                driverName: last.sender_name || `Chauffeur ${dId}`,
                lastMessage: last,
                unreadCount: unread
            };
        });

        // Sort by last message date
        convs.sort((a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime());
        setConversations(convs);
    };

    useEffect(() => {
        fetchConversations();
        const channel = supabase
            .channel('admin-chat')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages' },
                () => {
                    fetchConversations();
                    if (selectedDriverId) fetchMessagesForDriver(selectedDriverId);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedDriverId]);

    const fetchMessagesForDriver = async (driverId: string) => {
        const { data } = await supabase
            .from('messages')
            .select('*')
            .eq('driver_id', driverId)
            .order('created_at', { ascending: true });

        if (data) {
            setMessages(data as Message[]);
            // Mark as read
            const unread = data.filter((m: Message) => m.direction === 'from_driver' && !m.is_read);
            if (unread.length > 0) {
                await supabase
                    .from('messages')
                    .update({ is_read: true })
                    .in('id', unread.map((m: Message) => m.id));
                // Update local counts
                fetchConversations();
            }
        }
        setTimeout(() => {
            if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }, 100);
    };

    const handleSelectDriver = (driverId: string) => {
        setSelectedDriverId(driverId);
        fetchMessagesForDriver(driverId);
    };

    const sendMessage = async () => {
        if (!newMessage.trim() || !selectedDriverId) return;

        const content = newMessage.trim();
        setNewMessage("");

        await supabase.from('messages').insert({
            driver_id: selectedDriverId,
            direction: 'to_driver',
            content: content,
            sender_name: 'Dispatch',
            is_read: false
        });

        // Optimistic update handled by subscription or re-fetch
        fetchMessagesForDriver(selectedDriverId);
    };

    const sendAppAccess = async () => {
        if (!selectedDriverId) return;

        const appUrl = window.location.origin;
        const driverLink = `${appUrl}/driver/${selectedDriverId}`;
        const message = `📱 Voici ton accès à l'application chauffeur (sans login) :\n${driverLink}\n\nClique sur ce lien pour voir ta tournée.`;

        await supabase.from('messages').insert({
            driver_id: selectedDriverId,
            direction: 'to_driver',
            content: message,
            sender_name: 'Dispatch',
            is_read: false
        });

        fetchMessagesForDriver(selectedDriverId);
    };

    return (
        <div className="h-[calc(100vh-8rem)] grid grid-cols-12 gap-6 animate-fade-in">
            {/* Conversations List */}
            <Card className="col-span-4 flex flex-col overflow-hidden bg-white/50 backdrop-blur-lg border-white/20 shadow-xl">
                <div className="p-4 border-b border-gray-100 bg-white/50">
                    <h2 className="font-bold text-lg flex items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-blue-600" />
                        Messagerie
                    </h2>
                </div>
                <ScrollArea className="flex-1">
                    <div className="p-2 space-y-2">
                        {conversations.length === 0 && (
                            <div className="text-center p-8 text-muted-foreground text-sm">
                                Aucune conversation active
                            </div>
                        )}
                        {conversations.map((conv) => (
                            <div
                                key={conv.driverId}
                                onClick={() => handleSelectDriver(conv.driverId)}
                                className={cn(
                                    "p-3 rounded-xl cursor-pointer transition-all hover:bg-white hover:shadow-md border border-transparent",
                                    selectedDriverId === conv.driverId ? "bg-blue-50 border-blue-200 shadow-sm" : "bg-transparent",
                                    conv.unreadCount > 0 ? "font-semibold" : ""
                                )}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                            <Truck className="h-4 w-4" />
                                        </div>
                                        <span className="text-sm font-bold text-slate-800">{conv.driverName}</span>
                                    </div>
                                    {conv.unreadCount > 0 && (
                                        <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                                            {conv.unreadCount}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500 truncate pl-10 pr-2">
                                    {conv.lastMessage.direction === 'to_driver' && "Vous: "}
                                    {conv.lastMessage.content}
                                </p>
                                <p className="text-[10px] text-slate-400 text-right mt-1">
                                    {format(new Date(conv.lastMessage.created_at), 'HH:mm')}
                                </p>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </Card>

            {/* Chat Area */}
            <Card className="col-span-8 flex flex-col overflow-hidden bg-white shadow-xl border-0">
                {!selectedDriverId ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                        <MessageSquare className="h-16 w-16 mb-4 opacity-50" />
                        <p>Sélectionnez une conversation</p>
                    </div>
                ) : (
                    <>
                        <div className="p-4 border-b flex items-center justify-between bg-slate-50">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                                    {conversations.find(c => c.driverId === selectedDriverId)?.driverName.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800">
                                        {conversations.find(c => c.driverId === selectedDriverId)?.driverName}
                                    </h3>
                                    <p className="text-xs text-slate-500 flex items-center gap-1">
                                        <Clock className="h-3 w-3" /> En ligne
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => window.open(`/driver/${selectedDriverId}`, '_blank')} className="text-slate-600 border-slate-200 hover:bg-slate-50">
                                    <Eye className="mr-2 h-4 w-4" />
                                    Voir
                                </Button>
                                <Button variant="outline" size="sm" onClick={sendAppAccess} className="text-blue-600 border-blue-200 hover:bg-blue-50">
                                    <Link className="mr-2 h-4 w-4" />
                                    Envoyer App
                                </Button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50" ref={scrollRef}>
                            {messages.map((msg) => {
                                const isMe = msg.direction === 'to_driver'; // Admin is sending 'to_driver'
                                return (
                                    <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                                        <div className={cn(
                                            "max-w-[70%] rounded-2xl px-4 py-3 shadow-sm",
                                            isMe
                                                ? "bg-blue-600 text-white rounded-br-none"
                                                : "bg-white text-slate-800 border border-slate-200 rounded-bl-none"
                                        )}>
                                            <p className="text-sm">{msg.content}</p>
                                            <p className={cn("text-[10px] mt-1 opacity-70 text-right", isMe ? "text-blue-100" : "text-slate-400")}>
                                                {format(new Date(msg.created_at), 'HH:mm')}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        <div className="p-4 bg-white border-t flex gap-3">
                            <Input
                                placeholder="Tapez votre message..."
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                                className="flex-1 bg-slate-50 border-slate-200 focus-visible:ring-blue-500"
                            />
                            <Button onClick={sendMessage} className="bg-blue-600 hover:bg-blue-700 w-12 h-10 px-0 rounded-xl">
                                <Send className="h-5 w-5 text-white" />
                            </Button>
                        </div>
                    </>
                )}
            </Card>
        </div>
    );
}
