import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logger from '@/services/logger';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): State {
        return {
            hasError: true,
            error,
            errorInfo: null
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Logger l'erreur
        logger.exception(error, {
            componentStack: errorInfo.componentStack,
            errorBoundary: true
        });

        this.setState({
            error,
            errorInfo
        });
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });
    };

    handleGoHome = () => {
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            // Fallback personnalisé si fourni
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // UI d'erreur par défaut
            return (
                <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">
                    <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8 space-y-6">
                        {/* Icône */}
                        <div className="flex justify-center">
                            <div className="bg-red-100 rounded-full p-6">
                                <AlertTriangle className="h-16 w-16 text-red-600" />
                            </div>
                        </div>

                        {/* Titre */}
                        <div className="text-center space-y-2">
                            <h1 className="text-3xl font-bold text-gray-900">
                                Oups ! Une erreur est survenue
                            </h1>
                            <p className="text-gray-600">
                                L'application a rencontré un problème inattendu. Nos équipes ont été notifiées.
                            </p>
                        </div>

                        {/* Détails de l'erreur (en dev uniquement) */}
                        {import.meta.env.DEV && this.state.error && (
                            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                                <h3 className="font-semibold text-gray-900">Détails techniques :</h3>
                                <div className="text-sm text-gray-700 space-y-1">
                                    <p className="font-mono bg-red-50 p-2 rounded">
                                        {this.state.error.message}
                                    </p>
                                    {this.state.error.stack && (
                                        <details className="mt-2">
                                            <summary className="cursor-pointer text-gray-600 hover:text-gray-900">
                                                Stack trace
                                            </summary>
                                            <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40">
                                                {this.state.error.stack}
                                            </pre>
                                        </details>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3 justify-center">
                            <Button
                                onClick={this.handleReset}
                                variant="outline"
                                className="gap-2"
                            >
                                <RefreshCw className="h-4 w-4" />
                                Réessayer
                            </Button>
                            <Button
                                onClick={this.handleGoHome}
                                className="gap-2"
                            >
                                <Home className="h-4 w-4" />
                                Retour à l'accueil
                            </Button>
                        </div>

                        {/* Message de support */}
                        <div className="text-center text-sm text-gray-500 pt-4 border-t">
                            <p>
                                Si le problème persiste, contactez le support technique avec le code d'erreur :
                            </p>
                            <p className="font-mono text-gray-700 mt-1">
                                {new Date().toISOString().split('T')[0]}-{Math.random().toString(36).substr(2, 9).toUpperCase()}
                            </p>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// Hook pour utiliser l'Error Boundary de manière programmatique
export function useErrorHandler() {
    const [, setError] = React.useState();

    return React.useCallback((error: Error) => {
        logger.exception(error, { manual: true });
        setError(() => {
            throw error;
        });
    }, []);
}
