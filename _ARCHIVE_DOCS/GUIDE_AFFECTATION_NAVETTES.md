# 🚚 AFFECTATION DE NAVETTE - VERSION SIMPLIFIÉE

## 🎯 Concept

**Système ultra-simplifié** : Le système calcule automatiquement **UN trajet complet** avec tous les clients planifiés pour une date donnée. Tu choisis simplement **quel chauffeur** va faire ce trajet en **un seul clic**.

---

## 📋 Comment ça marche

### 1️⃣ **Le système calcule automatiquement le trajet**
- Récupère tous les clients planifiés pour la date sélectionnée
- Calcule la charge totale (nombre de LEDs)
- Calcule la durée estimée du trajet
- Calcule l'heure de retour
- Affiche l'itinéraire complet avec tous les clients

### 2️⃣ **Tu choisis le chauffeur**
- 3 chauffeurs disponibles :
  - **Nicolas** : 1000 LEDs
  - **David** : 500 LEDs
  - **Gros Camion** : 2000 LEDs
- Le système affiche pour chaque chauffeur :
  - Le taux de remplissage (%)
  - Si le camion peut gérer la charge
  - Un badge "Capacité insuffisante" si trop petit

### 3️⃣ **Tu valides en un clic**
- Clique sur le chauffeur choisi
- Clique sur "Valider l'affectation"
- **TOUS les clients du trajet** sont affectés à ce chauffeur
- Synchronisation automatique avec Supabase et Google Sheets

---

## 🖥️ Interface

```
┌──────────────────────────────────────────────────────────┐
│  TRAJET OPTIMISÉ - 15 janvier 2026                       │
│  20 clients • 1500 LEDs au total                         │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  📦 Charge totale    ⏱️ Durée estimée    🕐 Retour      │
│     1500 LEDs           8h30                18:30        │
│                                                           │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  📍 ITINÉRAIRE (20 destinations)                         │
│                                                           │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │ 1. Jean │ │ 2. Marie│ │ 3. Paul │ │ 4. Luc  │       │
│  │ Paris   │ │ Lyon    │ │ Lille   │ │ Nantes  │       │
│  │ 100 LEDs│ │ 80 LEDs │ │ 90 LEDs │ │ 70 LEDs │       │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │
│  ... (16 autres clients)                                 │
│                                                           │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  🚚 CHOISIR LE CHAUFFEUR POUR CE TRAJET                  │
│                                                           │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│  │ 🚚 Nicolas   │ │ 🚚 David     │ │ 🚚 Gros Cam. │    │
│  │ 1000 LEDs    │ │ 500 LEDs     │ │ 2000 LEDs    │    │
│  │              │ │              │ │              │    │
│  │ ⚠️ 150%      │ │ ⚠️ 300%      │ │ ✅ 75%       │    │
│  │ [TROP PETIT] │ │ [TROP PETIT] │ │ [SÉLECTIONNÉ]│    │
│  └──────────────┘ └──────────────┘ └──────────────┘    │
│                                                           │
│                          [Valider l'affectation]         │
└──────────────────────────────────────────────────────────┘
```

---

## ✅ Workflow complet

```
1. Ouvrir "Affectation Navettes"
   ↓
2. Sélectionner une date
   ↓
3. Le système affiche automatiquement :
   - Le trajet complet avec tous les clients
   - La charge totale
   - La durée estimée
   - L'heure de retour
   ↓
4. Cliquer sur le chauffeur choisi
   (ex: Gros Camion)
   ↓
5. Cliquer sur "Valider l'affectation"
   ↓
6. ✅ TOUS les 20 clients sont affectés au Gros Camion
   ↓
7. Synchronisation automatique :
   - Supabase mis à jour
   - Google Sheets mis à jour
   - Le chauffeur voit sa tournée dans "Monitor Dispatch"
```

---

## 🎨 Codes couleurs

| Couleur | Signification |
|---------|---------------|
| 🟢 Vert | Camion OK (< 90%) |
| 🟠 Orange | Camion presque plein (90-100%) |
| 🔴 Rouge | Camion trop petit (> 100%) |
| 🔵 Bleu | Retour avant 20h |
| 🟠 Orange | Retour après 20h |

---

## 📝 Exemple concret

### Situation :
- **Date** : 15 janvier 2026
- **Clients planifiés** : 20 clients
- **Charge totale** : 1500 LEDs
- **Durée estimée** : 8h30
- **Retour estimé** : 18:30

### Choix du chauffeur :
1. **Nicolas (1000 LEDs)** : ❌ Trop petit (150% de remplissage)
2. **David (500 LEDs)** : ❌ Trop petit (300% de remplissage)
3. **Gros Camion (2000 LEDs)** : ✅ OK (75% de remplissage)

### Action :
1. Cliquer sur "Gros Camion"
2. Cliquer sur "Valider l'affectation"
3. ✅ Les 20 clients sont affectés au Gros Camion

---

## ⚡ Avantages

- **Ultra-rapide** : 2 clics au lieu de 20
- **Pas d'erreur** : Impossible d'affecter à un camion trop petit
- **Automatique** : Le trajet est calculé automatiquement
- **Visuel** : Tu vois immédiatement si le camion peut gérer
- **Simple** : Pas besoin de réfléchir, le système te guide

---

## 🔧 Technique

### Calcul automatique
```typescript
// Récupérer tous les clients planifiés pour la date
const clientsForDate = clients.filter(c => 
  c.dateLivraison === selectedDate && !c.camionId
);

// Calculer la charge totale
const totalLEDs = clientsForDate.reduce((sum, c) => 
  sum + c.nombreLED, 0
);

// Calculer le temps de retour
const timeCheck = OptimizerService.simulateTour(
  selectedDate, clientsForDate, 9, 0
);
```

### Affectation en masse
```typescript
// Affecter TOUS les clients au chauffeur sélectionné
for (const client of routeInfo.clients) {
  await supabase
    .from('clients')
    .update({
      livreur_id: selectedDriver,
      statut_client: 'EN COURS',
      statut_livraison: 'PLANIFIÉ'
    })
    .eq('id', client.id);
}
```

---

## 🎯 Cas d'usage

### Cas 1 : Trajet normal (< 1000 LEDs)
- **Choix** : Nicolas (1000 LEDs)
- **Temps** : 10 secondes

### Cas 2 : Gros trajet (1000-2000 LEDs)
- **Choix** : Gros Camion (2000 LEDs)
- **Temps** : 10 secondes

### Cas 3 : Petit trajet (< 500 LEDs)
- **Choix** : David (500 LEDs)
- **Temps** : 10 secondes

---

## 🚀 Résultat

**Avant** : 5 minutes pour affecter 20 clients un par un  
**Maintenant** : 10 secondes pour affecter les 20 clients en un clic  
**Gain** : 96% de temps économisé ! 🎉

---

**Date de mise à jour** : 01/01/2026  
**Version** : 2.0 - Version simplifiée
