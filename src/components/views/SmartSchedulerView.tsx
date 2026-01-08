import React from 'react';
import { SmartScheduler } from '../scheduler/SmartScheduler';

export const SmartSchedulerView = () => {
    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                        Optimisation de Tournées
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Planifiez vos rendez-vous en fonction de la proximité géographique des chauffeurs et équipes.
                    </p>
                </div>
            </div>

            <div className="mt-8">
                <SmartScheduler />
            </div>
        </div>
    );
};
