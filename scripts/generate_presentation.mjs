// ==============================================================================
//  INS SIG PLATFORM v1.0 — Générateur PowerPoint Professionnel
//  Génère : INS_SIG_Platform_Presentation.pptx
// ==============================================================================
import PptxGenJS from 'pptxgenjs';
import { createWriteStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Palette de couleurs INS Tunisie ──
const C = {
  bleuINS:     '1B3A6B',  // Bleu foncé institutionnel
  bleuClair:   '2E6DB4',  // Bleu moyen
  bleuAccent:  '4A9FD4',  // Bleu clair accent
  vertSucces:  '27AE60',  // Vert succès
  orangeAcc:   'E67E22',  // Orange accent
  rougeDanger: 'C0392B',  // Rouge danger
  grisTexte:   '2C3E50',  // Gris foncé texte
  grisClair:   'ECF0F1',  // Gris clair fond
  grisMedium:  'BDC3C7',  // Gris medium
  blanc:       'FFFFFF',
  noir:        '000000',
  fondSlide:   'F4F6F9',  // Fond slides
};

// ── Polices ──
const FONT_TITLE = 'Calibri';
const FONT_BODY  = 'Calibri';

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE'; // 16:9 33.87 x 19.05 cm
pptx.author  = 'INS Tunisie — Direction Informatique';
pptx.company = 'Institut National de la Statistique — Tunisie';
pptx.subject = 'INS SIG PLATFORM v1.0 — Présentation Technique';
pptx.title   = 'INS SIG Platform v1.0';

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

/** Ajoute un fond dégradé simulé (rectangle plein bleu foncé) à un slide titre */
function addTitleBackground(slide) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: '100%',
    fill: { color: C.bleuINS },
    line: { color: C.bleuINS },
  });
  // Bande décorative diagonale
  slide.addShape(pptx.ShapeType.rect, {
    x: '60%', y: 0, w: '40%', h: '100%',
    fill: { color: C.bleuClair, transparency: 30 },
    line: { color: C.bleuClair, transparency: 30 },
  });
  // Accent bas
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: '85%', w: '100%', h: '15%',
    fill: { color: C.bleuClair, transparency: 20 },
    line: { color: C.bleuClair },
  });
  // Ligne accent couleur
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: '83%', w: '30%', h: 0.08,
    fill: { color: C.bleuAccent },
    line: { color: C.bleuAccent },
  });
}

/** Fond standard pour slides de contenu */
function addContentBackground(slide) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: '100%',
    fill: { color: C.fondSlide },
    line: { color: C.fondSlide },
  });
  // Bande header
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: 1.1,
    fill: { color: C.bleuINS },
    line: { color: C.bleuINS },
  });
  // Accent ligne sous header
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 1.1, w: '100%', h: 0.07,
    fill: { color: C.bleuAccent },
    line: { color: C.bleuAccent },
  });
  // Footer
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: '93%', w: '100%', h: '7%',
    fill: { color: C.bleuINS, transparency: 10 },
    line: { color: C.bleuINS },
  });
}

/** Titre d'un slide de contenu */
function addSlideTitle(slide, title, subtitle = '') {
  slide.addText(title, {
    x: 0.4, y: 0.12, w: '90%', h: 0.8,
    fontSize: 22, bold: true,
    fontFace: FONT_TITLE, color: C.blanc,
    valign: 'middle',
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.4, y: 0.82, w: '90%', h: 0.25,
      fontSize: 11, color: C.bleuAccent,
      fontFace: FONT_BODY, italic: true,
    });
  }
  // Numéro de page et logo texte dans le footer
  slide.addText('INS SIG PLATFORM v1.0  |  Institut National de la Statistique — Tunisie', {
    x: 0.3, y: 6.95, w: 9, h: 0.3,
    fontSize: 8, color: C.blanc, fontFace: FONT_BODY,
  });
}

/** Ajoute une card colorée avec icône texte, titre et texte */
function addCard(slide, x, y, w, h, icon, title, body, color = C.bleuClair) {
  slide.addShape(pptx.ShapeType.rect, {
    x, y, w, h,
    fill: { color: C.blanc },
    line: { color: color, pt: 1.5 },
    shadow: { type: 'outer', color: '999999', blur: 6, offset: 2, angle: 45, opacity: 0.3 },
  });
  // Bandeau couleur haut
  slide.addShape(pptx.ShapeType.rect, {
    x, y, w, h: 0.07,
    fill: { color: color },
    line: { color: color },
  });
  // Icône
  slide.addText(icon, {
    x: x + 0.12, y: y + 0.1, w: 0.5, h: 0.4,
    fontSize: 20, align: 'center',
  });
  // Titre
  slide.addText(title, {
    x: x + 0.12, y: y + 0.48, w: w - 0.2, h: 0.32,
    fontSize: 11, bold: true, color: color,
    fontFace: FONT_TITLE, wrap: true,
  });
  // Corps
  slide.addText(body, {
    x: x + 0.12, y: y + 0.78, w: w - 0.2, h: h - 0.9,
    fontSize: 9, color: C.grisTexte,
    fontFace: FONT_BODY, wrap: true, valign: 'top',
  });
}

/** Badge pill coloré */
function addBadge(slide, x, y, label, color = C.bleuClair, textColor = C.blanc) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w: 1.4, h: 0.28, rectRadius: 0.14,
    fill: { color }, line: { color },
  });
  slide.addText(label, {
    x, y, w: 1.4, h: 0.28,
    fontSize: 8, bold: true, color: textColor,
    align: 'center', valign: 'middle', fontFace: FONT_BODY,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 1 — TITRE
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  addTitleBackground(slide);

  // Logo texte INS
  slide.addText('INS', {
    x: 0.5, y: 0.4, w: 2, h: 0.8,
    fontSize: 52, bold: true, color: C.blanc,
    fontFace: FONT_TITLE,
  });
  slide.addText('Institut National de la Statistique', {
    x: 0.5, y: 1.15, w: 5, h: 0.35,
    fontSize: 13, color: C.bleuAccent, fontFace: FONT_BODY,
  });

  // Ligne séparatrice
  slide.addShape(pptx.ShapeType.line, {
    x: 0.5, y: 1.6, w: 8, h: 0,
    line: { color: C.bleuAccent, pt: 1, dashType: 'solid' },
  });

  // Titre principal
  slide.addText('SIG PLATFORM', {
    x: 0.5, y: 1.8, w: 9, h: 1.1,
    fontSize: 54, bold: true, color: C.blanc,
    fontFace: FONT_TITLE, charSpacing: 3,
  });
  slide.addText('v 1.0', {
    x: 0.5, y: 2.85, w: 2, h: 0.45,
    fontSize: 20, color: C.bleuAccent, fontFace: FONT_BODY, bold: true,
  });

  // Sous-titre
  slide.addText('Système d\'Information Géographique Web Enterprise\nPrésentation Technique — Équipe Informatique', {
    x: 0.5, y: 3.5, w: 9, h: 0.9,
    fontSize: 16, color: C.blanc, fontFace: FONT_BODY,
    lineSpacingMultiple: 1.4,
  });

  // Badges technologies
  const badges = [
    { label: 'Node.js 20', color: '3C873A' },
    { label: 'PostgreSQL 16', color: '336791' },
    { label: 'PostGIS 3.4', color: '4CAF50' },
    { label: 'Redis 7', color: 'DC382D' },
    { label: 'Docker', color: '2496ED' },
    { label: 'Nginx', color: '009639' },
  ];
  badges.forEach((b, i) => {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.5 + i * 1.6, y: 4.6, w: 1.45, h: 0.3,
      rectRadius: 0.15,
      fill: { color: b.color, transparency: 20 },
      line: { color: b.color },
    });
    slide.addText(b.label, {
      x: 0.5 + i * 1.6, y: 4.6, w: 1.45, h: 0.3,
      fontSize: 8.5, bold: true, color: C.blanc,
      align: 'center', valign: 'middle', fontFace: FONT_BODY,
    });
  });

  // Date et département
  slide.addText(`Octobre 2026  •  Direction des Systèmes d'Information`, {
    x: 0.5, y: 6.3, w: 9, h: 0.3,
    fontSize: 11, color: C.blanc, fontFace: FONT_BODY,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 2 — AGENDA
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  addContentBackground(slide);
  addSlideTitle(slide, '📋  Plan de la Présentation');

  const items = [
    { num: '01', title: 'Contexte & Objectifs',       sub: 'Pourquoi cette plateforme ?' },
    { num: '02', title: 'Architecture Système',        sub: 'Vue d\'ensemble des composants' },
    { num: '03', title: 'Stack Technologique',         sub: 'Technologies et choix techniques' },
    { num: '04', title: 'Fonctionnalités Clés',        sub: 'Ce que la plateforme permet de faire' },
    { num: '05', title: 'Sécurité & Authentification', sub: 'JWT, Argon2, Rate Limiting' },
    { num: '06', title: 'Monitoring & Supervision',    sub: 'Prometheus, Grafana, Healthchecks' },
    { num: '07', title: 'Déploiement & Installation',  sub: 'Docker, Ubuntu natif, Windows' },
    { num: '08', title: 'Accès & Identifiants',        sub: 'URLs et comptes par défaut' },
    { num: '09', title: 'Conclusion & Prochaines Étapes', sub: 'Roadmap et évolutions' },
  ];

  items.forEach((item, i) => {
    const col = i < 5 ? 0 : 1;
    const row = i < 5 ? i : i - 5;
    const x = col === 0 ? 0.4 : 6.0;
    const y = 1.35 + row * 1.05;
    const colors = [C.bleuINS, C.bleuClair, C.bleuAccent, C.vertSucces, C.orangeAcc];
    const color = colors[i % colors.length];

    slide.addShape(pptx.ShapeType.rect, {
      x, y, w: 5.3, h: 0.85,
      fill: { color: C.blanc },
      line: { color: color, pt: 1 },
      shadow: { type: 'outer', color: 'AAAAAA', blur: 4, offset: 1, angle: 45, opacity: 0.2 },
    });
    slide.addShape(pptx.ShapeType.rect, {
      x, y, w: 0.55, h: 0.85,
      fill: { color },
      line: { color },
    });
    slide.addText(item.num, {
      x, y, w: 0.55, h: 0.85,
      fontSize: 14, bold: true, color: C.blanc,
      align: 'center', valign: 'middle', fontFace: FONT_TITLE,
    });
    slide.addText(item.title, {
      x: x + 0.65, y: y + 0.06, w: 4.5, h: 0.38,
      fontSize: 11, bold: true, color: C.grisTexte, fontFace: FONT_TITLE,
    });
    slide.addText(item.sub, {
      x: x + 0.65, y: y + 0.44, w: 4.5, h: 0.3,
      fontSize: 9, color: '7F8C8D', fontFace: FONT_BODY, italic: true,
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 3 — CONTEXTE & OBJECTIFS
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  addContentBackground(slide);
  addSlideTitle(slide, '🎯  Contexte & Objectifs', 'Pourquoi la plateforme INS SIG ?');

  // Problématique
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.4, y: 1.3, w: 5.6, h: 2.6,
    fill: { color: C.blanc },
    line: { color: 'E74C3C', pt: 1.5 },
    shadow: { type: 'outer', color: 'CCCCCC', blur: 5, offset: 2, angle: 45, opacity: 0.3 },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.4, y: 1.3, w: 5.6, h: 0.38,
    fill: { color: 'E74C3C' },
    line: { color: 'E74C3C' },
  });
  slide.addText('❌  Problématique', {
    x: 0.5, y: 1.31, w: 5.4, h: 0.36,
    fontSize: 13, bold: true, color: C.blanc, fontFace: FONT_TITLE,
  });
  const problems = [
    '• Données géospatiales dispersées sans outil de centralisation',
    '• Absence d\'interface web pour la visualisation cartographique',
    '• Pas d\'API standardisée pour l\'accès aux données SIG',
    '• Outils existants coûteux et non adaptés aux besoins INS',
    '• Pas de monitoring ni de traçabilité des accès',
  ];
  slide.addText(problems.join('\n'), {
    x: 0.55, y: 1.75, w: 5.3, h: 2.0,
    fontSize: 10.5, color: C.grisTexte, fontFace: FONT_BODY,
    lineSpacingMultiple: 1.5, valign: 'top',
  });

  // Solution
  slide.addShape(pptx.ShapeType.rect, {
    x: 6.3, y: 1.3, w: 5.6, h: 2.6,
    fill: { color: C.blanc },
    line: { color: C.vertSucces, pt: 1.5 },
    shadow: { type: 'outer', color: 'CCCCCC', blur: 5, offset: 2, angle: 45, opacity: 0.3 },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 6.3, y: 1.3, w: 5.6, h: 0.38,
    fill: { color: C.vertSucces },
    line: { color: C.vertSucces },
  });
  slide.addText('✅  Solution : INS SIG Platform', {
    x: 6.4, y: 1.31, w: 5.4, h: 0.36,
    fontSize: 13, bold: true, color: C.blanc, fontFace: FONT_TITLE,
  });
  const solutions = [
    '• Plateforme SIG web complète et centralisée',
    '• API REST multi-fournisseurs (OSM, ESRI, Google Maps)',
    '• Studio cartographique interactif basé sur MapLibre GL',
    '• Solution open-source, déployable on-premise',
    '• Monitoring temps réel avec Grafana & Prometheus',
  ];
  slide.addText(solutions.join('\n'), {
    x: 6.45, y: 1.75, w: 5.3, h: 2.0,
    fontSize: 10.5, color: C.grisTexte, fontFace: FONT_BODY,
    lineSpacingMultiple: 1.5, valign: 'top',
  });

  // Objectifs clés
  slide.addText('Objectifs Clés', {
    x: 0.4, y: 4.1, w: 11.5, h: 0.4,
    fontSize: 14, bold: true, color: C.bleuINS, fontFace: FONT_TITLE,
  });
  const objectives = [
    { icon: '🗺️', text: 'Centraliser la donnée géospatiale' },
    { icon: '⚡', text: 'API haute performance avec cache Redis' },
    { icon: '🔒', text: 'Sécurité JWT & audit complet' },
    { icon: '📊', text: 'Supervision & métriques temps réel' },
  ];
  objectives.forEach((obj, i) => {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.4 + i * 3.05, y: 4.55, w: 2.85, h: 1.5,
      rectRadius: 0.1,
      fill: { color: C.bleuINS, transparency: 5 },
      line: { color: C.bleuAccent },
    });
    slide.addText(obj.icon, {
      x: 0.4 + i * 3.05, y: 4.6, w: 2.85, h: 0.55,
      fontSize: 26, align: 'center',
    });
    slide.addText(obj.text, {
      x: 0.4 + i * 3.05, y: 5.15, w: 2.85, h: 0.75,
      fontSize: 10, color: C.blanc, bold: true,
      fontFace: FONT_BODY, align: 'center', valign: 'middle', wrap: true,
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 4 — ARCHITECTURE
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  addContentBackground(slide);
  addSlideTitle(slide, '🏗️  Architecture de la Plateforme', 'Vue d\'ensemble — 6 services conteneurisés');

  // Couche Client
  slide.addShape(pptx.ShapeType.rect, {
    x: 3.5, y: 1.35, w: 5.2, h: 0.6,
    fill: { color: '8E44AD', transparency: 10 },
    line: { color: '8E44AD' },
  });
  slide.addText('🌐  COUCHE CLIENT — Navigateur Web', {
    x: 3.5, y: 1.35, w: 5.2, h: 0.6,
    fontSize: 11, bold: true, color: C.blanc,
    align: 'center', valign: 'middle', fontFace: FONT_TITLE,
  });

  // Flèche
  slide.addShape(pptx.ShapeType.line, {
    x: 6.1, y: 1.95, w: 0, h: 0.35,
    line: { color: C.grisTexte, pt: 1.5, endArrowType: 'arrow' },
  });

  // Frontend
  slide.addShape(pptx.ShapeType.rect, {
    x: 3.5, y: 2.3, w: 5.2, h: 0.7,
    fill: { color: '009639', transparency: 10 },
    line: { color: '009639' },
  });
  slide.addText('🖥️  carto-frontend  |  Nginx 1.27  |  Port 8085', {
    x: 3.5, y: 2.3, w: 5.2, h: 0.7,
    fontSize: 10.5, bold: true, color: C.blanc,
    align: 'center', valign: 'middle', fontFace: FONT_BODY,
  });

  // Flèche
  slide.addShape(pptx.ShapeType.line, {
    x: 6.1, y: 3.0, w: 0, h: 0.35,
    line: { color: C.grisTexte, pt: 1.5, endArrowType: 'arrow' },
  });

  // API
  slide.addShape(pptx.ShapeType.rect, {
    x: 3.5, y: 3.35, w: 5.2, h: 0.72,
    fill: { color: C.bleuINS },
    line: { color: C.bleuAccent },
  });
  slide.addText('⚙️  carto-api  |  Node.js 20 / Express  |  Port 4000', {
    x: 3.5, y: 3.35, w: 5.2, h: 0.72,
    fontSize: 10.5, bold: true, color: C.blanc,
    align: 'center', valign: 'middle', fontFace: FONT_BODY,
  });

  // Flèches vers BDD et Redis
  slide.addShape(pptx.ShapeType.line, {
    x: 4.5, y: 4.07, w: -1.8, h: 0.6,
    line: { color: C.grisTexte, pt: 1.5, endArrowType: 'arrow' },
  });
  slide.addShape(pptx.ShapeType.line, {
    x: 7.7, y: 4.07, w: 1.8, h: 0.6,
    line: { color: C.grisTexte, pt: 1.5, endArrowType: 'arrow' },
  });

  // PostgreSQL + PostGIS
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.4, y: 4.7, w: 4.0, h: 0.9,
    fill: { color: '336791', transparency: 10 },
    line: { color: '336791' },
  });
  slide.addText('🗄️  carto-postgis\nPostgreSQL 16 + PostGIS 3.4 | Port 5432', {
    x: 0.4, y: 4.7, w: 4.0, h: 0.9,
    fontSize: 9.5, bold: true, color: C.blanc,
    align: 'center', valign: 'middle', fontFace: FONT_BODY, lineSpacingMultiple: 1.3,
  });

  // Redis
  slide.addShape(pptx.ShapeType.rect, {
    x: 7.9, y: 4.7, w: 4.0, h: 0.9,
    fill: { color: 'DC382D', transparency: 10 },
    line: { color: 'DC382D' },
  });
  slide.addText('⚡  carto-redis\nRedis 7 Alpine | Port 6379', {
    x: 7.9, y: 4.7, w: 4.0, h: 0.9,
    fontSize: 9.5, bold: true, color: C.blanc,
    align: 'center', valign: 'middle', fontFace: FONT_BODY, lineSpacingMultiple: 1.3,
  });

  // Monitoring (côté)
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.2, y: 1.35, w: 2.8, h: 3.0,
    fill: { color: C.blanc },
    line: { color: C.orangeAcc, pt: 1.5 },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.2, y: 1.35, w: 2.8, h: 0.35,
    fill: { color: C.orangeAcc },
    line: { color: C.orangeAcc },
  });
  slide.addText('📊 MONITORING', {
    x: 0.2, y: 1.35, w: 2.8, h: 0.35,
    fontSize: 9, bold: true, color: C.blanc, align: 'center', valign: 'middle',
    fontFace: FONT_TITLE,
  });
  slide.addText('Prometheus\nPort 9090\n\nGrafana\nPort 3000', {
    x: 0.2, y: 1.75, w: 2.8, h: 2.5,
    fontSize: 10, color: C.grisTexte, fontFace: FONT_BODY,
    align: 'center', valign: 'middle', lineSpacingMultiple: 1.4,
  });

  // Réseau Docker
  slide.addText('Réseau Docker : carto-internal-net + carto-public-net', {
    x: 3.5, y: 6.3, w: 8.4, h: 0.4,
    fontSize: 9, color: '7F8C8D', fontFace: FONT_BODY, italic: true,
    align: 'center',
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 5 — STACK TECHNOLOGIQUE
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  addContentBackground(slide);
  addSlideTitle(slide, '⚙️  Stack Technologique', 'Composants open-source enterprise-grade');

  const techs = [
    {
      color: '3C873A', icon: '🟢', name: 'Node.js 20 LTS',
      role: 'Runtime API Gateway',
      details: 'ESM Modules • Express 4 • Async/Await natif',
    },
    {
      color: '336791', icon: '🐘', name: 'PostgreSQL 16',
      role: 'Base de données principale',
      details: 'Pool connexions • Migrations versionées • ACID',
    },
    {
      color: '4CAF50', icon: '🌍', name: 'PostGIS 3.4',
      role: 'Extension géospatiale',
      details: 'Géométries 2D/3D • Requêtes spatiales SQL • GeoJSON',
    },
    {
      color: 'DC382D', icon: '⚡', name: 'Redis 7',
      role: 'Cache & Rate Limiting',
      details: 'TTL par type • LRU eviction • Auth par mot de passe',
    },
    {
      color: '009639', icon: '🔀', name: 'Nginx 1.27',
      role: 'Reverse Proxy & Static',
      details: 'Gzip • Cache headers • Proxy upstream • SPA fallback',
    },
    {
      color: '2496ED', icon: '🐳', name: 'Docker Compose',
      role: 'Orchestration conteneurs',
      details: 'Multi-stage builds • Healthchecks • Volumes persistants',
    },
    {
      color: 'E67E22', icon: '📈', name: 'Prometheus',
      role: 'Collecte de métriques',
      details: 'Scraping 10s • Métriques API • Alerting configurable',
    },
    {
      color: 'F46800', icon: '📊', name: 'Grafana 10',
      role: 'Tableaux de bord',
      details: 'Datasource Prometheus • Dashboards temps réel',
    },
  ];

  // Grille 4x2
  techs.forEach((t, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 0.3 + col * 3.05;
    const y = 1.35 + row * 2.75;
    addCard(slide, x, y, 2.85, 2.55, t.icon, t.name, `${t.role}\n\n${t.details}`, t.color);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 6 — FONCTIONNALITÉS
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  addContentBackground(slide);
  addSlideTitle(slide, '✨  Fonctionnalités Clés', 'Ce que la plateforme permet de faire');

  const features = [
    {
      color: C.bleuINS, icon: '🗺️',
      title: 'Studio Cartographique Web',
      items: [
        'Interface MapLibre GL JS interactive',
        'Basemaps : OSM, ESRI, MapTiler',
        'Dessin et édition de géométries',
        'Import GeoJSON / KML / Shapefile',
        'Export et partage de cartes',
      ],
    },
    {
      color: C.bleuClair, icon: '📡',
      title: 'API REST Multi-Fournisseurs',
      items: [
        'Tuiles raster & vectorielles',
        'Géocodage Nominatim / Google',
        'Géocodage inversé',
        'Documentation Swagger interactive',
        'ETag & cache HTTP intégré',
      ],
    },
    {
      color: C.vertSucces, icon: '🗄️',
      title: 'Gestion Données Spatiales',
      items: [
        'Stockage PostGIS avec index spatial',
        'CRUD couches géographiques',
        'Requêtes spatiales avancées (ST_)',
        'Import en masse de datasets',
        'Gestion des projections (EPSG)',
      ],
    },
    {
      color: C.orangeAcc, icon: '👥',
      title: 'Gestion Utilisateurs & API Keys',
      items: [
        'Authentification JWT (Access + Refresh)',
        'Rôles : admin / analyst / viewer',
        'Tokens API avec expiration',
        'Audit log complet des actions',
        'Gestion des sessions actives',
      ],
    },
  ];

  features.forEach((f, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.3 + col * 6.15;
    const y = 1.35 + row * 2.8;

    slide.addShape(pptx.ShapeType.rect, {
      x, y, w: 5.9, h: 2.6,
      fill: { color: C.blanc },
      line: { color: f.color, pt: 1.5 },
      shadow: { type: 'outer', color: 'AAAAAA', blur: 5, offset: 2, angle: 45, opacity: 0.25 },
    });
    slide.addShape(pptx.ShapeType.rect, {
      x, y, w: 5.9, h: 0.5,
      fill: { color: f.color },
      line: { color: f.color },
    });
    slide.addText(`${f.icon}  ${f.title}`, {
      x: x + 0.15, y: y + 0.05, w: 5.6, h: 0.42,
      fontSize: 12, bold: true, color: C.blanc, fontFace: FONT_TITLE,
      valign: 'middle',
    });
    const listText = f.items.map(item => ({ text: `✓  ${item}\n`, options: { fontSize: 10, color: C.grisTexte } }));
    slide.addText(listText, {
      x: x + 0.2, y: y + 0.55, w: 5.5, h: 1.95,
      fontFace: FONT_BODY, lineSpacingMultiple: 1.45, valign: 'top',
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 7 — SÉCURITÉ
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  addContentBackground(slide);
  addSlideTitle(slide, '🔒  Sécurité & Authentification', 'Architecture de sécurité multicouche');

  const secItems = [
    { icon: '🔑', title: 'JWT Access + Refresh Tokens',    color: C.bleuINS,
      text: 'Access token 15min · Refresh token 7j · Secrets HS256 ≥ 64 chars · Rotation automatique' },
    { icon: '🛡️', title: 'Argon2id Password Hashing',     color: '8E44AD',
      text: 'Algorithme Argon2id (résistant GPU) · m=65536, t=3, p=4 · Sel unique par hash' },
    { icon: '🚦', title: 'Rate Limiting par IP',           color: C.orangeAcc,
      text: 'Express-rate-limit · Fenêtre glissante · 429 Too Many Requests · Protection brute-force' },
    { icon: '🪖', title: 'Helmet.js Security Headers',    color: '2C3E50',
      text: 'X-Frame-Options · X-Content-Type-Options · X-XSS-Protection · Referrer-Policy' },
    { icon: '📋', title: 'Audit Log Complet',             color: C.vertSucces,
      text: 'Table security_audit_logs · Login success/fail · IP tracée · Sévérité INFO/WARNING' },
    { icon: '🔐', title: 'Variables d\'environnement',    color: C.bleuClair,
      text: 'Secrets dans .env (jamais en dur) · Fichier 600 · JWT auto-régénéré à l\'install' },
  ];

  secItems.forEach((item, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.3 + col * 4.1;
    const y = 1.35 + row * 2.65;

    slide.addShape(pptx.ShapeType.rect, {
      x, y, w: 3.9, h: 2.45,
      fill: { color: C.blanc },
      line: { color: item.color, pt: 1.5 },
    });
    slide.addShape(pptx.ShapeType.rect, {
      x, y, w: 3.9, h: 0.07,
      fill: { color: item.color },
      line: { color: item.color },
    });
    slide.addText(item.icon, {
      x: x + 0.1, y: y + 0.12, w: 0.55, h: 0.5,
      fontSize: 22, align: 'center',
    });
    slide.addText(item.title, {
      x: x + 0.68, y: y + 0.12, w: 3.1, h: 0.5,
      fontSize: 11, bold: true, color: item.color,
      fontFace: FONT_TITLE, valign: 'middle', wrap: true,
    });
    slide.addShape(pptx.ShapeType.line, {
      x: x + 0.15, y: y + 0.68, w: 3.6, h: 0,
      line: { color: C.grisMedium, pt: 0.5 },
    });
    slide.addText(item.text, {
      x: x + 0.15, y: y + 0.78, w: 3.65, h: 1.55,
      fontSize: 9, color: C.grisTexte,
      fontFace: FONT_BODY, wrap: true, valign: 'top',
      lineSpacingMultiple: 1.4,
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 8 — MONITORING
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  addContentBackground(slide);
  addSlideTitle(slide, '📊  Monitoring & Supervision', 'Observabilité complète de la plateforme');

  // Prometheus
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.3, y: 1.35, w: 5.8, h: 4.8,
    fill: { color: C.blanc },
    line: { color: C.orangeAcc, pt: 1.5 },
    shadow: { type: 'outer', color: 'CCCCCC', blur: 5, offset: 2, angle: 45, opacity: 0.25 },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.3, y: 1.35, w: 5.8, h: 0.45,
    fill: { color: C.orangeAcc },
    line: { color: C.orangeAcc },
  });
  slide.addText('📈  Prometheus  —  Port 9090', {
    x: 0.4, y: 1.37, w: 5.6, h: 0.4,
    fontSize: 13, bold: true, color: C.blanc, fontFace: FONT_TITLE,
  });
  const promMetrics = [
    '• Scraping toutes les 10 secondes',
    '• Métriques API : latence, req/s, codes HTTP',
    '• Métriques Redis : connexions, mémoire',
    '• Métriques système : CPU, RAM, I/O',
    '• Rétention configurable des séries temporelles',
    '• Interface web native : http://localhost:9090',
    '',
    'Jobs configurés :',
    '  › carto-api       → /api/metrics',
    '  › carto-redis     → port 6379',
    '  › prometheus      → auto-monitoring',
  ];
  slide.addText(promMetrics.join('\n'), {
    x: 0.45, y: 1.88, w: 5.5, h: 4.1,
    fontSize: 10, color: C.grisTexte, fontFace: FONT_BODY,
    lineSpacingMultiple: 1.45, valign: 'top',
  });

  // Grafana
  slide.addShape(pptx.ShapeType.rect, {
    x: 6.4, y: 1.35, w: 5.8, h: 4.8,
    fill: { color: C.blanc },
    line: { color: 'F46800', pt: 1.5 },
    shadow: { type: 'outer', color: 'CCCCCC', blur: 5, offset: 2, angle: 45, opacity: 0.25 },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 6.4, y: 1.35, w: 5.8, h: 0.45,
    fill: { color: 'F46800' },
    line: { color: 'F46800' },
  });
  slide.addText('📊  Grafana 10  —  Port 3000', {
    x: 6.5, y: 1.37, w: 5.6, h: 0.4,
    fontSize: 13, bold: true, color: C.blanc, fontFace: FONT_TITLE,
  });
  const grafanaFeatures = [
    '• Dashboards temps réel pré-configurés',
    '• Source Prometheus intégrée automatiquement',
    '• Alertes email / webhook configurables',
    '• Authentification admin sécurisée',
    '• Accès : http://localhost:3000',
    '',
    'Panels disponibles :',
    '  › Requêtes API par minute (req/s)',
    '  › Latence P50 / P95 / P99',
    '  › Taux d\'erreurs HTTP 4xx / 5xx',
    '  › Utilisation mémoire Redis',
  ];
  slide.addText(grafanaFeatures.join('\n'), {
    x: 6.5, y: 1.88, w: 5.5, h: 4.1,
    fontSize: 10, color: C.grisTexte, fontFace: FONT_BODY,
    lineSpacingMultiple: 1.45, valign: 'top',
  });

  // Healthcheck
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.3, y: 6.2, w: 11.9, h: 0.5,
    fill: { color: C.vertSucces, transparency: 15 },
    line: { color: C.vertSucces },
  });
  slide.addText('✅  Healthchecks Docker natifs : carto-postgis · carto-redis · carto-api · carto-frontend  —  Intervalle : 10-30s', {
    x: 0.4, y: 6.22, w: 11.7, h: 0.45,
    fontSize: 9.5, color: C.blanc, bold: true,
    fontFace: FONT_BODY, align: 'center', valign: 'middle',
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 9 — DÉPLOIEMENT
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  addContentBackground(slide);
  addSlideTitle(slide, '🚀  Déploiement & Installation', 'Trois modes de déploiement disponibles');

  const deployments = [
    {
      icon: '🐳', color: '2496ED',
      title: 'Ubuntu + Docker',
      script: 'install_docker_ubuntu.sh',
      cmd: 'sudo ./install_docker_ubuntu.sh',
      steps: [
        'Installe Docker Engine automatiquement',
        'Construit toutes les images Docker',
        'Démarre les 6 conteneurs',
        'Exécute les migrations BDD',
        'Génère JWT secrets sécurisés',
      ],
      badge: 'RECOMMANDÉ',
    },
    {
      icon: '🖥️', color: C.vertSucces,
      title: 'Ubuntu Natif (sans Docker)',
      script: 'install_native_ubuntu.sh',
      cmd: 'sudo ./install_native_ubuntu.sh',
      steps: [
        'Installe Node.js 20, PostgreSQL 16, PostGIS',
        'Installe Redis 7 et Nginx',
        'Configure les services systemd',
        'Crée l\'utilisateur système "carto"',
        'Déploie dans /opt/carto_platform',
      ],
      badge: 'ON-PREMISE',
    },
    {
      icon: '🪟', color: C.bleuClair,
      title: 'Windows + Docker Desktop',
      script: 'install_windows.ps1',
      cmd: '.\\install_windows.ps1',
      steps: [
        'Vérifie Docker Desktop (déjà installé)',
        'Configure le fichier .env',
        'Lance docker compose up --build',
        'Attend la santé des services',
        'Exécute les migrations',
      ],
      badge: 'WINDOWS',
    },
  ];

  deployments.forEach((d, i) => {
    const x = 0.3 + i * 4.05;
    const y = 1.35;
    const w = 3.85;
    const h = 5.6;

    slide.addShape(pptx.ShapeType.rect, {
      x, y, w, h,
      fill: { color: C.blanc },
      line: { color: d.color, pt: 1.5 },
      shadow: { type: 'outer', color: 'AAAAAA', blur: 5, offset: 2, angle: 45, opacity: 0.3 },
    });
    slide.addShape(pptx.ShapeType.rect, {
      x, y, w, h: 0.55,
      fill: { color: d.color },
      line: { color: d.color },
    });

    // Badge
    slide.addShape(pptx.ShapeType.roundRect, {
      x: x + w - 1.2, y: y - 0.2, w: 1.15, h: 0.28,
      rectRadius: 0.14,
      fill: { color: d.color },
      line: { color: d.color },
    });
    slide.addText(d.badge, {
      x: x + w - 1.2, y: y - 0.2, w: 1.15, h: 0.28,
      fontSize: 7.5, bold: true, color: C.blanc,
      align: 'center', valign: 'middle', fontFace: FONT_BODY,
    });

    slide.addText(`${d.icon}  ${d.title}`, {
      x: x + 0.12, y: y + 0.05, w: w - 0.2, h: 0.45,
      fontSize: 11.5, bold: true, color: C.blanc, fontFace: FONT_TITLE, valign: 'middle',
    });

    // Script name
    slide.addShape(pptx.ShapeType.rect, {
      x: x + 0.12, y: y + 0.65, w: w - 0.22, h: 0.35,
      fill: { color: d.color, transparency: 85 },
      line: { color: d.color, transparency: 50 },
    });
    slide.addText(`📄 ${d.script}`, {
      x: x + 0.15, y: y + 0.65, w: w - 0.25, h: 0.35,
      fontSize: 8.5, bold: true, color: d.color, fontFace: 'Courier New', valign: 'middle',
    });

    // Steps
    d.steps.forEach((step, si) => {
      slide.addText(`${si + 1}.  ${step}`, {
        x: x + 0.15, y: y + 1.1 + si * 0.43, w: w - 0.25, h: 0.38,
        fontSize: 9.5, color: C.grisTexte, fontFace: FONT_BODY, wrap: true,
      });
    });

    // Commande
    slide.addShape(pptx.ShapeType.rect, {
      x: x + 0.12, y: y + h - 0.75, w: w - 0.22, h: 0.55,
      fill: { color: '1A1A2E' },
      line: { color: '333355' },
    });
    slide.addText(`$ ${d.cmd}`, {
      x: x + 0.18, y: y + h - 0.75, w: w - 0.3, h: 0.55,
      fontSize: 8, color: '00FF88', fontFace: 'Courier New',
      valign: 'middle',
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 10 — ACCÈS & IDENTIFIANTS
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  addContentBackground(slide);
  addSlideTitle(slide, '🔐  Accès & Identifiants par Défaut', 'URLs des services et comptes d\'accès');

  // Services table
  const services = [
    { icon: '🗺️', name: 'Studio SIG Web',        url: 'http://localhost:8085',          login: 'adminCarto', pwd: 'AdminCarto2026!Secure', color: C.bleuINS },
    { icon: '📡', name: 'API REST / Swagger',     url: 'http://localhost:4000/api/docs', login: 'Token JWT', pwd: '—', color: C.bleuClair },
    { icon: '❤️', name: 'Healthcheck API',        url: 'http://localhost:4000/api/health',login: 'Public',   pwd: '—', color: C.vertSucces },
    { icon: '📊', name: 'Grafana Supervision',    url: 'http://localhost:3000',          login: 'admin',     pwd: 'GrafanaCarto2026!Pass', color: 'F46800' },
    { icon: '🔥', name: 'Prometheus Métriques',   url: 'http://localhost:9090',          login: 'Public',    pwd: '—', color: C.orangeAcc },
    { icon: '🗄️', name: 'PostgreSQL (direct)',    url: '127.0.0.1:5432',               login: 'carto_user', pwd: '(voir .env)', color: '336791' },
  ];

  // En-tête table
  const headers = ['Service', 'URL', 'Login', 'Mot de passe'];
  const colWidths = [2.0, 3.8, 1.8, 2.6];
  const colX = [0.3, 2.35, 6.2, 8.05];

  // Header row
  headers.forEach((h, ci) => {
    slide.addShape(pptx.ShapeType.rect, {
      x: colX[ci], y: 1.35, w: colWidths[ci], h: 0.42,
      fill: { color: C.bleuINS },
      line: { color: C.bleuINS },
    });
    slide.addText(h, {
      x: colX[ci] + 0.08, y: 1.35, w: colWidths[ci] - 0.1, h: 0.42,
      fontSize: 10.5, bold: true, color: C.blanc,
      fontFace: FONT_TITLE, valign: 'middle',
    });
  });

  // Data rows
  services.forEach((svc, ri) => {
    const rowY = 1.77 + ri * 0.72;
    const rowBg = ri % 2 === 0 ? C.blanc : C.grisClair;

    // Row background
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.3, y: rowY, w: 11.6, h: 0.68,
      fill: { color: rowBg },
      line: { color: C.grisMedium, pt: 0.5 },
    });

    // Accent couleur gauche
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.3, y: rowY, w: 0.06, h: 0.68,
      fill: { color: svc.color },
      line: { color: svc.color },
    });

    // Cells
    slide.addText(`${svc.icon}  ${svc.name}`, {
      x: colX[0] + 0.1, y: rowY, w: colWidths[0] - 0.1, h: 0.68,
      fontSize: 9.5, color: C.grisTexte, fontFace: FONT_BODY,
      bold: true, valign: 'middle', wrap: true,
    });
    slide.addText(svc.url, {
      x: colX[1] + 0.08, y: rowY, w: colWidths[1] - 0.1, h: 0.68,
      fontSize: 9, color: C.bleuClair, fontFace: 'Courier New',
      valign: 'middle', wrap: true,
    });
    slide.addText(svc.login, {
      x: colX[2] + 0.08, y: rowY, w: colWidths[2] - 0.1, h: 0.68,
      fontSize: 9.5, color: C.grisTexte, fontFace: 'Courier New',
      valign: 'middle', bold: true,
    });
    slide.addText(svc.pwd, {
      x: colX[3] + 0.08, y: rowY, w: colWidths[3] - 0.1, h: 0.68,
      fontSize: 9, color: svc.pwd === '—' ? C.grisMedium : C.grisTexte,
      fontFace: 'Courier New', valign: 'middle',
    });
  });

  // Avertissement
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.3, y: 6.2, w: 11.6, h: 0.52,
    fill: { color: 'FFF3CD' },
    line: { color: 'FFCC00', pt: 1 },
  });
  slide.addText('⚠️  Ces identifiants sont les valeurs par défaut. Modifier le fichier .env avant tout déploiement en production.  Référence complète : CREDENTIALS.md', {
    x: 0.4, y: 6.21, w: 11.4, h: 0.5,
    fontSize: 9, color: '856404', fontFace: FONT_BODY,
    valign: 'middle', bold: true,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 11 — CONCLUSION & ROADMAP
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  addContentBackground(slide);
  addSlideTitle(slide, '🗓️  Conclusion & Prochaines Étapes', 'Roadmap et évolutions planifiées');

  // Acquis v1.0
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.3, y: 1.35, w: 5.8, h: 3.5,
    fill: { color: C.blanc },
    line: { color: C.vertSucces, pt: 1.5 },
    shadow: { type: 'outer', color: 'CCCCCC', blur: 4, offset: 1, angle: 45, opacity: 0.2 },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.3, y: 1.35, w: 5.8, h: 0.45,
    fill: { color: C.vertSucces },
    line: { color: C.vertSucces },
  });
  slide.addText('✅  Acquis — v1.0 (Actuelle)', {
    x: 0.4, y: 1.37, w: 5.6, h: 0.4,
    fontSize: 12, bold: true, color: C.blanc, fontFace: FONT_TITLE, valign: 'middle',
  });
  const acquis = [
    '✓ API REST multi-fournisseurs complète',
    '✓ Studio cartographique web interactif',
    '✓ Authentification JWT + Argon2id',
    '✓ Cache Redis avec TTL intelligent',
    '✓ PostgreSQL + PostGIS opérationnel',
    '✓ Monitoring Prometheus + Grafana',
    '✓ Scripts installation multi-OS',
    '✓ Documentation Swagger interactive',
  ];
  slide.addText(acquis.join('\n'), {
    x: 0.4, y: 1.88, w: 5.6, h: 2.85,
    fontSize: 10.5, color: C.grisTexte, fontFace: FONT_BODY, lineSpacingMultiple: 1.5,
  });

  // Roadmap v2.0
  const roadmapItems = [
    { version: 'v1.1', color: C.bleuClair, label: 'Interne',
      items: ['2FA (TOTP / SMS)', 'SSO LDAP / Active Directory', 'Gestion fine des permissions'] },
    { version: 'v1.2', color: C.orangeAcc, label: '3 mois',
      items: ['Impression PDF cartographique', 'Import Shapefile ZIP natif', 'WMS/WFS externe'] },
    { version: 'v2.0', color: C.bleuINS, label: '6 mois',
      items: ['Analyse spatiale avancée', 'Tableau de bord statistiques', 'Mobile-responsive'] },
  ];

  roadmapItems.forEach((r, i) => {
    const x = 6.4;
    const y = 1.35 + i * 1.85;
    slide.addShape(pptx.ShapeType.rect, {
      x, y, w: 5.8, h: 1.72,
      fill: { color: C.blanc },
      line: { color: r.color, pt: 1.5 },
    });
    slide.addShape(pptx.ShapeType.rect, {
      x, y, w: 1.0, h: 1.72,
      fill: { color: r.color },
      line: { color: r.color },
    });
    slide.addText(r.version, {
      x, y, w: 1.0, h: 0.9,
      fontSize: 14, bold: true, color: C.blanc,
      align: 'center', valign: 'middle', fontFace: FONT_TITLE,
    });
    slide.addText(r.label, {
      x, y: y + 0.9, w: 1.0, h: 0.82,
      fontSize: 9, color: C.blanc, align: 'center', valign: 'middle', fontFace: FONT_BODY,
    });
    slide.addText(r.items.join('\n'), {
      x: x + 1.12, y: y + 0.15, w: 4.55, h: 1.42,
      fontSize: 10, color: C.grisTexte, fontFace: FONT_BODY,
      lineSpacingMultiple: 1.5, valign: 'middle',
    });
  });

  // Message final
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.3, y: 5.05, w: 11.6, h: 1.6,
    fill: { color: C.bleuINS },
    line: { color: C.bleuINS },
  });
  slide.addText('🌍  La plateforme INS SIG v1.0 est déjà opérationnelle et prête pour la production.', {
    x: 0.5, y: 5.15, w: 11.2, h: 0.5,
    fontSize: 13, bold: true, color: C.blanc, fontFace: FONT_TITLE, align: 'center',
  });
  slide.addText('Elle fournit une base solide, sécurisée et extensible pour tous les besoins cartographiques de l\'INS.', {
    x: 0.5, y: 5.65, w: 11.2, h: 0.4,
    fontSize: 11, color: C.bleuAccent, fontFace: FONT_BODY, align: 'center',
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 12 — MERCI / QUESTIONS
// ══════════════════════════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  addTitleBackground(slide);

  slide.addText('Merci pour votre attention', {
    x: 0.5, y: 1.0, w: 11.2, h: 1.0,
    fontSize: 38, bold: true, color: C.blanc,
    fontFace: FONT_TITLE, align: 'center',
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 3.5, y: 2.1, w: 5.2, h: 0.06,
    fill: { color: C.bleuAccent },
    line: { color: C.bleuAccent },
  });

  slide.addText('Questions ?', {
    x: 0.5, y: 2.35, w: 11.2, h: 0.7,
    fontSize: 30, color: C.bleuAccent, fontFace: FONT_TITLE,
    align: 'center', bold: true,
  });

  // Infos contacts / accès
  const infos = [
    { label: 'Studio SIG Web', value: 'http://localhost:8085' },
    { label: 'API Docs',       value: 'http://localhost:4000/api/docs' },
    { label: 'Grafana',        value: 'http://localhost:3000' },
    { label: 'Login admin',    value: 'adminCarto / AdminCarto2026!Secure' },
  ];

  infos.forEach((info, i) => {
    slide.addShape(pptx.ShapeType.rect, {
      x: 2.3 + i * 2.2, y: 3.25, w: 2.0, h: 0.95,
      fill: { color: C.bleuClair, transparency: 30 },
      line: { color: C.bleuAccent },
    });
    slide.addText(info.label, {
      x: 2.3 + i * 2.2, y: 3.28, w: 2.0, h: 0.38,
      fontSize: 8, color: C.bleuAccent, bold: true,
      fontFace: FONT_BODY, align: 'center',
    });
    slide.addText(info.value, {
      x: 2.3 + i * 2.2, y: 3.65, w: 2.0, h: 0.5,
      fontSize: 7.5, color: C.blanc,
      fontFace: 'Courier New', align: 'center', wrap: true,
    });
  });

  slide.addText('INS SIG PLATFORM v1.0  •  Institut National de la Statistique — Tunisie  •  Octobre 2026', {
    x: 0.5, y: 6.4, w: 11.2, h: 0.35,
    fontSize: 9, color: C.blanc, fontFace: FONT_BODY,
    align: 'center',
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SAUVEGARDE
// ══════════════════════════════════════════════════════════════════════════════
const outputPath = 'd:/carto_platform/INS_SIG_Platform_Presentation.pptx';
await pptx.writeFile({ fileName: outputPath });
console.log(`[OK] Présentation générée : ${outputPath}`);
console.log(`[INFO] ${pptx.slides.length} slides créées.`);
