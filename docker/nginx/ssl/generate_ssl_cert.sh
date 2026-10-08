# ==============================================================================
#  INS SIG PLATFORM — Génération certificat SSL auto-signé (intranet)
#  Usage : chmod +x generate_ssl_cert.sh && bash generate_ssl_cert.sh
# ==============================================================================
set -euo pipefail

CERT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOMAIN="${1:-localhost}"
DAYS=3650  # 10 ans

echo "[*] Génération certificat auto-signé pour : $DOMAIN"
echo "[*] Dossier de sortie : $CERT_DIR"

openssl req -x509 -nodes -newkey rsa:4096 \
  -keyout  "$CERT_DIR/carto-selfsigned.key" \
  -out     "$CERT_DIR/carto-selfsigned.crt" \
  -days    $DAYS \
  -subj    "/C=TN/ST=Tunis/L=Tunis/O=Institut National de la Statistique/OU=DSI/CN=$DOMAIN" \
  -addext  "subjectAltName=DNS:$DOMAIN,DNS:localhost,IP:127.0.0.1"

# Paramètres DH pour Forward Secrecy
if [ ! -f "$CERT_DIR/dhparam.pem" ]; then
  echo "[*] Génération des paramètres DH 2048 bits (peut prendre ~30s)..."
  openssl dhparam -out "$CERT_DIR/dhparam.pem" 2048
fi

chmod 600 "$CERT_DIR/carto-selfsigned.key"
chmod 644 "$CERT_DIR/carto-selfsigned.crt"

echo "[OK] Certificat généré :"
echo "     Clé privée  : $CERT_DIR/carto-selfsigned.key"
echo "     Certificat  : $CERT_DIR/carto-selfsigned.crt"
echo "     Valide pour : $DAYS jours (~10 ans)"
echo ""
echo "[INFO] Pour ajouter ce certificat aux navigateurs du réseau INS :"
echo "       Importez 'carto-selfsigned.crt' dans les Autorités de Certification"
echo "       de chaque navigateur (ou via GPO Active Directory)."
