# Aide-Mémoire Opérationnel Docker — CartoPlatform

## 1. Démarrage et Arrêt

```bash
# Démarrer tous les services en tâche de fond (avec build si nécessaire)
docker compose up -d

# Arrêter les services en conservant les volumes de données
docker compose down

# Arrêter et supprimer tous les volumes (ATTENTION : perte des données locales)
docker compose down -v

# Redémarrer un service spécifique
docker compose restart carto-api
```

## 2. Consultation des Journaux (Logs)

```bash
# Suivre tous les logs en temps réel
docker compose logs -f

# Suivre uniquement les logs de l'API cartographique
docker compose logs -f --tail=100 carto-api

# Filtrer les erreurs dans les logs de l'API
docker compose logs carto-api | grep "ERROR"
```

## 3. Gestion de la Base Spatiale PostGIS

```bash
# Exécuter les migrations manuellement
docker compose exec carto-api npm run migrate

# Ouvrir une session interactive psql
docker compose exec carto-postgis psql -U carto_user -d carto_db

# Lancer la sauvegarde PostGIS immédiate (PowerShell)
.\scripts\backup_postgis.ps1

# Restaurer une sauvegarde (PowerShell)
.\scripts\restore_postgis.ps1 -BackupFile ".\backups\backup_carto_postgis_XXXXX.dump"
```

## 4. Gestion du Cache Redis

```bash
# Vérifier la mémoire et les clés dans Redis
docker compose exec carto-redis redis-cli -a redis_secure_pass info memory

# Vider manuellement le cache des tuiles
docker compose exec carto-redis redis-cli -a redis_secure_pass flushdb
```

## 5. Mise à l'Échelle (Scaling Horizontal)

Pour supporter un trafic important, vous pouvez instancier plusieurs répliques de l'API :
```bash
docker compose up -d --scale carto-api=3
```

## 6. Surveillance des Ressources

```bash
# Voir l'utilisation CPU et RAM de chaque conteneur en direct
docker stats carto-api carto-postgis carto-redis carto-frontend
```
