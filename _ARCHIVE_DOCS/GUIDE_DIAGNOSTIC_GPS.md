# 🗺️ Guide du Diagnostic GPS - LocationIQ

## 📋 Vue d'ensemble

Votre application utilise **LocationIQ** pour géocoder automatiquement les adresses de vos clients et obtenir leurs coordonnées GPS (latitude/longitude). Ces coordonnées sont essentielles pour :

- ✅ Optimiser les routes avec VROOM
- ✅ Afficher les clients sur la carte
- ✅ Calculer les distances et temps de trajet
- ✅ Suggérer les meilleurs créneaux de livraison

---

## 🔧 Configuration actuelle

### Clé API LocationIQ
```javascript
const LOCATION_IQ_KEY = 'pk.c2b6935ab51436de4a3352477dd8c7b4';
```
📍 **Fichier** : `server/index.js` (ligne 62)

### Endpoints disponibles

#### 1. **Vérifier les clients sans GPS** (GET)
```
GET http://localhost:3001/api/clients/check-gps
```

**Réponse** :
```json
{
  "total": 50,
  "withGPS": 35,
  "missingGPS": 15,
  "percentage": 70,
  "clientsWithoutGPS": [
    {
      "id": "client-123",
      "nom": "Dupont",
      "prenom": "Jean",
      "adresse": "10 rue de Paris, 75001 Paris",
      "gps": null,
      "statut": "À CONTACTER"
    }
  ],
  "clientsWithGPS": [...]
}
```

#### 2. **Lancer le scan GPS automatique** (POST)
```
POST http://localhost:3001/api/clients/scan-gps
```

**Réponse** :
```json
{
  "success": true,
  "fixed": 12,
  "failed": 3,
  "total": 15
}
```

---

## 🎯 Comment utiliser le diagnostic GPS

### Méthode 1 : Via l'interface web (Recommandé)

1. **Démarrez votre serveur** :
   ```bash
   npm run dev
   ```

2. **Accédez à l'application** : `http://localhost:5173`

3. **Cliquez sur "Diagnostic GPS"** dans le menu latéral (icône 📍)

4. **Visualisez les statistiques** :
   - Total de clients
   - Clients avec GPS ✅
   - Clients sans GPS ❌
   - Pourcentage de couverture

5. **Lancez le scan** si nécessaire en cliquant sur "Lancer le scan"

### Méthode 2 : Page de test standalone

1. **Ouvrez le fichier** `test-gps.html` dans votre navigateur

2. **Cliquez sur "Vérifier GPS"** pour voir l'état actuel

3. **Cliquez sur "Lancer le scan"** pour géocoder les clients manquants

### Méthode 3 : Via l'API directement

**Avec curl** :
```bash
# Vérifier
curl http://localhost:3001/api/clients/check-gps

# Scanner
curl -X POST http://localhost:3001/api/clients/check-gps
```

**Avec Postman** :
- GET `http://localhost:3001/api/clients/check-gps`
- POST `http://localhost:3001/api/clients/scan-gps`

---

## ⚙️ Fonctionnement technique

### Détection des clients sans GPS

Le système vérifie si un client a des coordonnées GPS valides :

```javascript
const missingGPS = clients.filter(c => {
    if (!c.gps) return true;  // Pas de champ GPS
    if (typeof c.gps === 'object' && (!c.gps.lat || !c.gps.lon)) return true;  // GPS incomplet
    if (typeof c.gps === 'string' && c.gps.length < 5) return true;  // GPS invalide
    return false;
});
```

### Géocodage avec LocationIQ

Pour chaque client sans GPS :

1. **Construction de l'URL** :
   ```javascript
   const url = `https://us1.locationiq.com/v1/search.php?key=${LOCATION_IQ_KEY}&q=${encodeURIComponent(address)}&format=json`;
   ```

2. **Appel API** avec pause de 600ms (rate limiting)

3. **Extraction des coordonnées** :
   ```javascript
   const lat = parseFloat(geoData[0].lat);
   const lon = parseFloat(geoData[0].lon);
   ```

4. **Mise à jour Supabase** :
   ```javascript
   await supabase
       .from('clients')
       .update({
           gps: { lat, lon },
           updated_at: new Date().toISOString()
       })
       .eq('id', client.id);
   ```

---

## 📊 Statistiques affichées

| Métrique | Description |
|----------|-------------|
| **Total Clients** | Nombre total de clients dans la base |
| **Avec GPS** ✅ | Clients ayant des coordonnées valides |
| **Sans GPS** ❌ | Clients nécessitant un géocodage |
| **Couverture** | Pourcentage de clients géocodés |

---

## 🚨 Limitations et bonnes pratiques

### Rate Limiting LocationIQ

- ⏱️ **Pause de 600ms** entre chaque requête
- 📈 **Limite gratuite** : Vérifiez votre quota sur [locationiq.com](https://locationiq.com)
- 💡 **Conseil** : Ne lancez le scan que lorsque nécessaire

### Qualité des adresses

Pour un géocodage optimal, assurez-vous que vos adresses contiennent :
- ✅ Numéro de rue
- ✅ Nom de rue
- ✅ Code postal
- ✅ Ville

**Exemple d'adresse optimale** :
```
10 rue de la République, 75001 Paris
```

### Gestion des erreurs

Le système gère automatiquement :
- ❌ Adresses introuvables
- ❌ Erreurs réseau
- ❌ Timeouts API

Les échecs sont comptabilisés dans le résultat du scan.

---

## 🔍 Débogage

### Vérifier les logs serveur

Les logs affichent :
```
🔍 Vérification des clients sans GPS...
✅ Fixed: Dupont Jean -> 48.8566, 2.3522
❌ Not found: Client Inconnu
```

### Vérifier la base de données

```sql
-- Clients sans GPS
SELECT id, nom, prenom, adresse_brute, gps
FROM clients
WHERE gps IS NULL OR gps = '';

-- Clients avec GPS
SELECT id, nom, prenom, gps
FROM clients
WHERE gps IS NOT NULL AND gps != '';
```

---

## 📝 Fichiers modifiés

| Fichier | Description |
|---------|-------------|
| `server/index.js` | Ajout endpoint `/api/clients/check-gps` |
| `src/components/diagnostics/GPSChecker.tsx` | Composant React de diagnostic |
| `src/components/layout/Sidebar.tsx` | Ajout menu "Diagnostic GPS" |
| `src/pages/Index.tsx` | Intégration du composant |
| `test-gps.html` | Page de test standalone |

---

## 🎯 Prochaines étapes recommandées

1. ✅ **Tester le diagnostic** avec vos données réelles
2. ✅ **Lancer un scan GPS** pour géocoder les clients manquants
3. ✅ **Vérifier la qualité** des coordonnées obtenues sur la carte
4. ✅ **Optimiser les routes** avec VROOM maintenant que tous les clients ont des GPS

---

## 💡 Astuces

### Géocodage manuel

Si un client n'est pas trouvé automatiquement, vous pouvez :

1. Vérifier l'adresse dans la base de données
2. Corriger l'adresse si nécessaire
3. Relancer le scan pour ce client spécifique

### Monitoring de la couverture GPS

Ajoutez un widget dans le dashboard pour suivre le pourcentage de clients géocodés en temps réel.

---

## 📞 Support

En cas de problème :

1. Vérifiez que le serveur est démarré (`npm run dev`)
2. Consultez les logs dans la console
3. Vérifiez votre quota LocationIQ
4. Testez avec la page `test-gps.html` pour isoler le problème

---

**Créé le** : 2026-01-01  
**Version** : 1.0  
**API utilisée** : LocationIQ v1
