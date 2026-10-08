// scripts/generate_architecture_pdf.mjs
// PDF Architecture INS CartoPlatform — Thème CLAIR, Coloré, Pro

import fs from 'fs';
import { execSync } from 'child_process';

const OUTPUT_HTML = 'd:/carto_platform/scripts/architecture_doc.html';
const OUTPUT_PDF  = 'd:/carto_platform/INS_CartoPlatform_Architecture.pdf';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>INS CartoPlatform — Architecture Technique</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', sans-serif;
      background: #ffffff;
      color: #0f172a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-size: 9.5pt;
      line-height: 1.5;
    }

    .doc-page {
      width: 210mm;
      min-height: 297mm;
      max-height: 297mm;
      page-break-after: always;
      position: relative;
      overflow: hidden;
      padding: 0;
      display: flex;
      flex-direction: column;
      background: #ffffff;
    }

    /* ============================================================ */
    /* PAGE DE GARDE PREMIUM                                         */
    /* ============================================================ */
    .cover-page {
      background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 40%, #0369a1 100%);
      justify-content: space-between;
      padding: 0;
    }

    .cover-top-bar {
      background: rgba(255,255,255,0.08);
      backdrop-filter: blur(10px);
      padding: 14px 22mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255,255,255,0.12);
    }
    .cover-logo-group { display:flex;align-items:center;gap:12px; }
    .cover-logo-icon {
      width:44px;height:44px;
      background: linear-gradient(135deg, #38bdf8, #0ea5e9);
      border-radius:12px;
      display:flex;align-items:center;justify-content:center;
      font-size:22px;
      box-shadow: 0 4px 16px rgba(56,189,248,0.4);
    }
    .cover-logo-name { font-family:'Outfit',sans-serif;font-size:13pt;font-weight:800;color:#fff;letter-spacing:.3px; }
    .cover-logo-sub  { font-size:7.5pt;color:rgba(255,255,255,.6);margin-top:1px; }
    .cover-flag {
      background:rgba(255,255,255,0.12);
      border:1px solid rgba(255,255,255,0.25);
      color:#fff;
      padding:5px 12px;border-radius:20px;
      font-size:8pt;font-weight:600;
      display:flex;align-items:center;gap:6px;
    }

    .cover-hero {
      flex:1;
      display:flex;
      flex-direction:column;
      align-items:flex-start;
      justify-content:center;
      padding:0 22mm;
    }
    .cover-chip {
      background:rgba(56,189,248,0.2);
      border:1px solid rgba(56,189,248,0.45);
      color:#7dd3fc;
      font-size:7.5pt;font-weight:700;
      padding:4px 14px;border-radius:20px;
      letter-spacing:1.2px;
      margin-bottom:20px;
      font-family:'JetBrains Mono',monospace;
    }
    .cover-title {
      font-family:'Outfit',sans-serif;
      font-size:32pt;
      font-weight:900;
      line-height:1.1;
      color:#ffffff;
      margin-bottom:18px;
      letter-spacing:-0.5px;
    }
    .cover-title span { color:#38bdf8; }
    .cover-desc {
      font-size:10.5pt;
      color:rgba(255,255,255,.65);
      max-width:460px;
      line-height:1.65;
      margin-bottom:30px;
    }

    .cover-stats {
      display:grid;
      grid-template-columns:repeat(4,1fr);
      gap:10px;
      width:100%;
    }
    .cstat {
      background:rgba(255,255,255,0.07);
      border:1px solid rgba(255,255,255,0.12);
      border-radius:12px;
      padding:12px 14px;
      text-align:center;
    }
    .cstat-val { font-family:'Outfit',sans-serif;font-size:17pt;font-weight:800;color:#38bdf8; }
    .cstat-lbl { font-size:6.5pt;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.7px;margin-top:3px; }

    .cover-bottom-bar {
      background:rgba(0,0,0,0.25);
      padding:12px 22mm;
      display:flex;justify-content:space-between;align-items:center;
      font-size:8pt;color:rgba(255,255,255,.45);
      border-top:1px solid rgba(255,255,255,0.08);
    }

    /* Decorative circles */
    .deco-circle {
      position:absolute;border-radius:50%;pointer-events:none;
    }

    /* ============================================================ */
    /* HEADER & FOOTER DES PAGES INTÉRIEURES                        */
    /* ============================================================ */
    .page-top-band {
      background: linear-gradient(90deg, #0369a1, #0284c7, #38bdf8);
      height: 5px;
      width: 100%;
      flex-shrink: 0;
    }
    .page-header-inner {
      display:flex;justify-content:space-between;align-items:center;
      padding:9px 16mm;
      background:#f8fafc;
      border-bottom:1px solid #e2e8f0;
      flex-shrink:0;
    }
    .phi-left { display:flex;align-items:center;gap:8px; }
    .phi-logo { width:22px;height:22px;background:linear-gradient(135deg,#0284c7,#38bdf8);border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:11px; }
    .phi-name { font-family:'Outfit',sans-serif;font-size:8.5pt;font-weight:700;color:#0369a1; }
    .phi-badge { background:#dbeafe;color:#1d4ed8;padding:2px 7px;border-radius:4px;font-size:6.5pt;font-weight:700;border:1px solid #bfdbfe;font-family:'JetBrains Mono',monospace; }
    .phi-right { font-size:7.5pt;color:#94a3b8; }

    .page-content { flex:1;padding:12mm 16mm 18mm 16mm;overflow:hidden; }

    .page-footer-inner {
      position:absolute;bottom:0;left:0;right:0;
      background:#f8fafc;
      border-top:1px solid #e2e8f0;
      padding:7px 16mm;
      display:flex;justify-content:space-between;align-items:center;
      font-size:7pt;color:#94a3b8;
    }
    .page-footer-inner strong { color:#0369a1; }

    /* ============================================================ */
    /* SECTION TITLES                                               */
    /* ============================================================ */
    .sec-title {
      font-family:'Outfit',sans-serif;
      font-size:16pt;
      font-weight:800;
      color:#0f172a;
      display:flex;
      align-items:center;
      gap:10px;
      margin-bottom:6px;
    }
    .sec-title-bar {
      width:4px;height:24px;
      background:linear-gradient(180deg,#0284c7,#38bdf8);
      border-radius:2px;flex-shrink:0;
    }
    .sec-lead { font-size:8.5pt;color:#64748b;margin-bottom:12px;line-height:1.55; }

    /* ============================================================ */
    /* COMPONENT CARDS — LIGHT THEME                                */
    /* ============================================================ */
    .comp-grid { display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px; }
    .comp-card {
      border-radius:12px;
      padding:13px;
      border:1.5px solid;
      background:#ffffff;
      box-shadow:0 2px 8px rgba(0,0,0,.06);
    }
    .comp-card-header { display:flex;align-items:flex-start;gap:10px;margin-bottom:7px; }
    .comp-icon {
      width:36px;height:36px;border-radius:10px;
      display:flex;align-items:center;justify-content:center;
      font-size:17px;flex-shrink:0;
      box-shadow:0 2px 6px rgba(0,0,0,.1);
    }
    .comp-title  { font-family:'Outfit',sans-serif;font-size:10.5pt;font-weight:700;line-height:1.2; }
    .comp-sub    { font-size:7pt;color:#64748b;margin-top:2px;font-family:'JetBrains Mono',monospace; }
    .comp-desc   { font-size:7.5pt;color:#475569;line-height:1.5;margin-bottom:7px; }
    .comp-tags   { display:flex;flex-wrap:wrap;gap:4px; }
    .ctag        { font-size:6.5pt;font-weight:600;padding:2px 7px;border-radius:20px;font-family:'JetBrains Mono',monospace; }

    /* NGINX — Orange */
    .card-nginx  { border-color:#fed7aa;background:linear-gradient(135deg,#fff7ed,#ffedd5); }
    .icon-nginx  { background:linear-gradient(135deg,#ea580c,#f97316);color:#fff; }
    .title-nginx { color:#c2410c; }
    .tag-nginx   { background:#fed7aa;color:#9a3412; }

    /* API — Blue */
    .card-api    { border-color:#bfdbfe;background:linear-gradient(135deg,#eff6ff,#dbeafe); }
    .icon-api    { background:linear-gradient(135deg,#1d4ed8,#3b82f6);color:#fff; }
    .title-api   { color:#1d4ed8; }
    .tag-api     { background:#bfdbfe;color:#1e40af; }

    /* Redis — Red */
    .card-redis  { border-color:#fecaca;background:linear-gradient(135deg,#fff5f5,#fee2e2); }
    .icon-redis  { background:linear-gradient(135deg,#b91c1c,#ef4444);color:#fff; }
    .title-redis { color:#b91c1c; }
    .tag-redis   { background:#fecaca;color:#7f1d1d; }

    /* Docker — Cyan */
    .card-docker { border-color:#a5f3fc;background:linear-gradient(135deg,#f0fdff,#cffafe); }
    .icon-docker { background:linear-gradient(135deg,#0e7490,#06b6d4);color:#fff; }
    .title-docker{ color:#0e7490; }
    .tag-docker  { background:#a5f3fc;color:#155e75; }

    /* Frontend — Purple */
    .card-front  { border-color:#ddd6fe;background:linear-gradient(135deg,#faf5ff,#ede9fe); }
    .icon-front  { background:linear-gradient(135deg,#6d28d9,#8b5cf6);color:#fff; }
    .title-front { color:#6d28d9; }
    .tag-front   { background:#ddd6fe;color:#4c1d95; }

    /* Providers — Green */
    .card-map    { border-color:#bbf7d0;background:linear-gradient(135deg,#f0fdf4,#dcfce7); }
    .icon-map    { background:linear-gradient(135deg,#047857,#10b981);color:#fff; }
    .title-map   { color:#047857; }
    .tag-map     { background:#bbf7d0;color:#14532d; }

    /* ============================================================ */
    /* FLOW STEPS                                                   */
    /* ============================================================ */
    .flow-step {
      display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;
    }
    .flow-num {
      width:30px;height:30px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      font-size:10.5pt;font-weight:800;color:#fff;
      flex-shrink:0;box-shadow:0 3px 8px rgba(0,0,0,.15);
    }
    .flow-body {
      flex:1;border-radius:10px;padding:9px 13px;border:1.5px solid;
    }
    .flow-title { font-size:8.5pt;font-weight:700;margin-bottom:3px; }
    .flow-text  { font-size:7.5pt;color:#475569;line-height:1.45; }
    .flow-text code {
      font-family:'JetBrains Mono',monospace;font-size:6.8pt;
      background:rgba(0,0,0,.06);padding:1px 5px;border-radius:3px;
    }

    /* ============================================================ */
    /* PORTS TABLE                                                  */
    /* ============================================================ */
    .ports-table { width:100%;border-collapse:collapse;font-size:7.5pt;border-radius:10px;overflow:hidden;border:1.5px solid #e2e8f0;box-shadow:0 2px 8px rgba(0,0,0,.05); }
    .ports-table th { background:linear-gradient(90deg,#0369a1,#0284c7);color:#fff;padding:8px 10px;text-align:left;font-family:'Outfit',sans-serif;font-weight:700;font-size:7pt;text-transform:uppercase;letter-spacing:.5px; }
    .ports-table td { padding:7px 10px;border-bottom:1px solid #f1f5f9;color:#334155;vertical-align:middle; }
    .ports-table tr:last-child td { border-bottom:none; }
    .ports-table tr:nth-child(even) td { background:#f8fafc; }
    .ports-table code { font-family:'JetBrains Mono',monospace;font-size:7pt;background:#e0f2fe;padding:2px 5px;border-radius:4px;color:#0369a1;font-weight:600; }

    /* ============================================================ */
    /* CALLOUTS                                                     */
    /* ============================================================ */
    .callout { border-radius:8px;padding:8px 12px;display:flex;gap:8px;align-items:flex-start;font-size:7.5pt;margin-bottom:8px;border:1.5px solid; }
    .callout-blue   { background:#eff6ff;border-color:#bfdbfe;color:#1e40af; }
    .callout-green  { background:#f0fdf4;border-color:#bbf7d0;color:#166534; }
    .callout-amber  { background:#fffbeb;border-color:#fde68a;color:#92400e; }

    /* ============================================================ */
    /* SCHEMA PAGE (SVG wrapper)                                    */
    /* ============================================================ */
    .schema-section {
      flex:1;display:flex;flex-direction:column;
      align-items:center;justify-content:center;
    }
  </style>
</head>
<body>

<!-- ============================================================ -->
<!-- PAGE 1 : COUVERTURE PREMIUM                                  -->
<!-- ============================================================ -->
<div class="doc-page cover-page">
  <!-- Decorative circles -->
  <div class="deco-circle" style="width:360px;height:360px;top:-100px;right:-80px;background:radial-gradient(circle,rgba(56,189,248,0.18),transparent 70%);"></div>
  <div class="deco-circle" style="width:280px;height:280px;bottom:60px;right:40px;background:radial-gradient(circle,rgba(139,92,246,0.15),transparent 70%);"></div>
  <div class="deco-circle" style="width:200px;height:200px;bottom:-40px;left:80px;background:radial-gradient(circle,rgba(16,185,129,0.12),transparent 70%);"></div>

  <div class="cover-top-bar">
    <div class="cover-logo-group">
      <div class="cover-logo-icon">🗺️</div>
      <div>
        <div class="cover-logo-name">INS CARTO PLATFORM</div>
        <div class="cover-logo-sub">Direction Informatique &amp; Mécanographie — Tunis</div>
      </div>
    </div>
    <div class="cover-flag">🇹🇳 République Tunisienne</div>
  </div>

  <div class="cover-hero">
    <div class="cover-chip">ARCHITECTURE TECHNIQUE · v1.0.0 ENTERPRISE</div>
    <div class="cover-title">
      Schéma d'Architecture<br>
      <span>Système &amp; Flux</span><br>
      de Données
    </div>
    <div class="cover-desc">
      Description complète et illustrée de chaque composant de la plateforme SIG souveraine de l'INS :
      du navigateur terrain jusqu'au cache Redis, en passant par le reverse proxy NGINX et le moteur de tuiles cartographiques.
    </div>
    <div class="cover-stats">
      <div class="cstat"><div class="cstat-val">6</div><div class="cstat-lbl">Composants</div></div>
      <div class="cstat"><div class="cstat-val">4</div><div class="cstat-lbl">Fonds de Carte</div></div>
      <div class="cstat"><div class="cstat-val">4 Go</div><div class="cstat-lbl">Cache Redis</div></div>
      <div class="cstat"><div class="cstat-val">100%</div><div class="cstat-lbl">Hors-Ligne</div></div>
    </div>
  </div>

  <div class="cover-bottom-bar">
    <div>Institut National de la Statistique (INS) — 70, Rue Ech-Cham, 1002 Tunis Belvédère</div>
    <div>Édition Technique : <strong style="color:rgba(255,255,255,.7)">Octobre 2026</strong></div>
  </div>
</div>

<!-- ============================================================ -->
<!-- PAGE 2 : SCHÉMA SVG GLOBAL                                   -->
<!-- ============================================================ -->
<div class="doc-page">
  <div class="page-top-band"></div>
  <div class="page-header-inner">
    <div class="phi-left">
      <div class="phi-logo">🗺️</div>
      <span class="phi-name">INS CARTO PLATFORM</span>
      <span class="phi-badge">ARCHITECTURE</span>
    </div>
    <div class="phi-right">Schéma Global • Page 2 / 4</div>
  </div>

  <div class="page-content">
    <div class="sec-title"><span class="sec-title-bar"></span>Vue d'Ensemble — Schéma d'Architecture</div>
    <p class="sec-lead">Flux unidirectionnel de la requête utilisateur à la tuile servie. Tous les composants tournent dans des conteneurs Docker sur le réseau intranet de l'INS.</p>

    <div class="schema-section">
      <svg viewBox="0 0 700 480" width="100%" height="100%" style="max-height:420px;" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="gBar" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#0369a1"/>
            <stop offset="100%" stop-color="#38bdf8"/>
          </linearGradient>
          <linearGradient id="gNginx" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#fff7ed"/>
            <stop offset="100%" stop-color="#ffedd5"/>
          </linearGradient>
          <linearGradient id="gApi" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#eff6ff"/>
            <stop offset="100%" stop-color="#dbeafe"/>
          </linearGradient>
          <linearGradient id="gRedis" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#fff5f5"/>
            <stop offset="100%" stop-color="#fee2e2"/>
          </linearGradient>
          <linearGradient id="gFront" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#faf5ff"/>
            <stop offset="100%" stop-color="#ede9fe"/>
          </linearGradient>
          <linearGradient id="gDocker" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#f0fdff"/>
            <stop offset="100%" stop-color="#e0f7fa"/>
          </linearGradient>
          <filter id="shadow" x="-5%" y="-5%" width="115%" height="115%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="rgba(0,0,0,0.10)"/>
          </filter>
          <marker id="arrowBlue"  markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#0284c7"/></marker>
          <marker id="arrowOrange" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#f97316"/></marker>
          <marker id="arrowRed"   markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#ef4444"/></marker>
          <marker id="arrowGreen" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#10b981"/></marker>
          <marker id="arrowGray"  markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#94a3b8"/></marker>
          <marker id="arrowPurple" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#8b5cf6"/></marker>
        </defs>

        <!-- Background white -->
        <rect width="700" height="480" fill="#ffffff"/>

        <!-- Top gradient bar -->
        <rect x="0" y="0" width="700" height="5" fill="url(#gBar)"/>

        <!-- ── DOCKER wrapper ── -->
        <rect x="10" y="74" width="678" height="394" rx="16" fill="#f0fdff" stroke="#0e7490" stroke-width="1.8" stroke-dasharray="7,4"/>
        <rect x="10" y="62" width="158" height="20" rx="6" fill="#0e7490"/>
        <text x="22" y="76" font-size="9.5" fill="#cffafe" font-family="JetBrains Mono,monospace" font-weight="700">🐳  Docker Compose</text>

        <!-- ── USERS ── -->
        <!-- Agent Terrain -->
        <rect x="90" y="6" width="145" height="56" rx="11" fill="#eff6ff" stroke="#3b82f6" stroke-width="1.8" filter="url(#shadow)"/>
        <rect x="90" y="6" width="145" height="4" rx="2" fill="url(#gBar)"/>
        <text x="106" y="28" font-size="18" fill="#3b82f6">💻</text>
        <text x="132" y="25" font-size="10" fill="#1e3a8a" font-family="Outfit,sans-serif" font-weight="800">Agent Terrain</text>
        <text x="106" y="41" font-size="7" fill="#3b82f6" font-family="Inter,sans-serif">Consultation de la carte interactive</text>
        <text x="106" y="53" font-size="7" fill="#3b82f6" font-family="Inter,sans-serif">Saisie &amp; localisation des ménages</text>

        <!-- Administrateur -->
        <rect x="465" y="6" width="145" height="56" rx="11" fill="#faf5ff" stroke="#8b5cf6" stroke-width="1.8" filter="url(#shadow)"/>
        <rect x="465" y="6" width="145" height="4" rx="2" fill="url(#gBar)"/>
        <text x="481" y="28" font-size="18" fill="#8b5cf6">🛡️</text>
        <text x="507" y="25" font-size="10" fill="#4c1d95" font-family="Outfit,sans-serif" font-weight="800">Administrateur</text>
        <text x="481" y="41" font-size="7" fill="#8b5cf6" font-family="Inter,sans-serif">Dashboard &amp; métriques temps-réel</text>
        <text x="481" y="53" font-size="7" fill="#8b5cf6" font-family="Inter,sans-serif">Gestion clés API &amp; téléchargement</text>

        <!-- Arrows Users → NGINX -->
        <line x1="162" y1="62" x2="290" y2="92" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#arrowBlue)"/>
        <text x="182" y="83" font-size="6.5" fill="#2563eb" font-family="Inter,sans-serif" font-weight="600">HTTPS / LAN</text>
        <line x1="538" y1="62" x2="418" y2="92" stroke="#8b5cf6" stroke-width="1.5" marker-end="url(#arrowPurple)"/>
        <text x="448" y="83" font-size="6.5" fill="#7c3aed" font-family="Inter,sans-serif" font-weight="600">HTTPS / LAN</text>

        <!-- ── NGINX ── -->
        <rect x="200" y="94" width="300" height="68" rx="13" fill="url(#gNginx)" stroke="#f97316" stroke-width="2" filter="url(#shadow)"/>
        <rect x="200" y="94" width="300" height="5" rx="2" fill="linear-gradient(90deg,#ea580c,#fb923c)"/>
        <rect x="200" y="94" width="300" height="5" rx="2" fill="#f97316"/>
        <text x="218" y="121" font-size="20" fill="#f97316">🔀</text>
        <text x="252" y="117" font-size="13" fill="#9a3412" font-family="Outfit,sans-serif" font-weight="900">NGINX</text>
        <text x="252" y="128" font-size="7" fill="#c2410c" font-family="Inter,sans-serif">Reverse Proxy • Load Balancer • SSL Termination • Static Files</text>
        <!-- Port badges -->
        <rect x="210" y="136" width="52" height="16" rx="5" fill="#fed7aa" stroke="#fb923c" stroke-width="1"/>
        <text x="225" y="148" font-size="7.5" fill="#9a3412" font-family="JetBrains Mono,monospace" font-weight="700">:80</text>
        <rect x="268" y="136" width="58" height="16" rx="5" fill="#fed7aa" stroke="#fb923c" stroke-width="1"/>
        <text x="281" y="148" font-size="7.5" fill="#9a3412" font-family="JetBrains Mono,monospace" font-weight="700">:443</text>
        <rect x="332" y="136" width="66" height="16" rx="5" fill="#fed7aa" stroke="#fb923c" stroke-width="1"/>
        <text x="341" y="148" font-size="7.5" fill="#9a3412" font-family="JetBrains Mono,monospace" font-weight="700">:8085</text>
        <text x="216" y="148" font-size="8" fill="#9a3412" font-family="Outfit,sans-serif" font-weight="700">HTTP</text>
        <text x="272" y="148" font-size="8" fill="#9a3412" font-family="Outfit,sans-serif" font-weight="700">HTTPS</text>
        <text x="341" y="148" font-size="7" fill="#9a3412" font-family="Outfit,sans-serif" font-weight="700">Admin</text>

        <!-- Arrows NGINX → children -->
        <line x1="290" y1="162" x2="218" y2="218" stroke="#f97316" stroke-width="1.6" marker-end="url(#arrowOrange)"/>
        <text x="218" y="198" font-size="6" fill="#ea580c" font-family="Inter,sans-serif" font-weight="600">proxy_pass</text>
        <line x1="410" y1="162" x2="482" y2="218" stroke="#8b5cf6" stroke-width="1.6" marker-end="url(#arrowPurple)"/>
        <text x="430" y="198" font-size="6" fill="#7c3aed" font-family="Inter,sans-serif" font-weight="600">static files</text>

        <!-- ── API BACKEND ── -->
        <rect x="60" y="220" width="270" height="78" rx="13" fill="url(#gApi)" stroke="#3b82f6" stroke-width="2" filter="url(#shadow)"/>
        <rect x="60" y="220" width="270" height="5" rx="2" fill="#3b82f6"/>
        <text x="78" y="246" font-size="19" fill="#3b82f6">⚡</text>
        <text x="108" y="242" font-size="12" fill="#1e3a8a" font-family="Outfit,sans-serif" font-weight="900">API Backend</text>
        <text x="108" y="253" font-size="7" fill="#3b82f6" font-family="JetBrains Mono,monospace">Node.js 20 · Express · Port :3000</text>
        <text x="78" y="267" font-size="7" fill="#1e40af" font-family="Inter,sans-serif">✔ REST API Tuiles XYZ (proxy intelligent)</text>
        <text x="78" y="278" font-size="7" fill="#1e40af" font-family="Inter,sans-serif">✔ Géocodage direct / inverse (Nominatim)</text>
        <text x="78" y="289" font-size="7" fill="#1e40af" font-family="Inter,sans-serif">✔ Moteur de Seeding &amp; Itinéraires (OSRM)</text>

        <!-- ── FRONTEND ── -->
        <rect x="370" y="220" width="270" height="78" rx="13" fill="url(#gFront)" stroke="#8b5cf6" stroke-width="2" filter="url(#shadow)"/>
        <rect x="370" y="220" width="270" height="5" rx="2" fill="#8b5cf6"/>
        <text x="388" y="246" font-size="19" fill="#8b5cf6">🖥️</text>
        <text x="418" y="242" font-size="12" fill="#4c1d95" font-family="Outfit,sans-serif" font-weight="900">Frontend Web</text>
        <text x="418" y="253" font-size="7" fill="#8b5cf6" font-family="JetBrains Mono,monospace">HTML5 · CSS3 · JS Vanilla · Leaflet.js</text>
        <text x="388" y="267" font-size="7" fill="#6d28d9" font-family="Inter,sans-serif">✔ Carte Leaflet.js interactive multi-couches</text>
        <text x="388" y="278" font-size="7" fill="#6d28d9" font-family="Inter,sans-serif">✔ Dashboard admin KPIs &amp; logs temps-réel</text>
        <text x="388" y="289" font-size="7" fill="#6d28d9" font-family="Inter,sans-serif">✔ Téléchargement hors-ligne &amp; itinéraire</text>

        <!-- Arrows API ↔ Redis -->
        <line x1="195" y1="298" x2="195" y2="350" stroke="#0284c7" stroke-width="1.5" marker-end="url(#arrowBlue)"/>
        <line x1="215" y1="350" x2="215" y2="298" stroke="#ef4444" stroke-width="1.3" stroke-dasharray="3,3" marker-end="url(#arrowRed)"/>
        <text x="222" y="322" font-size="6.5" fill="#0369a1" font-family="Inter,sans-serif" font-weight="700">GET tile</text>
        <text x="222" y="332" font-size="6.5" fill="#dc2626" font-family="Inter,sans-serif" font-weight="700">HIT/SET</text>

        <!-- ── REDIS ── -->
        <rect x="60" y="352" width="270" height="72" rx="13" fill="url(#gRedis)" stroke="#ef4444" stroke-width="2" filter="url(#shadow)"/>
        <rect x="60" y="352" width="270" height="5" rx="2" fill="#ef4444"/>
        <text x="78" y="376" font-size="19" fill="#ef4444">🗄️</text>
        <text x="108" y="372" font-size="12" fill="#7f1d1d" font-family="Outfit,sans-serif" font-weight="900">Redis Cache</text>
        <text x="108" y="383" font-size="7" fill="#ef4444" font-family="JetBrains Mono,monospace">Redis 7 · AOF Persistence · 4 Go LRU</text>
        <text x="78" y="397" font-size="7" fill="#991b1b" font-family="Inter,sans-serif">✔ Stockage permanent de toutes les tuiles</text>
        <text x="78" y="408" font-size="7" fill="#991b1b" font-family="Inter,sans-serif">✔ Sessions JWT &amp; compteurs de trafic API</text>

        <!-- Arrow API → Providers (cache MISS) -->
        <line x1="330" y1="262" x2="380" y2="352" stroke="#94a3b8" stroke-width="1.3" stroke-dasharray="4,3" marker-end="url(#arrowGray)"/>
        <text x="326" y="303" font-size="6" fill="#64748b" font-family="Inter,sans-serif">Cache MISS</text>
        <text x="326" y="313" font-size="6" fill="#64748b" font-family="Inter,sans-serif">→ Fetch</text>

        <!-- ── TILE PROVIDERS ── -->
        <rect x="370" y="352" width="298" height="110" rx="13" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5" filter="url(#shadow)"/>
        <text x="392" y="370" font-size="7" fill="#64748b" font-family="Outfit,sans-serif" font-weight="800" letter-spacing="1.2">FOURNISSEURS DE TUILES EXTERNES</text>

        <!-- Esri Imagery -->
        <rect x="378" y="376" width="126" height="38" rx="9" fill="#fffbeb" stroke="#fbbf24" stroke-width="1.3"/>
        <text x="392" y="394" font-size="14" fill="#f59e0b">🛰️</text>
        <text x="415" y="393" font-size="8" fill="#78350f" font-family="Outfit,sans-serif" font-weight="700">Esri Imagery</text>
        <text x="415" y="404" font-size="6.5" fill="#92400e" font-family="Inter,sans-serif">Satellite HD • Zoom 0-19</text>

        <!-- Esri Streets -->
        <rect x="510" y="376" width="148" height="38" rx="9" fill="#f0fdf4" stroke="#6ee7b7" stroke-width="1.3"/>
        <text x="524" y="394" font-size="14" fill="#10b981">🏙️</text>
        <text x="547" y="393" font-size="8" fill="#14532d" font-family="Outfit,sans-serif" font-weight="700">Esri Streets</text>
        <text x="547" y="404" font-size="6.5" fill="#166534" font-family="Inter,sans-serif">Plan Routier • Zoom 0-19</text>

        <!-- Esri Topo -->
        <rect x="378" y="420" width="126" height="36" rx="9" fill="#fff7ed" stroke="#fdba74" stroke-width="1.3"/>
        <text x="392" y="437" font-size="14" fill="#f97316">⛰️</text>
        <text x="415" y="436" font-size="8" fill="#7c2d12" font-family="Outfit,sans-serif" font-weight="700">Esri Topo</text>
        <text x="415" y="447" font-size="6.5" fill="#9a3412" font-family="Inter,sans-serif">Relief &amp; Courbes • Zoom 0-18</text>

        <!-- OpenStreetMap -->
        <rect x="510" y="420" width="148" height="36" rx="9" fill="#f0fdff" stroke="#a5f3fc" stroke-width="1.3"/>
        <text x="524" y="437" font-size="14" fill="#06b6d4">🗺️</text>
        <text x="547" y="436" font-size="8" fill="#155e75" font-family="Outfit,sans-serif" font-weight="700">OpenStreetMap</text>
        <text x="547" y="447" font-size="6.5" fill="#0e7490" font-family="Inter,sans-serif">Données libres • Zoom 0-19</text>

        <!-- Arrow Providers → Redis (cache SET) -->
        <line x1="380" y1="395" x2="332" y2="380" stroke="#10b981" stroke-width="1.2" stroke-dasharray="3,3" marker-end="url(#arrowGreen)"/>
        <text x="325" y="362" font-size="6" fill="#047857" font-family="Inter,sans-serif">SET cache</text>
      </svg>
    </div>
  </div>

  <div class="page-footer-inner">
    <div><strong>INS Carto Platform</strong> · Architecture Technique</div>
    <div>Institut National de la Statistique · Octobre 2026</div>
  </div>
</div>

<!-- ============================================================ -->
<!-- PAGE 3 : DESCRIPTION DÉTAILLÉE DES COMPOSANTS               -->
<!-- ============================================================ -->
<div class="doc-page">
  <div class="page-top-band"></div>
  <div class="page-header-inner">
    <div class="phi-left">
      <div class="phi-logo">🗺️</div>
      <span class="phi-name">INS CARTO PLATFORM</span>
      <span class="phi-badge">COMPOSANTS</span>
    </div>
    <div class="phi-right">Description des Composants • Page 3 / 4</div>
  </div>

  <div class="page-content">
    <div class="sec-title"><span class="sec-title-bar"></span>Description Détaillée des Composants</div>
    <p class="sec-lead">Chaque brique logicielle joue un rôle précis dans la chaîne de traitement. Rôle fonctionnel, technologies utilisées et ports réseau.</p>

    <div class="comp-grid">

      <!-- NGINX -->
      <div class="comp-card card-nginx">
        <div class="comp-card-header">
          <div class="comp-icon icon-nginx">🔀</div>
          <div>
            <div class="comp-title title-nginx">NGINX — Reverse Proxy</div>
            <div class="comp-sub">nginx:alpine · Ports 80 / 443 / 8085</div>
          </div>
        </div>
        <div class="comp-desc">
          Point d'entrée unique. Reçoit toutes les requêtes HTTP/HTTPS, vérifie l'authentification et les route vers l'API ou le frontend. Il sert aussi les fichiers statiques directement du disque (JS, CSS, images) sans passer par Node.js pour maximiser les performances.
        </div>
        <div class="comp-tags">
          <span class="ctag tag-nginx">Proxy Pass</span>
          <span class="ctag tag-nginx">SSL/TLS</span>
          <span class="ctag tag-nginx">Static Files</span>
          <span class="ctag tag-nginx">Gzip</span>
          <span class="ctag tag-nginx">Rate Limit</span>
        </div>
      </div>

      <!-- API Backend -->
      <div class="comp-card card-api">
        <div class="comp-card-header">
          <div class="comp-icon icon-api">⚡</div>
          <div>
            <div class="comp-title title-api">API Backend — Node.js</div>
            <div class="comp-sub">node:20-alpine · Port interne 3000</div>
          </div>
        </div>
        <div class="comp-desc">
          Cœur logique de la plateforme. Gère le proxy de tuiles avec lookup Redis avant chaque fetch externe, le géocodage (Nominatim), le calcul d'itinéraires, la gestion des clés API avec JWT, et le moteur de seeding progressif avec suivi de progression.
        </div>
        <div class="comp-tags">
          <span class="ctag tag-api">Express.js</span>
          <span class="ctag tag-api">JWT Auth</span>
          <span class="ctag tag-api">Tile Proxy</span>
          <span class="ctag tag-api">Seeding</span>
          <span class="ctag tag-api">REST API</span>
        </div>
      </div>

      <!-- Redis -->
      <div class="comp-card card-redis">
        <div class="comp-card-header">
          <div class="comp-icon icon-redis">🗄️</div>
          <div>
            <div class="comp-title title-redis">Redis — Cache Cartographique</div>
            <div class="comp-sub">redis:7-alpine · 4 Go RAM · AOF Persist.</div>
          </div>
        </div>
        <div class="comp-desc">
          Stocke chaque tuile sous la clé <code style="font-family:monospace;background:#fee2e2;padding:1px 4px;border-radius:3px;font-size:7pt;color:#b91c1c;">tile:{provider}:{z}:{x}:{y}</code>. La politique <strong>allkeys-lru</strong> gère automatiquement l'espace. La persistance AOF garantit la survie des tuiles aux redémarrages serveur — aucun re-téléchargement nécessaire.
        </div>
        <div class="comp-tags">
          <span class="ctag tag-redis">LRU 4 Go</span>
          <span class="ctag tag-redis">AOF Persist</span>
          <span class="ctag tag-redis">&lt;1 ms HIT</span>
          <span class="ctag tag-redis">Tile Store</span>
        </div>
      </div>

      <!-- Docker -->
      <div class="comp-card card-docker">
        <div class="comp-card-header">
          <div class="comp-icon icon-docker">🐳</div>
          <div>
            <div class="comp-title title-docker">Docker Compose — Orchestration</div>
            <div class="comp-sub">docker-compose.https-intranet.yml</div>
          </div>
        </div>
        <div class="comp-desc">
          Tous les services (NGINX, API, Redis) tournent en conteneurs isolés sur le réseau virtuel privé <code style="font-family:monospace;background:#cffafe;padding:1px 4px;border-radius:3px;font-size:7pt;color:#0e7490;">carto_network</code>. Le volume <code style="font-family:monospace;background:#cffafe;padding:1px 4px;border-radius:3px;font-size:7pt;color:#0e7490;">carto_redis_data</code> persiste le cache sur disque SSD entre les redémarrages.
        </div>
        <div class="comp-tags">
          <span class="ctag tag-docker">Isolation</span>
          <span class="ctag tag-docker">Volume AOF</span>
          <span class="ctag tag-docker">carto_network</span>
          <span class="ctag tag-docker">Health Check</span>
        </div>
      </div>

      <!-- Frontend -->
      <div class="comp-card card-front">
        <div class="comp-card-header">
          <div class="comp-icon icon-front">🖥️</div>
          <div>
            <div class="comp-title title-front">Frontend Web — Interface GIS</div>
            <div class="comp-sub">HTML5 / CSS3 / JS Vanilla · Leaflet.js</div>
          </div>
        </div>
        <div class="comp-desc">
          Interface utilisateur sans framework lourd pour un chargement instantané. La carte Leaflet.js se connecte uniquement à l'API locale. Le tableau de bord admin affiche métriques temps-réel, clés API et pilote le téléchargement hors-ligne. Mode nuit / mode jour inclus.
        </div>
        <div class="comp-tags">
          <span class="ctag tag-front">Leaflet.js</span>
          <span class="ctag tag-front">Dashboard</span>
          <span class="ctag tag-front">Dark Mode</span>
          <span class="ctag tag-front">Responsive</span>
        </div>
      </div>

      <!-- Providers -->
      <div class="comp-card card-map">
        <div class="comp-card-header">
          <div class="comp-icon icon-map">🗺️</div>
          <div>
            <div class="comp-title title-map">Fournisseurs de Tuiles Externes</div>
            <div class="comp-sub">Esri World Services · OpenStreetMap</div>
          </div>
        </div>
        <div class="comp-desc">
          Sollicités <strong>uniquement</strong> lors d'un Cache MISS (tuile absente de Redis). Dès réception, la tuile est stockée définitivement. En mode hors-ligne complet post-seeding, ces serveurs ne sont plus jamais contactés — opération 100% autonome.
        </div>
        <div class="comp-tags">
          <span class="ctag tag-map">🛰️ Esri Imagery</span>
          <span class="ctag tag-map">🏙️ Esri Streets</span>
          <span class="ctag tag-map">⛰️ Esri Topo</span>
          <span class="ctag tag-map">🗺️ OSM</span>
        </div>
      </div>

    </div>

    <div class="callout callout-blue">
      <div style="font-size:14px;">💡</div>
      <div><strong>Sécurité by design :</strong> Seul NGINX est exposé au réseau physique de l'INS. L'API Node.js et Redis communiquent exclusivement via le réseau Docker privé <code style="font-family:monospace;font-size:7.5pt;background:#dbeafe;padding:1px 4px;border-radius:3px;color:#1d4ed8;">carto_network</code> — jamais accessibles directement depuis le LAN.</div>
    </div>
  </div>

  <div class="page-footer-inner">
    <div><strong>INS Carto Platform</strong> · Architecture Technique</div>
    <div>Institut National de la Statistique · Octobre 2026</div>
  </div>
</div>

<!-- ============================================================ -->
<!-- PAGE 4 : FLUX DE DONNÉES & PORTS                             -->
<!-- ============================================================ -->
<div class="doc-page">
  <div class="page-top-band"></div>
  <div class="page-header-inner">
    <div class="phi-left">
      <div class="phi-logo">🗺️</div>
      <span class="phi-name">INS CARTO PLATFORM</span>
      <span class="phi-badge">FLUX &amp; PORTS</span>
    </div>
    <div class="phi-right">Flux de Données &amp; Ports • Page 4 / 4</div>
  </div>

  <div class="page-content">
    <div class="sec-title"><span class="sec-title-bar"></span>Flux d'une Requête de Tuile — 5 Étapes</div>
    <p class="sec-lead">Du clic de zoom dans le navigateur Leaflet.js jusqu'à l'image PNG/JPEG affichée sur la carte — latence totale &lt; 2 ms en cache HIT.</p>

    <div class="flow-step">
      <div class="flow-num" style="background:linear-gradient(135deg,#0369a1,#38bdf8);">1</div>
      <div class="flow-body" style="background:#eff6ff;border-color:#bfdbfe;">
        <div class="flow-title" style="color:#1d4ed8;">Navigateur Agent → NGINX (Port 80/443)</div>
        <div class="flow-text">Leaflet.js génère <code>GET /api/tiles/esri-imagery/13/2234/1567?key=cpt_live_...</code> sur le port <strong>80</strong> ou <strong>443</strong>. NGINX reçoit la requête, vérifie la présence de la clé API et la transfère à l'API interne.</div>
      </div>
    </div>

    <div class="flow-step">
      <div class="flow-num" style="background:linear-gradient(135deg,#ea580c,#f97316);">2</div>
      <div class="flow-body" style="background:#fff7ed;border-color:#fed7aa;">
        <div class="flow-title" style="color:#c2410c;">NGINX → API Backend (proxy_pass :3000)</div>
        <div class="flow-text">NGINX transfère via <code>proxy_pass http://carto-api:3000</code>. L'API valide le JWT et construit la clé de cache Redis : <code>tile:esri-imagery:13:2234:1567</code>.</div>
      </div>
    </div>

    <div class="flow-step">
      <div class="flow-num" style="background:linear-gradient(135deg,#b91c1c,#ef4444);">3</div>
      <div class="flow-body" style="background:#fff5f5;border-color:#fecaca;">
        <div class="flow-title" style="color:#b91c1c;">API → Redis — Lookup Cache</div>
        <div class="flow-text">L'API effectue un <code>GET</code> Redis. 
          <strong style="color:#15803d;">Cache HIT ✔</strong> → tuile retournée en &lt;1ms avec <code>X-Cache-Status: HIT</code>, passer directement à l'étape 5.<br>
          <strong style="color:#b45309;">Cache MISS ✘</strong> → passer à l'étape 4.</div>
      </div>
    </div>

    <div class="flow-step">
      <div class="flow-num" style="background:linear-gradient(135deg,#047857,#10b981);">4</div>
      <div class="flow-body" style="background:#f0fdf4;border-color:#bbf7d0;">
        <div class="flow-title" style="color:#047857;">Cache MISS → Fetch Fournisseur Externe</div>
        <div class="flow-text">L'API contacte le provider (ex: <code>server.arcgisonline.com</code>), récupère la tuile PNG/JPEG, la stocke dans Redis avec <code>SET</code> permanent (sans expiration TTL), puis continue à l'étape 5. Header réponse : <code>X-Cache-Status: MISS</code>.</div>
      </div>
    </div>

    <div class="flow-step">
      <div class="flow-num" style="background:linear-gradient(135deg,#6d28d9,#8b5cf6);">5</div>
      <div class="flow-body" style="background:#faf5ff;border-color:#ddd6fe;">
        <div class="flow-title" style="color:#6d28d9;">API → NGINX → Navigateur — Rendu Carte</div>
        <div class="flow-text">L'API retourne la tuile binaire avec <code>Content-Type: image/jpeg</code> et <code>Cache-Control: max-age=86400</code>. Leaflet.js affiche la tuile. Latence totale : <strong style="color:#047857;">&lt; 2 ms</strong> (HIT) ou <strong style="color:#b45309;">~200 ms</strong> (MISS, fetch réseau).</div>
      </div>
    </div>

    <div style="margin-top:12px;">
      <div class="sec-title" style="font-size:13pt;margin-bottom:8px;"><span class="sec-title-bar"></span>Ports &amp; Protocoles Réseau</div>
      <table class="ports-table">
        <thead>
          <tr>
            <th>Port</th>
            <th>Protocole</th>
            <th>Service</th>
            <th>Accessible par</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>80</code></td><td>HTTP</td><td>NGINX</td><td>Agents Terrain (LAN)</td>
            <td>Carte Leaflet + appels API tuiles réseau intranet</td>
          </tr>
          <tr>
            <td><code>443</code></td><td>HTTPS / TLS</td><td>NGINX</td><td>Tous les utilisateurs</td>
            <td>Accès sécurisé avec certificat auto-signé intranet INS</td>
          </tr>
          <tr>
            <td><code>8085</code></td><td>HTTP</td><td>NGINX</td><td>Administrateurs</td>
            <td>Interface d'administration, Dashboard &amp; Studio</td>
          </tr>
          <tr>
            <td><code>3000</code></td><td>HTTP (Docker)</td><td>API Node.js</td><td>NGINX uniquement</td>
            <td>API REST interne, jamais exposée au réseau physique</td>
          </tr>
          <tr>
            <td><code>6379</code></td><td>Redis Protocol</td><td>Redis</td><td>API Node.js uniquement</td>
            <td>Cache tuiles, sessions &amp; compteurs (réseau Docker privé)</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="callout callout-green" style="margin-top:10px;">
      <div style="font-size:14px;">✅</div>
      <div><strong>Mode 100% Hors-Ligne :</strong> Après le seeding complet de la Tunisie (Zoom 6-16), le système fonctionne sans aucune connexion internet. Redis stocke l'intégralité des tuiles en mémoire/disque. Les fournisseurs externes ne sont plus jamais contactés — parfait pour les recensements en zones isolées.</div>
    </div>
  </div>

  <div class="page-footer-inner">
    <div><strong>INS Carto Platform</strong> · Architecture Technique</div>
    <div>Institut National de la Statistique · Octobre 2026</div>
  </div>
</div>

</body>
</html>`;

fs.writeFileSync(OUTPUT_HTML, html, 'utf8');
console.log('✅ HTML généré :', OUTPUT_HTML);

const cmd = `"${CHROME_PATH}" --headless=new --disable-gpu --no-sandbox --print-to-pdf="${OUTPUT_PDF}" --print-to-pdf-no-header --no-pdf-header-footer "file:///${OUTPUT_HTML.replace(/\\/g,'/')}"`;
console.log('🚀 Génération PDF...');
try {
  execSync(cmd, { stdio: 'inherit' });
  console.log('✅ PDF généré :', OUTPUT_PDF);
} catch(e) {
  console.error('❌ Erreur:', e.message);
}
