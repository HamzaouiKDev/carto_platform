// scripts/generate_tmaps_doc_pdf.mjs
// Générateur de la Documentation Technique Officielle INS Carto Platform
// Style graphique inspiré de TMaps.tn et des standards d'API modernes

import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';

const OUTPUT_HTML = 'd:/carto_platform/scripts/tmaps_doc.html';
const OUTPUT_PDF = 'd:/carto_platform/INS_Carto_Platform_Documentation_API.pdf';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>INS Carto Platform — Documentation des APIs & Services Géographiques</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

    @page {
      size: A4 portrait;
      margin: 0;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: #0b0f19;
      color: #e2e8f0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-size: 9.5pt;
      line-height: 1.5;
    }

    /* Structure des pages A4 */
    .doc-page {
      width: 210mm;
      height: 297mm;
      max-height: 297mm;
      page-break-after: always;
      position: relative;
      overflow: hidden;
      padding: 16mm 18mm 18mm 18mm;
      display: flex;
      flex-direction: column;
      background: #0d121f;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    /* Décorations de fond */
    .glow-cyan {
      position: absolute;
      top: -100px;
      right: -100px;
      width: 350px;
      height: 350px;
      background: radial-gradient(circle, rgba(6, 182, 212, 0.12) 0%, transparent 70%);
      pointer-events: none;
    }
    .glow-blue {
      position: absolute;
      bottom: -100px;
      left: -100px;
      width: 350px;
      height: 350px;
      background: radial-gradient(circle, rgba(37, 99, 235, 0.12) 0%, transparent 70%);
      pointer-events: none;
    }

    /* En-tête de page standard */
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 8px;
      margin-bottom: 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      font-size: 8pt;
      color: #94a3b8;
    }
    .page-header-left {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      color: #38bdf8;
    }
    .page-header-badge {
      background: rgba(14, 165, 233, 0.15);
      color: #38bdf8;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 7pt;
      font-weight: 700;
      border: 1px solid rgba(14, 165, 233, 0.3);
    }

    /* Pied de page standard */
    .page-footer {
      position: absolute;
      bottom: 10mm;
      left: 18mm;
      right: 18mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      padding-top: 6px;
      font-size: 7.5pt;
      color: #64748b;
    }
    .page-footer a {
      color: #0284c7;
      text-decoration: none;
    }

    /* Typographie */
    h1, h2, h3, h4 {
      font-family: 'Outfit', sans-serif;
      color: #ffffff;
      font-weight: 700;
    }
    h2.section-title {
      font-size: 16pt;
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
      color: #ffffff;
    }
    h2.section-title .title-bar {
      width: 4px;
      height: 20px;
      background: linear-gradient(180deg, #0284c7, #38bdf8);
      border-radius: 2px;
      display: inline-block;
    }
    p.lead-text {
      color: #94a3b8;
      font-size: 9pt;
      margin-bottom: 12px;
      line-height: 1.5;
    }

    /* Badges HTTP Verbs */
    .badge-method {
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.5pt;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 5px;
      display: inline-block;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .badge-get {
      background: rgba(16, 185, 129, 0.15);
      color: #10b981;
      border: 1px solid rgba(16, 185, 129, 0.4);
    }
    .badge-post {
      background: rgba(245, 158, 11, 0.15);
      color: #f59e0b;
      border: 1px solid rgba(245, 158, 11, 0.4);
    }
    .badge-patch {
      background: rgba(139, 92, 246, 0.15);
      color: #a78bfa;
      border: 1px solid rgba(139, 92, 246, 0.4);
    }
    .badge-delete {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.4);
    }

    /* Endpoint Bar */
    .endpoint-card {
      background: #131b2e;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
    .endpoint-url {
      font-family: 'JetBrains Mono', monospace;
      font-size: 9pt;
      color: #f8fafc;
      font-weight: 500;
    }
    .endpoint-url span.param {
      color: #38bdf8;
    }

    /* Grille 2 colonnes style TMaps doc */
    .doc-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-bottom: 12px;
    }
    .doc-col {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    /* Terminal / Code Block */
    .code-card {
      background: #080c14;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
    }
    .code-card-header {
      background: #0f172a;
      padding: 6px 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    .terminal-dots {
      display: flex;
      gap: 5px;
    }
    .terminal-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .dot-red { background: #ef4444; }
    .dot-yellow { background: #f59e0b; }
    .dot-green { background: #10b981; }
    .code-title {
      font-size: 7.5pt;
      color: #94a3b8;
      font-family: 'JetBrains Mono', monospace;
    }
    .code-content {
      padding: 10px 12px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.5pt;
      line-height: 1.45;
      color: #cbd5e1;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .c-comment { color: #64748b; }
    .c-verb { color: #f59e0b; font-weight: 600; }
    .c-key { color: #38bdf8; }
    .c-str { color: #34d399; }
    .c-num { color: #fbbf24; }
    .c-url { color: #60a5fa; text-decoration: underline; }

    /* Tables */
    table.spec-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8pt;
      margin-bottom: 10px;
      background: rgba(19, 27, 46, 0.6);
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    table.spec-table th {
      background: rgba(30, 41, 59, 0.9);
      padding: 7px 10px;
      text-align: left;
      font-family: 'Outfit', sans-serif;
      font-weight: 600;
      color: #93c5fd;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    table.spec-table td {
      padding: 7px 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      color: #cbd5e1;
      vertical-align: top;
    }
    table.spec-table tr:last-child td {
      border-bottom: none;
    }
    table.spec-table code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.5pt;
      background: rgba(0, 0, 0, 0.3);
      padding: 1px 4px;
      border-radius: 3px;
      color: #38bdf8;
    }
    .req-badge {
      color: #f87171;
      font-weight: 600;
      font-size: 7pt;
    }
    .opt-badge {
      color: #94a3b8;
      font-size: 7pt;
    }

    /* Boîtes d'alerte / Callout */
    .callout {
      border-radius: 6px;
      padding: 9px 12px;
      display: flex;
      gap: 10px;
      align-items: flex-start;
      margin-bottom: 10px;
      font-size: 8pt;
    }
    .callout-info {
      background: rgba(2, 132, 199, 0.1);
      border-left: 3px solid #0284c7;
      color: #bae6fd;
    }
    .callout-success {
      background: rgba(16, 185, 129, 0.1);
      border-left: 3px solid #10b981;
      color: #a7f3d0;
    }
    .callout-warning {
      background: rgba(245, 158, 11, 0.1);
      border-left: 3px solid #f59e0b;
      color: #fde68a;
    }

    /* Cards interactifs / Features */
    .feature-card {
      background: rgba(19, 27, 46, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 12px;
    }
    .feature-card-title {
      font-family: 'Outfit', sans-serif;
      font-size: 9.5pt;
      font-weight: 600;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }

    /* ================= PAGE DE GARDE ================= */
    .cover-page {
      background: radial-gradient(circle at 80% 20%, #1e293b 0%, #0b0f19 70%);
      justify-content: space-between;
      padding: 22mm 22mm;
    }
    .cover-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .cover-logo-group {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .cover-logo-icon {
      width: 50px;
      height: 50px;
      background: linear-gradient(135deg, #0284c7, #2563eb);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      box-shadow: 0 8px 24px rgba(2, 132, 199, 0.4);
    }
    .cover-logo-text h3 {
      font-size: 13pt;
      letter-spacing: 0.5px;
      color: #ffffff;
    }
    .cover-logo-text p {
      font-size: 8pt;
      color: #94a3b8;
    }
    .cover-tag-rep {
      background: rgba(225, 29, 72, 0.15);
      border: 1px solid rgba(225, 29, 72, 0.35);
      color: #fda4af;
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 7.5pt;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .cover-center {
      margin: 40px 0;
    }
    .cover-badge-v {
      background: linear-gradient(90deg, #0284c7, #38bdf8);
      color: #0b0f19;
      font-weight: 800;
      font-size: 8.5pt;
      padding: 4px 12px;
      border-radius: 20px;
      display: inline-block;
      margin-bottom: 16px;
      letter-spacing: 1px;
    }
    .cover-title {
      font-size: 28pt;
      line-height: 1.15;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin-bottom: 16px;
      background: linear-gradient(135deg, #ffffff 40%, #93c5fd 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .cover-subtitle {
      font-size: 11pt;
      color: #94a3b8;
      max-width: 520px;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .cover-stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-top: 30px;
    }
    .cover-stat-box {
      background: rgba(30, 41, 59, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 12px;
      text-align: center;
    }
    .cover-stat-val {
      font-family: 'Outfit', sans-serif;
      font-size: 16pt;
      font-weight: 800;
      color: #38bdf8;
    }
    .cover-stat-lbl {
      font-size: 7pt;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }
    .cover-bottom {
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      padding-top: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8pt;
      color: #64748b;
    }
  </style>
</head>
<body>

  <!-- ========================================================================= -->
  <!-- PAGE 1 : COUVERTURE OFFICIELLE STYLE TMAPS.TN                            -->
  <!-- ========================================================================= -->
  <div class="doc-page cover-page">
    <div class="glow-cyan"></div>
    <div class="glow-blue"></div>

    <div class="cover-top">
      <div class="cover-logo-group">
        <div class="cover-logo-icon">🗺️</div>
        <div class="cover-logo-text">
          <h3>INS CARTO PLATFORM</h3>
          <p>Direction Informatique & Mécanographie • Tunis</p>
        </div>
      </div>
      <div class="cover-tag-rep">
        <span>🇹🇳</span> République Tunisienne
      </div>
    </div>

    <div class="cover-center">
      <div class="cover-badge-v">API REFERENCE v1.0.0 ENTERPRISE</div>
      <h1 class="cover-title">Plateforme Cartographique & SIG Souveraine</h1>
      <p class="cover-subtitle">
        Documentation officielle de référence pour l'intégration des APIs géospatiales,
        services de tuiles XYZ, géocodage direct/inverse, calcul d'itinéraires et moteur
        de cache cartographique 100% hors-ligne.
      </p>

      <div class="cover-stats-grid">
        <div class="cover-stat-box">
          <div class="cover-stat-val">60 200+</div>
          <div class="cover-stat-lbl">Tuiles Hors-Ligne</div>
        </div>
        <div class="cover-stat-box">
          <div class="cover-stat-val">15 000</div>
          <div class="cover-stat-lbl">Req/Min Débit Max</div>
        </div>
        <div class="cover-stat-box">
          <div class="cover-stat-val">&lt; 1 ms</div>
          <div class="cover-stat-lbl">Latence Cache Redis</div>
        </div>
        <div class="cover-stat-box">
          <div class="cover-stat-val">100%</div>
          <div class="cover-stat-lbl">Air-Gapped / Souverain</div>
        </div>
      </div>
    </div>

    <div class="cover-bottom">
      <div>
        <strong>Institut National de la Statistique (INS)</strong> — 70, Rue Ech-Cham, 1002 Tunis Belvédère
      </div>
      <div>
        Édition Technique : <strong>Octobre 2026</strong>
      </div>
    </div>
  </div>

  <!-- ========================================================================= -->
  <!-- PAGE 2 : VUE D'ENSEMBLE, ARCHITECTURE & AUTHENTIFICATION                  -->
  <!-- ========================================================================= -->
  <div class="doc-page">
    <div class="page-header">
      <div class="page-header-left">
        <span>INS CARTO PLATFORM</span>
        <span class="page-header-badge">GUIDE GÉNÉRAL</span>
      </div>
      <div>Architecture & Authentification • Page 2</div>
    </div>

    <h2 class="section-title"><span class="title-bar"></span>Vue d'Ensemble & Authentification</h2>
    <p class="lead-text">
      L'INS Carto Platform fournit une infrastructure géospatiale complète, haute performance et sécurisée,
      permettant aux applications de recensement, aux portails web et aux terminaux mobiles terrain d'accéder
      aux données cartographiques même en l'absence totale de connectivité réseau.
    </p>

    <div class="doc-grid">
      <!-- Col 1: Principes d'architecture -->
      <div class="doc-col">
        <div class="feature-card">
          <div class="feature-card-title">🏛️ Architecture 100% On-Premise</div>
          <p style="font-size: 8pt; color: #94a3b8; line-height: 1.45;">
            L'ensemble des briques logicielles s'exécute dans l'infrastructure de l'INS à Tunis.
            Aucune coordonnée de ménage ni donnée d'enquête ne transite par des serveurs tiers ou étrangers.
          </p>
        </div>

        <div class="feature-card">
          <div class="feature-card-title">⚡ Accélération Cache & Persistence</div>
          <p style="font-size: 8pt; color: #94a3b8; line-height: 1.45;">
            Le moteur Redis 7 en mémoire vive avec persistance disque AOF (volume <code>carto_redis_data</code>)
            sert les requêtes de tuiles avec un temps de réponse inférieur à <strong>1 ms</strong>.
          </p>
        </div>

        <div class="callout callout-info">
          <div>💡</div>
          <div>
            <strong>URL de Base :</strong> En environnement interne INS, utilisez l'hôte local ou le reverse proxy
            <code>http://localhost/api</code> (ou <code>https://sig.ins.tn/api</code>).
          </div>
        </div>
      </div>

      <!-- Col 2: Méthodes d'authentification -->
      <div class="doc-col">
        <div class="code-card">
          <div class="code-card-header">
            <div class="terminal-dots">
              <div class="terminal-dot dot-red"></div>
              <div class="terminal-dot dot-yellow"></div>
              <div class="terminal-dot dot-green"></div>
            </div>
            <div class="code-title">auth_methods.http</div>
          </div>
          <div class="code-content"><span class="c-comment"># Méthode 1 : Clé d'API via Query Param (Recommandé Leaflet)</span>
<span class="c-verb">GET</span> /api/tiles/esri-imagery/12/2165/1648?<span class="c-key">key</span>=<span class="c-str">cpt_live_JNkRURbRup63...</span>

<span class="c-comment"># Méthode 2 : En-tête X-API-Key</span>
<span class="c-verb">GET</span> /api/geocoding/search?q=Ariana
<span class="c-key">X-API-Key:</span> <span class="c-str">cpt_live_JNkRURbRup63...</span>

<span class="c-comment"># Méthode 3 : Token JWT Bearer (Portail Admin)</span>
<span class="c-verb">GET</span> /api/admin/metrics
<span class="c-key">Authorization:</span> Bearer <span class="c-str">eyJhbGciOiJIUzI1NiIs...</span></div>
        </div>

        <table class="spec-table">
          <thead>
            <tr>
              <th>Type de Clé</th>
              <th>Préfixe</th>
              <th>Usage & Portée</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>Production</code></td>
              <td><code>cpt_live_</code></td>
              <td>Accès complet tuiles, géocodage, routing terrain.</td>
            </tr>
            <tr>
              <td><code>Test/Dev</code></td>
              <td><code>cpt_test_</code></td>
              <td>Développement d'applications sans quota bloquant.</td>
            </tr>
            <tr>
              <td><code>Admin JWT</code></td>
              <td><code>Bearer</code></td>
              <td>Accès aux endpoints de Seeding, purge et métriques.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="callout callout-warning">
      <div>⚠️</div>
      <div>
        <strong>Politique de Rate Limiting :</strong> Les requêtes de tuiles <code>/tiles/</code> sont autorisées
        jusqu'à <strong>15 000 requêtes/minute</strong> par IP/Token afin de garantir un affichage instantané
        sans jamais renvoyer de code HTTP 429 lors des zooms rapides.
      </div>
    </div>

    <div class="page-footer">
      <div>INS Carto Platform • Documentation Technique Développeur</div>
      <div>https://sig.ins.tn/docs</div>
    </div>
  </div>

  <!-- ========================================================================= -->
  <!-- PAGE 3 : API TUILES CARTOGRAPHIQUES XYZ (TILE SERVICE)                   -->
  <!-- ========================================================================= -->
  <div class="doc-page">
    <div class="page-header">
      <div class="page-header-left">
        <span>INS CARTO PLATFORM</span>
        <span class="page-header-badge">TILE SERVICE</span>
      </div>
      <div>API Tuiles XYZ • Page 3</div>
    </div>

    <h2 class="section-title"><span class="title-bar"></span>API Tuiles Cartographiques XYZ</h2>
    <p class="lead-text">
      Distribution haute performance de tuiles raster conformes au standard Web Mercator (EPSG:3857).
      Intégration native sans adaptateur dans Leaflet, OpenLayers, MapLibre GL JS, QGIS et ArcGIS Pro.
    </p>

    <div class="endpoint-card">
      <span class="badge-method badge-get">GET</span>
      <span class="endpoint-url">/api/tiles/<span class="param">{provider}</span>/<span class="param">{z}</span>/<span class="param">{x}</span>/<span class="param">{y}</span></span>
    </div>

    <div class="doc-grid">
      <!-- Col 1: Paramètres & Fournisseurs -->
      <div class="doc-col">
        <h4 style="font-size: 9pt; color: #38bdf8; margin-bottom: 4px;">Paramètres d'URL</h4>
        <table class="spec-table">
          <thead>
            <tr>
              <th>Paramètre</th>
              <th>Type</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>provider</code></td>
              <td><span class="req-badge">Requis</span></td>
              <td>Identifiant du fournisseur de fond de carte.</td>
            </tr>
            <tr>
              <td><code>z</code></td>
              <td><span class="req-badge">Requis</span></td>
              <td>Niveau de zoom (0 à 19).</td>
            </tr>
            <tr>
              <td><code>x</code>, <code>y</code></td>
              <td><span class="req-badge">Requis</span></td>
              <td>Coordonnées de la colonne et rangée de la tuile.</td>
            </tr>
            <tr>
              <td><code>key</code></td>
              <td><span class="req-badge">Requis</span></td>
              <td>Clé API autorisée (<code>cpt_live_...</code>).</td>
            </tr>
          </tbody>
        </table>

        <h4 style="font-size: 9pt; color: #38bdf8; margin-top: 6px; margin-bottom: 4px;">Fonds de Carte Pris en Charge</h4>
        <table class="spec-table">
          <thead>
            <tr>
              <th>Provider ID</th>
              <th>Type</th>
              <th>Résolution & Couverture</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>esri-imagery</code></td>
              <td>Satellite HD</td>
              <td>Zoom 0-19 • Imagerie haute résolution</td>
            </tr>
            <tr>
              <td><code>esri-streets</code></td>
              <td>Plan Routier</td>
              <td>Zoom 0-19 • Rues, axes, adresses</td>
            </tr>
            <tr>
              <td><code>esri-topo</code></td>
              <td>Relief Topo</td>
              <td>Zoom 0-18 • Courbes de niveau, orographie</td>
            </tr>
            <tr>
              <td><code>osm-standard</code></td>
              <td>OpenStreetMap</td>
              <td>Zoom 0-19 • Données libres cartographiques</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Col 2: Exemple d'intégration Leaflet -->
      <div class="doc-col">
        <div class="code-card">
          <div class="code-card-header">
            <div class="terminal-dots">
              <div class="terminal-dot dot-red"></div>
              <div class="terminal-dot dot-yellow"></div>
              <div class="terminal-dot dot-green"></div>
            </div>
            <div class="code-title">leaflet_integration.js</div>
          </div>
          <div class="code-content"><span class="c-comment">// Initialisation Leaflet avec tuiles locales anti-écran noir</span>
<span class="c-verb">const</span> map = L.map(<span class="c-str">'map'</span>).setView([<span class="c-num">36.8188</span>, <span class="c-num">10.1800</span>], <span class="c-num">12</span>);

<span class="c-verb">const</span> localSatellite = L.tileLayer(
  <span class="c-str">'http://localhost/api/tiles/esri-imagery/{z}/{x}/{y}?key=cpt_live_...'</span>,
  {
    attribution: <span class="c-str">'&copy; INS Carto Platform'</span>,
    maxZoom: <span class="c-num">19</span>,
    <span class="c-key">maxNativeZoom:</span> <span class="c-num">16</span>,  <span class="c-comment">// Agrandit numériquement sans noir</span>
    <span class="c-key">keepBuffer:</span> <span class="c-num">10</span>       <span class="c-comment">// Maintient le cache mémoire</span>
  }
).addTo(map);</div>
        </div>

        <div class="callout callout-success">
          <div>🛡️</div>
          <div>
            <strong>En-têtes de Réponse HTTP :</strong><br>
            • <code>X-Cache-Status: HIT</code> (Tuile servie depuis la RAM Redis en &lt; 1 ms)<br>
            • <code>X-Cache-Status: MISS</code> (Tuile rapatriée puis mise en cache permanent)<br>
            • <code>Content-Type: image/jpeg</code> ou <code>image/png</code>
          </div>
        </div>
      </div>
    </div>

    <div class="page-footer">
      <div>INS Carto Platform • Documentation Technique Développeur</div>
      <div>https://sig.ins.tn/docs/tiles</div>
    </div>
  </div>

  <!-- ========================================================================= -->
  <!-- PAGE 4 : API GÉOCODAGE & RECHERCHE D'ADRESSES                            -->
  <!-- ========================================================================= -->
  <div class="doc-page">
    <div class="page-header">
      <div class="page-header-left">
        <span>INS CARTO PLATFORM</span>
        <span class="page-header-badge">GEOCODING SERVICE</span>
      </div>
      <div>API Géocodage & Recherche • Page 4</div>
    </div>

    <h2 class="section-title"><span class="title-bar"></span>API Géocodage & Recherche d'Adresses</h2>
    <p class="lead-text">
      Services de géocodage textuel direct (adresses, bâtiments administratifs, localités tunisiennes)
      et géocodage inverse (résolution d'un point GPS vers une adresse et un découpage administratif INS).
    </p>

    <!-- Endpoints -->
    <div class="endpoint-card">
      <span class="badge-method badge-get">GET</span>
      <span class="endpoint-url">/api/geocoding/search?<span class="param">q={query}&amp;limit=5</span></span>
    </div>

    <div class="endpoint-card" style="margin-top: -6px;">
      <span class="badge-method badge-get">GET</span>
      <span class="endpoint-url">/api/geocoding/reverse?<span class="param">lat={latitude}&amp;lon={longitude}</span></span>
    </div>

    <div class="doc-grid">
      <!-- Col 1: Paramètres & Format -->
      <div class="doc-col">
        <h4 style="font-size: 9pt; color: #38bdf8; margin-bottom: 4px;">Paramètres de Requête (Search)</h4>
        <table class="spec-table">
          <thead>
            <tr>
              <th>Paramètre</th>
              <th>Type</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>q</code></td>
              <td><span class="req-badge">Requis</span></td>
              <td>Terme recherché (ex: "Avenue Habib Bourguiba Tunis").</td>
            </tr>
            <tr>
              <td><code>limit</code></td>
              <td><span class="opt-badge">Optionnel</span></td>
              <td>Nombre de résultats max (par défaut: 5, max: 20).</td>
            </tr>
            <tr>
              <td><code>gov</code></td>
              <td><span class="opt-badge">Optionnel</span></td>
              <td>Filtrer par gouvernorat (ex: "Tunis", "Sfax").</td>
            </tr>
          </tbody>
        </table>

        <div class="feature-card">
          <div class="feature-card-title">📍 Découpage Administratif INS Inclus</div>
          <p style="font-size: 8pt; color: #94a3b8; line-height: 1.45;">
            Chaque résultat retourne automatiquement le <strong>Gouvernorat</strong>, la <strong>Délégation</strong>,
            le <strong>Secteur statistique INS</strong> et les coordonnées précises normalisées en WGS84.
          </p>
        </div>
      </div>

      <!-- Col 2: Exemple réponse GeoJSON -->
      <div class="doc-col">
        <div class="code-card">
          <div class="code-card-header">
            <div class="terminal-dots">
              <div class="terminal-dot dot-red"></div>
              <div class="terminal-dot dot-yellow"></div>
              <div class="terminal-dot dot-green"></div>
            </div>
            <div class="code-title">response_geojson.json</div>
          </div>
          <div class="code-content">{
  <span class="c-key">"type"</span>: <span class="c-str">"FeatureCollection"</span>,
  <span class="c-key">"features"</span>: [
    {
      <span class="c-key">"type"</span>: <span class="c-str">"Feature"</span>,
      <span class="c-key">"geometry"</span>: {
        <span class="c-key">"type"</span>: <span class="c-str">"Point"</span>,
        <span class="c-key">"coordinates"</span>: [<span class="c-num">10.1800</span>, <span class="c-num">36.8000</span>]
      },
      <span class="c-key">"properties"</span>: {
        <span class="c-key">"label"</span>: <span class="c-str">"Direction Générale INS, Tunis"</span>,
        <span class="c-key">"gouvernorat"</span>: <span class="c-str">"Tunis"</span>,
        <span class="c-key">"delegation"</span>: <span class="c-str">"Bab El Bhar"</span>,
        <span class="c-key">"code_postal"</span>: <span class="c-str">"1002"</span>,
        <span class="c-key">"confidence"</span>: <span class="c-num">0.98</span>
      }
    }
  ]
}</div>
        </div>
      </div>
    </div>

    <div class="page-footer">
      <div>INS Carto Platform • Documentation Technique Développeur</div>
      <div>https://sig.ins.tn/docs/geocoding</div>
    </div>
  </div>

  <!-- ========================================================================= -->
  <!-- PAGE 5 : API CALCUL D'ITINÉRAIRES & ROUTAGE MULTIMODAL                  -->
  <!-- ========================================================================= -->
  <div class="doc-page">
    <div class="page-header">
      <div class="page-header-left">
        <span>INS CARTO PLATFORM</span>
        <span class="page-header-badge">ROUTING ENGINE</span>
      </div>
      <div>API Calcul d'Itinéraires • Page 5</div>
    </div>

    <h2 class="section-title"><span class="title-bar"></span>API Calcul d'Itinéraires & Routage</h2>
    <p class="lead-text">
      Moteur de calcul de plus court chemin optimisé pour le réseau routier et piétonnier tunisien.
      Permet de guider les enquêteurs terrain vers les ménages cibles avec tracé cartographique instantané.
    </p>

    <div class="endpoint-card">
      <span class="badge-method badge-post">POST</span>
      <span class="endpoint-url">/api/routing/route</span>
    </div>

    <div class="doc-grid">
      <!-- Col 1: Paramètres d'entrée -->
      <div class="doc-col">
        <h4 style="font-size: 9pt; color: #38bdf8; margin-bottom: 4px;">Corps de la Requête (JSON)</h4>
        <table class="spec-table">
          <thead>
            <tr>
              <th>Champ</th>
              <th>Type</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>origin</code></td>
              <td><span class="req-badge">Requis</span></td>
              <td><code>[longitude, latitude]</code> du point A.</td>
            </tr>
            <tr>
              <td><code>destination</code></td>
              <td><span class="req-badge">Requis</span></td>
              <td><code>[longitude, latitude]</code> du point B.</td>
            </tr>
            <tr>
              <td><code>mode</code></td>
              <td><span class="opt-badge">Optionnel</span></td>
              <td><code>car</code> (défaut), <code>foot</code> (piéton), <code>bike</code>.</td>
            </tr>
            <tr>
              <td><code>steps</code></td>
              <td><span class="opt-badge">Optionnel</span></td>
              <td>Booléen (instructions virage par virage).</td>
            </tr>
          </tbody>
        </table>

        <div class="code-card">
          <div class="code-card-header">
            <div class="terminal-dots">
              <div class="terminal-dot dot-red"></div>
              <div class="terminal-dot dot-yellow"></div>
              <div class="terminal-dot dot-green"></div>
            </div>
            <div class="code-title">request_payload.json</div>
          </div>
          <div class="code-content">{
  <span class="c-key">"origin"</span>: [<span class="c-num">10.1650</span>, <span class="c-num">36.8188</span>],
  <span class="c-key">"destination"</span>: [<span class="c-num">10.1800</span>, <span class="c-num">36.8000</span>],
  <span class="c-key">"mode"</span>: <span class="c-str">"foot"</span>,
  <span class="c-key">"steps"</span>: <span class="c-num">true</span>
}</div>
        </div>
      </div>

      <!-- Col 2: Réponse JSON & Intégration -->
      <div class="doc-col">
        <div class="code-card">
          <div class="code-card-header">
            <div class="terminal-dots">
              <div class="terminal-dot dot-red"></div>
              <div class="terminal-dot dot-yellow"></div>
              <div class="terminal-dot dot-green"></div>
            </div>
            <div class="code-title">routing_response.json</div>
          </div>
          <div class="code-content">{
  <span class="c-key">"status"</span>: <span class="c-str">"SUCCESS"</span>,
  <span class="c-key">"distance_m"</span>: <span class="c-num">2450</span>,
  <span class="c-key">"duration_sec"</span>: <span class="c-num">1820</span>,
  <span class="c-key">"duration_min"</span>: <span class="c-num">30.3</span>,
  <span class="c-key">"geometry"</span>: {
    <span class="c-key">"type"</span>: <span class="c-str">"LineString"</span>,
    <span class="c-key">"coordinates"</span>: [
      [<span class="c-num">10.1650</span>, <span class="c-num">36.8188</span>],
      [<span class="c-num">10.1685</span>, <span class="c-num">36.8140</span>],
      [<span class="c-num">10.1800</span>, <span class="c-num">36.8000</span>]
    ]
  }
}</div>
        </div>

        <div class="callout callout-success">
          <div>🎯</div>
          <div>
            <strong>Dessin Leaflet Direct :</strong> La géométrie <code>LineString</code> retournée est directement
            passée à <code>L.geoJSON(res.geometry, { style: { color: '#0284c7', weight: 5 } }).addTo(map)</code>
            pour matérialiser instantanément le tracé du chemin.
          </div>
        </div>
      </div>
    </div>

    <div class="page-footer">
      <div>INS Carto Platform • Documentation Technique Développeur</div>
      <div>https://sig.ins.tn/docs/routing</div>
    </div>
  </div>

  <!-- ========================================================================= -->
  <!-- PAGE 6 : MOTEUR DE SEEDING & FONCTIONNEMENT HORS-LIGNE                   -->
  <!-- ========================================================================= -->
  <div class="doc-page">
    <div class="page-header">
      <div class="page-header-left">
        <span>INS CARTO PLATFORM</span>
        <span class="page-header-badge">OFFLINE ENGINE</span>
      </div>
      <div>Seeding & Mode Hors-Ligne • Page 6</div>
    </div>

    <h2 class="section-title"><span class="title-bar"></span>Moteur de Seeding & Mode Hors-Ligne</h2>
    <p class="lead-text">
      Le moteur de Seeding permet d'ingérer et de stocker à l'avance des millions de tuiles cartographiques
      dans le cluster Redis avec une durée de vie infinie (<code>TTL = 0</code>), garantissant une autonomie
      totale hors-ligne sur le terrain pour les tablettes d'enquête.
    </p>

    <div class="doc-grid">
      <!-- Col 1: Endpoints Seeding -->
      <div class="doc-col">
        <div class="endpoint-card">
          <span class="badge-method badge-post">POST</span>
          <span class="endpoint-url">/api/seed/start</span>
        </div>
        <div class="endpoint-card" style="margin-top: -6px;">
          <span class="badge-method badge-get">GET</span>
          <span class="endpoint-url">/api/seed/status</span>
        </div>

        <h4 style="font-size: 9pt; color: #38bdf8; margin-bottom: 4px;">Paramètres de Lancement (POST /seed/start)</h4>
        <table class="spec-table">
          <thead>
            <tr>
              <th>Paramètre</th>
              <th>Type</th>
              <th>Exemple / Valeur</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>provider</code></td>
              <td>String</td>
              <td><code>"esri-imagery"</code>, <code>"esri-streets"</code></td>
            </tr>
            <tr>
              <td><code>minZoom</code></td>
              <td>Integer</td>
              <td><code>6</code> (Vue pays Tunisie entière)</td>
            </tr>
            <tr>
              <td><code>maxZoom</code></td>
              <td>Integer</td>
              <td><code>12</code> (National) ou <code>16</code> (Urbain)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Col 2: État du cache actuel -->
      <div class="doc-col">
        <div class="feature-card">
          <div class="feature-card-title">📦 Inventaire Actuel en Cache Local</div>
          <table class="spec-table" style="margin-top: 6px;">
            <thead>
              <tr>
                <th>Couche</th>
                <th>Zoom</th>
                <th>Tuiles en Cache</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Esri Satellite</td>
                <td>6 -> 16</td>
                <td><strong>10 300+</strong></td>
                <td><span style="color: #10b981; font-weight: 700;">✅ 100%</span></td>
              </tr>
              <tr>
                <td>Esri Rues</td>
                <td>6 -> 16</td>
                <td><strong>10 300+</strong></td>
                <td><span style="color: #10b981; font-weight: 700;">✅ 100%</span></td>
              </tr>
              <tr>
                <td>Esri Topo</td>
                <td>6 -> 12</td>
                <td><strong>6 420</strong></td>
                <td><span style="color: #10b981; font-weight: 700;">✅ 100%</span></td>
              </tr>
              <tr>
                <td>OpenStreetMap</td>
                <td>6 -> 11</td>
                <td><strong>1 673</strong></td>
                <td><span style="color: #10b981; font-weight: 700;">✅ 100%</span></td>
              </tr>
            </tbody>
          </table>
          <div style="font-size: 7.5pt; color: #94a3b8; margin-top: 4px;">
            Total cumulé : <strong>60 203 tuiles</strong> sauvegardées sur volume Docker persistant <code>carto_redis_data</code>.
          </div>
        </div>

        <div class="callout callout-success">
          <div>🚀</div>
          <div>
            <strong>Orchestrateur Node.js inclus :</strong> Le script <code>scripts/seed_all_tunisia.mjs</code>
            automatise le téléchargement séquentiel et affiche une barre de progression en temps réel.
          </div>
        </div>
      </div>
    </div>

    <div class="page-footer">
      <div>INS Carto Platform • Documentation Technique Développeur</div>
      <div>https://sig.ins.tn/docs/seed</div>
    </div>
  </div>

  <!-- ========================================================================= -->
  <!-- PAGE 7 : API GESTION DES ENQUÊTES & MÉNAGES INS                          -->
  <!-- ========================================================================= -->
  <div class="doc-page">
    <div class="page-header">
      <div class="page-header-left">
        <span>INS CARTO PLATFORM</span>
        <span class="page-header-badge">SURVEY API</span>
      </div>
      <div>API Données d'Enquêtes & Ménages • Page 7</div>
    </div>

    <h2 class="section-title"><span class="title-bar"></span>API Données d'Enquêtes & Ménages</h2>
    <p class="lead-text">
      Gestion spatiale des points d'enquêtes statistiques, des ménages recensés et des formulaires associés.
      Stockage dans PostgreSQL 16 spatialisé avec PostGIS 3.4 et requêtes par Bounding Box.
    </p>

    <div class="endpoint-card">
      <span class="badge-method badge-get">GET</span>
      <span class="endpoint-url">/api/survey/households?<span class="param">bbox={minLon,minLat,maxLon,maxLat}</span></span>
    </div>

    <div class="doc-grid">
      <!-- Col 1: Spécifications -->
      <div class="doc-col">
        <h4 style="font-size: 9pt; color: #38bdf8; margin-bottom: 4px;">Attributs d'un Point Ménage INS</h4>
        <table class="spec-table">
          <thead>
            <tr>
              <th>Champ</th>
              <th>Type</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>id</code></td>
              <td>UUID / Int</td>
              <td>Identifiant unique national du ménage.</td>
            </tr>
            <tr>
              <td><code>chef_menage</code></td>
              <td>String</td>
              <td>Nom et prénom du chef de famille.</td>
            </tr>
            <tr>
              <td><code>adresse</code></td>
              <td>String</td>
              <td>Adresse textuelle ou repère de proximité.</td>
            </tr>
            <tr>
              <td><code>statut</code></td>
              <td>Enum</td>
              <td><code>A_VISITER</code>, <code>TERMINE</code>, <code>REFUS</code>.</td>
            </tr>
            <tr>
              <td><code>geometry</code></td>
              <td>Point</td>
              <td>Point PostGIS <code>ST_Point(lon, lat, 4326)</code>.</td>
            </tr>
          </tbody>
        </table>

        <div class="callout callout-info">
          <div>📋</div>
          <div>
            <strong>Synchronisation IndexedDB :</strong> Sur les tablettes Android des agents,
            les données sont répliquées localement dans le navigateur via <code>CartoDB</code> (IndexedDB)
            pour permettre la saisie et la consultation en l'absence totale de réseau.
          </div>
        </div>
      </div>

      <!-- Col 2: Exemple JSON Ménage -->
      <div class="doc-col">
        <div class="code-card">
          <div class="code-card-header">
            <div class="terminal-dots">
              <div class="terminal-dot dot-red"></div>
              <div class="terminal-dot dot-yellow"></div>
              <div class="terminal-dot dot-green"></div>
            </div>
            <div class="code-title">household_feature.json</div>
          </div>
          <div class="code-content">{
  <span class="c-key">"type"</span>: <span class="c-str">"Feature"</span>,
  <span class="c-key">"id"</span>: <span class="c-str">"MN-2026-0881"</span>,
  <span class="c-key">"geometry"</span>: {
    <span class="c-key">"type"</span>: <span class="c-str">"Point"</span>,
    <span class="c-key">"coordinates"</span>: [<span class="c-num">10.1742</span>, <span class="c-num">36.8210</span>]
  },
  <span class="c-key">"properties"</span>: {
    <span class="c-key">"chef_menage"</span>: <span class="c-str">"Moncef Ben Romdhane"</span>,
    <span class="c-key">"adresse"</span>: <span class="c-str">"14 Rue de la Liberté, Ariana"</span>,
    <span class="c-key">"membres_count"</span>: <span class="c-num">4</span>,
    <span class="c-key">"statut"</span>: <span class="c-str">"A_VISITER"</span>,
    <span class="c-key">"enqueteur_assigne"</span>: <span class="c-str">"Agent_INS_04"</span>,
    <span class="c-key">"questionnaire_url"</span>: <span class="c-str">"/survey/form?id=MN-2026-0881"</span>
  }
}</div>
        </div>
      </div>
    </div>

    <div class="page-footer">
      <div>INS Carto Platform • Documentation Technique Développeur</div>
      <div>https://sig.ins.tn/docs/survey</div>
    </div>
  </div>

  <!-- ========================================================================= -->
  <!-- PAGE 8 : GUIDES D'INTÉGRATION DÉVELOPPEURS (SDK & SNIPPETS)              -->
  <!-- ========================================================================= -->
  <div class="doc-page">
    <div class="page-header">
      <div class="page-header-left">
        <span>INS CARTO PLATFORM</span>
        <span class="page-header-badge">DEVELOPER SDK</span>
      </div>
      <div>Exemples & Kits d'Intégration • Page 8</div>
    </div>

    <h2 class="section-title"><span class="title-bar"></span>Exemples d'Intégration Développeurs</h2>
    <p class="lead-text">
      Exemples prêts à l'emploi en JavaScript / Leaflet, Python (automatisation de rapports statistiques)
      et requêtes cURL pour vos scripts d'intégration CI/CD.
    </p>

    <div class="doc-grid">
      <!-- Col 1: Python -->
      <div class="doc-col">
        <div class="code-card">
          <div class="code-card-header">
            <div class="terminal-dots">
              <div class="terminal-dot dot-red"></div>
              <div class="terminal-dot dot-yellow"></div>
              <div class="terminal-dot dot-green"></div>
            </div>
            <div class="code-title">script_python.py</div>
          </div>
          <div class="code-content"><span class="c-verb">import</span> requests

API_KEY = <span class="c-str">"cpt_live_JNkRURbRup63..."</span>
BASE_URL = <span class="c-str">"http://localhost/api"</span>

<span class="c-comment"># 1. Géocodage d'une délégation</span>
res = requests.get(
    f<span class="c-str">"{BASE_URL}/geocoding/search"</span>,
    params={<span class="c-str">"q"</span>: <span class="c-str">"La Marsa"</span>, <span class="c-str">"key"</span>: API_KEY}
).json()
coords = res[<span class="c-str">"features"</span>][<span class="c-num">0</span>][<span class="c-str">"geometry"</span>][<span class="c-str">"coordinates"</span>]

<span class="c-comment"># 2. Calcul d'itinéraire vers le ménage</span>
route = requests.post(
    f<span class="c-str">"{BASE_URL}/routing/route?key={API_KEY}"</span>,
    json={
        <span class="c-str">"origin"</span>: [<span class="c-num">10.1650</span>, <span class="c-num">36.8188</span>],
        <span class="c-str">"destination"</span>: coords,
        <span class="c-str">"mode"</span>: <span class="c-str">"car"</span>
    }
).json()

print(f<span class="c-str">"Distance: {route['distance_m']}m en {route['duration_min']} min"</span>)</div>
        </div>
      </div>

      <!-- Col 2: cURL & Bash -->
      <div class="doc-col">
        <div class="code-card">
          <div class="code-card-header">
            <div class="terminal-dots">
              <div class="terminal-dot dot-red"></div>
              <div class="terminal-dot dot-yellow"></div>
              <div class="terminal-dot dot-green"></div>
            </div>
            <div class="code-title">api_test.sh</div>
          </div>
          <div class="code-content"><span class="c-comment"># Vérification de l'état de santé du cluster</span>
curl -s -i http://localhost/health

<span class="c-comment"># Téléchargement direct d'une tuile Satellite HD</span>
curl -s -o tile_test.jpg \
  <span class="c-str">"http://localhost/api/tiles/esri-imagery/12/2165/1648?key=cpt_live_..."</span>

<span class="c-comment"># Inspection des métriques Prometheus</span>
curl -s http://localhost/metrics | grep carto_tiles_total</div>
        </div>

        <div class="feature-card">
          <div class="feature-card-title">📱 Compatibilité Applications Mobiles</div>
          <p style="font-size: 8pt; color: #94a3b8; line-height: 1.45;">
            Les URLs de tuiles XYZ sont compatibles avec les composants cartographiques natifs Android
            (<code>osmdroid</code>, <code>MapLibre Android SDK</code>) et iOS (<code>MapLibre Native</code>).
          </p>
        </div>
      </div>
    </div>

    <div class="page-footer">
      <div>INS Carto Platform • Documentation Technique Développeur</div>
      <div>https://sig.ins.tn/docs/sdk</div>
    </div>
  </div>

  <!-- ========================================================================= -->
  <!-- PAGE 9 : CODES HTTP, MONITORING PROMETHEUS & CONTACT                    -->
  <!-- ========================================================================= -->
  <div class="doc-page">
    <div class="page-header">
      <div class="page-header-left">
        <span>INS CARTO PLATFORM</span>
        <span class="page-header-badge">RÉFÉRENCE & SUPPORT</span>
      </div>
      <div>Codes d'Erreurs & Monitoring • Page 9</div>
    </div>

    <h2 class="section-title"><span class="title-bar"></span>Codes HTTP, Monitoring & Support</h2>
    <p class="lead-text">
      Référence des statuts de réponse HTTP, métriques de supervision Prometheus et assistance technique
      pour les équipes d'administration de l'INS.
    </p>

    <div class="doc-grid">
      <!-- Col 1: Codes d'erreur -->
      <div class="doc-col">
        <h4 style="font-size: 9pt; color: #38bdf8; margin-bottom: 4px;">Codes de Statut HTTP</h4>
        <table class="spec-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Statut</th>
              <th>Signification & Résolution</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>200 OK</code></td>
              <td>Succès</td>
              <td>Requête traitée et payload retourné.</td>
            </tr>
            <tr>
              <td><code>304 Not Mod.</code></td>
              <td>Cache Navigateur</td>
              <td>Tuile déjà en cache local du navigateur.</td>
            </tr>
            <tr>
              <td><code>400 Bad Req.</code></td>
              <td>Paramètre Invalide</td>
              <td>Coordonnées GPS ou zoom hors limites.</td>
            </tr>
            <tr>
              <td><code>401 Unauth.</code></td>
              <td>Clé Manquante</td>
              <td>Clé API invalide, expirée ou omise.</td>
            </tr>
            <tr>
              <td><code>429 Rate Limit</code></td>
              <td>Seuil Dépassé</td>
              <td>Quota dépassé (augmenter <code>rate_limit</code>).</td>
            </tr>
            <tr>
              <td><code>503 Unavailable</code></td>
              <td>Circuit Breaker</td>
              <td>Fournisseur amont temporairement indisponible.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Col 2: Monitoring & Support -->
      <div class="doc-col">
        <h4 style="font-size: 9pt; color: #38bdf8; margin-bottom: 4px;">Supervision Prometheus & Grafana</h4>
        <div class="code-card">
          <div class="code-card-header">
            <div class="terminal-dots">
              <div class="terminal-dot dot-red"></div>
              <div class="terminal-dot dot-yellow"></div>
              <div class="terminal-dot dot-green"></div>
            </div>
            <div class="code-title">metrics_exposed</div>
          </div>
          <div class="code-content"><span class="c-key">carto_tile_requests_total</span>{provider="esri-imagery", status="hit"}
<span class="c-key">carto_redis_memory_bytes</span> 422422888
<span class="c-key">carto_upstream_duration_seconds_bucket</span>{le="0.1"}</div>
        </div>

        <div class="feature-card" style="margin-top: 6px;">
          <div class="feature-card-title">📞 Assistance & Support INS</div>
          <p style="font-size: 8pt; color: #cbd5e1; line-height: 1.5;">
            <strong>Direction Informatique :</strong> Équipe SIG & Systèmes<br>
            <strong>Email :</strong> <a href="mailto:sig.support@ins.tn" style="color: #38bdf8; text-decoration: none;">sig.support@ins.tn</a><br>
            <strong>Portail d'Administration :</strong> <a href="http://localhost:8085" style="color: #38bdf8; text-decoration: none;">http://localhost:8085</a><br>
            <strong>Swagger / OpenAPI :</strong> <a href="http://localhost/docs" style="color: #38bdf8; text-decoration: none;">http://localhost/docs</a>
          </p>
        </div>
      </div>
    </div>

    <div class="callout callout-info" style="margin-top: 10px;">
      <div>🇹🇳</div>
      <div>
        <strong>Engagement Souveraineté :</strong> L'INS Carto Platform garantit à la République Tunisienne
        une indépendance numérique totale pour la réalisation de l'ensemble de ses recensements démographiques,
        enquêtes économiques et cartographies statistiques.
      </div>
    </div>

    <div class="page-footer">
      <div>INS Carto Platform • Documentation Technique Développeur v1.0.0</div>
      <div>© 2026 Institut National de la Statistique (INS) — Tunisie</div>
    </div>
  </div>

</body>
</html>
`;

fs.writeFileSync(OUTPUT_HTML, htmlContent, 'utf-8');
console.log('HTML de documentation généré avec succès :', OUTPUT_HTML);

console.log('Génération du PDF officiel via Chrome Headless...');
try {
  execSync(`"${CHROME_PATH}" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="${OUTPUT_PDF}" "${OUTPUT_HTML}"`);
  const stats = fs.statSync(OUTPUT_PDF);
  console.log(`✅ PDF créé avec succès : ${OUTPUT_PDF} (${(stats.size / 1024 / 1024).toFixed(2)} Mo)`);
} catch (e) {
  console.error('Erreur lors de la génération du PDF :', e.message);
}
