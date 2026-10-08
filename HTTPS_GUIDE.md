# 🔒 INS SIG PLATFORM — Guide de Configuration HTTPS & SSL

Ce guide explique comment activer et utiliser le protocole **HTTPS / TLS** pour sécuriser l'ensemble des échanges (Studio SIG Web, API REST, tuiles cartographiques, websockets).

---

## 📋 Synthèse des 3 modes disponibles

| Mode | Fichier Compose | Protocole | Certificat | Cas d'usage |
| :--- | :--- | :--- | :--- | :--- |
| **1. Standard (Actuel)** | `docker-compose.yml` | HTTP | Aucun (`:8085`, `:4000`) | Développement local, POC |
| **2. Intranet INS** | `docker-compose.https-intranet.yml` | **HTTPS** (443) | **Auto-signé INS** (4096 bits, 10 ans) | Réseau interne INS, sans domaine public |
| **3. Production Internet** | `docker-compose.https-traefik.yml` | **HTTPS** (443) | **Let's Encrypt** (Renouvellement auto) | Exposition publique (ex: `sig.ins.tn`) |

---

## 🏛️ Option 1 : HTTPS Intranet (Nginx + Certificat Auto-signé)

Idéal pour l'infrastructure interne de l'INS sans dépendance à une autorité de certification publique ni accès internet.

### ✅ Statut des certificats
Les certificats ont déjà été générés et se trouvent dans `docker/nginx/ssl/` :
- `carto-selfsigned.crt` : Certificat X.509 (4096 bits, valide 10 ans)
- `carto-selfsigned.key` : Clé privée RSA sécurisée
- `dhparam.pem` : Paramètres Diffie-Hellman 2048 bits pour Perfect Forward Secrecy

### 🚀 Démarrer la plateforme en HTTPS Intranet
```powershell
# 1. Arrêter le mode standard
docker compose down

# 2. Démarrer le mode HTTPS Intranet
docker compose -f docker-compose.https-intranet.yml up -d --build
```

### 🌐 URLs d'accès :
- **Studio SIG & API** : `https://localhost` (ou l'IP/nom de la machine sur l'intranet)
- **Redirection automatique** : Tout appel `http://...:80` est automatiquement redirigé vers `https://...:443`
- **API Healthcheck** : `https://localhost/api/health`
- **Swagger Docs** : `https://localhost/api/docs`

### 🔄 Régénérer le certificat pour un nom de machine ou IP spécifique
Si le serveur a un nom ou une IP intranet (ex: `192.168.1.50` ou `sig-srv.ins.lan`) :

- **Sous Windows (PowerShell)** :
  ```powershell
  .\docker\nginx\ssl\generate_ssl_cert.ps1 -Domain "sig-srv.ins.lan"
  ```
- **Sous Linux (Bash)** :
  ```bash
  bash docker/nginx/ssl/generate_ssl_cert.sh "sig-srv.ins.lan"
  ```

### 💻 Installer le certificat sur les postes clients (éviter l'avertissement navigateur)
Pour que Chrome / Edge / Firefox affichent le cadenas vert sans avertissement :
1. Copier le fichier `docker/nginx/ssl/carto-selfsigned.crt` sur le poste client.
2. Double-cliquer sur le fichier → **Installer le certificat**.
3. Choisir **Ordinateur local** → **Placer tous les certificats dans le magasin suivant**.
4. Sélectionner **Autorités de certification racines de confiance**.
5. *En entreprise :* L'équipe système INS peut déployer ce certificat sur tous les postes en 1 clic via une **GPO Active Directory**.

---

## 🌍 Option 2 : HTTPS Production Internet (Traefik + Let's Encrypt)

Utilisé lorsque la plateforme est accessible depuis Internet avec un vrai nom de domaine (ex: `sig.ins.tn`).

### ⚙️ Configuration
1. Dans le fichier `.env` ou directement dans l'environnement, renseignez :
   ```env
   DOMAIN_NAME=sig.ins.tn
   ACME_EMAIL=dsi@ins.tn
   ```
2. Vérifiez que les ports **80** et **443** sont ouverts et redirigés vers le serveur.

### 🚀 Démarrage
```powershell
# 1. Arrêter tout conteneur actif
docker compose down

# 2. Démarrer avec Traefik
docker compose -f docker-compose.https-traefik.yml up -d --build
```
Traefik négocie automatiquement le certificat SSL avec l'autorité Let's Encrypt, le stocke dans un volume persistant et le renouvelle automatiquement tous les 60 à 90 jours sans interruption de service.

---

## 🔐 Paramètres de sécurité TLS appliqués
- **Protocoles** : TLSv1.2 et TLSv1.3 uniquement (SSLv3, TLS 1.0 et 1.1 désactivés)
- **HSTS** : `Strict-Transport-Security` configuré pour forcer HTTPS
- **Headers de durcissement** : `X-Frame-Options`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`
- **Protection DDoS / API** : Rate limiting à 60 req/s pour l'API et 300 req/s pour les tuiles cartographiques
