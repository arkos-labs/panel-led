# 🔄 Redémarrage du serveur pour appliquer les changements

## Problème
Les camions n'affichent pas encore 1500 LEDs de capacité malgré la modification du code.

## Solution : Redémarrer le serveur

### Méthode 1 : Redémarrage automatique (si nodemon est configuré)
Le serveur devrait redémarrer automatiquement après la modification de `server/index.js`.

### Méthode 2 : Redémarrage manuel

1. **Arrêtez le serveur** :
   - Dans le terminal où `npm run dev` tourne
   - Appuyez sur `Ctrl+C`

2. **Relancez le serveur** :
   ```bash
   npm run dev
   ```

3. **Attendez le message** :
   ```
   Server running on port 3001
   Client running on port 8080
   ```

4. **Rechargez votre navigateur** :
   - Appuyez sur `F5` sur `http://localhost:8080`

---

## ✅ Vérification

Après le redémarrage, ouvrez votre navigateur et planifiez une livraison.

Vous devriez voir :

```
┌─────────────────────────────┐
│ Nicolas                     │
│ Capacité: 1500 LEDs         │ ✅ (au lieu de 1000)
│ Remplissage: 120 / 1500     │
│ 8%                          │
└─────────────────────────────┘

┌─────────────────────────────┐
│ David                       │
│ Capacité: 1500 LEDs         │ ✅ (au lieu de 500)
│ Remplissage: 120 / 1500     │
│ 8%                          │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Gros Camion                 │
│ Capacité: 1500 LEDs         │ ✅ (au lieu de 2000)
│ Remplissage: 120 / 1500     │
│ 8%                          │
└─────────────────────────────┘
```

---

## 🔧 Si ça ne fonctionne toujours pas

### Vérifiez que la modification est bien dans le fichier :

Ouvrez `server/index.js` et vérifiez les lignes 520-522 :

```javascript
{ id: 'camion-1000', nom: 'Nicolas', type: 'LIVREUR', capacite: 1500, secteur: 'IDF' },
{ id: 'camion-500', nom: 'David', type: 'LIVREUR', capacite: 1500, secteur: 'IDF' },
{ id: 'camion-2000', nom: 'Gros Camion', type: 'LIVREUR', capacite: 1500, secteur: 'IDF' }
```

Si vous voyez toujours `capacite: 1000`, `capacite: 500`, ou `capacite: 2000`, alors la modification n'a pas été sauvegardée.

---

## 🚀 Commande rapide

Exécutez dans le terminal du projet :

```bash
# Arrêter le serveur (Ctrl+C) puis :
npm run dev
```

Puis rechargez votre navigateur (F5).
