# 🧪 TEST END-TO-END COMPLET - LED ROUTE PLANNER

**Date de création** : 04 Janvier 2026  
**Objectif** : Valider le flux complet depuis l'ajout d'un client dans Google Sheets jusqu'à la validation de livraison/installation.

---

## 📋 PRÉ-REQUIS

Avant de commencer, vérifie que :

- [ ] L'application frontend tourne (`npm run dev` - port 5173)
- [ ] Le serveur backend tourne (`npm run dev:server` - port 3001)
- [ ] Le bridge Google Sheets tourne (`node server/bridge.js`)
- [ ] Tu as accès au Google Sheet de production
- [ ] Tu as accès à Supabase (pour vérifier les données)

**Outils nécessaires** :
- Navigateur (Chrome/Edge recommandé)
- Console développeur ouverte (F12)
- Accès au fichier `server/bridge_debug.log`

---

## 🎯 SCÉNARIO DE TEST COMPLET

### **Phase 1 : Ajout Client dans Google Sheets → Apparition dans l'App**

#### Étape 1.1 : Créer un client test dans Google Sheets

1. **Ouvre ton Google Sheet** (ID: `1pParE3lQ3SOo7mQ0WjhY0aLuXtQAGpVQ0qANYEBcpAI`)

2. **Choisis un onglet de zone** (ex: "fr metropole")

3. **Ajoute une nouvelle ligne** (par exemple ligne 100) avec ces données :

   | A (Nom) | B (Prénom) | C (Adresse) | D (Téléphone) | E (Email) | F (Nb LED) | G (Statut) |
   |---------|-----------|-------------|---------------|-----------|------------|------------|
   | TEST-E2E | David | 10 rue de Rivoli, 75001 Paris | 0612345678 | test@example.com | 150 | SIGNÉ |

   **⚠️ IMPORTANT** : 
   - Utilise "TEST-E2E" comme nom pour identifier facilement ce client
   - Mets bien "SIGNÉ" dans la colonne G
   - Note le **numéro de ligne** (ex: 100)

4. **Sauvegarde** (Ctrl+S ou attends l'auto-save)

#### Étape 1.2 : Vérifier la synchronisation

5. **Ouvre le fichier de logs** dans un terminal :
   ```powershell
   Get-Content server/bridge_debug.log -Wait -Tail 50
   ```

6. **Attends maximum 2 minutes** (le bridge poll toutes les 60 secondes)

7. **Cherche dans les logs** :
   ```
   [Ingest] Updated Client: fr_metropole_100 (TEST-E2E)
   ```

   ✅ **Succès** : Tu vois ce message  
   ❌ **Échec** : Aucun message après 3 minutes → Vérifie que bridge.js tourne

#### Étape 1.3 : Vérifier dans Supabase

8. **Ouvre Supabase** → Table `clients`

9. **Cherche le client** avec l'ID `fr_metropole_100`

10. **Vérifie les champs** :
    - `nom` = "TEST-E2E"
    - `prenom` = "David"
    - `statut_client` = "SIGNÉ"
    - `latitude` et `longitude` sont remplis (géocodage automatique)
    - `zone_pays` = "FR"

    ✅ **Succès** : Toutes les données sont présentes  
    ❌ **Échec** : GPS manquant → Vérifie les logs pour erreur de géocodage

#### Étape 1.4 : Vérifier dans l'application

11. **Ouvre l'app** : http://localhost:5173

12. **Va dans "Clients à Contacter"** (ou Dashboard)

13. **Cherche "TEST-E2E"** dans la liste

14. **Vérifie que tu vois** :
    - Nom complet : "TEST-E2E David"
    - Adresse : "10 rue de Rivoli, 75001 Paris"
    - Nombre de LEDs : 150
    - Badge de statut

    ✅ **Succès** : Le client apparaît  
    ❌ **Échec** : Client invisible → Vérifie la console (F12) pour erreurs

---

### **Phase 2 : Planification de la Livraison**

#### Étape 2.1 : Ouvrir le modal de planification

15. **Clique sur le client TEST-E2E** (ou bouton "Planifier")

16. **Le modal de planification s'ouvre**

17. **Vérifie que tu vois** :
    - Les informations du client
    - Un calendrier ou sélecteur de date
    - Des suggestions de dates (si implémenté)
    - Une carte avec la position du client

    ✅ **Succès** : Modal complet  
    ❌ **Échec** : Erreur → Vérifie la console

#### Étape 2.2 : Sélectionner une date

18. **Choisis une date** (ex: demain ou lundi prochain)

19. **Sélectionne un camion** (ex: "Nicolas - Camion 1500L")

20. **Vérifie l'aperçu du trajet** :
    - Distance totale affichée
    - Heure de retour estimée
    - Carte avec l'itinéraire

#### Étape 2.3 : Valider la planification

21. **Clique sur "Confirmer la Planification"**

22. **Attends la notification de succès**

23. **Vérifie dans Supabase** :
    - Table `clients` : 
      - `date_livraison_prevue` est remplie
      - `statut_livraison` = "PLANIFIÉE" ou "EN_COURS"
      - `livreur_id` est assigné

    ✅ **Succès** : Données mises à jour  
    ❌ **Échec** : Données manquantes → Vérifie les logs backend

#### Étape 2.4 : Vérifier la mise à jour Google Sheets

24. **Retourne dans Google Sheet**

25. **Vérifie la ligne du client TEST-E2E** :
    - Colonne G (Statut) = "🚚 2. Livraison confirmée" (ou similaire)
    - Colonne H (Date Livraison) = La date que tu as choisie
    - Colonne N (Camion) = ID du camion (optionnel selon config)

26. **Attends max 30 secondes** (le bridge sync en temps réel)

    ✅ **Succès** : Google Sheet mis à jour  
    ❌ **Échec** : Pas de mise à jour → Vérifie les logs bridge pour erreurs "Unable to parse range"

---

### **Phase 3 : Visualisation dans la Vue Flotte**

#### Étape 3.1 : Voir la tournée planifiée

27. **Va dans "Affectation Navettes"** ou "Livraisons"

28. **Sélectionne la date** que tu as planifiée

29. **Vérifie que tu vois** :
    - Le camion assigné (ex: Nicolas)
    - Le client TEST-E2E dans la liste
    - Une carte avec l'itinéraire
    - La jauge de capacité mise à jour (150 LEDs)

    ✅ **Succès** : Tournée visible  
    ❌ **Échec** : Client manquant → Vérifie les filtres de date/statut

---

### **Phase 4 : Validation de la Livraison (Chauffeur)**

#### Étape 4.1 : Générer le lien de validation

30. **Dans l'app, trouve le lien de validation** pour ce client
    - Soit dans la vue Livraisons
    - Soit dans les détails du client
    - Format : `/validate?id=fr_metropole_100&action=livraison`

31. **Copie le lien complet** :
    ```
    http://localhost:5173/validate?id=fr_metropole_100&action=livraison
    ```

#### Étape 4.2 : Simuler la validation chauffeur

32. **Ouvre le lien dans un nouvel onglet** (ou sur mobile si possible)

33. **Vérifie que tu vois** :
    - Nom du client : "TEST-E2E David"
    - Adresse complète
    - Nombre de LEDs : 150
    - Bouton "Marquer livrée" (ou "Livrer")
    - Boutons "Waze" et "Appeler"

34. **Clique sur "Marquer livrée"**

35. **Attends la confirmation** (toast "Livraison confirmée !")

#### Étape 4.3 : Vérifier la mise à jour en temps réel

36. **Vérifie dans Supabase** (table `clients`) :
    - `statut_livraison` = "LIVRÉ"
    - `date_livraison_reelle` = Timestamp actuel (ISO format)
    - `heure_livraison` = Heure actuelle (format HH:mm)

37. **Vérifie dans Google Sheet** (ligne TEST-E2E) :
    - Colonne G = "📦 3. Matériel reçu" (ou "LIVRÉ")
    - Colonne I = Date du jour (format DD/MM/YYYY)
    - Colonne J = Heure actuelle (format HH:mm)

38. **Vérifie dans l'app** (Dashboard ou Livraisons) :
    - Le statut du client est passé à "Livré"
    - Il apparaît dans la section "Terminées" ou "Livrés"

    ✅ **Succès** : Tout est synchronisé  
    ❌ **Échec** : Vérifier les logs bridge pour "[Sync Validation]"

---

### **Phase 5 : Planification de l'Installation**

#### Étape 5.1 : Accéder à la vue Installations

39. **Va dans "Installations"**

40. **Cherche le client TEST-E2E** (il devrait être dans "À Planifier")

41. **Clique sur "Planifier Installation"**

#### Étape 5.2 : Planifier l'installation

42. **Sélectionne** :
    - Date de début (ex: dans 2 jours)
    - Équipe de poseurs (ex: "Équipe Installation A")

43. **Vérifie le calcul automatique** :
    - Durée estimée = 150 LEDs / 70 ≈ 2-3 jours
    - Date de fin calculée automatiquement

44. **Valide la planification**

#### Étape 5.3 : Vérifier la mise à jour

45. **Vérifie dans Supabase** :
    - `statut_installation` = "PLANIFIÉE"
    - `date_install_debut` = Date choisie
    - `poseur_id` = ID de l'équipe

46. **Vérifie dans Google Sheet** :
    - Colonne G = "📅 4. Installation confirmée"
    - Colonne K = Date de début d'installation

    ✅ **Succès** : Installation planifiée  
    ❌ **Échec** : Vérifier les logs

---

### **Phase 6 : Validation de l'Installation**

#### Étape 6.1 : Simuler le début des travaux

47. **Ouvre le lien de validation installation** :
    ```
    http://localhost:5173/validate?id=fr_metropole_100&action=installation
    ```

48. **Clique sur "DÉBUT TRAVAUX"**

49. **Vérifie** :
    - Supabase : `statut_installation` = "EN_COURS"
    - Google Sheet : Colonne G = "🚧 5. Installation en cours"

#### Étape 6.2 : Simuler la fin des travaux

50. **Clique sur "FIN TRAVAUX"**

51. **Vérifie** :
    - Supabase : `statut_installation` = "TERMINÉ"
    - Google Sheet : 
      - Colonne G = "✅ 6. Terminé"
      - Colonne L = Date de fin
      - Colonne M = Date de finalisation

    ✅ **Succès** : Cycle complet terminé !  
    ❌ **Échec** : Vérifier les logs

---

## 📊 CHECKLIST FINALE

Une fois le test terminé, vérifie que :

- [ ] Le client apparaît dans l'app en moins de 2 minutes après ajout dans Sheets
- [ ] Le géocodage fonctionne (latitude/longitude présents)
- [ ] La planification met à jour Supabase ET Google Sheets
- [ ] La validation de livraison enregistre la date/heure exacte
- [ ] Les colonnes I et J du Google Sheet sont bien remplies
- [ ] L'installation peut être planifiée après livraison
- [ ] Le statut final "Terminé" est bien synchronisé partout

---

## 🐛 PROBLÈMES COURANTS ET SOLUTIONS

### Problème 1 : Client n'apparaît pas dans l'app

**Causes possibles** :
- Bridge.js ne tourne pas → Vérifie `ps aux | grep bridge`
- Erreur de géocodage → Vérifie les logs pour "Geocoding error"
- Problème de permissions Google Sheets → Vérifie credentials.json

**Solution** :
```bash
# Redémarre le bridge
node server/bridge.js
```

### Problème 2 : Google Sheet non mis à jour

**Causes possibles** :
- Erreur "Unable to parse range" → Problème de nom d'onglet (espaces)
- Quota Google dépassé → Attends 1 minute et réessaie
- Bridge en double → Vérifie qu'une seule instance tourne

**Solution** :
```bash
# Vérifie les logs
tail -f server/bridge_debug.log | grep "ERROR"
```

### Problème 3 : Date/heure de livraison incorrecte

**Causes possibles** :
- Timezone mal configurée
- Champ `date_livraison_reelle` vide
- Format de date incorrect

**Solution** :
- Vérifie que `date_livraison_reelle` est un ISO timestamp
- Vérifie les logs "[Sync Validation]" dans bridge_debug.log

---

## 📝 RAPPORT DE TEST

Une fois le test terminé, remplis ce rapport :

**Date du test** : _______________  
**Testeur** : _______________

| Phase | Statut | Temps | Remarques |
|-------|--------|-------|-----------|
| 1. Ajout client Sheets → App | ✅ / ❌ | ___ min | |
| 2. Planification livraison | ✅ / ❌ | ___ min | |
| 3. Vue Flotte | ✅ / ❌ | ___ min | |
| 4. Validation livraison | ✅ / ❌ | ___ min | |
| 5. Planification installation | ✅ / ❌ | ___ min | |
| 6. Validation installation | ✅ / ❌ | ___ min | |

**Bugs trouvés** :
1. _______________
2. _______________
3. _______________

**Temps total du test** : _______ minutes

**Conclusion** : ✅ Prêt pour production / ❌ Corrections nécessaires

---

## 🎯 PROCHAINES ÉTAPES

Si tous les tests passent :
- [ ] Nettoyer le client TEST-E2E de Supabase et Google Sheets
- [ ] Documenter les bugs trouvés
- [ ] Corriger les bugs critiques
- [ ] Refaire le test après corrections
- [ ] Marquer la tâche comme terminée dans PLAN_FINALISATION.md

**Bon test ! 🚀**
