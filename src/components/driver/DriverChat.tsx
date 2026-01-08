import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { MessageCircle, Send, X, Minimize2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Message {
    id: string;
    content: string;
    direction: 'from_driver' | 'to_driver';
    created_at: string;
}

interface DriverChatProps {
    driverId: string;
    driverName: string;
}

export function DriverChat({ driverId, driverName }: DriverChatProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchMessages = async () => {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('driver_id', driverId)
            .order('created_at', { ascending: true });

        if (!error && data) {
            setMessages(data as Message[]);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchMessages();
            // Mark as read logic here if needed
            setUnreadCount(0);
        }

        const channel = supabase
            .channel(`chat:${driverId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `driver_id=eq.${driverId}`
                },
                (payload) => {
                    const newMsg = payload.new as Message;
                    setMessages((curr) => [...curr, newMsg]);
                    if (!isOpen && newMsg.direction === 'to_driver') {
                        setUnreadCount((c) => c + 1);
                        toast.info("Nouveau message du bureau !");
                    }
                    if (isOpen) {
                        setTimeout(() => scrollToBottom(), 100);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [driverId, isOpen]);

    const scrollToBottom = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const sendMessage = async () => {
        if (!newMessage.trim()) return;

        const msgContent = newMessage.trim();
        setNewMessage(""); // Optimistic clear

        // Optimistic UI
        const tempId = Date.now().toString();
        const optimisticMsg: Message = {
            id: tempId,
            content: msgContent,
            direction: 'from_driver',
            created_at: new Date().toISOString()
        };
        setMessages((prev) => [...prev, optimisticMsg]);

        try {
            const { error } = await supabase
                .from('messages')
                .insert({
                    driver_id: driverId,
                    direction: 'from_driver',
                    content: msgContent,
                    sender_name: driverName,
                    is_read: false
                });

            if (error) {
                console.error("Error sending message:", error);
                toast.error("Erreur d'envoi");
                setMessages((prev) => prev.filter(m => m.id !== tempId)); // Revert
                setNewMessage(msgContent); // Restore text
            }
        } catch (e) {
            console.error(e);
        }
    };

    if (!isOpen) {
        return (
            <Button
                onClick={() => setIsOpen(true)}
                className={cn(
                    "fixed bottom-24 right-6 h-16 w-16 rounded-full shadow-2xl z-[9999] transition-all hover:scale-105 active:scale-95 flex items-center justify-center",
                    unreadCount > 0 ? "bg-red-600 animate-bounce" : "bg-blue-600 text-white"
                )}
                style={{ position: 'fixed', bottom: '100px', right: '20px', zIndex: 9999 }} // Force inline styles for debug
            >
                <MessageCircle className="h-7 w-7 text-white" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-white text-red-600 font-bold text-xs h-5 w-5 rounded-full flex items-center justify-center border-2 border-red-500">
                        {unreadCount}
                    </span>
                )}
            </Button>
        );
    }

    return (
        <Card className={cn(
            "fixed bottom-32 right-6 w-80 sm:w-96 shadow-2xl z-[9999] flex flex-col overflow-hidden border-2 border-slate-200 transition-all duration-300",
            isMinimized ? "h-14" : "h-[500px] max-h-[70vh]"
        )}>
            {/* Header */}
            <div className="bg-slate-900 text-white p-3 flex items-center justify-between cursor-pointer" onClick={() => setIsMinimized(!isMinimized)}>
                <div className="flex items-center gap-2">
                    <div className="bg-green-500 h-2 w-2 rounded-full animate-pulse" />
                    <h3 className="font-bold text-sm">Message Dispatch</h3>
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-white" onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}>
                        <Minimize2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-white" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {!isMinimized && (
                <>
                    {/* Messages Area */}
                    <div className="flex-1 bg-slate-50 p-4 overflow-y-auto space-y-3" ref={scrollRef}>
                        {messages.length === 0 && (
                            <div className="text-center text-slate-400 text-xs py-8">
                                Aucune conversation.<br />Écrivez un message au bureau.
                            </div>
                        )}
                        {messages.map((msg, idx) => {
                            const isMe = msg.direction === 'from_driver';
                            return (
                                <div key={idx} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                                    <div className={cn(
                                        "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                                        isMe ? "bg-blue-600 text-white rounded-br-none" : "bg-white text-slate-800 border border-slate-200 rounded-bl-none"
                                    )}>
                                        {msg.content}
                                        <p className={cn("text-[9px] mt-1 opacity-70 text-right", isMe ? "text-blue-100" : "text-slate-400")}>
                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Input Area */}
                    <div className="p-3 bg-white border-t border-slate-100 flex gap-2">
                        <Input
                            placeholder="Message..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                            className="flex-1 focus-visible:ring-blue-500"
                        />
                        <Button size="icon" className="bg-blue-600 hover:bg-blue-700" onClick={sendMessage}>
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                </>
            )}
        </Card>
    );
}
