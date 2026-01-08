# 🗺️ Affichage de tous les itinéraires de camions

## 🎯 Objectif
Afficher **tous les camions** (Nicolas ET David) avec leurs itinéraires complets **côte à côte** ou **l'un en dessous de l'autre** après l'optimisation VROOM.

---

## 📊 Situation actuelle

### **Code actuel** (ligne 1116-1117) :
```typescript
<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
    {camions.map((camion, index) => {
        // ... affiche UN SEUL camion sélectionné avec son itinéraire
    })}
</div>
```

### **Comportement actuel** :
- ✅ Affiche **tous les camions** dans une grille (3 colonnes)
- ❌ Mais l'**itinéraire détaillé** n'est affiché que pour **le camion sélectionné**
- ❌ Les autres camions montrent juste un résumé (capacité, nombre de stops)

---

## ✅ Solution proposée

### **Option 1 : Afficher tous les itinéraires en colonnes** (Recommandé)

Modifier la grille pour afficher **2 colonnes** (Nicolas et David côte à côte) avec leurs itinéraires complets :

```typescript
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    {camions.map((camion, index) => {
        // ... affiche TOUS les camions avec leurs itinéraires complets
        // Pas de condition "isSelected", on affiche tout
    })}
</div>
```

**Avantages** :
- ✅ Vue d'ensemble complète
- ✅ Comparaison facile entre les 2 camions
- ✅ Pas besoin de cliquer pour voir l'autre camion

**Inconvénients** :
- ⚠️ Prend plus de place verticalement
- ⚠️ Peut être chargé si beaucoup de clients

---

### **Option 2 : Onglets pour chaque camion**

Créer un système d'onglets pour basculer entre Nicolas et David :

```typescript
<Tabs defaultValue="navette-1">
    <TabsList>
        <TabsTrigger value="navette-1">Navette 1 - Nicolas</TabsTrigger>
        <TabsTrigger value="navette-2">Navette 2 - David</TabsTrigger>
    </TabsList>
    
    <TabsContent value="navette-1">
        {/* Itinéraire complet de Nicolas */}
    </TabsContent>
    
    <TabsContent value="navette-2">
        {/* Itinéraire complet de David */}
    </TabsContent>
</Tabs>
```

**Avantages** :
- ✅ Interface propre et organisée
- ✅ Pas de surcharge visuelle
- ✅ Facile à naviguer

**Inconvénients** :
- ⚠️ Pas de vue d'ensemble simultanée
- ⚠️ Nécessite des clics pour voir l'autre camion

---

### **Option 3 : Accordéon extensible**

Afficher tous les camions en mode compact, et permettre d'étendre chacun pour voir son itinéraire :

```typescript
<Accordion type="multiple" defaultValue={["navette-1", "navette-2"]}>
    {camions.map((camion, index) => (
        <AccordionItem value={`navette-${index + 1}`}>
            <AccordionTrigger>
                Navette {index + 1} - {camion.nom} ({truckClients.length} stops)
            </AccordionTrigger>
            <AccordionContent>
                {/* Itinéraire complet */}
            </AccordionContent>
        </AccordionItem>
    ))}
</Accordion>
```

**Avantages** :
- ✅ Compact par défaut
- ✅ Peut afficher tous les itinéraires en même temps si étendu
- ✅ Flexible

**Inconvénients** :
- ⚠️ Nécessite des clics pour étendre/réduire

---

## 🛠️ Modification recommandée (Option 1)

### **Étape 1 : Supprimer la condition de sélection**

Actuellement, l'itinéraire détaillé n'est affiché que si `isSelected === true`. Il faut **toujours afficher** l'itinéraire pour tous les camions.

### **Étape 2 : Modifier la grille**

Changer de 3 colonnes à 2 colonnes :

```typescript
// AVANT
<div className="grid grid-cols-1 md:grid-cols-3 gap-3">

// APRÈS
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
```

### **Étape 3 : Afficher l'itinéraire pour tous**

Actuellement, l'itinéraire détaillé (timeline) est probablement conditionné par `isSelected`. Il faut le rendre **toujours visible** :

```typescript
// AVANT (probablement)
{isSelected && (
    <div className="timeline">
        {/* Itinéraire détaillé */}
    </div>
)}

// APRÈS
<div className="timeline">
    {/* Itinéraire détaillé */}
</div>
```

---

## 📝 Fichier à modifier

**Fichier** : `src/components/modals/PlanningModal.tsx`  
**Lignes** : 1116-1400 (environ)

---

## 🎨 Résultat attendu

Après modification, vous verrez :

```
┌─────────────────────────────────┬─────────────────────────────────┐
│ NAVETTE 1 - Nicolas             │ NAVETTE 2 - David               │
│ Capacité: 1000 / Reste: 400     │ Capacité: 500 / Reste: 180      │
│                                 │                                 │
│ Itinéraire (5 stops)            │ Itinéraire (3 stops)            │
│ ├─ 09:00 Départ Dépôt           │ ├─ 09:00 Départ Dépôt           │
│ ├─ 10:30 TOURCOING (Julien)    │ ├─ 12:00 MARSEILLE (Sophie)     │
│ ├─ 11:00 ROUBAIX (Marion)      │ ├─ 14:30 TOULOUSE (Marc)        │
│ ├─ 12:30 ARRAS (Sophie)        │ ├─ 17:00 BORDEAUX (Julie)       │
│ ├─ 14:00 LILLE (Thomas)        │ └─ 21:00 Retour Dépôt           │
│ └─ 16:00 Retour Dépôt           │                                 │
└─────────────────────────────────┴─────────────────────────────────┘
```

---

## ❓ Quelle option préférez-vous ?

1. **Option 1** : Afficher tous les itinéraires côte à côte (2 colonnes)
2. **Option 2** : Onglets pour basculer entre les camions
3. **Option 3** : Accordéon extensible

Dites-moi votre préférence et je modifierai le code en conséquence ! 🚀
