# 🗺️ INS Carto Ménages — Application Test & Cercles Dynamiques

Application web interactive dédiée à la visualisation cartographique, au suivi des enquêtes terrain et à la gestion des ménages (recensement INS) avec persistance locale **IndexedDB** et intégration de la **Clé API**.

---

## 🚀 Accès Rapide

| Méthode | URL / Chemin | Description |
| :--- | :--- | :--- |
| **En ligne (HTTPS)** | [https://localhost/app_test/](https://localhost/app_test/) | Recommandé (servi directement par Nginx, sans problème de CORS) |
| **Fichier local** | `d:\carto_platform\app_test\index.html` | Peut être ouvert directement dans le navigateur |

---

## ✨ Fonctionnalités Clés

### 1. 🟢 Affichage des Cercles Dynamiques des Ménages
- **Calcul du rayon** :
  - *Proportionnel* : Le rayon s'adapte automatiquement à la taille du ménage (nombre de personnes).
  - *Uniforme* : Taille constante.
  - *Par statut* : Met en évidence les ménages prioritaires (ex: "À revisiter").
- **Code couleur par statut d'enquête** :
  - 🟢 **Vert (#10B981)** : Recensé (enquête validée)
  - 🟠 **Ambre (#F59E0B)** : À revisiter (absent temporaire / incomplet)
  - 🔵 **Bleu (#3B82F6)** : Absent (avis de passage déposé)
  - 🔴 **Rouge (#EF4444)** : Refus
- **Curseur d'échelle** : Multiplicateur de rayon de `x 0.5` à `x 2.5`.

### 2. ⚡ Clic sur un Cercle & Menu d'Options Interactif
Lors d'un clic sur n'importe quel cercle de ménage, un tiroir latéral vitré (glassmorphism) s'ouvre avec les options suivantes :
1. 📄 **Afficher la fiche d'enquête complète** : Détails exhaustifs (membres, logement, tranche revenu, téléphone, enquêteur assigné, observations, bouton impression).
2. 🏷️ **Modifier le statut d'enquête** : Changement instantané (ex: passer de *À revisiter* à *Recensé*), mise à jour visuelle du cercle et sauvegarde dans IndexedDB.
3. 🎨 **Personnaliser l'apparence du cercle** : Palette de couleur, curseur de rayon et d'opacité avec persistance.
4. 🧭 **Calculer la distance depuis le bureau INS** : Tracé géodésique sur la carte, calcul kilométrique et estimation du temps de route.
5. 📝 **Ajouter / Modifier la note de terrain** : Saisie d'observations de l'enquêteur sauvegardées localement.
6. 🗑️ **Supprimer le ménage** : Retrait définitif de la base locale avec confirmation.

### 3. 💾 Persistance Locale avec IndexedDB
- Base de données : `CartoMenagesDB` (version 1)
- Deux ObjectStores :
  - `menages` : Stockage complet des ménages avec index (`code`, `statut`, `taille`, `gouvernorat`).
  - `config` : Sauvegarde de la clé API, de l'URL du serveur et du fond de carte sélectionné.
- Fonction de réinitialisation rapide avec ~20 ménages géolocalisés sur le Grand Tunis (Tunis, Ariana, Ben Arous, La Marsa, Bardo).
- Export des données au format **GeoJSON standard**.

### 4. 🔑 Intégration de la Clé API
- Bouton dédié dans le bandeau supérieur pour configurer et tester la clé API (`x-api-key`).
- Test de connexion direct avec le healthcheck de la plateforme (`https://localhost/api/health`).
- Choix du fond de carte (Carto Dark, Carto Voyager, OSM, ou tuiles API plateforme).

### 5. ➕ Ajout de Nouveaux Ménages
- Cliquez sur le bouton **"Ajouter un ménage"** dans le header.
- Le curseur passe en mode cible : cliquez n'importe où sur la carte pour positionner le nouveau ménage.
- Le formulaire d'enregistrement s'ouvre avec les coordonnées GPS pré-remplies.
