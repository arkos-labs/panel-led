# 🚚 Mise à jour de la capacité des camions à 1500 LEDs

## 🎯 Objectif
Augmenter la capacité de **tous les camions** à **1500 LEDs** pour permettre de livrer plus de clients par tournée.

---

## 📊 Configuration actuelle vs nouvelle

| Camion | Capacité actuelle | Nouvelle capacité | Gain |
|--------|-------------------|-------------------|------|
| **Nicolas** | 1000 LEDs | **1500 LEDs** | +50% |
| **David** | 500 LEDs | **1500 LEDs** | +200% |
| **Gros Camion** | 2000 LEDs | **1500 LEDs** | -25% |

**Note** : Gros Camion perd de la capacité, mais cela uniformise la flotte.

---

## 🛠️ Méthode 1 : Via Supabase Dashboard (Recommandé)

### **Étapes** :

1. **Ouvrez Supabase Dashboard**
   - Allez sur : https://supabase.com/dashboard
   - Connectez-vous avec votre compte

2. **Sélectionnez votre projet**
   - Projet ID : `cvqmwbhidmqnlmmejusk`

3. **Ouvrez l'éditeur SQL**
   - Menu latéral → **SQL Editor**
   - Cliquez sur **"New query"**

4. **Exécutez cette requête** :
   ```sql
   UPDATE resources 
   SET capacite = 1500 
   WHERE type = 'LIVREUR';
   ```

5. **Cliquez sur "Run"** (ou appuyez sur Ctrl+Enter)

6. **Vérifiez le résultat** :
   ```sql
   SELECT id, nom, capacite, secteur 
   FROM resources 
   WHERE type = 'LIVREUR'
   ORDER BY nom;
   ```

7. **Résultat attendu** :
   ```
   id             | nom          | capacite | secteur
   ---------------+--------------+----------+---------
   camion-500     | David        | 1500     | IDF
   camion-2000    | Gros Camion  | 1500     | IDF
   camion-1000    | Nicolas      | 1500     | IDF
   ```

---

## 🛠️ Méthode 2 : Via Table Editor

### **Étapes** :

1. **Ouvrez Supabase Dashboard**
   - https://supabase.com/dashboard

2. **Allez dans Table Editor**
   - Menu latéral → **Table Editor**
   - Sélectionnez la table **`resources`**

3. **Filtrez les camions**
   - Ajoutez un filtre : `type = 'LIVREUR'`

4. **Modifiez chaque ligne** :
   - **Nicolas** : Changez `capacite` à **1500**
   - **David** : Changez `capacite` à **1500**
   - **Gros Camion** : Changez `capacite` à **1500**

5. **Sauvegardez** (Entrée après chaque modification)

---

## 🧪 Test après modification

### **1. Rechargez l'application**
- Ouvrez : `http://localhost:8080`
- Appuyez sur **F5** pour recharger

### **2. Planifiez une livraison**
- Sélectionnez un client
- Choisissez une date
- Cliquez sur "Optimiser avec IA"

### **3. Vérifiez les capacités**
Vous devriez voir dans les cartes de chauffeurs :

```
┌─────────────────────────────┐
│ Nicolas                     │
│ Capacité: 1500 LEDs         │ ← Doit afficher 1500
│ Remplissage: 120 / 1500     │
│ 8%                          │
└─────────────────────────────┘

┌─────────────────────────────┐
│ David                       │
│ Capacité: 1500 LEDs         │ ← Doit afficher 1500
│ Remplissage: 120 / 1500     │
│ 8%                          │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Gros Camion                 │
│ Capacité: 1500 LEDs         │ ← Doit afficher 1500
│ Remplissage: 120 / 1500     │
│ 8%                          │
└─────────────────────────────┘
```

---

## 📊 Impact de la modification

### **Avantages** :

✅ **Plus de clients par tournée**
- Avant : Nicolas pouvait prendre 1000 LEDs max
- Après : Nicolas peut prendre **1500 LEDs** (+50%)

✅ **David devient plus utile**
- Avant : 500 LEDs (très limité)
- Après : **1500 LEDs** (peut faire de grosses tournées SUD)

✅ **Flotte uniformisée**
- Tous les camions ont la même capacité
- Facilite la planification

✅ **Moins de rejets VROOM**
- Plus de capacité = moins de clients rejetés
- Moins de messages "Trop petit"

### **Inconvénients** :

⚠️ **Gros Camion perd de la capacité**
- Avant : 2000 LEDs
- Après : 1500 LEDs
- Si vous avez vraiment besoin de 2000 LEDs, gardez-le à 2000

---

## 🎯 Recommandation alternative

Si vous voulez garder une différenciation entre les camions :

```sql
-- Option A : Capacités différenciées
UPDATE resources SET capacite = 1500 WHERE nom = 'Nicolas';
UPDATE resources SET capacite = 1500 WHERE nom = 'David';
UPDATE resources SET capacite = 2000 WHERE nom = 'Gros Camion';  -- Garde 2000

-- Option B : Capacités progressives
UPDATE resources SET capacite = 1200 WHERE nom = 'David';        -- Petit
UPDATE resources SET capacite = 1500 WHERE nom = 'Nicolas';      -- Moyen
UPDATE resources SET capacite = 2000 WHERE nom = 'Gros Camion';  -- Grand
```

---

## 📋 Checklist de vérification

- [ ] Connexion à Supabase Dashboard
- [ ] Ouverture du SQL Editor
- [ ] Exécution de la requête UPDATE
- [ ] Vérification avec SELECT
- [ ] Tous les camions affichent 1500 LEDs
- [ ] Rechargement de l'application (F5)
- [ ] Test de planification d'une livraison
- [ ] Vérification des capacités dans l'interface
- [ ] Confirmation que les capacités sont bien 1500 LEDs

---

## ❓ En cas de problème

### **Problème 1 : Les capacités ne changent pas dans l'interface**
**Solution** :
1. Videz le cache du navigateur (Ctrl+Shift+R)
2. Rechargez l'application (F5)
3. Vérifiez dans Supabase que la modification a bien été faite

### **Problème 2 : La requête SQL échoue**
**Solution** :
1. Vérifiez que vous êtes connecté au bon projet
2. Vérifiez que la table `resources` existe
3. Vérifiez que le champ `capacite` existe

### **Problème 3 : Un camion n'est pas mis à jour**
**Solution** :
1. Vérifiez le `type` du camion (doit être 'LIVREUR')
2. Exécutez une requête spécifique :
   ```sql
   UPDATE resources 
   SET capacite = 1500 
   WHERE nom = 'Nicolas' AND type = 'LIVREUR';
   ```

---

## 🚀 Résultat final attendu

Après cette modification, vous pourrez :

✅ **Planifier plus de clients par tournée**
- Exemple : 10 clients de 150 LEDs chacun = 1500 LEDs total

✅ **Moins de tournées nécessaires**
- Avant : 2 tournées pour 1200 LEDs
- Après : 1 seule tournée pour 1500 LEDs

✅ **Optimisation VROOM plus efficace**
- Moins de clients rejetés
- Meilleure répartition

---

**Créé le** : 2026-01-01  
**Objectif** : Augmenter capacité à 1500 LEDs  
**Priorité** : MOYENNE  
**Fichier SQL** : `update_all_trucks_capacity_1500.sql`
