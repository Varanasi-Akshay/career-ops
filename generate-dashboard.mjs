#!/usr/bin/env node
/**
 * generate-dashboard.mjs - Build a static browser dashboard from local career-ops data.
 *
 * Reads:
 *   - data/applications.md
 *   - data/pipeline.md
 *   - reports/*.md
 *
 * Writes:
 *   - static-dashboard/index.html
 *
 * The generated dashboard embeds personal job-search data, so static-dashboard/
 * is gitignored.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const APPS_FILE = existsSync(join(ROOT, 'data/applications.md'))
  ? join(ROOT, 'data/applications.md')
  : join(ROOT, 'applications.md');
const PIPELINE_FILE = join(ROOT, 'data/pipeline.md');
const REPORTS_DIR = join(ROOT, 'reports');
const OUTPUT_DIR = join(ROOT, 'static-dashboard');
const OUTPUT_FILE = join(OUTPUT_DIR, 'index.html');

const COURSE_CATALOG = [
  {
    skill: 'SQL',
    title: 'Kaggle Learn: Intro to SQL',
    provider: 'Kaggle',
    url: 'https://www.kaggle.com/learn/intro-to-sql',
    focus: 'Querying, joins, grouping, and BigQuery practice',
  },
  {
    skill: 'Advanced SQL',
    title: 'Kaggle Learn: Advanced SQL',
    provider: 'Kaggle',
    url: 'https://www.kaggle.com/learn/advanced-sql',
    focus: 'Analytic functions, nested data, efficient queries',
  },
  {
    skill: 'Python / pandas',
    title: 'Kaggle Learn: Python and Pandas',
    provider: 'Kaggle',
    url: 'https://www.kaggle.com/learn',
    focus: 'Daily data manipulation and notebook fluency',
  },
  {
    skill: 'Machine Learning',
    title: 'Google Machine Learning Crash Course',
    provider: 'Google',
    url: 'https://developers.google.com/machine-learning/crash-course',
    focus: 'Regression, classification, embeddings, LLM basics, production ML',
  },
  {
    skill: 'Applied ML',
    title: 'Microsoft Learn: Create machine learning models',
    provider: 'Microsoft Learn',
    url: 'https://learn.microsoft.com/en-us/training/paths/create-machine-learn-models/',
    focus: 'Train, evaluate, and explain classical ML models',
  },
  {
    skill: 'Deep Learning / PyTorch',
    title: 'fast.ai Practical Deep Learning for Coders',
    provider: 'fast.ai',
    url: 'https://course.fast.ai/',
    focus: 'PyTorch, tabular, NLP, computer vision, deployment',
  },
  {
    skill: 'LLMs / NLP',
    title: 'Hugging Face Course',
    provider: 'Hugging Face',
    url: 'https://huggingface.co/course/chapter1',
    focus: 'Transformers, datasets, tokenizers, and model fine-tuning',
  },
  {
    skill: 'AI Agents',
    title: 'Hugging Face AI Agents Course',
    provider: 'Hugging Face',
    url: 'https://huggingface.co/learn/agents-course/en/unit0/introduction',
    focus: 'Build, evaluate, and share agentic AI systems',
  },
];

const SKILL_PATTERNS = [
  { skill: 'SQL', priority: 5, terms: ['sql', 'query', 'queries', 'database', 'bigquery', 'postgres'] },
  { skill: 'Python / pandas', priority: 5, terms: ['python', 'pandas', 'numpy', 'notebook', 'jupyter'] },
  { skill: 'Machine Learning', priority: 5, terms: ['machine learning', 'ml model', 'classification', 'regression', 'modeling', 'predictive'] },
  { skill: 'MLOps / Production ML', priority: 5, terms: ['mlops', 'production ml', 'model deployment', 'monitoring', 'model registry', 'feature store'] },
  { skill: 'Cloud Data Platforms', priority: 4, terms: ['snowflake', 'databricks', 'aws', 'azure', 'gcp', 'cloud'] },
  { skill: 'Data Engineering', priority: 4, terms: ['pipeline', 'etl', 'data pipeline', 'orchestration', 'airflow', 'dbt'] },
  { skill: 'LLMs / NLP', priority: 4, terms: ['llm', 'large language model', 'nlp', 'transformer', 'rag', 'embedding'] },
  { skill: 'AI Agents', priority: 4, terms: ['agent', 'agentic', 'tool calling', 'workflow automation'] },
  { skill: 'Deep Learning / PyTorch', priority: 3, terms: ['deep learning', 'pytorch', 'tensorflow', 'neural network', 'computer vision'] },
  { skill: 'Experimentation / Causal', priority: 3, terms: ['experiment', 'a/b', 'causal', 'statistics', 'hypothesis'] },
  { skill: 'Healthcare Analytics', priority: 3, terms: ['healthcare', 'medical', 'claims', 'clinical', 'patient'] },
  { skill: 'Communication / Stakeholders', priority: 3, terms: ['stakeholder', 'executive', 'presentation', 'cross-functional', 'business'] },
];

function readIfExists(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function stripMd(raw) {
  return String(raw || '')
    .replace(/\*\*/g, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .trim();
}

function extractMarkdownLink(raw) {
  const text = String(raw || '').trim();
  const match = text.match(/\[([^\]]+)\]\(([^)]+)\)/);
  if (!match) return { label: stripMd(text), href: '' };
  return { label: match[1], href: match[2] };
}

function scoreNumber(raw) {
  const match = String(raw || '').match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function parseTracker() {
  const content = readIfExists(APPS_FILE);
  const entries = [];
  for (const line of content.split('\n')) {
    if (!line.startsWith('|')) continue;
    const parts = line.split('|').map((part) => part.trim());
    if (parts.length < 9) continue;
    const num = Number.parseInt(parts[1], 10);
    if (Number.isNaN(num)) continue;
    const report = extractMarkdownLink(parts[8]);
    entries.push({
      id: String(num).padStart(3, '0'),
      num,
      date: parts[2],
      company: stripMd(parts[3]),
      role: stripMd(parts[4]),
      score: parts[5],
      scoreValue: scoreNumber(parts[5]),
      status: stripMd(parts[6]),
      pdf: stripMd(parts[7]),
      hasPdf: parts[7].includes('✅') || /output\/.*\.pdf/i.test(parts[7]),
      reportLabel: report.label,
      reportPath: report.href,
      notes: stripMd(parts[9] || ''),
    });
  }
  return entries;
}

function parseHeader(content, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = content.match(new RegExp(`^\\*\\*${escaped}:\\*\\*\\s*(.+)$`, 'mi'));
  return match ? stripMd(match[1]) : '';
}

function section(content, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = content.match(new RegExp(`^##\\s+${escaped}[^\n]*\\n([\\s\\S]*?)(?=^##\\s+|$)`, 'm'));
  return match ? match[1].trim() : '';
}

function parseSimpleTable(block) {
  const rows = [];
  for (const line of block.split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    if (/^\|\s*-+/.test(line)) continue;
    const parts = line.split('|').slice(1, -1).map((part) => stripMd(part));
    if (parts.length >= 2) rows.push(parts);
  }
  return rows;
}

function tableValue(rows, key) {
  const found = rows.find((row) => row[0].toLowerCase() === key.toLowerCase());
  return found ? found[1] : '';
}

function parseBullets(block, limit = 5) {
  return block
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^(?:[-*]|\d+\.)\s+/.test(line))
    .map((line) => stripMd(line.replace(/^(?:[-*]|\d+\.)\s+/, '')))
    .slice(0, limit);
}

function parseGaps(content) {
  const match = content.match(/^###\s+Gaps and Mitigation\s*\n([\s\S]*?)(?=^##\s+|^###\s+|$)/m);
  if (!match) return [];
  return parseSimpleTable(match[1])
    .filter((row) => row[0] && row[0].toLowerCase() !== 'gap')
    .map((row) => ({ gap: row[0], blocker: row[1] || '', mitigation: row[2] || '' }));
}

function parseKeywords(content) {
  const block = section(content, 'Keywords extracted');
  return block
    .replace(/\n/g, ' ')
    .split(',')
    .map((item) => stripMd(item).replace(/\.$/, ''))
    .filter(Boolean)
    .slice(0, 24);
}

function parseReportFile(reportPath) {
  const fullPath = join(ROOT, reportPath);
  if (!existsSync(fullPath)) return {};
  const content = readFileSync(fullPath, 'utf8');
  const roleRows = parseSimpleTable(section(content, 'A) Role Summary'));
  const compBlock = section(content, 'D) Comp and Demand');
  const compRead = (compBlock.match(/\*\*Comp read:\*\*\s*([^\n]+)/i) || [])[1] || '';
  const customizationBlock = section(content, 'E) Customization Plan');
  const report = {
    url: parseHeader(content, 'URL'),
    archetype: parseHeader(content, 'Archetype') || tableValue(roleRows, 'Archetype'),
    score: parseHeader(content, 'Score'),
    legitimacy: parseHeader(content, 'Legitimacy'),
    pdfPath: parseHeader(content, 'PDF'),
    location: tableValue(roleRows, 'Location'),
    seniority: tableValue(roleRows, 'Seniority'),
    domain: tableValue(roleRows, 'Domain'),
    function: tableValue(roleRows, 'Function'),
    remote: tableValue(roleRows, 'Remote'),
    tldr: tableValue(roleRows, 'TL;DR'),
    gaps: parseGaps(content),
    compRead: stripMd(compRead),
    cvChanges: parseBullets((customizationBlock.match(/### Top CV Changes\s*\n([\s\S]*?)(?=^###\s+|$)/m) || [])[1] || '', 5),
    linkedinChanges: parseBullets((customizationBlock.match(/### Top LinkedIn Changes\s*\n([\s\S]*?)(?=^##\s+|$)/m) || [])[1] || '', 5),
    keywords: parseKeywords(content),
  };
  return report;
}

function parsePipeline() {
  const content = readIfExists(PIPELINE_FILE);
  const entries = [];
  for (const line of content.split('\n')) {
    const match = line.match(/^-\s+\[\s*]\s+(\S+)(?:\s+\|\s+([^|]+)\s+\|\s+(.+))?$/);
    if (!match) continue;
    entries.push({
      url: match[1],
      company: stripMd(match[2] || 'Unknown'),
      role: stripMd(match[3] || 'Untitled role'),
      status: 'Pending evaluation',
    });
  }
  return entries;
}

function includesTerm(text, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(text);
}

function jobSignalText(job) {
  return [
    job.company,
    job.role,
    job.archetype,
    job.domain,
    job.function,
    job.tldr,
    job.notes,
    job.compRead,
    ...(job.keywords || []),
    ...(job.gaps || []).flatMap((gap) => [gap.gap, gap.mitigation]),
  ].join(' ').toLowerCase();
}

function coursesForSkill(skill) {
  const exact = COURSE_CATALOG.filter((course) => course.skill === skill);
  if (exact.length) return exact;
  if (skill === 'MLOps / Production ML') {
    return COURSE_CATALOG.filter((course) => course.skill === 'Machine Learning' || course.skill === 'Applied ML');
  }
  if (skill === 'Cloud Data Platforms' || skill === 'Data Engineering') {
    return COURSE_CATALOG.filter((course) => course.skill === 'Advanced SQL' || course.skill === 'Python / pandas');
  }
  if (skill === 'Healthcare Analytics') {
    return COURSE_CATALOG.filter((course) => course.skill === 'SQL' || course.skill === 'Machine Learning');
  }
  return COURSE_CATALOG.filter((course) => course.skill === 'Machine Learning').slice(0, 1);
}

function inferMarketInsights(jobs) {
  const total = Math.max(jobs.length, 1);
  return SKILL_PATTERNS.map((pattern) => {
    const matchedJobs = jobs.filter((job) => {
      const text = jobSignalText(job);
      return pattern.terms.some((term) => includesTerm(text, term));
    });
    const evaluatedMatches = matchedJobs.filter((job) => job.kind === 'evaluated').length;
    const demand = matchedJobs.length;
    return {
      skill: pattern.skill,
      demand,
      coverage: Math.round((demand / total) * 100),
      priority: pattern.priority,
      evidence: matchedJobs.slice(0, 5).map((job) => `${job.company}: ${job.role}`),
      evaluatedMatches,
      courses: coursesForSkill(pattern.skill),
    };
  })
    .filter((item) => item.demand > 0)
    .sort((a, b) => (b.demand * b.priority + b.evaluatedMatches) - (a.demand * a.priority + a.evaluatedMatches));
}

function careerActions(insights) {
  const top = insights.slice(0, 4).map((item) => item.skill);
  return [
    {
      title: 'Prioritize high-signal applications',
      detail: 'Apply first to evaluated roles with score 4.0+ and a strong PDF, then work through pending roles that match the same skill cluster.',
    },
    {
      title: 'Turn gaps into weekly proof',
      detail: top.length
        ? `This week, create one portfolio artifact that touches ${top.join(', ')}. Keep it small enough to finish.`
        : 'This week, create one portfolio artifact tied to the strongest repeated job requirement you see.',
    },
    {
      title: 'Track outcomes, not effort',
      detail: 'Use the dashboard status buttons for interested, applying, applied, interviewing, and skipped so the next action is always visible.',
    },
  ];
}

function loadData() {
  const apps = parseTracker().map((app) => ({ ...app, ...parseReportFile(app.reportPath), kind: 'evaluated' }));
  const evaluatedKeys = new Set(apps.map((app) => `${app.company.toLowerCase()}::${app.role.toLowerCase()}`));
  const pending = parsePipeline()
    .filter((job) => !evaluatedKeys.has(`${job.company.toLowerCase()}::${job.role.toLowerCase()}`))
    .map((job) => ({ ...job, kind: 'pending' }));
  const insights = inferMarketInsights([...apps, ...pending]);
  return {
    generatedAt: new Date().toISOString(),
    applications: apps,
    pending,
    insights,
    careerActions: careerActions(insights),
    courses: COURSE_CATALOG,
  };
}

function assetHref(path) {
  if (!path) return '';
  return '../' + path.replace(/^\.?\//, '');
}

function html(data) {
  const payload = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Career-Ops Dashboard</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7f9;
      --panel: #ffffff;
      --ink: #17202a;
      --muted: #5f6b7a;
      --line: #dfe4ea;
      --teal: #087f8c;
      --plum: #6c4ab6;
      --amber: #a66a00;
      --green: #237a45;
      --red: #b42318;
      --shadow: 0 10px 28px rgba(16, 24, 40, 0.08);
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    a { color: var(--teal); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .shell { min-height: 100vh; display: grid; grid-template-rows: auto 1fr; }
    header {
      background: #ffffff;
      border-bottom: 1px solid var(--line);
      padding: 18px 24px 14px;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .topline { display: flex; gap: 16px; justify-content: space-between; align-items: flex-start; }
    h1 { font-size: 22px; line-height: 1.15; margin: 0 0 4px; letter-spacing: 0; }
    .subtle { color: var(--muted); font-size: 13px; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .button {
      display: inline-flex; align-items: center; gap: 6px;
      border: 1px solid var(--line); background: #fff; color: var(--ink);
      padding: 7px 10px; border-radius: 6px; font-weight: 600; font-size: 13px;
      cursor: pointer;
    }
    .button.primary { background: var(--ink); color: #fff; border-color: var(--ink); }
    .button.good { background: var(--green); color: #fff; border-color: var(--green); }
    .button.warn { background: var(--amber); color: #fff; border-color: var(--amber); }
    .layout {
      display: grid;
      grid-template-columns: minmax(320px, 32%) minmax(0, 1fr) minmax(300px, 24%);
      gap: 16px;
      padding: 16px;
      max-width: 1680px;
      width: 100%;
      margin: 0 auto;
    }
    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: var(--shadow);
      min-width: 0;
    }
    .metrics { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; padding: 12px; }
    .metric { border: 1px solid var(--line); border-radius: 6px; padding: 10px; background: #fbfcfd; min-width: 0; }
    .metric strong { display: block; font-size: 20px; }
    .metric span { color: var(--muted); font-size: 12px; }
    .toolbar { display: grid; grid-template-columns: 1fr auto; gap: 10px; padding: 12px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
    input, select {
      width: 100%; border: 1px solid var(--line); border-radius: 6px;
      padding: 8px 10px; font: inherit; background: #fff; color: var(--ink);
    }
    .tabs { display: flex; gap: 6px; padding: 10px 12px 0; flex-wrap: wrap; }
    .tab {
      border: 1px solid var(--line); background: #fff; border-radius: 6px;
      padding: 6px 9px; font-weight: 600; color: var(--muted); cursor: pointer;
    }
    .tab.active { color: #fff; background: var(--teal); border-color: var(--teal); }
    .list { max-height: calc(100vh - 250px); overflow: auto; padding: 8px; }
    .job {
      width: 100%; text-align: left; border: 1px solid var(--line); background: #fff;
      border-radius: 6px; padding: 10px; margin-bottom: 8px; cursor: pointer;
    }
    .job.active { border-color: var(--teal); box-shadow: 0 0 0 2px rgba(8,127,140,0.12); }
    .job-head { display: flex; gap: 8px; justify-content: space-between; align-items: flex-start; }
    .company { font-weight: 700; }
    .role { color: var(--muted); margin-top: 2px; }
    .chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
    .chip { border-radius: 999px; padding: 2px 7px; background: #eef2f6; color: #364152; font-size: 12px; white-space: nowrap; }
    .chip.green { background: #e7f6ec; color: var(--green); }
    .chip.amber { background: #fff4dc; color: var(--amber); }
    .chip.red { background: #ffebe8; color: var(--red); }
    .chip.plum { background: #f0ecff; color: var(--plum); }
    .score { font-weight: 800; font-size: 18px; white-space: nowrap; }
    .detail { padding: 16px; min-height: calc(100vh - 118px); }
    .detail h2 { margin: 0; font-size: 22px; line-height: 1.2; letter-spacing: 0; }
    .detail h3 { margin: 22px 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--teal); }
    .detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 12px; }
    .coach { padding: 14px; align-self: start; position: sticky; top: 88px; max-height: calc(100vh - 104px); overflow: auto; }
    .coach h2 { margin: 0 0 8px; font-size: 18px; letter-spacing: 0; }
    .coach h3 { margin: 18px 0 8px; font-size: 13px; color: var(--teal); text-transform: uppercase; letter-spacing: 0.04em; }
    .fact { border: 1px solid var(--line); border-radius: 6px; padding: 9px; background: #fbfcfd; }
    .fact label { display: block; color: var(--muted); font-size: 12px; margin-bottom: 2px; }
    .fact div { font-weight: 600; }
    .note { padding: 10px 12px; border-left: 3px solid var(--teal); background: #eefafa; border-radius: 0 6px 6px 0; color: #22313f; }
    .split { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .status-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
    .status-row .button { justify-content: center; min-height: 36px; }
    .textarea {
      width: 100%; min-height: 84px; resize: vertical; border: 1px solid var(--line);
      border-radius: 6px; padding: 9px; font: inherit; margin-top: 8px;
    }
    .skill-card { border: 1px solid var(--line); border-radius: 8px; padding: 10px; margin-bottom: 10px; background: #fff; }
    .skill-top { display: flex; justify-content: space-between; gap: 8px; align-items: flex-start; }
    .skill-name { font-weight: 800; }
    .bar { height: 7px; border-radius: 999px; background: #edf1f5; overflow: hidden; margin: 8px 0; }
    .bar span { display: block; height: 100%; background: var(--teal); }
    .course { display: block; margin-top: 6px; font-weight: 650; }
    .progress-toggle { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 8px; }
    .progress-toggle button { border: 1px solid var(--line); background: #fff; border-radius: 6px; padding: 6px; font-size: 12px; }
    .progress-toggle button.active { background: var(--ink); color: #fff; border-color: var(--ink); }
    .footer-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
    .sync-row { display: grid; grid-template-columns: 1fr auto auto; gap: 8px; margin-top: 10px; }
    .sync-status { margin-top: 8px; min-height: 18px; }
    ul.clean { padding-left: 18px; margin: 8px 0 0; }
    ul.clean li { margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border-bottom: 1px solid var(--line); padding: 8px; text-align: left; vertical-align: top; }
    th { color: var(--muted); font-size: 12px; font-weight: 700; }
    .empty { color: var(--muted); padding: 32px; text-align: center; }
    code { background: #eef2f6; border-radius: 4px; padding: 1px 4px; }
    @media (max-width: 980px) {
      .layout { grid-template-columns: 1fr; }
      .metrics { grid-template-columns: repeat(2, 1fr); }
      .list { max-height: none; }
      .split, .detail-grid { grid-template-columns: 1fr; }
      .coach { position: static; max-height: none; }
      .topline { display: block; }
      .actions { justify-content: flex-start; margin-top: 12px; }
      .status-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .sync-row { grid-template-columns: 1fr; }
      header { padding: 14px 16px 12px; }
      .layout { padding: 10px; gap: 10px; }
    }
    @media (max-width: 560px) {
      h1 { font-size: 19px; }
      .toolbar { grid-template-columns: 1fr; }
      .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .status-row, .progress-toggle { grid-template-columns: 1fr; }
      .button { width: 100%; justify-content: center; }
      .actions { width: 100%; }
    }
  </style>
</head>
<body>
<div class="shell">
  <header>
    <div class="topline">
      <div>
        <h1>Career-Ops Dashboard</h1>
        <div class="subtle" id="generatedAt"></div>
      </div>
      <div class="actions">
        <a class="button" href="../data/applications.md">Tracker</a>
        <a class="button" href="../data/pipeline.md">Pipeline</a>
        <button class="button" id="exportProgress" type="button">Export Progress</button>
        <label class="button" for="importProgress">Import</label>
        <input id="importProgress" type="file" accept="application/json" style="display:none">
        <a class="button primary" id="selectedReport" href="#">Open Report</a>
      </div>
    </div>
  </header>
  <main class="layout">
    <section class="panel">
      <div class="metrics" id="metrics"></div>
      <div class="tabs" id="tabs"></div>
      <div class="toolbar">
        <input id="search" type="search" placeholder="Search company, role, keyword, note">
        <select id="sort">
          <option value="score-desc">Score high to low</option>
          <option value="date-desc">Newest first</option>
          <option value="pending-first">Pending first</option>
          <option value="company">Company A-Z</option>
        </select>
      </div>
      <div class="list" id="jobList"></div>
    </section>
    <section class="panel detail" id="detail"></section>
    <aside class="panel coach" id="coach"></aside>
  </main>
</div>
<script>
const DATA = ${payload};
const assetHref = ${assetHref.toString()};
const state = { tab: 'all', query: '', sort: 'score-desc', selectedKey: null };
const STORE_KEY = 'careerOpsDashboardState:v2';
const SYNC_URL_KEY = 'careerOpsDashboardSyncUrl:v1';
const USER = loadUserState();
let driveSyncUrl = localStorage.getItem(SYNC_URL_KEY) || '';

function loadUserState() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || { jobs: {}, skills: {}, updatedAt: null };
  } catch (error) {
    return { jobs: {}, skills: {}, updatedAt: null };
  }
}

function saveUserState() {
  USER.updatedAt = new Date().toISOString();
  localStorage.setItem(STORE_KEY, JSON.stringify(USER));
}

function mergeUserState(incoming) {
  USER.jobs = { ...USER.jobs, ...(incoming.jobs || {}) };
  USER.skills = { ...USER.skills, ...(incoming.skills || {}) };
  USER.updatedAt = incoming.updatedAt || new Date().toISOString();
  saveUserState();
}

function isAllowedDriveSyncUrl(rawUrl) {
  try {
    const url = new URL(String(rawUrl || '').trim());
    return url.protocol === 'https:' && ['script.google.com', 'script.googleusercontent.com'].includes(url.hostname);
  } catch (error) {
    return false;
  }
}

function syncUrl() {
  return String(driveSyncUrl || '').trim();
}

function setSyncMessage(message, tone = '') {
  const element = document.getElementById('syncStatus');
  if (!element) return;
  element.textContent = message;
  element.style.color = tone === 'error' ? 'var(--red)' : tone === 'ok' ? 'var(--green)' : 'var(--muted)';
}

function saveDriveSyncUrl(value) {
  driveSyncUrl = String(value || '').trim();
  localStorage.setItem(SYNC_URL_KEY, driveSyncUrl);
}

function jobLocal(job) {
  if (!USER.jobs[job.key]) USER.jobs[job.key] = { status: '', note: '', updatedAt: null };
  return USER.jobs[job.key];
}

function setJobStatus(key, status) {
  if (!USER.jobs[key]) USER.jobs[key] = { status: '', note: '', updatedAt: null };
  USER.jobs[key].status = status;
  USER.jobs[key].updatedAt = new Date().toISOString();
  saveUserState();
  render();
}

function setJobNote(key, note) {
  if (!USER.jobs[key]) USER.jobs[key] = { status: '', note: '', updatedAt: null };
  USER.jobs[key].note = note;
  USER.jobs[key].updatedAt = new Date().toISOString();
  saveUserState();
}

function setSkillProgress(skill, progress) {
  USER.skills[skill] = { progress, updatedAt: new Date().toISOString() };
  saveUserState();
  renderCoach();
}

function loadDriveProgress() {
  const url = syncUrl();
  if (!isAllowedDriveSyncUrl(url)) {
    setSyncMessage('Use an https://script.google.com/... Web App URL.', 'error');
    return;
  }
  const callback = 'careerOpsDriveLoad' + Date.now();
  const script = document.createElement('script');
  window[callback] = (payload) => {
    mergeUserState(payload || {});
    setSyncMessage('Loaded progress from Drive.', 'ok');
    delete window[callback];
    script.remove();
    render();
  };
  script.onerror = () => {
    setSyncMessage('Could not load Drive progress. Check deployment access.', 'error');
    delete window[callback];
    script.remove();
  };
  script.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + encodeURIComponent(callback) + '&t=' + Date.now();
  document.body.appendChild(script);
}

async function saveDriveProgress() {
  const url = syncUrl();
  if (!isAllowedDriveSyncUrl(url)) {
    setSyncMessage('Use an https://script.google.com/... Web App URL.', 'error');
    return;
  }
  setSyncMessage('Saving to Drive...');
  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'content-type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(USER),
    });
    setSyncMessage('Saved to Drive.', 'ok');
  } catch (error) {
    setSyncMessage('Save failed. Check the Web App URL and network.', 'error');
  }
}

function scoreClass(score) {
  if (score == null) return 'plum';
  if (score >= 4.3) return 'green';
  if (score >= 3.7) return 'amber';
  return 'red';
}

function allJobs() {
  return [
    ...DATA.applications.map((job) => {
      const withKey = { ...job, kind: 'evaluated', key: 'e-' + job.id };
      return { ...withKey, local: jobLocal(withKey) };
    }),
    ...DATA.pending.map((job, index) => {
      const withKey = { ...job, kind: 'pending', key: 'p-' + index, scoreValue: null, score: 'Pending' };
      return { ...withKey, local: jobLocal(withKey) };
    }),
  ];
}

function filteredJobs() {
  const q = state.query.toLowerCase();
  let jobs = allJobs().filter((job) => {
    if (state.tab === 'evaluated' && job.kind !== 'evaluated') return false;
    if (state.tab === 'pending' && job.kind !== 'pending') return false;
    if (state.tab === 'strong' && !(job.scoreValue >= 4.0)) return false;
    if (state.tab === 'hasPdf' && !job.hasPdf) return false;
    if (state.tab === 'applied' && job.local.status !== 'Applied') return false;
    if (state.tab === 'active' && !['Interested', 'Applying', 'Applied', 'Interviewing'].includes(job.local.status)) return false;
    if (!q) return true;
    return [job.company, job.role, job.notes, job.archetype, job.tldr, job.local.note, job.local.status, ...(job.keywords || [])].join(' ').toLowerCase().includes(q);
  });
  jobs.sort((a, b) => {
    if (state.sort === 'date-desc') return String(b.date || '').localeCompare(String(a.date || ''));
    if (state.sort === 'pending-first') return (a.kind === 'pending' ? -1 : 1) - (b.kind === 'pending' ? -1 : 1);
    if (state.sort === 'company') return String(a.company).localeCompare(String(b.company));
    return (b.scoreValue ?? -1) - (a.scoreValue ?? -1);
  });
  return jobs;
}

function renderMetrics() {
  const apps = DATA.applications;
  const avg = apps.length ? (apps.reduce((sum, app) => sum + (app.scoreValue || 0), 0) / apps.length).toFixed(1) : '0.0';
  const strong = apps.filter((app) => app.scoreValue >= 4).length;
  const jobs = allJobs();
  const applied = jobs.filter((job) => job.local.status === 'Applied').length;
  const active = jobs.filter((job) => ['Interested', 'Applying', 'Applied', 'Interviewing'].includes(job.local.status)).length;
  const items = [
    ['Evaluated', apps.length],
    ['Pending', DATA.pending.length],
    ['Avg score', avg + '/5'],
    ['Strong fits', strong],
    ['Active', active],
    ['Applied', applied],
  ];
  document.getElementById('metrics').innerHTML = items.map(([label, value]) => '<div class="metric"><strong>' + value + '</strong><span>' + label + '</span></div>').join('');
}

function renderTabs() {
  const tabs = [
    ['all', 'All'],
    ['evaluated', 'Evaluated'],
    ['strong', 'Score 4+'],
    ['hasPdf', 'Has PDF'],
    ['active', 'Active'],
    ['applied', 'Applied'],
    ['pending', 'Pending'],
  ];
  document.getElementById('tabs').innerHTML = tabs.map(([id, label]) =>
    '<button class="tab ' + (state.tab === id ? 'active' : '') + '" data-tab="' + id + '">' + label + '</button>'
  ).join('');
}

function renderList() {
  const jobs = filteredJobs();
  if (!state.selectedKey && jobs.length) state.selectedKey = jobs[0].key;
  if (jobs.length && !jobs.some((job) => job.key === state.selectedKey)) state.selectedKey = jobs[0].key;
  document.getElementById('jobList').innerHTML = jobs.length ? jobs.map((job) => {
    const pending = job.kind === 'pending';
    const score = pending ? 'Pending' : job.score;
    return '<button class="job ' + (state.selectedKey === job.key ? 'active' : '') + '" data-key="' + job.key + '">' +
      '<div class="job-head"><div><div class="company">' + escapeHtml(job.company) + '</div><div class="role">' + escapeHtml(job.role) + '</div></div><div class="score">' + escapeHtml(score) + '</div></div>' +
      '<div class="chips">' +
      '<span class="chip ' + (pending ? 'plum' : scoreClass(job.scoreValue)) + '">' + (pending ? 'Needs eval' : escapeHtml(job.status || 'Evaluated')) + '</span>' +
      (job.local.status ? '<span class="chip green">' + escapeHtml(job.local.status) + '</span>' : '') +
      (job.legitimacy ? '<span class="chip green">' + escapeHtml(job.legitimacy) + '</span>' : '') +
      (job.hasPdf ? '<span class="chip green">PDF</span>' : '') +
      (job.archetype ? '<span class="chip plum">' + escapeHtml(job.archetype.split('/')[0].trim()) + '</span>' : '') +
      '</div>' +
    '</button>';
  }).join('') : '<div class="empty">No jobs match this view.</div>';
  renderDetail();
}

function renderDetail() {
  const job = allJobs().find((item) => item.key === state.selectedKey);
  const detail = document.getElementById('detail');
  const reportButton = document.getElementById('selectedReport');
  if (!job) {
    detail.innerHTML = '<div class="empty">Select a job to review details.</div>';
    reportButton.removeAttribute('href');
    return;
  }
  const local = job.local || { status: '', note: '' };
  const statusControls = controlsForJob(job);
  if (job.kind === 'pending') {
    reportButton.href = job.url;
    detail.innerHTML = '<h2>' + escapeHtml(job.company) + '</h2><div class="subtle">' + escapeHtml(job.role) + '</div>' +
      '<div class="chips" style="margin-top:10px"><span class="chip plum">Pending evaluation</span>' + (local.status ? '<span class="chip green">' + escapeHtml(local.status) + '</span>' : '') + '</div>' +
      '<h3>Apply / Decide</h3>' + statusControls +
      '<h3>Next Action</h3><div class="note">Open the job post to apply, or run <code>/career-ops ' + escapeHtml(job.url) + '</code> to generate score, report, and tailored PDF before applying.</div>' +
      '<div class="actions" style="justify-content:flex-start;margin-top:12px"><a class="button primary" href="' + escapeAttr(job.url) + '" target="_blank" rel="noreferrer">Apply / View Post</a><button class="button" data-copy="' + escapeAttr('/career-ops ' + job.url) + '">Copy Eval Command</button></div>' +
      noteEditor(job);
    return;
  }
  reportButton.href = assetHref(job.reportPath);
  const pdfLink = job.pdfPath ? '<a class="button" href="' + escapeAttr(assetHref(job.pdfPath)) + '">Open PDF</a>' : '';
  const reportLink = job.reportPath ? '<a class="button" href="' + escapeAttr(assetHref(job.reportPath)) + '">Open Report</a>' : '';
  detail.innerHTML = '<h2>' + escapeHtml(job.company) + '</h2><div class="subtle">' + escapeHtml(job.role) + '</div>' +
    '<div class="chips" style="margin-top:10px"><span class="chip ' + scoreClass(job.scoreValue) + '">Score ' + escapeHtml(job.score) + '</span><span class="chip green">' + escapeHtml(job.legitimacy || 'Legitimacy unknown') + '</span><span class="chip plum">' + escapeHtml(local.status || job.status || 'Evaluated') + '</span></div>' +
    '<h3>Apply / Decide</h3>' + statusControls +
    '<div class="actions" style="justify-content:flex-start;margin-top:12px">' + (job.url ? '<a class="button primary" href="' + escapeAttr(job.url) + '" target="_blank" rel="noreferrer">Apply / View Post</a>' : '') + reportLink + pdfLink + '</div>' +
    '<h3>Quick Read</h3><div class="note">' + escapeHtml(job.tldr || job.notes || 'No TL;DR extracted yet.') + '</div>' +
    '<div class="detail-grid">' +
      fact('Archetype', job.archetype) + fact('Domain', job.domain) + fact('Seniority', job.seniority) + fact('Remote', job.remote || job.location) +
    '</div>' +
    '<h3>Comp Read</h3><p>' + escapeHtml(job.compRead || 'No comp read extracted.') + '</p>' +
    '<div class="split"><div><h3>CV Moves</h3>' + list(job.cvChanges) + '</div><div><h3>LinkedIn Moves</h3>' + list(job.linkedinChanges) + '</div></div>' +
    '<h3>Gaps and Mitigation</h3>' + gapsTable(job.gaps) +
    '<h3>Keywords</h3><div class="chips">' + (job.keywords || []).map((keyword) => '<span class="chip">' + escapeHtml(keyword) + '</span>').join('') + '</div>' +
    noteEditor(job);
}

function controlsForJob(job) {
  const statuses = ['Interested', 'Applying', 'Applied', 'Interviewing', 'Skipped', 'No'];
  return '<div class="status-row">' + statuses.map((status) => {
    const cls = job.local.status === status ? 'button good' : 'button';
    return '<button class="' + cls + '" data-status="' + escapeAttr(status) + '" data-key="' + escapeAttr(job.key) + '">' + escapeHtml(status) + '</button>';
  }).join('') + '</div>';
}

function noteEditor(job) {
  return '<h3>Private Notes</h3><textarea class="textarea" data-note-key="' + escapeAttr(job.key) + '" placeholder="Add follow-up notes, recruiter names, interview dates, or why this role matters.">' + escapeHtml(job.local.note || '') + '</textarea>';
}

function fact(label, value) {
  return '<div class="fact"><label>' + escapeHtml(label) + '</label><div>' + escapeHtml(value || 'Not specified') + '</div></div>';
}

function list(items) {
  if (!items || !items.length) return '<p class="subtle">No items extracted.</p>';
  return '<ul class="clean">' + items.map((item) => '<li>' + escapeHtml(item) + '</li>').join('') + '</ul>';
}

function gapsTable(gaps) {
  if (!gaps || !gaps.length) return '<p class="subtle">No gaps extracted.</p>';
  return '<table><thead><tr><th>Gap</th><th>Blocker?</th><th>Mitigation</th></tr></thead><tbody>' +
    gaps.map((gap) => '<tr><td>' + escapeHtml(gap.gap) + '</td><td>' + escapeHtml(gap.blocker) + '</td><td>' + escapeHtml(gap.mitigation) + '</td></tr>').join('') +
    '</tbody></table>';
}

function renderCoach() {
  const coach = document.getElementById('coach');
  const skills = DATA.insights || [];
  const actions = DATA.careerActions || [];
  const topSkills = skills.slice(0, 6).map((item) => skillCard(item)).join('');
  coach.innerHTML = '<h2>Career Coach</h2>' +
    '<div class="note">Skill demand is inferred from your local pipeline, evaluated reports, and extracted report keywords. As you evaluate more jobs, this gets sharper.</div>' +
    '<h3>Drive Sync</h3>' +
    '<div class="sync-row"><input id="driveSyncUrl" type="url" placeholder="Google Apps Script Web App URL" value="' + escapeAttr(driveSyncUrl) + '"><button class="button" id="loadDrive" type="button">Load Drive</button><button class="button good" id="saveDrive" type="button">Save Drive</button></div>' +
    '<div class="subtle sync-status" id="syncStatus">Only https://script.google.com URLs are accepted.</div>' +
    '<h3>Market Signals</h3>' + (topSkills || '<p class="subtle">No repeated skills found yet. Evaluate more jobs to build the signal.</p>') +
    '<h3>Next Moves</h3><ul class="clean">' + actions.map((item) => '<li><strong>' + escapeHtml(item.title) + ':</strong> ' + escapeHtml(item.detail) + '</li>').join('') + '</ul>' +
    '<h3>Portable Progress</h3><p class="subtle">Status, notes, and learning progress are saved in this browser. Export the JSON into your synced folder when you want to move it to mobile or another computer.</p>';
}

function skillCard(item) {
  const saved = USER.skills[item.skill] || { progress: 'Plan' };
  const courses = (item.courses || []).slice(0, 2).map((course) =>
    '<a class="course" href="' + escapeAttr(course.url) + '" target="_blank" rel="noreferrer">' + escapeHtml(course.title) + '</a><div class="subtle">' + escapeHtml(course.provider + ' - ' + course.focus) + '</div>'
  ).join('');
  return '<div class="skill-card">' +
    '<div class="skill-top"><div><div class="skill-name">' + escapeHtml(item.skill) + '</div><div class="subtle">' + item.demand + ' matching jobs - ' + item.coverage + '% of current list</div></div><span class="chip ' + (item.coverage >= 20 ? 'green' : 'amber') + '">Priority</span></div>' +
    '<div class="bar"><span style="width:' + Math.min(100, Math.max(8, item.coverage)) + '%"></span></div>' +
    '<div class="subtle">Seen in: ' + escapeHtml((item.evidence || []).slice(0, 2).join('; ') || 'current reports') + '</div>' +
    courses +
    '<div class="progress-toggle">' + ['Plan', 'Doing', 'Done'].map((progress) =>
      '<button class="' + (saved.progress === progress ? 'active' : '') + '" data-skill="' + escapeAttr(item.skill) + '" data-progress="' + progress + '">' + progress + '</button>'
    ).join('') + '</div>' +
  '</div>';
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/[\x60]/g, '&#96;');
}

function render() {
  document.getElementById('generatedAt').textContent = 'Generated ' + new Date(DATA.generatedAt).toLocaleString() + ' from local tracker, reports, and pipeline.';
  renderMetrics();
  renderTabs();
  renderList();
  renderCoach();
}

document.getElementById('search').addEventListener('input', (event) => { state.query = event.target.value; renderList(); });
document.getElementById('sort').addEventListener('change', (event) => { state.sort = event.target.value; renderList(); });
document.getElementById('tabs').addEventListener('click', (event) => {
  const tab = event.target.closest('[data-tab]');
  if (!tab) return;
  state.tab = tab.dataset.tab;
  state.selectedKey = null;
  renderTabs();
  renderList();
});
document.getElementById('jobList').addEventListener('click', (event) => {
  const item = event.target.closest('[data-key]');
  if (!item) return;
  state.selectedKey = item.dataset.key;
  renderList();
});
document.getElementById('detail').addEventListener('click', async (event) => {
  const statusButton = event.target.closest('[data-status]');
  if (statusButton) {
    setJobStatus(statusButton.dataset.key, statusButton.dataset.status);
    return;
  }
  const copyButton = event.target.closest('[data-copy]');
  if (copyButton) {
    try {
      await navigator.clipboard.writeText(copyButton.dataset.copy);
      copyButton.textContent = 'Copied';
    } catch (error) {
      copyButton.textContent = 'Copy failed';
    }
  }
});
document.getElementById('detail').addEventListener('input', (event) => {
  const note = event.target.closest('[data-note-key]');
  if (!note) return;
  setJobNote(note.dataset.noteKey, note.value);
  renderMetrics();
});
document.getElementById('coach').addEventListener('click', (event) => {
  const loadDrive = event.target.closest('#loadDrive');
  if (loadDrive) {
    loadDriveProgress();
    return;
  }
  const saveDrive = event.target.closest('#saveDrive');
  if (saveDrive) {
    saveDriveProgress();
    return;
  }
  const progress = event.target.closest('[data-skill]');
  if (!progress) return;
  setSkillProgress(progress.dataset.skill, progress.dataset.progress);
});
document.getElementById('coach').addEventListener('input', (event) => {
  if (event.target.id !== 'driveSyncUrl') return;
  saveDriveSyncUrl(event.target.value);
  setSyncMessage(isAllowedDriveSyncUrl(event.target.value)
    ? 'Drive sync URL saved in this browser.'
    : 'Use an https://script.google.com/... Web App URL.',
    isAllowedDriveSyncUrl(event.target.value) ? 'ok' : 'error');
});
document.getElementById('exportProgress').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(USER, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'career-ops-dashboard-progress.json';
  link.click();
  URL.revokeObjectURL(url);
});
document.getElementById('importProgress').addEventListener('change', async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const imported = JSON.parse(await file.text());
  USER.jobs = imported.jobs || {};
  USER.skills = imported.skills || {};
  USER.updatedAt = imported.updatedAt || new Date().toISOString();
  saveUserState();
  render();
});
render();
</script>
</body>
</html>`;
}

mkdirSync(OUTPUT_DIR, { recursive: true });
const data = loadData();
writeFileSync(OUTPUT_FILE, html(data));
console.log(`Static dashboard written to ${relative(ROOT, OUTPUT_FILE)}`);
console.log(`Evaluated: ${data.applications.length} | Pending: ${data.pending.length}`);
