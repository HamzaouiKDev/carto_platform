import os
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm, mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        if self._pageNumber == 1:
            return # Couverture sans header/footer

        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#06B6D4"))
        self.drawString(2 * cm, 28.5 * cm, "CartoPlatform Enterprise — Guide d'Intégration & de Déploiement")
        
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawRightString(19 * cm, 28.5 * cm, "ENPE • Cartographie Souveraine")

        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(2 * cm, 28.3 * cm, 19 * cm, 28.3 * cm)

        # Footer
        self.line(2 * cm, 1.8 * cm, 19 * cm, 1.8 * cm)
        self.setFont("Helvetica", 8)
        self.drawString(2 * cm, 1.3 * cm, "Confidentiel • Système d'Information Géographique & Recensement")
        self.drawRightString(19 * cm, 1.3 * cm, f"Page {self._pageNumber} sur {page_count}")
        self.restoreState()

def build_pdf(filename="Guide_Complet_Plateforme_Cartographique_ENPE.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2.2 * cm,
        bottomMargin=2.2 * cm
    )

    styles = getSampleStyleSheet()

    # Custom typography
    title_cover_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=26,
        leading=32,
        textColor=colors.HexColor('#0F172A'),
        spaceAfter=12
    )

    subtitle_cover_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=13,
        leading=18,
        textColor=colors.HexColor('#475569'),
        spaceAfter=30
    )

    h1_style = ParagraphStyle(
        'SectionH1',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=20,
        textColor=colors.HexColor('#0284C7'),
        spaceBefore=18,
        spaceAfter=8,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#0F172A'),
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor('#1E293B'),
        spaceAfter=8
    )

    callout_style = ParagraphStyle(
        'Callout',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13.5,
        textColor=colors.HexColor('#0369A1')
    )

    code_style = ParagraphStyle(
        'CodeSnippet',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8,
        leading=11,
        textColor=colors.HexColor('#0F172A'),
    )

    story = []

    # ══════════════════════════════════════════════════════════════════════════
    # PAGE DE COUVERTURE
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Spacer(1, 2 * cm))
    
    # Badge
    badge_table = Table([[Paragraph("<b>DOCUMENT TECHNIQUE DE RÉFÉRENCE</b>", ParagraphStyle('B', fontName='Helvetica-Bold', fontSize=9, textColor=colors.HexColor('#0369A1')))]], colWidths=[7.5 * cm])
    badge_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#E0F2FE')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#38BDF8')),
        ('PADDING', (0,0), (-1,-1), 4),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
    ]))
    story.append(badge_table)
    story.append(Spacer(1, 0.8 * cm))

    story.append(Paragraph("Plateforme Cartographique Souveraine", title_cover_style))
    story.append(Paragraph("Guide d'Intégration Développeur, Administration & Déploiement Système (Docker & Natif Ubuntu)", subtitle_cover_style))
    
    story.append(HRFlowable(width="100%", thickness=3, color=colors.HexColor('#0284C7'), spaceBefore=10, spaceAfter=20))

    meta_data = [
        [Paragraph("<b>Projet :</b>", body_style), Paragraph("Enquête Nationale sur la Population et l'Emploi (ENPE)", body_style)],
        [Paragraph("<b>Composant :</b>", body_style), Paragraph("CartoPlatform Enterprise — Passerelle SIG & API Multi-Fournisseurs", body_style)],
        [Paragraph("<b>Technologies :</b>", body_style), Paragraph("Node.js 20, PostGIS 3.4, Redis 7, OSRM MLD, Leaflet, Nginx", body_style)],
        [Paragraph("<b>Version :</b>", body_style), Paragraph("1.2.0 (Production)", body_style)],
        [Paragraph("<b>Date de publication :</b>", body_style), Paragraph("Octobre 2026", body_style)],
        [Paragraph("<b>Diffusion :</b>", body_style), Paragraph("Équipe Technique, Administrateurs Systèmes & Développeurs", body_style)],
    ]
    meta_table = Table(meta_data, colWidths=[4 * cm, 13 * cm])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#E2E8F0')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(meta_table)

    story.append(Spacer(1, 3 * cm))
    
    notice_text = "<b>Résumé Exécutif :</b> Ce document constitue le guide de référence pour l'utilisation, le raccordement applicatif et le déploiement opérationnel du serveur cartographique. Il couvre l'intégration avec les clients Web (Symfony/Twig), mobiles (tablettes CAPI hors-ligne) et SIG bureautiques (QGIS), ainsi que les procédures de réplication sur Windows et Ubuntu Server sans conteneur."
    notice_table = Table([[Paragraph(notice_text, callout_style)]], colWidths=[17 * cm])
    notice_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F0F9FF')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#BAE6FD')),
        ('PADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(notice_table)

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # CHAPITRE 1 : ARCHITECTURE ET AUTHENTIFICATION
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph("1. Architecture Générale & Authentification", h1_style))
    story.append(Paragraph(
        "La plateforme cartographique fournit un point d'accès unifié et haute performance pour servir les couches cartographiques (fonds raster satellite, plans de rues), les calculs d'itinéraires et le géocodage, tout en garantissant un fonctionnement 100% autonome et hors-ligne grâce à une stratégie de pré-cache Redis et un moteur OSRM embarqué.",
        body_style
    ))

    story.append(Paragraph("1.1 Modes d'authentification par Clé d'API", h2_style))
    story.append(Paragraph(
        "L'accès aux ressources cartographiques est sécurisé par des jetons applicatifs (clés d'API préfixées par <code>cpt_live_</code>). Les clients peuvent s'authentifier au choix selon deux formats :",
        body_style
    ))

    auth_data = [
        [Paragraph("<b>Méthode</b>", body_style), Paragraph("<b>Format</b>", body_style), Paragraph("<b>Cas d'usage recommandé</b>", body_style)],
        [
            Paragraph("<b>Paramètre d'URL (Query)</b>", body_style),
            Paragraph("<code>?key=cpt_live_XXXXX</code>", code_style),
            Paragraph("Couches de tuiles XYZ pour Leaflet.js, OpenLayers, et connexions QGIS de bureau.", body_style)
        ],
        [
            Paragraph("<b>En-tête HTTP (Header)</b>", body_style),
            Paragraph("<code>x-api-key: cpt_live_XXXXX</code>", code_style),
            Paragraph("Requêtes JSON backend (Symfony), applications mobiles Android et scripts d'intégration.", body_style)
        ],
        [
            Paragraph("<b>Jeton Porteur (Bearer JWT)</b>", body_style),
            Paragraph("<code>Authorization: Bearer &lt;token&gt;</code>", code_style),
            Paragraph("Session administrateur sur le Dashboard Studio et opérations de configuration.", body_style)
        ]
    ]
    auth_table = Table(auth_data, colWidths=[4 * cm, 6 * cm, 7 * cm])
    auth_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F5F9')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('PADDING', (0,0), (-1,-1), 6),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(auth_table)
    story.append(Spacer(1, 0.4 * cm))

    story.append(Paragraph("1.2 Cycle de Vie des Clés d'API & Sécurité Zero-Knowledge", h2_style))
    story.append(Paragraph(
        "• <b>Stockage sécurisé :</b> Le serveur ne stocke que le hachage cryptographique <b>SHA-256</b> de la clé. La clé complète en clair n'est communiquée qu'une seule fois lors de sa création.<br/>"
        "• <b>Désactivation / Activation à chaud :</b> Une clé peut être suspendue temporairement via l'interface ou l'API (<code>PUT /api/tokens/:id/toggle</code>). La désactivation est immédiate sans perte de statistiques d'usage.<br/>"
        "• <b>Suppression définitive :</b> Permet de révoquer et purger définitivement la clé de la base de données PostGIS avec traçabilité dans le journal d'audit de sécurité.",
        body_style
    ))

    story.append(Spacer(1, 0.5 * cm))

    # ══════════════════════════════════════════════════════════════════════════
    # CHAPITRE 2 : GUIDE D'INTÉGRATION CLIENT
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph("2. Guide d'Intégration Développeur", h1_style))
    
    story.append(Paragraph("2.1 Intégration Web avec Leaflet.js (Templates Twig / Symfony)", h2_style))
    story.append(Paragraph("Pour afficher une carte interactive dans une application web ou un portail d'administration :", body_style))

    leaflet_code = """&lt;link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/&gt;
&lt;script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"&gt;&lt;/script&gt;
&lt;div id="map" style="width: 100%; height: 500px; border-radius: 8px;"&gt;&lt;/div&gt;

&lt;script&gt;
  const SERVER_URL = 'http://localhost:8085';
  const API_KEY = 'VOTRE_CLE_API';

  // 1. Initialiser la carte sur la Tunisie
  const map = L.map('map').setView([36.8065, 10.1815], 12);

  // 2. Calque Satellite HD (Esri)
  const satLayer = L.tileLayer(
    `${SERVER_URL}/api/tiles/esri-imagery/{z}/{x}/{y}.png?key=${API_KEY}`,
    { maxZoom: 19, attribution: 'Esri Satellite | CartoPlatform' }
  ).addTo(map);

  // 3. Calque Rues OpenStreetMap
  const osmLayer = L.tileLayer(
    `${SERVER_URL}/api/tiles/osm-standard/{z}/{x}/{y}.png?key=${API_KEY}`,
    { maxZoom: 19, attribution: 'OpenStreetMap | CartoPlatform' }
  );

  L.control.layers({ "Satellite HD": satLayer, "Plan OSM": osmLayer }).addTo(map);
&lt;/script&gt;"""

    code_table = Table([[Paragraph(f"<pre>{leaflet_code}</pre>", code_style)]], colWidths=[17 * cm])
    code_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#0F172A')),
        ('TEXTCOLOR', (0,0), (-1,-1), colors.HexColor('#E2E8F0')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#334155')),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(code_table)

    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph("2.2 Connexion dans QGIS (SIG Bureautique)", h2_style))
    story.append(Paragraph(
        "1. Ouvrez <b>QGIS</b> et localisez l'arbre <b>Explorateur</b>.<br/>"
        "2. Faites un clic droit sur <b>XYZ Tiles</b> &gt; <b>Nouvelle connexion...</b><br/>"
        "3. Renseignez les champs :<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;• <b>Nom :</b> <code>CartoPlatform Satellite HD</code><br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;• <b>URL :</b> <code>http://localhost:8085/api/tiles/esri-imagery/{z}/{x}/{y}.png?key=VOTRE_CLE</code><br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;• <b>Résolution :</b> Zoom 0 à 19.<br/>"
        "4. Validez en cliquant sur <b>OK</b>. Le calque est prêt à être glissé dans n'importe quel projet SIG.",
        body_style
    ))

    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph("2.3 API REST de Calcul d'Itinéraires (OSRM)", h2_style))
    story.append(Paragraph(
        "Permet de calculer le temps de trajet en minutes, la distance kilométrique et le tracé GeoJSON entre deux points GPS :<br/>"
        "<code>GET /api/routing/route?start=10.1815,36.8065&end=10.6369,35.8256&mode=car&key=VOTRE_CLE</code>",
        body_style
    ))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # CHAPITRE 3 : CATALOGUE DES COUCHES ET FOURNISSEURS
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph("3. Catalogue des Calques & Services Disponibles", h1_style))
    story.append(Paragraph("La passerelle cartographique unifie plusieurs fournisseurs avec basculement automatique (failover) :", body_style))

    cat_data = [
        [Paragraph("<b>Identifiant URL</b>", body_style), Paragraph("<b>Nom & Description</b>", body_style), Paragraph("<b>Type</b>", body_style), Paragraph("<b>Zooms</b>", body_style), Paragraph("<b>Usage Cible</b>", body_style)],
        [
            Paragraph("<code>esri-imagery</code>", code_style),
            Paragraph("<b>Satellite HD (Esri World Imagery)</b>", body_style),
            Paragraph("Raster XYZ", body_style),
            Paragraph("0 à 19", body_style),
            Paragraph("Repérage précis du bâti, parcelles agricoles, zones rurales et limites de district.", body_style)
        ],
        [
            Paragraph("<code>osm-standard</code>", code_style),
            Paragraph("<b>Plan Rues & Bâti (OpenStreetMap)</b>", body_style),
            Paragraph("Raster XYZ", body_style),
            Paragraph("0 à 19", body_style),
            Paragraph("Navigation urbaine, toponymie complète des quartiers et points d'intérêt.", body_style)
        ],
        [
            Paragraph("<code>esri-streets</code>", code_style),
            Paragraph("<b>Plan Routier Cartographique (Esri)</b>", body_style),
            Paragraph("Raster XYZ", body_style),
            Paragraph("0 à 19", body_style),
            Paragraph("Fond de carte clair, très lisible pour superposer des polygones ou des ménages.", body_style)
        ],
        [
            Paragraph("<code>maptiler-streets</code>", code_style),
            Paragraph("<b>MapTiler Vector / Raster</b>", body_style),
            Paragraph("Vector/Raster", body_style),
            Paragraph("0 à 20", body_style),
            Paragraph("Styles personnalisables et rendu haute densité pour écrans haute résolution.", body_style)
        ],
        [
            Paragraph("<code>osrm-tunisia</code>", code_style),
            Paragraph("<b>Moteur de Routage National (Tunisie)</b>", body_style),
            Paragraph("Routing REST", body_style),
            Paragraph("-", body_style),
            Paragraph("Calcul d'itinéraires et temps de déplacement pour les équipes d'enquêteurs.", body_style)
        ]
    ]

    cat_table = Table(cat_data, colWidths=[3.2 * cm, 4.5 * cm, 2.3 * cm, 1.8 * cm, 5.2 * cm])
    cat_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F5F9')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('PADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(cat_table)

    story.append(Spacer(1, 0.6 * cm))

    # ══════════════════════════════════════════════════════════════════════════
    # CHAPITRE 4 : TABLEAU DE BORD & STATISTIQUES
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph("4. Administration, Statistiques & Maintenance", h1_style))
    story.append(Paragraph(
        "Le tableau de bord d'administration centralise les indicateurs opérationnels en temps réel :",
        body_style
    ))

    story.append(Paragraph("4.1 Métriques Globales et Filtrage Multi-Périodes", h2_style))
    story.append(Paragraph(
        "• <b>Périodes sélectionnables :</b> 1 Heure (résolution minute par minute), 24 Heures, 7 Jours, 30 Jours ou Tout l'historique.<br/>"
        "• <b>Indicateurs clés (KPIs) :</b> Volume d'appels, Taux de cache Redis (visant &gt; 80% pour économiser la bande passante), Latence moyenne P95/P99, et Taux de Succès Global des requêtes.<br/>"
        "• <b>Filtrage par Clé d'API :</b> Le sélecteur d'API permet d'isoler en un clic le trafic, les succès et les erreurs générés par une tablette ou un service spécifique.<br/>"
        "• <b>Tableau détaillé par Clé :</b> Donne la visibilité sur chaque application cliente avec statut (Actif/Désactivé), volume d'appels, taux de succès, hits de cache et date de dernière activité.",
        body_style
    ))

    story.append(Paragraph("4.2 Procédure d'Initialisation (Réinitialisation) des Statistiques", h2_style))
    story.append(Paragraph(
        "Pour réinitialiser les compteurs d'appels avant le lancement d'une nouvelle vague d'enquête ou après des tests de charge :<br/>"
        "1. Ouvrez le <b>Dashboard Admin</b> sur <code>http://localhost:8085</code>.<br/>"
        "2. Cliquez sur le bouton rouge <b>🗑️ Initialiser les Stats</b> en haut à droite.<br/>"
        "3. Confirmez l'opération dans la boîte de dialogue : la table <code>api_usage_logs</code> est purgée, les quotas journaliers sont réinitialisés et le cache Redis des statistiques est invalidé.<br/>"
        "4. L'opération est immédiatement tracée dans le journal d'audit de sécurité avec l'adresse IP de l'administrateur.",
        body_style
    ))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # CHAPITRE 5 : GUIDE DE DÉPLOIEMENT & DUPLICATION
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph("5. Déploiement & Duplication de l'Infrastructure", h1_style))

    story.append(Paragraph("5.1 Scénario A : Duplication sur un autre PC Windows (avec Docker Desktop)", h2_style))
    story.append(Paragraph(
        "1. <b>Sur le PC source :</b> Lancez la sauvegarde PostGIS :<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;<code>cd carto_platform && .\\scripts\\backup_postgis.ps1</code><br/>"
        "2. Copiez l'intégralité du dossier <code>carto_platform</code> vers le nouveau PC Windows.<br/>"
        "3. <b>Sur le nouveau PC :</b> Démarrez Docker Desktop, puis dans PowerShell :<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;<code>cd carto_platform</code><br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;<code>docker compose up -d --build</code><br/>"
        "4. Restaurez les données de la base :<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;<code>.\\scripts\\restore_postgis.ps1 -BackupFile .\\backups\\backup_carto_postgis_XXX.dump</code><br/>"
        "5. L'application est immédiatement disponible sur <code>http://localhost:8085</code>.",
        body_style
    ))

    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph("5.2 Scénario B : Déploiement Natif sur Ubuntu Server 22.04/24.04 (SANS DOCKER)", h2_style))
    story.append(Paragraph(
        "Ce mode installe directement les services sur le système d'exploitation pour des performances maximales et une empreinte mémoire réduite :",
        body_style
    ))

    ubuntu_steps = """# 1. Mise à jour et paquets de base
sudo apt update && sudo apt install -y curl wget git nginx ufw software-properties-common

# 2. Installer PostgreSQL 16 + PostGIS 3.4
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt update && sudo apt install -y postgresql-16 postgresql-16-postgis-3
sudo -u postgres psql -c "CREATE USER carto_user WITH PASSWORD 'carto_secure_pass';"
sudo -u postgres psql -c "CREATE DATABASE carto_db OWNER carto_user;"
sudo -u postgres psql -d carto_db -c "CREATE EXTENSION postgis;"

# 3. Installer et sécuriser Redis 7
sudo apt install -y redis-server
sudo sed -i 's/^# requirepass foobared/requirepass redis_secure_pass/' /etc/redis/redis.conf
sudo systemctl restart redis-server && sudo systemctl enable redis-server

# 4. Installer Node.js 20 LTS et déployer l'API
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo mkdir -p /var/www/carto_platform && sudo chown -R www-data:www-data /var/www/carto_platform
# (Copier backend/ et frontend/ dans /var/www/carto_platform)
cd /var/www/carto_platform/backend && npm ci --omit=dev
node src/database/migrate.js

# 5. Créer le service Systemd (/etc/systemd/system/carto-api.service)
# ExecStart=/usr/bin/node /var/www/carto_platform/backend/src/index.js
sudo systemctl daemon-reload && sudo systemctl enable --now carto-api

# 6. Nginx Reverse Proxy (Port 8085 -> Static HTML + proxy_pass /api/ vers 127.0.0.1:4000)
sudo systemctl restart nginx"""

    ubuntu_table = Table([[Paragraph(f"<pre>{ubuntu_steps}</pre>", code_style)]], colWidths=[17 * cm])
    ubuntu_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#0F172A')),
        ('TEXTCOLOR', (0,0), (-1,-1), colors.HexColor('#E2E8F0')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#334155')),
        ('PADDING', (0,0), (-1,-1), 7),
    ]))
    story.append(ubuntu_table)

    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph(
        "<b>Bilan de l'installation :</b> La machine Ubuntu héberge nativement la base spatiale, le moteur de cache, le démon Node.js géré par Systemd et le serveur Nginx servant les interfaces sur le port <code>8085</code> avec redémarrage automatique en cas de panne.",
        body_style
    ))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF généré avec succès : {filename}")

if __name__ == "__main__":
    out_file = sys.argv[1] if len(sys.argv) > 1 else "Guide_Complet_Plateforme_Cartographique_ENPE.pdf"
    build_pdf(out_file)
