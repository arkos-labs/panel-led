import { useState } from 'react';
import { Phone, XCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Client } from '@/types/logistics';

interface CallActionModalProps {
    client: Client;
    isOpen: boolean;
    onClose: () => void;
    onNoAnswer: () => void;
    onAnswered: () => void;
    onCancelRecall: () => void;
    isRecallMode: boolean;
}

export function CallActionModal({
    client,
    isOpen,
    onClose,
    onNoAnswer,
    onAnswered,
    onCancelRecall,
    isRecallMode,
}: CallActionModalProps) {
    // If not open, we can return null or empty to save rendering, but Dialog handles visibility.
    // However, if we try to render content accessing client.* when client is null, it crashes.
    if (!client && isOpen) return null; // Should not happen if parent logic is correct, but safe guard.
    if (!client) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Phone className="h-5 w-5" />
                        Appel en cours
                    </DialogTitle>
                    <DialogDescription>
                        Appel avec {client.prenom} {client.nom}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="rounded-lg bg-muted p-4">
                        <p className="text-sm font-medium mb-2">Numéro de téléphone</p>
                        <a
                            href={`tel:${client.telephone}`}
                            className="text-2xl font-bold text-primary hover:underline"
                        >
                            {client.telephone}
                        </a>
                    </div>

                    <div className="text-sm text-muted-foreground">
                        <p><strong>Adresse :</strong> {client.adresse}, {client.codePostal} {client.ville}</p>
                        <p><strong>LED :</strong> {client.nombreLED || client.nb_led || 0} {client.marqueLED ? `(${client.marqueLED})` : ''}</p>
                    </div>
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-col">
                    <Button
                        variant="outline"
                        className="w-full gap-2 border-orange-200 text-orange-600 hover:bg-orange-50"
                        onClick={() => {
                            onNoAnswer();
                            onClose();
                        }}
                    >
                        <XCircle className="h-4 w-4" />
                        Ne répond pas (+26h)
                    </Button>

                    <Button
                        className="w-full gap-2"
                        onClick={() => {
                            onAnswered();
                            onClose();
                        }}
                    >
                        <CheckCircle2 className="h-4 w-4" />
                        Client a répondu - Planifier
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
