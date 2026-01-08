# 📘 GUIDE UTILISATEUR - ARKOS LOGISTICS

**Application de Gestion Logistique pour LEDs**  
**Version** : 1.0.0  
**Date** : Janvier 2026

---

## 📖 TABLE DES MATIÈRES

1. [Introduction](#introduction)
2. [Premiers Pas](#premiers-pas)
3. [Tableau de Bord](#tableau-de-bord)
4. [Gestion des Clients](#gestion-des-clients)
5. [Planification des Livraisons](#planification-des-livraisons)
6. [Gestion des Installations](#gestion-des-installations)
7. [Gestion du Stock](#gestion-du-stock)
8. [Rapports et Exports](#rapports-et-exports)
9. [Historique](#historique)
10. [FAQ](#faq)

---

## 🎯 INTRODUCTION

### Qu'est-ce qu'Arkos Logistics ?

Arkos Logistics est une application web complète pour gérer :
- 📋 Les clients et leurs commandes de LEDs
- 🚚 La planification et le suivi des livraisons
- 🔧 La planification et le suivi des installations
- 📦 Le stock de LEDs par zone géographique
- 📊 Les rapports et statistiques

### À qui s'adresse cette application ?

- **Gestionnaires** : Planification, suivi global
- **Chauffeurs** : Tournées de livraison
- **Poseurs** : Chantiers d'installation
- **Administrateurs** : Gestion du stock, rapports

---

## 🚀 PREMIERS PAS

### Accéder à l'application

1. **Ouvrir votre navigateur** (Chrome, Firefox, Edge)
2. **Aller sur** : `https://votre-app.vercel.app`
3. **Se connecter** avec vos identifiants

### Interface principale

L'application est divisée en plusieurs sections accessibles via le menu latéral :

```
┌─────────────────────────────────────┐
│  🏠 Tableau de Bord                 │
│  👥 Clients                         │
│  🚚 Livraisons                      │
│  🔧 Installations                   │
│  📦 Stock                           │
│  📊 Rapports                        │
│  📜 Historique                      │
└─────────────────────────────────────┘
```

---

## 📊 TABLEAU DE BORD

### Vue d'ensemble

Le tableau de bord affiche les informations clés :

#### **Statistiques du jour**
- 📞 Clients à contacter
- 🚚 Livraisons prévues
- 🔧 Installations en cours
- 📦 État du stock

#### **Résumé annuel**
- Total de clients
- Livraisons effectuées
- Installations terminées
- LEDs installées

#### **Clients à contacter**
Liste des clients nécessitant un suivi :
- Nouveaux clients (statut "À contacter")
- Clients à rappeler
- Devis en attente

### Actions rapides

Depuis le tableau de bord, vous pouvez :
- ✅ Cliquer sur un client pour voir ses détails
- ✅ Accéder rapidement aux livraisons du jour
- ✅ Voir les installations en cours

---

## 👥 GESTION DES CLIENTS

### Voir la liste des clients

1. Cliquer sur **"Clients"** dans le menu
2. La liste affiche tous les clients avec :
   - Nom et prénom
   - Adresse
   - Nombre de LEDs
   - Statut actuel
   - Zone géographique

### Filtrer les clients

Utilisez les filtres en haut de la page :
- **Par statut** : À contacter, Signé, Livré, etc.
- **Par zone** : France, Guadeloupe, Martinique, etc.
- **Recherche** : Par nom, ville, téléphone

### Voir les détails d'un client

1. Cliquer sur un client dans la liste
2. La fiche client affiche :
   - **Informations personnelles** : Nom, adresse, téléphone
   - **Commande** : Nombre de LEDs, prix
   - **Livraison** : Date prévue, statut, livreur
   - **Installation** : Date prévue, statut, poseur
   - **Historique** : Toutes les actions effectuées

### Modifier un client

1. Ouvrir la fiche client
2. Cliquer sur **"Modifier"**
3. Modifier les informations
4. Cliquer sur **"Enregistrer"**

> ⚠️ **Note** : Les modifications sont synchronisées automatiquement avec Google Sheets

---

## 🚚 PLANIFICATION DES LIVRAISONS

### Vue Livraisons

La vue Livraisons permet de :
- Voir les livraisons planifiées par date
- Optimiser les tournées
- Suivre l'état des livraisons

### Planifier une livraison

#### **Méthode 1 : Planning rapide**

1. Aller dans **"Livraisons"**
2. Cliquer sur **"Planning Rapide"**
3. Sélectionner les clients à livrer
4. Choisir la date de livraison
5. Choisir le livreur
6. Cliquer sur **"Planifier"**

#### **Méthode 2 : Optimisation automatique**

1. Cliquer sur **"Optimiser la tournée"**
2. L'application calcule automatiquement :
   - Le meilleur ordre de passage
   - Les temps de trajet
   - L'heure estimée pour chaque client
3. Valider la tournée optimisée

### Voir la tournée du jour

1. Sélectionner la date
2. Sélectionner le camion/livreur
3. La carte affiche :
   - 📍 Tous les points de livraison
   - 🛣️ L'itinéraire optimisé
   - ⏱️ Les horaires estimés

### Statuts de livraison

| Statut | Signification |
|--------|---------------|
| 🔵 **Planifiée** | Livraison programmée |
| 🟡 **En cours** | Livreur en route |
| 🟢 **Livrée** | Livraison effectuée |
| 🔴 **Problème** | Incident à signaler |

### Confirmer une livraison

**Pour les chauffeurs** (sur mobile) :

1. Ouvrir l'app sur le téléphone
2. Voir la liste des livraisons du jour
3. Arriver chez le client
4. Cliquer sur **"Livrer"**
5. Faire signer le client
6. Prendre une photo de la signature
7. Valider

> ✅ **Automatique** : La date et l'heure sont enregistrées automatiquement

---

## 🔧 GESTION DES INSTALLATIONS

### Vue Installations

La vue Installations affiche les chantiers par statut :
- **À contacter** : Clients livrés, installation à planifier
- **Planifiées** : Installations programmées
- **En cours** : Chantiers en cours
- **Terminées** : Installations finalisées

### Planifier une installation

1. Aller dans **"Installations"**
2. Onglet **"À contacter"**
3. Sélectionner un client
4. Cliquer sur **"Planifier installation"**
5. Choisir :
   - Date de début
   - Date de fin (estimée)
   - Poseur assigné
6. Valider

### Suivre un chantier

#### **Démarrer un chantier**

1. Onglet **"Planifiées"**
2. Cliquer sur **"Démarrer"**
3. Le statut passe à **"En cours"**
4. La date de début est enregistrée

#### **Terminer un chantier**

1. Onglet **"En cours"**
2. Cliquer sur **"Terminer"**
3. Confirmer la fin du chantier
4. Le statut passe à **"Terminée"**
5. La durée est calculée automatiquement

### Statistiques d'installation

Pour chaque chantier, vous pouvez voir :
- 📅 Date de début et de fin
- ⏱️ Durée totale (en jours)
- 👷 Poseur assigné
- 💡 Nombre de LEDs installées
- 📍 Localisation

---

## 📦 GESTION DU STOCK

### Vue Stock

La vue Stock affiche le stock de LEDs par zone géographique :
- 🇫🇷 France Métropolitaine
- 🏖️ Guadeloupe
- 🍌 Martinique
- 🐂 Corse

### Informations affichées

Pour chaque zone :
- **Stock total** : Quantité totale commandée
- **Consommées** : LEDs déjà livrées/installées
- **Restantes** : Stock disponible
- **Pourcentage** : Disponibilité en %
- **Alerte** : ⚠️ Si stock < 25%

### Ajouter du stock

1. Sélectionner la zone
2. Cliquer sur **"Réception Stock"**
3. Entrer la quantité reçue
4. Cliquer sur **"Confirmer l'ajout"**

> ✅ **Automatique** : Le stock est mis à jour dans Google Sheets

### Alertes de stock critique

Quand le stock passe sous 25% :
- 🔴 La carte devient rouge
- ⚠️ Une alerte s'affiche
- 📧 Une notification est envoyée (si configuré)

### Calcul automatique

Le stock est calculé automatiquement :
```
Stock restant = Stock total - Stock consommé

Stock consommé = Somme des LEDs des clients avec statut :
- Livraison confirmée
- Installation en cours
- Installation terminée
```

---

## 📊 RAPPORTS ET EXPORTS

### Types de rapports disponibles

#### **1. Rapport des Livraisons**

Contient :
- Liste de tous les clients livrés
- Dates de livraison
- Livreurs assignés
- Nombre de LEDs par livraison
- Statistiques globales

**Formats** : PDF, Excel

#### **2. Rapport des Installations**

Contient :
- Liste de tous les chantiers
- Dates de début et fin
- Durée de chaque chantier
- Poseurs assignés
- Statistiques globales

**Formats** : PDF, Excel

#### **3. Rapport de Stock**

Contient :
- État du stock par zone
- Stock total, consommé, restant
- Pourcentages de disponibilité
- Alertes critiques

**Formats** : PDF, Excel

### Générer un rapport

1. Aller dans la vue concernée (Livraisons, Installations, Stock)
2. Cliquer sur **"Exporter"**
3. Choisir le format :
   - **PDF** : Pour impression ou présentation
   - **Excel** : Pour analyse de données
4. Choisir la période (si applicable) :
   - Tout l'historique
   - Aujourd'hui
   - 7 derniers jours
   - Ce mois-ci
5. Cliquer sur **"Exporter"**
6. Le fichier se télécharge automatiquement

### Contenu des rapports PDF

Les rapports PDF incluent :
- 📋 **En-tête** : Titre, date, période
- 📊 **Statistiques** : Résumé chiffré
- 📄 **Tableau détaillé** : Toutes les données
- 📄 **Pagination** : Numéros de page
- 📅 **Date de génération**

### Contenu des fichiers Excel

Les fichiers Excel incluent :
- 📊 Toutes les colonnes de données
- 📐 Largeurs de colonnes ajustées
- 🔤 En-têtes en gras
- 📈 Prêt pour pivot tables et graphiques

---

## 📜 HISTORIQUE

### Vue Historique

L'historique affiche toutes les actions effectuées sur les clients :
- Création de client
- Modification d'informations
- Planification de livraison
- Confirmation de livraison
- Planification d'installation
- Début/Fin d'installation

### Filtrer l'historique

Vous pouvez filtrer par :
- **Client** : Voir l'historique d'un client spécifique
- **Date** : Période spécifique
- **Type d'action** : Livraison, Installation, etc.

### Informations affichées

Pour chaque action :
- 📅 Date et heure
- 👤 Client concerné
- 🔄 Type d'action
- 👷 Utilisateur ayant effectué l'action
- 📝 Détails de l'action

---

## ❓ FAQ (FOIRE AUX QUESTIONS)

### Questions générales

#### **Q : Comment me connecter à l'application ?**
**R** : Utilisez l'URL fournie par votre administrateur et vos identifiants personnels.

#### **Q : L'application fonctionne-t-elle sur mobile ?**
**R** : Oui ! L'application est optimisée pour mobile et peut être installée comme une app native (PWA).

#### **Q : Puis-je utiliser l'application hors ligne ?**
**R** : Oui, en mode PWA. Les données seront synchronisées à la reconnexion.

---

### Gestion des clients

#### **Q : Comment ajouter un nouveau client ?**
**R** : Les clients sont ajoutés via Google Sheets. Contactez votre administrateur.

#### **Q : Puis-je modifier les informations d'un client ?**
**R** : Oui, ouvrez la fiche client et cliquez sur "Modifier".

#### **Q : Les modifications sont-elles synchronisées ?**
**R** : Oui, automatiquement avec Google Sheets et Google Calendar.

---

### Livraisons

#### **Q : Comment optimiser une tournée ?**
**R** : Cliquez sur "Optimiser la tournée" dans la vue Livraisons. L'algorithme calcule le meilleur itinéraire.

#### **Q : Puis-je modifier l'ordre des livraisons ?**
**R** : Oui, vous pouvez réorganiser manuellement ou relancer l'optimisation.

#### **Q : Comment confirmer une livraison ?**
**R** : Sur mobile, cliquez sur "Livrer", faites signer le client et validez.

#### **Q : Que se passe-t-il si un client est absent ?**
**R** : Marquez la livraison comme "Problème" et ajoutez un commentaire.

---

### Installations

#### **Q : Quand planifier une installation ?**
**R** : Après la livraison, quand le client est prêt. Contactez-le d'abord.

#### **Q : Comment suivre l'avancement d'un chantier ?**
**R** : Dans l'onglet "En cours", vous voyez la date de début et la durée écoulée.

#### **Q : Puis-je assigner plusieurs poseurs ?**
**R** : Actuellement, un seul poseur par chantier. Contactez l'admin pour des besoins spécifiques.

---

### Stock

#### **Q : Comment est calculé le stock restant ?**
**R** : Stock restant = Stock total - Stock consommé (clients livrés/installés).

#### **Q : Que faire quand le stock est critique ?**
**R** : Commander du stock supplémentaire. Une alerte rouge s'affiche.

#### **Q : Le stock est-il mis à jour en temps réel ?**
**R** : Oui, à chaque livraison confirmée ou installation terminée.

---

### Rapports

#### **Q : Quelle est la différence entre PDF et Excel ?**
**R** : 
- **PDF** : Pour impression, présentation, archivage
- **Excel** : Pour analyse, graphiques, calculs

#### **Q : Puis-je personnaliser les rapports ?**
**R** : Vous pouvez choisir la période et la zone. Pour plus de personnalisation, contactez l'admin.

#### **Q : Les rapports incluent-ils les données en temps réel ?**
**R** : Oui, les rapports sont générés avec les données actuelles.

---

### Problèmes techniques

#### **Q : L'application est lente, que faire ?**
**R** : 
1. Vérifiez votre connexion internet
2. Actualisez la page (F5)
3. Videz le cache du navigateur
4. Contactez le support si le problème persiste

#### **Q : Je ne vois pas mes modifications**
**R** : Actualisez la page. Les modifications peuvent prendre quelques secondes.

#### **Q : L'application affiche "Hors ligne"**
**R** : Vérifiez votre connexion internet. Les données seront synchronisées à la reconnexion.

#### **Q : Comment signaler un bug ?**
**R** : Contactez votre administrateur avec :
- Description du problème
- Étapes pour le reproduire
- Captures d'écran si possible

---

## 📱 UTILISATION MOBILE

### Installer l'application (PWA)

#### **Sur Android** :
1. Ouvrir l'app dans Chrome
2. Cliquer sur le menu (⋮)
3. Sélectionner "Installer l'application"
4. L'icône apparaît sur l'écran d'accueil

#### **Sur iOS** :
1. Ouvrir l'app dans Safari
2. Cliquer sur le bouton Partager
3. Sélectionner "Sur l'écran d'accueil"
4. Confirmer

### Fonctionnalités mobiles

- ✅ Navigation optimisée (bottom bar)
- ✅ Touch-friendly (boutons 44px min)
- ✅ Pull-to-refresh
- ✅ Mode offline
- ✅ Notifications

### Conseils d'utilisation mobile

- 📱 Utilisez en mode portrait pour une meilleure lisibilité
- 🔋 Activez le mode économie d'énergie si batterie faible
- 📶 Synchronisez régulièrement quand vous avez du réseau
- 🔔 Activez les notifications pour les alertes importantes

---

## 🔐 SÉCURITÉ ET CONFIDENTIALITÉ

### Données personnelles

- 🔒 Toutes les données sont chiffrées
- 🔐 Connexion sécurisée (HTTPS)
- 👤 Accès restreint par utilisateur
- 📝 Logs d'audit pour traçabilité

### Bonnes pratiques

- ✅ Ne partagez jamais vos identifiants
- ✅ Déconnectez-vous après utilisation (ordinateurs partagés)
- ✅ Utilisez un mot de passe fort
- ✅ Signalez toute activité suspecte

---

## 📞 SUPPORT

### Besoin d'aide ?

**Contact** :
- 📧 Email : support@arkos-labs.com
- 📱 Téléphone : +33 X XX XX XX XX
- 💬 Chat : Disponible dans l'application

**Horaires** :
- Lundi - Vendredi : 9h - 18h
- Weekend : Support d'urgence uniquement

### Ressources

- 📚 Documentation technique : `/docs`
- 🎥 Vidéos tutoriels : [YouTube]
- 📖 Guide de démarrage rapide : `/quick-start`

---

## 🎓 GLOSSAIRE

| Terme | Définition |
|-------|------------|
| **LED** | Diode électroluminescente à installer |
| **Chantier** | Site d'installation des LEDs |
| **Tournée** | Ensemble de livraisons planifiées |
| **Poseur** | Technicien effectuant l'installation |
| **Livreur** | Chauffeur effectuant les livraisons |
| **PWA** | Progressive Web App (app installable) |
| **Optimisation** | Calcul du meilleur itinéraire |
| **Stock critique** | Stock < 25% du total |

---

## 📝 NOTES DE VERSION

### Version 1.0.0 (Janvier 2026)

**Nouvelles fonctionnalités** :
- ✅ Gestion complète des clients
- ✅ Planification des livraisons
- ✅ Gestion des installations
- ✅ Suivi du stock multi-zones
- ✅ Rapports PDF et Excel
- ✅ Application mobile (PWA)
- ✅ Mode offline
- ✅ Optimisation des tournées

---

**Date de création** : Janvier 2026  
**Dernière mise à jour** : 04 Janvier 2026  
**Version du guide** : 1.0.0

---

**© 2026 Arkos Labs - Tous droits réservés**
