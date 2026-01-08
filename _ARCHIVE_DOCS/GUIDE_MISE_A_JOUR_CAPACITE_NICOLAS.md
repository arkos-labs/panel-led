# 🔧 Mise à jour de la capacité de Nicolas à 1000 LEDs

## 🎯 Objectif
Augmenter la capacité du camion Nicolas de 600 à 1000 LEDs pour permettre de livrer plusieurs clients sur une même tournée.

---

## 📊 Problème identifié

**Situation actuelle** :
- Nicolas a une capacité de **600 LEDs**
- LEROY (210 LEDs) + MOREL (450 LEDs) = **660 LEDs**
- 660 > 600 → **MOREL est rejeté** par VROOM

**Solution** :
- Augmenter la capacité de Nicolas à **1000 LEDs**
- 660 < 1000 → ✅ **Les deux clients peuvent être livrés**

---

## 🛠️ Méthode 1 : Via l'interface Supabase (Recommandé)

### **Étapes** :

1. **Ouvrez Supabase Dashboard**
   - Allez sur : https://supabase.com/dashboard
   - Connectez-vous avec votre compte

2. **Sélectionnez votre projet**
   - Projet : `cvqmwbhidmqnlmmejusk`

3. **Ouvrez l'éditeur SQL**
   - Menu latéral → **SQL Editor**
   - Cliquez sur **"New query"**

4. **Exécutez cette requête** :
   ```sql
   -- Vérifier la capacité actuelle
   SELECT id, nom, capacite, secteur 
   FROM resources 
   WHERE type = 'LIVREUR'
   ORDER BY nom;
   ```

5. **Vérifiez le résultat**
   - Vous devriez voir Nicolas avec `capacite: 600` (ou autre valeur)

6. **Mettez à jour la capacité** :
   ```sql
   UPDATE resources 
   SET capacite = 1000 
   WHERE nom = 'Nicolas' AND type = 'LIVREUR';
   ```

7. **Vérifiez la mise à jour** :
   ```sql
   SELECT id, nom, capacite, secteur 
   FROM resources 
   WHERE nom = 'Nicolas';
   ```

8. **Résultat attendu** :
   ```
   id: camion-1000
   nom: Nicolas
   capacite: 1000  ← Doit être 1000
   secteur: IDF
   ```

---

## 🛠️ Méthode 2 : Via l'éditeur de table Supabase

### **Étapes** :

1. **Ouvrez Supabase Dashboard**
   - https://supabase.com/dashboard

2. **Allez dans Table Editor**
   - Menu latéral → **Table Editor**
   - Sélectionnez la table **`resources`**

3. **Trouvez Nicolas**
   - Cherchez la ligne où `nom = 'Nicolas'`
   - Vérifiez que `type = 'LIVREUR'`

4. **Modifiez la capacité**
   - Cliquez sur la cellule `capacite`
   - Changez la valeur à **1000**
   - Appuyez sur **Entrée** pour sauvegarder

5. **Vérifiez**
   - La cellule doit maintenant afficher **1000**

---

## 🧪 Test après modification

### **1. Rechargez l'application**
- Ouvrez : `http://localhost:8080`
- Appuyez sur **F5** pour recharger

### **2. Testez avec MOREL**
- Essayez de planifier **Émilie MOREL** (450 LEDs)
- Avec d'autres clients comme **LEROY** (210 LEDs)
- Total : 660 LEDs

### **3. Résultat attendu**
Vous devriez voir dans les logs :
```
🤖 Auto-select (Perfect Match): Nicolas (Vol: 1000)
✅ Optimisation réussie ! Répartition sur 1 camions.
```

Au lieu de :
```
🤖 Auto-select (Perfect Match): Nicolas (Vol: 600)
⚠️ 1 client(s) non placé(s)
Émilie MOREL - ✅ GPS OK (51.0318, 2.3021) - Dunkerque
```

---

## 📋 Checklist de vérification

- [ ] Connexion à Supabase Dashboard
- [ ] Ouverture du SQL Editor ou Table Editor
- [ ] Vérification de la capacité actuelle de Nicolas
- [ ] Mise à jour de la capacité à 1000 LEDs
- [ ] Vérification de la mise à jour
- [ ] Rechargement de l'application (F5)
- [ ] Test de planification avec MOREL + LEROY
- [ ] Vérification que VROOM accepte les 2 clients

---

## 🎯 Configuration finale recommandée

| Camion | Capacité | Zone | Utilisation |
|--------|----------|------|-------------|
| **Nicolas** | **1000 LEDs** | NORD (NORD_EST, NORD_OUEST, IDF) | Grosses tournées Nord |
| **David** | **500 LEDs** | SUD (SUD, CENTRE_EST, CENTRE_OUEST) | Tournées moyennes Sud |
| **Gros Camion** | **2000 LEDs** | Tous secteurs | Très grosses livraisons |

---

## ❓ En cas de problème

Si après la modification, le problème persiste :

1. **Vérifiez les logs** de la console (F12)
2. **Cherchez** : `🤖 Auto-select (Perfect Match): Nicolas (Vol: XXX)`
3. **Si Vol: 600** → La mise à jour n'a pas été prise en compte
4. **Si Vol: 1000** → Le problème vient d'ailleurs (contrainte de temps)

---

**Créé le** : 2026-01-01  
**Objectif** : Augmenter capacité Nicolas à 1000 LEDs  
**Priorité** : HAUTE
