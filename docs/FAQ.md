# ❓ FAQ - FOIRE AUX QUESTIONS

**Arkos Logistics - Questions fréquentes**

---

## 📱 ACCÈS ET CONNEXION

### Comment accéder à l'application ?
Ouvrez votre navigateur et allez sur l'URL fournie par votre administrateur. Utilisez vos identifiants personnels pour vous connecter.

### Puis-je utiliser l'application sur mon téléphone ?
Oui ! L'application est entièrement optimisée pour mobile. Vous pouvez même l'installer comme une app native (PWA).

### Comment installer l'app sur mon téléphone ?
**Android** : Ouvrez l'app dans Chrome → Menu (⋮) → "Installer l'application"  
**iOS** : Ouvrez l'app dans Safari → Bouton Partager → "Sur l'écran d'accueil"

### L'application fonctionne-t-elle hors ligne ?
Oui, en mode PWA. Les données seront automatiquement synchronisées quand vous aurez à nouveau du réseau.

### J'ai oublié mon mot de passe, que faire ?
Contactez votre administrateur pour réinitialiser votre mot de passe.

---

## 👥 GESTION DES CLIENTS

### Comment ajouter un nouveau client ?
Les clients sont ajoutés via Google Sheets par l'administrateur. Contactez-le pour ajouter un nouveau client.

### Puis-je modifier les informations d'un client ?
Oui, ouvrez la fiche client, cliquez sur "Modifier", changez les informations et enregistrez.

### Les modifications sont-elles synchronisées ?
Oui, automatiquement avec Google Sheets et Google Calendar en temps réel.

### Comment rechercher un client ?
Utilisez la barre de recherche en haut de la liste des clients. Vous pouvez rechercher par nom, ville ou téléphone.

### Que signifient les différents statuts de client ?
- **À contacter** : Nouveau client, pas encore contacté
- **Signé** : Devis signé, prêt pour livraison
- **Livraison planifiée** : Livraison programmée
- **Livré** : Livraison effectuée
- **Installation en cours** : Chantier en cours
- **Terminé** : Installation terminée

---

## 🚚 LIVRAISONS

### Comment planifier une livraison ?
Allez dans "Livraisons" → "Planning Rapide" → Sélectionnez les clients → Choisissez date et livreur → Planifiez.

### Comment optimiser une tournée ?
Cliquez sur "Optimiser la tournée". L'algorithme calcule automatiquement le meilleur itinéraire pour gagner du temps.

### Puis-je modifier l'ordre des livraisons ?
Oui, vous pouvez réorganiser manuellement ou relancer l'optimisation.

### Comment confirmer une livraison ?
Sur mobile : Cliquez sur "Livrer" → Faites signer le client → Prenez une photo de la signature → Validez.

### Que faire si un client est absent ?
Marquez la livraison comme "Problème", ajoutez un commentaire expliquant la situation, et replanifiez.

### Les horaires sont-ils automatiques ?
Oui, l'optimisation calcule les horaires estimés en fonction des temps de trajet.

### Puis-je voir la tournée sur une carte ?
Oui, la vue carte affiche tous les points de livraison et l'itinéraire optimisé.

---

## 🔧 INSTALLATIONS

### Quand planifier une installation ?
Après la livraison, quand le client est prêt. Il est recommandé de le contacter d'abord.

### Comment démarrer un chantier ?
Allez dans "Installations" → Onglet "Planifiées" → Cliquez sur "Démarrer". La date de début est enregistrée automatiquement.

### Comment terminer un chantier ?
Onglet "En cours" → Cliquez sur "Terminer" → Confirmez. La durée est calculée automatiquement.

### Comment suivre l'avancement d'un chantier ?
Dans l'onglet "En cours", vous voyez la date de début et la durée écoulée pour chaque chantier.

### Puis-je assigner plusieurs poseurs à un chantier ?
Actuellement, un seul poseur par chantier. Pour des besoins spécifiques, contactez l'administrateur.

### Que faire en cas de problème sur un chantier ?
Ajoutez un commentaire dans la fiche client et contactez votre responsable.

---

## 📦 STOCK

### Comment est calculé le stock restant ?
Stock restant = Stock total - Stock consommé (clients livrés ou en installation).

### Que signifie "Stock critique" ?
Le stock est critique quand il est inférieur à 25% du stock total. Une alerte rouge s'affiche.

### Comment ajouter du stock ?
Sélectionnez la zone → "Réception Stock" → Entrez la quantité → Confirmez.

### Le stock est-il mis à jour en temps réel ?
Oui, à chaque livraison confirmée ou installation terminée, le stock est recalculé automatiquement.

### Pourquoi le stock est différent de Google Sheets ?
Le stock affiché est calculé en temps réel. Si vous voyez une différence, actualisez la page.

### Comment voir le stock par zone ?
Utilisez les onglets en haut de la vue Stock : France, Guadeloupe, Martinique, Corse.

---

## 📊 RAPPORTS

### Quels types de rapports puis-je générer ?
- Rapport des livraisons (PDF/Excel)
- Rapport des installations (PDF/Excel)
- Rapport de stock (PDF/Excel)

### Quelle est la différence entre PDF et Excel ?
- **PDF** : Pour impression, présentation, archivage
- **Excel** : Pour analyse de données, graphiques, calculs

### Puis-je filtrer les rapports par période ?
Oui, vous pouvez choisir : Tout, Aujourd'hui, 7 derniers jours, Ce mois-ci.

### Les rapports incluent-ils les statistiques ?
Oui, tous les rapports PDF incluent des statistiques automatiques (totaux, pourcentages, etc.).

### Puis-je personnaliser les rapports ?
Vous pouvez choisir la période et la zone. Pour plus de personnalisation, contactez l'administrateur.

### Les rapports sont-ils en temps réel ?
Oui, les rapports sont générés avec les données actuelles au moment de l'export.

---

## 🔔 NOTIFICATIONS

### Quand suis-je notifié ?
- Nouvelle livraison planifiée
- Installation à planifier
- Stock critique
- Mise à jour de l'application

### Comment activer les notifications ?
Les notifications sont activées automatiquement. Assurez-vous d'autoriser les notifications dans votre navigateur.

### Puis-je désactiver certaines notifications ?
Contactez votre administrateur pour personnaliser vos préférences de notification.

---

## 🗺️ CARTE ET ITINÉRAIRES

### Comment fonctionne l'optimisation d'itinéraire ?
L'algorithme calcule le chemin le plus court en tenant compte des distances et des temps de trajet.

### Puis-je voir les temps de trajet ?
Oui, l'optimisation affiche les temps de trajet estimés entre chaque point.

### La carte fonctionne-t-elle hors ligne ?
Partiellement. Les itinéraires déjà chargés restent visibles, mais vous ne pourrez pas calculer de nouveaux itinéraires sans connexion.

---

## 🔄 SYNCHRONISATION

### À quelle fréquence les données sont synchronisées ?
En temps réel. Chaque action est immédiatement synchronisée avec Google Sheets et Calendar.

### Que se passe-t-il si je perds la connexion ?
L'app passe en mode offline. Vos actions seront synchronisées automatiquement à la reconnexion.

### Comment forcer une synchronisation ?
Actualisez la page (F5) ou utilisez le pull-to-refresh sur mobile.

---

## ⚙️ PARAMÈTRES

### Puis-je changer la langue de l'application ?
L'application est en français par défaut. Contactez l'administrateur pour d'autres langues.

### Puis-je personnaliser l'interface ?
Les paramètres de personnalisation sont gérés par l'administrateur.

### Comment changer mon mot de passe ?
Contactez votre administrateur pour modifier votre mot de passe.

---

## 🐛 PROBLÈMES TECHNIQUES

### L'application est lente, que faire ?
1. Vérifiez votre connexion internet
2. Actualisez la page (F5)
3. Videz le cache du navigateur
4. Redémarrez le navigateur
5. Contactez le support si le problème persiste

### Je ne vois pas mes modifications
Actualisez la page. Les modifications peuvent prendre quelques secondes pour se synchroniser.

### L'application affiche "Hors ligne"
Vérifiez votre connexion internet. L'app fonctionnera en mode limité jusqu'à la reconnexion.

### Les données ne se chargent pas
1. Vérifiez votre connexion
2. Actualisez la page
3. Vérifiez que vous êtes bien connecté
4. Contactez le support

### La carte ne s'affiche pas
1. Vérifiez votre connexion internet
2. Autorisez la géolocalisation dans votre navigateur
3. Actualisez la page

### Les exports ne fonctionnent pas
1. Vérifiez que vous avez des données à exporter
2. Essayez un autre format (PDF → Excel ou vice versa)
3. Vérifiez que les pop-ups ne sont pas bloqués
4. Contactez le support

---

## 📱 MOBILE

### Pourquoi installer l'app au lieu d'utiliser le navigateur ?
L'app installée :
- ✅ Fonctionne hors ligne
- ✅ Est plus rapide
- ✅ Envoie des notifications
- ✅ S'ouvre comme une app native

### L'app prend-elle beaucoup d'espace ?
Non, environ 5-10 MB seulement.

### Puis-je utiliser l'app sur plusieurs appareils ?
Oui, connectez-vous avec les mêmes identifiants sur tous vos appareils.

### Comment mettre à jour l'app ?
Les mises à jour sont automatiques. Vous recevrez une notification quand une mise à jour est disponible.

---

## 🔐 SÉCURITÉ

### Mes données sont-elles sécurisées ?
Oui, toutes les données sont chiffrées et stockées de manière sécurisée.

### Qui peut voir mes données ?
Seuls les utilisateurs autorisés avec les bons identifiants peuvent accéder aux données.

### Puis-je partager mon compte ?
Non, chaque utilisateur doit avoir son propre compte pour des raisons de sécurité et de traçabilité.

### Que faire si je pense que mon compte est compromis ?
Contactez immédiatement votre administrateur pour changer votre mot de passe.

---

## 📞 SUPPORT

### Comment contacter le support ?
- 📧 Email : support@arkos-labs.com
- 📱 Téléphone : +33 X XX XX XX XX
- 💬 Chat : Disponible dans l'application

### Quels sont les horaires du support ?
Lundi - Vendredi : 9h - 18h  
Weekend : Support d'urgence uniquement

### Comment signaler un bug ?
Contactez le support avec :
- Description détaillée du problème
- Étapes pour reproduire le bug
- Captures d'écran si possible
- Navigateur et appareil utilisés

---

## 🎓 FORMATION

### Existe-t-il des tutoriels vidéo ?
Oui, consultez notre chaîne YouTube ou contactez votre administrateur.

### Puis-je avoir une formation personnalisée ?
Oui, contactez votre administrateur pour organiser une session de formation.

### Où trouver plus de documentation ?
Consultez le Guide Utilisateur Complet dans `/docs/GUIDE_UTILISATEUR.md`

---

## 💡 ASTUCES

### Raccourcis clavier
- `F5` : Actualiser
- `Ctrl + F` : Rechercher
- `Esc` : Fermer une modal

### Astuces mobile
- Tirez vers le bas pour actualiser (pull-to-refresh)
- Utilisez le mode paysage pour voir plus de données
- Activez le mode sombre pour économiser la batterie (si disponible)

### Optimisation
- Fermez les onglets inutilisés pour de meilleures performances
- Synchronisez régulièrement en mode offline
- Videz le cache occasionnellement

---

**Dernière mise à jour** : 04 Janvier 2026  
**Version** : 1.0.0

**Vous ne trouvez pas votre réponse ?**  
Contactez le support : support@arkos-labs.com
