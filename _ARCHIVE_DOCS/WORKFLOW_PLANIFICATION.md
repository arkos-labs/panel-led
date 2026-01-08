# 📋 WORKFLOW DE PLANIFICATION OPTIMISÉE

## 🔄 Cycle de Vie d'un Client

### 1️⃣ **NOUVEAU CLIENT** → Statut: `A PLANIFIER`
- Le client signe un devis
- Dans Google Sheets, vous mettez "SIGNÉ" en colonne G
- Le bridge détecte automatiquement et convertit en **"A PLANIFIER"**
- Le client apparaît dans la section "Clients à Contacter"

### 2️⃣ **PLANIFICATION** → Statut: `EN COURS`
**Quand vous planifiez une livraison:**
- Vous sélectionnez une date optimisée via le Smart Scheduler
- Vous assignez un chauffeur/camion
- **AUTOMATIQUEMENT:**
  - ✅ Colonne G (Google Sheets) passe à **"EN COURS"**
  - ✅ Colonne H (Date prévue) est remplie
  - ✅ Colonne J (Heure RDV) est remplie
  - ✅ Colonne N (Camion ID) est remplie
  - ✅ Supabase est mis à jour
  - ✅ Le client disparaît de "Clients à Contacter"
  - ✅ Le client apparaît dans "Clients en Cours"

### 3️⃣ **LIVRAISON** → Statut: `LIVRÉ`
**Quand le chauffeur valide la livraison:**
- Il clique sur le lien de validation
- **AUTOMATIQUEMENT:**
  - ✅ Colonne G passe à **"LIVRÉ"**
  - ✅ Colonne I (Signature) est horodatée
  - ✅ Le client passe en "Livraisons Terminées"

### 4️⃣ **INSTALLATION** → Statut: `INSTALLÉ`
**Quand l'installation est terminée:**
- Le poseur valide la fin du chantier
- **AUTOMATIQUEMENT:**
  - ✅ Colonne G passe à **"INSTALLÉ"**
  - ✅ Colonnes K et L (Dates début/fin) sont remplies
  - ✅ Le client passe en "Installations Terminées"

---

## 🚚 OPTIMISATION DES TRAJETS

### Contraintes du Smart Scheduler:
- **Départ:** 5 rue des Champs-Élysées, Paris (9h00)
- **Retour:** Même adresse avant **20h00** maximum
- **Temps par client:** 45 minutes (déchargement)
- **Vitesse moyenne:** 50 km/h

### Algorithme TSP (Voyageur de Commerce):
Le système utilise l'algorithme **"Nearest Neighbor"** pour optimiser:
1. Départ du dépôt
2. Visite du client le plus proche
3. Puis du suivant le plus proche
4. Et ainsi de suite...
5. Retour au dépôt

### Calcul de Faisabilité:
```
Temps Total = Temps de Route + (Nombre de Clients × 45 min)

✅ VERT   : Retour avant 19h (marge confortable)
🟠 ORANGE : Retour entre 19h et 20h (limite)
🔴 ROUGE  : Retour après 20h (NON FAISABLE)
```

### Exemple Concret:
**Tournée de 6 clients:**
- Distance totale: 180 km
- Temps de route: 180 / 50 = 3h36
- Temps service: 6 × 45min = 4h30
- **TOTAL: 8h06** → Retour à **17h06** ✅ VERT

**Tournée de 10 clients:**
- Distance totale: 250 km
- Temps de route: 250 / 50 = 5h00
- Temps service: 10 × 45min = 7h30
- **TOTAL: 12h30** → Retour à **21h30** 🔴 ROUGE (NON FAISABLE)

---

## 📊 MAPPING DES COLONNES GOOGLE SHEETS

| Colonne | Nom | Description | Mise à jour |
|---------|-----|-------------|-------------|
| **A** | Nom | Nom du client | Manuel |
| **B** | Prénom | Prénom du client | Manuel |
| **C** | Adresse | Adresse complète | Manuel |
| **D** | Téléphone | Numéro de téléphone | Manuel |
| **E** | Email | Email du client | Manuel |
| **F** | Nb LED | Nombre de LEDs | Manuel |
| **G** | **STATUT** | **A PLANIFIER → EN COURS → LIVRÉ → INSTALLÉ** | **AUTO** |
| **H** | Date Livraison | Date prévue de livraison | AUTO (planification) |
| **I** | Signature | Horodatage de la livraison | AUTO (validation) |
| **J** | Heure RDV | Heure du rendez-vous | AUTO (planification) |
| **K** | Début Install | Date début installation | AUTO (planification install) |
| **L** | Fin Install | Date fin installation | AUTO (validation install) |
| **M** | Info Divers | Notes diverses | Manuel/Auto |
| **N** | Camion ID | ID du camion assigné | AUTO (planification) |
| **O** | Poseur ID | ID du poseur assigné | AUTO (planification install) |

---

## 🎯 RÉSUMÉ DES AUTOMATISATIONS

### ✅ Ce qui est AUTOMATIQUE:
1. Conversion "SIGNÉ" → "A PLANIFIER" (Bridge)
2. Passage "A PLANIFIER" → "EN COURS" (lors planification)
3. Géocodage des adresses (LocationIQ)
4. Calcul des trajets optimisés (TSP)
5. Vérification de faisabilité (contrainte 20h)
6. Mise à jour Google Sheets ↔ Supabase (bidirectionnel)
7. Notifications temps réel (Socket.io)

### 📝 Ce qui reste MANUEL:
1. Saisie des informations client dans Google Sheets
2. Choix de la date finale (parmi les suggestions)
3. Validation de la livraison (lien chauffeur)
4. Validation de l'installation (lien poseur)

---

## 🔧 COMMANDES UTILES

```bash
# Lancer l'application complète
npm run dev

# Lancer uniquement le bridge (sync Google Sheets)
node server/bridge.js

# Vérifier le nombre de clients dans Supabase
node check-clients.js
```

---

**Date de mise à jour:** 31/12/2024 23:40
**Version:** 2.0 - Optimisation TSP + Statut EN COURS
