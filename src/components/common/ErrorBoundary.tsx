
import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 text-center">
                    <div className="rounded-full bg-red-100 p-4 mb-4">
                        <AlertTriangle className="h-10 w-10 text-red-600" />
                    </div>
                    <h1 className="mb-2 text-2xl font-bold text-slate-900">Oups, une erreur est survenue</h1>
                    <p className="mb-6 max-w-md text-slate-600">
                        L'application a rencontré un problème inattendu.
                        <br />
                        <span className="font-mono text-xs bg-slate-200 p-1 rounded mt-2 block break-all text-red-500">
                            {this.state.error?.message}
                        </span>
                    </p>
                    <div className="flex gap-4">
                        <Button
                            onClick={() => window.location.reload()}
                            variant="default"
                            className="gap-2"
                        >
                            <RefreshCcw className="h-4 w-4" />
                            Rafraîchir la page
                        </Button>
                        <Button
                            onClick={() => {
                                localStorage.clear();
                                window.location.href = '/';
                            }}
                            variant="outline"
                        >
                            Réinitialiser l'application
                        </Button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
