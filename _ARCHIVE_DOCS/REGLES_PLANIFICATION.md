# 📋 RÈGLES DE PLANIFICATION - MISE À JOUR

## ⏰ NOUVELLES CONTRAINTES DE PLANIFICATION

### 1. **Délai Minimum : J+8**
- ❌ **Impossible** de planifier une livraison avant 8 jours
- ✅ **Minimum** : Aujourd'hui + 8 jours calendaires
- 📅 **Exemple** : Si nous sommes le 1er janvier, la première date disponible est le 9 janvier

**Raison :** Permet d'organiser les tournées à l'avance et d'optimiser les trajets

---

### 2. **Suppression du Champ "Heure"**
- ❌ **Plus de sélection d'heure** lors de la planification
- ✅ **Heure par défaut** : 12h00 (midi) pour l'affichage
- 📦 **Livraison** : Dans la journée (pas d'heure précise)

**Raison :** Les tournées sont optimisées par le système, l'ordre de passage est calculé automatiquement

---

### 3. **Capacité Camion : 2000 LEDs Maximum**
- 🚚 **Capacité par camion** : 2000 LEDs max
- ⚠️ **Alerte** : Si dépassement, le système bloque la planification
- 📊 **Affichage** : `1250 / 2000 LEDs (62% chargé)`

**Exemples concrets :**
- ✅ **OK** : 15 clients × 100 LEDs = 1500 LEDs → **75% de charge**
- ✅ **OK** : 20 clients × 100 LEDs = 2000 LEDs → **100% de charge** (limite)
- ❌ **BLOQUÉ** : 25 clients × 100 LEDs = 2500 LEDs → **⚠️ SURCHARGE de 500 LEDs**

---

## 🚚 CALCUL DE CAPACITÉ PAR TOURNÉE

### Scénarios Types :

#### **Petits Clients (50 LEDs/client)**
- Maximum : **40 clients** par tournée
- Charge : 40 × 50 = 2000 LEDs

#### **Clients Moyens (100 LEDs/client)**
- Maximum : **20 clients** par tournée
- Charge : 20 × 100 = 2000 LEDs

#### **Gros Clients (200 LEDs/client)**
- Maximum : **10 clients** par tournée
- Charge : 10 × 200 = 2000 LEDs

#### **Très Gros Clients (500 LEDs/client)**
- Maximum : **4 clients** par tournée
- Charge : 4 × 500 = 2000 LEDs

---

## 🎯 OPTIMISATION COMPLÈTE

### Contraintes Combinées :
1. **Délai** : Minimum J+8
2. **Capacité** : Maximum 2000 LEDs
3. **Horaire** : Retour avant 20h00
4. **Temps service** : 45 min par client

### Exemple de Tournée Optimale :

**Date** : 10 janvier 2025 (planifié le 1er janvier)
**Camion** : Camion #1
**Départ** : 9h00 - 5 rue des Champs-Élysées, Paris

| Client | LEDs | Ville | Distance | Heure Estimée |
|--------|------|-------|----------|---------------|
| Départ | - | Paris | 0 km | 09:00 |
| Client A | 150 | Versailles | 18 km | 09:30 |
| Client B | 200 | Rambouillet | 32 km | 10:45 |
| Client C | 180 | Chartres | 45 km | 12:15 |
| Client D | 220 | Orléans | 78 km | 14:15 |
| Client E | 150 | Fontainebleau | 95 km | 16:00 |
| Retour | - | Paris | 65 km | 18:00 |

**Résultat :**
- ✅ **Total LEDs** : 900 / 2000 (45% de charge)
- ✅ **Distance totale** : 333 km
- ✅ **Temps total** : 9h00 (route + service)
- ✅ **Retour** : 18h00 (OK avant 20h)
- ✅ **Délai** : J+9 (OK > J+8)

---

## 📊 AFFICHAGE DANS L'INTERFACE

### Avant Planification :
```
┌─────────────────────────────────────┐
│ Capacité Disponible                 │
│ 0 / 2000 LEDs (0%)                  │
│ ▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
└─────────────────────────────────────┘
```

### Après Ajout de Clients :
```
┌─────────────────────────────────────┐
│ Capacité Utilisée                   │
│ 1450 / 2000 LEDs (72%)              │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░  │
│ ✅ Espace disponible : 550 LEDs     │
└─────────────────────────────────────┘
```

### En Surcharge :
```
┌─────────────────────────────────────┐
│ ⚠️ SURCHARGE DÉTECTÉE               │
│ 2350 / 2000 LEDs (117%)             │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ ❌ Surcharge : 350 LEDs en trop     │
│ 🚫 Planification BLOQUÉE            │
└─────────────────────────────────────┘
```

---

## 🔄 WORKFLOW COMPLET

### Étape 1 : Sélection du Client
- Voir la liste "Clients à Contacter"
- Cliquer sur "Planifier Livraison"

### Étape 2 : Choix de la Date
- ❌ Dates grisées : Avant J+8
- ✅ Dates disponibles : À partir de J+8
- 🟢 Dates optimales : Suggérées par le Smart Scheduler

### Étape 3 : Sélection du Camion
- Voir la capacité actuelle de chaque camion
- Le système suggère automatiquement le camion optimal
- Vérification en temps réel de la capacité

### Étape 4 : Validation
- ✅ Si capacité OK : Bouton "Confirmer" actif
- ❌ Si surcharge : Bouton "Confirmer" désactivé
- 📊 Message explicite sur la capacité

### Étape 5 : Confirmation
- **Google Sheets** : Colonne G passe à "EN COURS"
- **Supabase** : Mise à jour instantanée
- **Frontend** : Le client disparaît de "À Contacter"

---

## 🎯 RÉSUMÉ DES CHANGEMENTS

| Avant | Après |
|-------|-------|
| Planification dès demain | **Minimum J+8** |
| Sélection d'heure obligatoire | **Pas d'heure** (midi par défaut) |
| Capacité en m³ (complexe) | **Capacité en LEDs** (2000 max) |
| Volume estimé par LED | **Comptage direct** des LEDs |

---

**Date de mise à jour :** 31/12/2024 23:45
**Version :** 3.0 - Règles J+8 + Capacité 2000 LEDs
