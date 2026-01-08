# 🚚 SIMPLIFICATION : 1 Camion, 1 Région par Jour

## 🎯 Nouvelle Stratégie

### ❌ Avant : 2 Camions (Nord/Sud)
- Nicolas (Nord) : Hauts-de-France, IDF, Normandie, etc.
- David (Sud) : PACA, Occitanie, Nouvelle-Aquitaine, etc.
- Possibilité de mélanger les régions

### ✅ Maintenant : 1 Camion, 1 Région/Jour
- **1 seul camion** pour toute la France
- **1 région par jour** (pas de mélange)
- Planning plus simple et prévisible

---

## 🗺️ Découpage par Région

### Lundi : Île-de-France + Hauts-de-France
- Paris (75)
- Val-de-Marne (94), Val-d'Oise (95), etc.
- Nord (59), Pas-de-Calais (62)

### Mardi : Normandie + Bretagne
- Seine-Maritime (76), Calvados (14)
- Finistère (29), Côtes-d'Armor (22)

### Mercredi : Grand Est + Bourgogne
- Marne (51), Moselle (57)
- Côte-d'Or (21), Saône-et-Loire (71)

### Jeudi : Auvergne-Rhône-Alpes
- Rhône (69), Isère (38)
- Haute-Savoie (74), Ain (01)

### Vendredi : PACA + Occitanie
- Bouches-du-Rhône (13), Var (83)
- Hérault (34), Haute-Garonne (31)

---

## 🔧 Modifications Nécessaires

### 1. Supabase : Retirer le 2ème Camion

```sql
-- Garder seulement 1 livreur
DELETE FROM resources 
WHERE type = 'LIVREUR' 
AND nom != 'Nicolas';

-- Ou renommer pour être neutre
UPDATE resources 
SET nom = 'Camion Principal'
WHERE type = 'LIVREUR'
LIMIT 1;
```

### 2. QuickPlanningModal : Grouper par Région

Modifier la logique de suggestion pour :
- Détecter la région du client
- Suggérer les jours où cette région est déjà prévue
- Bloquer les jours avec une autre région

### 3. Validation VROOM : 1 Région Max

Ajouter une règle :
```typescript
// Vérifier que tous les clients du jour sont dans la même région
const regionsOnDate = new Set(clientsOnDate.map(c => getRegion(c)));
if (regionsOnDate.size > 1) {
    suggestion.status = 'IMPOSSIBLE';
    suggestion.reason = '❌ Mélange de régions interdit';
}
```

---

## 🎨 Nouvelle Interface de Suggestion

### Exemple : Client à Lyon (Auvergne-Rhône-Alpes)

```
┌────────────────────────────────────┐
│ Jeudi 9 Janvier                    │
│ ⭐ Optimal                         │
│ Région ARA (3 clients)             │ ← Même région
│ 🕐 Retour Paris: 20:30             │
├────────────────────────────────────┤
│ Lundi 6 Janvier                    │
│ ❌ Impossible                      │
│ ❌ Région IDF déjà prévue          │ ← Région différente
├────────────────────────────────────┤
│ Jeudi 16 Janvier                   │
│ 👍 Bien                            │
│ Nouveau jour ARA                   │ ← Même région, nouveau jour
│ 🕐 Retour Paris: 19:45             │
└────────────────────────────────────┘
```

---

## 💡 Avantages

### Simplicité
- ✅ **1 seul camion** à gérer
- ✅ **1 région par jour** : pas de confusion
- ✅ **Planning prévisible** : Lundi = IDF, Mardi = Normandie, etc.

### Optimisation
- ✅ **Mutualisation régionale** : Tous les clients d'une région le même jour
- ✅ **Moins de km** : Pas de zig-zag entre régions
- ✅ **Retour garanti avant 22h** : Distances cohérentes

### Organisation
- ✅ **Journées thématiques** : "Jeudi = jour Lyon"
- ✅ **Préparation facilitée** : Stock par région
- ✅ **Communication claire** : "Votre livraison est prévue jeudi (jour Rhône-Alpes)"

---

## 🚀 Implémentation

### Étape 1 : Nettoyer la Base de Données
```sql
-- Garder 1 seul livreur
DELETE FROM resources WHERE type = 'LIVREUR' AND id != 'camion-1';
```

### Étape 2 : Modifier QuickPlanningModal.tsx

Ajouter la logique de région :
```typescript
// Détecter la région du client
const clientRegion = getRegionFromPostalCode(client.codePostal);

// Filtrer les suggestions par région
suggestions.forEach(suggestion => {
    const existingClients = getClientsForDate(suggestion.date);
    const regionsOnDate = new Set(existingClients.map(c => getRegion(c)));
    
    // Si une autre région est déjà prévue ce jour-là
    if (regionsOnDate.size > 0 && !regionsOnDate.has(clientRegion)) {
        suggestion.status = 'IMPOSSIBLE';
        suggestion.reason = `❌ Région ${Array.from(regionsOnDate)[0]} déjà prévue`;
    }
});
```

### Étape 3 : Ajouter une Fonction de Mapping Région

```typescript
function getRegionFromPostalCode(postalCode: string): string {
    const dept = postalCode.substring(0, 2);
    
    // Île-de-France + Hauts-de-France
    if (['75', '77', '78', '91', '92', '93', '94', '95', '59', '62', '80', '02', '60'].includes(dept)) {
        return 'IDF_HDF';
    }
    
    // Normandie + Bretagne
    if (['14', '27', '50', '61', '76', '22', '29', '35', '56'].includes(dept)) {
        return 'NOR_BRE';
    }
    
    // Grand Est + Bourgogne
    if (['08', '10', '51', '52', '54', '55', '57', '67', '68', '88', '21', '58', '71', '89'].includes(dept)) {
        return 'GES_BFC';
    }
    
    // Auvergne-Rhône-Alpes
    if (['01', '03', '07', '15', '26', '38', '42', '43', '63', '69', '73', '74'].includes(dept)) {
        return 'ARA';
    }
    
    // PACA + Occitanie
    if (['04', '05', '06', '13', '83', '84', '09', '11', '12', '30', '31', '32', '34', '46', '48', '65', '66', '81', '82'].includes(dept)) {
        return 'PACA_OCC';
    }
    
    // Autres (Centre, Pays de la Loire, Nouvelle-Aquitaine)
    return 'AUTRES';
}
```

---

## 📊 Planning Type

### Semaine Standard

| Jour | Région | Départements | Retour |
|------|--------|--------------|--------|
| **Lundi** | IDF + HDF | 75, 92, 93, 94, 95, 59, 62 | 20h |
| **Mardi** | Normandie + Bretagne | 76, 14, 29, 35 | 21h |
| **Mercredi** | Grand Est + Bourgogne | 51, 57, 21, 71 | 21h30 |
| **Jeudi** | Auvergne-Rhône-Alpes | 69, 38, 74, 01 | 21h30 |
| **Vendredi** | PACA + Occitanie | 13, 83, 34, 31 | 22h |

---

## 🎯 Résultat

### Workflow Simplifié

1. **Client à Lyon** → Suggère **Jeudi** (jour ARA)
2. **Client à Paris** → Suggère **Lundi** (jour IDF)
3. **Client à Marseille** → Suggère **Vendredi** (jour PACA)

### Blocage Automatique

Si tu essaies de planifier un client Lyon un Lundi (jour IDF) :
```
❌ Impossible de planifier ce jour-là : Région IDF déjà prévue
```

---

## 📚 Documentation

- **`SIMPLIFICATION_1_CAMION.md`** : Ce document
- **`ANALYSE_VROOM_AUTOMATIQUE.md`** : Validation automatique
- **`RESUME_FINAL_V4.md`** : Version précédente

---

**Version** : 5.0 - 1 Camion, 1 Région par Jour  
**Date** : 01/01/2026  
**Statut** : 🔄 **EN COURS D'IMPLÉMENTATION**

**🎯 Objectif : Simplifier la logistique avec 1 camion et 1 région par jour !**
