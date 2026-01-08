# 🚚 SIMPLIFICATION MAJEURE : 1 Camion, 1 Région

## 🎯 Objectif
Plus de confusion entre Nicolas et David. **1 seul planning, 1 seule logique.**

---

## 🌍 Nouvelle Règle d'Or
**"Un jour = Une seule région"**

### ✅ Ce que le système fait maintenant :
1.  **Il détecte la région** de ton client (ex: Lyon = Auvergne-Rhône-Alpes)
2.  **Il scanne le planning** existant
3.  **Il t'interdit** de mélanger les régions

### 🚫 Exemples de Blocage :
- Tu as planifié un client à **Lille** le Lundi (Région Nord)
- Tu essaies de planifier un client à **Marseille** le même Lundi
- ❌ **BLOQUÉ** : "Impossible : Région Île-de-France + Hauts-de-France déjà prévue"

### ✅ Exemples de Succès :
- Tu as planifié un client à **Lille** le Lundi
- Tu ajoutes un client à **Paris** (Même zone logistique)
- ⭐ **OPTIMAL** : "Même région (2 clients)"

---

## 🗺️ Les Zones Logistiques

Le système regroupe les départements intelligemment :

| Zone | Emojis | Départements Clés |
|------|--------|-------------------|
| **Île-de-France + Nord** | 🏛️ | 75, 92, 93, 94, 59, 62... |
| **Normandie + Bretagne** | 🌊 | 14, 76, 35, 29... |
| **Grand Est + Bourgogne** | 🍷 | 51, 67, 21, 71... |
| **Auvergne-Rhône-Alpes** | ⛰️ | 69, 38, 74, 42... |
| **PACA + Occitanie** | ☀️ | 13, 83, 34, 31... |

---

## 🎨 Nouvelle Interface

Sur les cartes de suggestion, tu verras maintenant :

```
┌────────────────────────────────────┐
│ Jeudi 9 Janvier                    │
│ ⭐ Optimal                         │
│ ⛰️ Auvergne-Rhône-Alpes            │ ← La région du jour
│ 🕐 Retour Paris: 20:30             │
└────────────────────────────────────┘
```

Et si c'est incompatible :

```
┌────────────────────────────────────┐
│ Lundi 6 Janvier                    │
│ ❌ Impossible                      │
│ ❌ Région 🏛️ IDF + HDF déjà prévue │ ← La raison du blocage
└────────────────────────────────────┘
```

---

## 🚀 Avantages

1.  **Tournées ultra-rentables** : Plus de zig-zags à travers la France.
2.  **Planification sans erreur** : Impossible de se tromper de jour.
3.  **Organisation claire** : "Lundi c'est le Nord, Jeudi c'est le Sud".
4.  **1 Seul Planning** : Fini la gestion de 2 camions.

---

**Statut** : ✅ **ACTIVE**
**Date** : 01/01/2026
