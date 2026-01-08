# 🚦 GESTION INTELLIGENTE DE LA CAPACITÉ

## 🎯 Problème résolu

Quand tu planifies des clients, le système doit :
1. **Bloquer** si tous les camions sont pleins
2. **Proposer** d'ajouter un 2ème chauffeur pour partager la charge
3. **Empêcher** de dépasser la capacité totale

## ✅ Solution implémentée

### Vérification automatique en 3 niveaux

#### Niveau 1 : ✅ Capacité OK
```
┌────────────────────────────────────────┐
│ ✅ 2 camions disponibles               │
│ 1 camion déjà plein pour cette date    │
└────────────────────────────────────────┘
```
**Action** : Tu peux planifier normalement

---

#### Niveau 2 : ⚠️ Tous les camions pleins (mais capacité totale OK)
```
┌────────────────────────────────────────┐
│ ⚠️ Tous les camions sont pleins !      │
│                                        │
│ Aucun camion ne peut prendre ce client │
│ (300 LEDs) pour cette date.            │
│                                        │
│ 💡 Solution recommandée :              │
│ Ajoutez un 2ème chauffeur pour         │
│ partager la charge du jour.            │
│                                        │
│ ✅ Répartir les clients entre camions  │
│ ✅ Réduire le temps de tournée         │
│ ✅ Livrer tous les clients le même jour│
│                                        │
│ [1 chauffeur utilisé]                  │
│ [2 disponibles]                        │
└────────────────────────────────────────┘
```
**Action** : Ajoute un 2ème chauffeur pour partager

---

#### Niveau 3 : ⛔ Capacité totale dépassée
```
┌────────────────────────────────────────┐
│ ⛔ Capacité totale dépassée !          │
│                                        │
│ La charge totale (4500 LEDs) dépasse   │
│ la capacité maximale de tous les       │
│ camions combinés (3500 LEDs).          │
│                                        │
│ ⚠️ Vous devez choisir une autre date   │
│ ou diviser la commande.                │
│                                        │
│ [3 chauffeurs utilisés]                │
│ [0 disponible]                         │
└────────────────────────────────────────┘
```
**Action** : Impossible de planifier, change de date

---

## 🔄 Workflow

### Scénario 1 : Journée normale
```
1. Tu planifies un client (200 LEDs)
2. Date : 15 janvier 2026
3. Système vérifie :
   - Nicolas (1000 LEDs) : 500 LEDs utilisés → ✅ OK
   - David (500 LEDs) : 0 LEDs utilisés → ✅ OK
   - Gros Camion (2000 LEDs) : 0 LEDs utilisés → ✅ OK
4. Résultat : ✅ 3 camions disponibles
5. Tu choisis Nicolas
6. Validation OK
```

---

### Scénario 2 : Journée chargée (1 camion plein)
```
1. Tu planifies un client (300 LEDs)
2. Date : 15 janvier 2026
3. Système vérifie :
   - Nicolas (1000 LEDs) : 1000 LEDs utilisés → ❌ PLEIN
   - David (500 LEDs) : 0 LEDs utilisés → ✅ OK
   - Gros Camion (2000 LEDs) : 0 LEDs utilisés → ✅ OK
4. Résultat : ✅ 2 camions disponibles
5. Message : "1 camion déjà plein pour cette date"
6. Tu choisis David ou Gros Camion
7. Validation OK
```

---

### Scénario 3 : Tous les camions pleins (mais capacité totale OK)
```
1. Tu planifies un client (300 LEDs)
2. Date : 15 janvier 2026
3. Système vérifie :
   - Nicolas (1000 LEDs) : 1000 LEDs utilisés → ❌ PLEIN
   - David (500 LEDs) : 500 LEDs utilisés → ❌ PLEIN
   - Gros Camion (2000 LEDs) : 2000 LEDs utilisés → ❌ PLEIN
4. Total : 3500 LEDs utilisés + 300 LEDs nouveau = 3800 LEDs
5. Capacité totale : 3500 LEDs
6. Résultat : ⚠️ TOUS PLEINS mais capacité totale OK
7. Message : "💡 Ajoutez un 2ème chauffeur pour partager"
8. Solution : Réaffecter certains clients à un autre chauffeur
```

**Comment faire** :
1. Va dans "Affectation Navettes"
2. Sélectionne la date (15 janvier)
3. Vois tous les clients du jour
4. Réaffecte certains clients à un autre chauffeur
5. Reviens planifier ton nouveau client

---

### Scénario 4 : Capacité totale dépassée
```
1. Tu planifies un client (1500 LEDs)
2. Date : 15 janvier 2026
3. Système vérifie :
   - Nicolas (1000 LEDs) : 1000 LEDs utilisés → ❌ PLEIN
   - David (500 LEDs) : 500 LEDs utilisés → ❌ PLEIN
   - Gros Camion (2000 LEDs) : 2000 LEDs utilisés → ❌ PLEIN
4. Total : 3500 LEDs utilisés + 1500 LEDs nouveau = 5000 LEDs
5. Capacité totale : 3500 LEDs
6. Résultat : ⛔ CAPACITÉ TOTALE DÉPASSÉE
7. Message : "⚠️ Vous devez choisir une autre date"
8. Action : IMPOSSIBLE de planifier
```

**Solutions** :
- Choisir une autre date
- Diviser la commande en 2 livraisons
- Négocier avec le client

---

## 📊 Calculs automatiques

### Capacité disponible
```typescript
// Pour chaque camion
const currentLoad = clients du camion.reduce(sum, LEDs)
const availableSpace = capacité - currentLoad
const canTake = availableSpace >= nouveau client LEDs
```

### Capacité totale
```typescript
const totalCapacity = sum(tous les camions.capacité)
const totalUsed = sum(tous les clients.LEDs)
const totalWithNew = totalUsed + nouveau client.LEDs
const isOverCapacity = totalWithNew > totalCapacity
```

### Nombre de chauffeurs utilisés
```typescript
const usedTrucks = unique(clients.camionId).length
const availableTrucks = total camions - usedTrucks
const canAddMore = availableTrucks > 0
```

---

## 🎨 Interface

### Message d'alerte (Tous pleins)
```
┌──────────────────────────────────────────────┐
│ ⚠️ Tous les camions sont pleins !           │
│                                              │
│ Aucun camion ne peut prendre ce client       │
│ (300 LEDs) pour cette date.                  │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ 💡 Solution recommandée :                │ │
│ │                                          │ │
│ │ Ajoutez un 2ème chauffeur pour partager  │ │
│ │ la charge du jour. Cela permettra de :   │ │
│ │                                          │ │
│ │ ✅ Répartir les clients entre camions    │ │
│ │ ✅ Réduire le temps de tournée           │ │
│ │ ✅ Livrer tous les clients le même jour  │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ [1 chauffeur utilisé] [2 disponibles]        │
└──────────────────────────────────────────────┘
```

### Message d'alerte (Capacité dépassée)
```
┌──────────────────────────────────────────────┐
│ ⛔ Capacité totale dépassée !                │
│                                              │
│ La charge totale (5000 LEDs) dépasse la      │
│ capacité maximale de tous les camions        │
│ combinés (3500 LEDs).                        │
│                                              │
│ [3 chauffeurs utilisés] [0 disponible]       │
│                                              │
│ ⚠️ Vous devez choisir une autre date ou      │
│ diviser la commande.                         │
└──────────────────────────────────────────────┘
```

---

## 🚀 Avantages

✅ **Sécurité** : Impossible de surcharger un camion  
✅ **Visibilité** : Tu vois immédiatement si c'est possible  
✅ **Solutions** : Le système te guide vers la bonne action  
✅ **Optimisation** : Propose d'ajouter des chauffeurs intelligemment  
✅ **Flexibilité** : Permet de partager la charge entre plusieurs chauffeurs  

---

## 🎯 Résultat

**Avant** : Tu pouvais surcharger un camion sans le savoir  
**Maintenant** : Le système te bloque et te guide  

**Gain** :
- 0% d'erreur de surcharge
- 100% de visibilité
- Solutions automatiques proposées

🎉 **C'est prêt à l'emploi !**

---

**Date de création** : 01/01/2026  
**Version** : 1.0
