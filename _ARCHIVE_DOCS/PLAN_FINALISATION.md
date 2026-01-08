# Plan de Finalisation - LED Route Planner

Dernière mise à jour : 31 Décembre 2025

| Phase | Statut | Description |
| :--- | :---: | :--- |
| **Phase 1 : Infrastructure & Données Réelles** | ✅ **Terminé** | Création de la table `equipes` dans Supabase, ajout des vrais camions/poseurs, création de l'API `/api/resources`. Les modèles de Planning et Installation sont connectés au vrai backend. |
| **Phase 2 : Intelligence & Calculs** | ✅ **Terminé** | Rendre les barres de chargement précises en se basant sur les livraisons réelles (et non simulées). Optimiser le Smart Scheduler avec le GPS réel. |
| **Phase 3 : Nettoyage & Production** | ✅ **Terminé** | Supprimer les fichiers de données factices (`mockData.ts`), corriger le bug de quota Google Sheets qui vient d'apparaître, vérifier tous les logs d'erreurs. |

---

## Détail des Tâches Restantes (Phase 2 & 3)

### 1. 🚨 URGENCE : Corriger le Bug "Quota Exceeded" (Google Sheets)
Le serveur plante car il interroge Google Sheets trop souvent.
- [x] **Augmenter le délai** dans `server/bridge.js` (passé de 15s à 120s).
- [x] Ajouter une **pause intelligente** entre chaque onglet scanné (5s).

### 2. Calcul de Capacité Camion (Réel)
Actuellement, la barre de chargement dans le modal de planification est "approximative" ou basée sur des mocks.
- [x] Dans `PlanningModal.tsx`, remplacer la logique de calcul `capacityCheck` pour utiliser la liste réelle des livraisons (`allClients` filtré par date et camion).
- [x] Vérifier que le volume en m³ des commandes clients est bien calculé depuis leur nombre de LEDs.
- [x] **Réactiver l'optimisation des routes ("Optimiser")**
  - [x] Rebrancher le bouton sur `OptimizerService.simulateTourSync` (Local Solver)
  - [x] Vérifier que l'ordre des livraisons change bien visuellement.
  - [x] Filtrage par Zones (FR, GP, MQ, CORSE).

- [x] **Clarifier la Vue Installations**
  - [x] Créer 3 états : "À Planifier" (Inbox), "Planning" (Agenda), "Historique".
  - [x] Nettoyer les filtres et s'assurer que seuls les vrais 'LIVRÉS' apparaissent dans "À Planifier".
  - [x] Filtrage par Zones.

### 3. Smart Scheduler & GPS
- [x] Vérifier que le géocodage (adresse -> GPS) fonctionne bien pour tous les clients (Via bridge.js).
- [x] S'assurer que le suggestions de dates prennent bien en compte la distance réelle via la base de données.

### 4. Nettoyage Final (Clean-up)
- [x] Supprimer `src/data/mockData.ts`.
- [x] Vérifier qu'il ne reste plus aucune importation de mocks dans le projet.
- [ ] Faire un test complet : Ajout client Sheets -> Apparition App -> Planification -> Validation.
