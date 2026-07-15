
export interface AnonymizedCVMetadata {
  experience_years: number | null;
  degree_discipline: 'STEM' | 'Business' | 'Humanities' | 'Other' | null;
  skill_keywords: string[];
}

// ── Month parsing helpers ─────────────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  january: 0, february: 1, march: 2, april: 3, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

function parseMonthYear(str: string, reference: Date): Date | null {
  const s = str.trim().toLowerCase();
  if (s === 'present' || s === 'current' || s === 'now') return reference;

  // "Mon YYYY" or "Month YYYY"
  const m1 = s.match(/^([a-z]+)\.?\s+(\d{4})$/);
  if (m1) {
    const month = MONTH_MAP[m1[1]];
    if (month !== undefined) return new Date(parseInt(m1[2]), month, 1);
  }

  // "YYYY" only
  const m2 = s.match(/^(\d{4})$/);
  if (m2) return new Date(parseInt(m2[1]), 0, 1);

  return null;
}

// ── Rule 1: Experience Years ──────────────────────────────────────────────────
// Extracts all date ranges, sums durations, converts to years.
// Intentionally conservative — returns null rather than guessing.

function extractExperienceYears(text: string): number | null {
  const reference = new Date();

  // Match: (Month? YYYY) [separator] (Month? YYYY | present | current | now)
  // Separators: en dash, em dash, hyphen, "to"
  const rangeRe = /([a-zA-Z]*\.?\s*\d{4})\s*(?:[–—\-]+|\bto\b)\s*(present|current|now|[a-zA-Z]*\.?\s*\d{4})/gi;

  let totalMonths = 0;
  let rangesFound = 0;

  for (const match of text.matchAll(rangeRe)) {
    const start = parseMonthYear(match[1], reference);
    const end   = parseMonthYear(match[2], reference);
    if (!start || !end || end < start) continue;

    const months =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth());

    // Sanity: ignore implausible durations (> 50 years or 0 months)
    if (months <= 0 || months > 600) continue;

    totalMonths += months;
    rangesFound++;
  }

  if (rangesFound === 0) return null;
  return Math.round(totalMonths / 12);
}

// ── Rule 2: Degree Discipline ─────────────────────────────────────────────────
// Searches for degree abbreviations + field of study. Psychology has a special
// sub-classification (STEM vs Other) based on adjacent modifiers.

function extractDegreeDiscipline(
  text: string
): 'STEM' | 'Business' | 'Humanities' | 'Other' | null {

  // Collect text windows around degree keywords for context-aware matching
  const degreeRe =
    /\b(?:bsc|b\.sc|msci|msc|m\.sc|ba|b\.a|ma|m\.a|mba|m\.b\.a|phd|ph\.d|beng|b\.eng|meng|m\.eng|btech|mtech|llb|llm|bba|bcom|hnd|hnc|pgdip|pgce)\b[^\n.!?]{0,100}/gi;

  const windows = [...text.matchAll(degreeRe)].map(m => m[0].toLowerCase());

  // Also check "degree in X" / "studied X" patterns
  const degreeInRe = /(?:degree|studied|studying)\s+(?:in\s+)?([a-z\s&,]{3,60})/gi;
  windows.push(...[...text.matchAll(degreeInRe)].map(m => m[0].toLowerCase()));

  const ctx = windows.join(' ');

  // ── Psychology (special case — classify before other STEM checks) ──
  if (/psychology/.test(ctx) || /psychology/.test(text.toLowerCase().slice(0, 2000))) {
    const stemPsychRe =
      /(?:occupational|organisational|organizational|industrial|work|cognitive|quantitative|experimental)\s*(?:and\s*)?(?:organisational|organizational)?\s*psychology|psychology.*(?:quantitative|statistical\s+methods|spss|r\s+software|r,\s*spss)/i;
    if (stemPsychRe.test(text)) return 'STEM';
    // Loose check on full text for statistical module context
    if (/statistical\s+(?:methods|analysis)|quantitative\s+research/i.test(text)) return 'STEM';
    return 'Other';
  }

  const STEM_KW = [
    'computer science', 'computing', 'software engineering', 'software development',
    'information technology', 'information systems', 'data science', 'data engineering',
    'artificial intelligence', 'machine learning', 'mathematics', 'maths', 'math',
    'statistics', 'statistical', 'physics', 'chemistry', 'biology', 'biochemistry',
    'neuroscience', 'engineering', 'electronics', 'electrical', 'mechanical',
    'civil engineering', 'chemical engineering', 'aerospace',
  ];
  const BUSINESS_KW = [
    'business', 'management', 'finance', 'financial', 'economics', 'economic',
    'marketing', 'accounting', 'accountancy', 'commerce', 'mba',
    'business administration', 'entrepreneurship', 'operations management',
  ];
  const HUMANITIES_KW = [
    'history', 'literature', 'english language', 'languages', 'linguistics',
    'philosophy', 'social science', 'sociology', 'anthropology', 'political science',
    'politics', 'geography', 'media studies', 'journalism', 'film studies',
    'music', 'theatre', 'drama', 'fine art', 'graphic design', 'fashion',
  ];

  // Use the degree context window first; fall back to full text start if empty
  const searchIn = ctx.length > 10 ? ctx : text.toLowerCase().slice(0, 3000);

  for (const kw of STEM_KW)       if (searchIn.includes(kw)) return 'STEM';
  for (const kw of BUSINESS_KW)   if (searchIn.includes(kw)) return 'Business';
  for (const kw of HUMANITIES_KW) if (searchIn.includes(kw)) return 'Humanities';

  return 'Other';
}

// ── Rule 3: Skill Keywords ────────────────────────────────────────────────────
// Matches only against the explicit allowed list. "R" matched with context
// to avoid false positives (e.g., the letter R in ordinary sentences).

const SKILL_PATTERNS: Array<{ display: string; re: RegExp }> = [
  { display: 'microsoft office', re: /\bmicrosoft\s+office\b/i },
  { display: 'excel',            re: /\bexcel\b/i },
  { display: 'powerpoint',       re: /\bpowerpoint\b/i },
  { display: 'word',             re: /\b(?:microsoft\s+word|ms\s+word)\b/i },
  { display: 'outlook',          re: /\boutlook\b/i },
  { display: 'spss',             re: /\bspss\b/i },
  // R: only match "R software / R programming / R statistical / RStudio / R, SPSS / SPSS and R"
  { display: 'r',                re: /\bR\s+(?:programming|software|statistical|studio)\b|\bRStudio\b|\bSPSS\s*(?:and|&|,)\s*R\b|\bR\s*(?:and|&|,)\s*SPSS\b/i },
  { display: 'python',           re: /\bpython\b/i },
  { display: 'stata',            re: /\bstata\b/i },
  { display: 'sas',              re: /\bsas\b/i },
  { display: 'qualtrics',        re: /\bqualtrics\b/i },
  { display: 'surveymonkey',     re: /\bsurvey\s*monkey\b/i },
  { display: 'redcap',           re: /\bredcap\b/i },
  { display: 'zoom',             re: /\bzoom\b/i },
  // Teams: require "Microsoft Teams" or "MS Teams" to avoid matching "team" broadly
  { display: 'teams',            re: /\b(?:microsoft\s+teams|ms\s+teams)\b/i },
  { display: 'slack',            re: /\bslack\b/i },
  { display: 'moodle',           re: /\bmoodle\b/i },
  // Canvas: require VLE/LMS context to avoid matching art/design uses
  { display: 'canvas',           re: /\bcanvas\s+(?:vle|lms|learning)|canvas\b(?=\s*[\(,])/i },
  { display: 'blackboard',       re: /\bblackboard\b/i },
  // SQL: match standalone SQL but not as part of MySQL/PostgreSQL (handled separately)
  { display: 'sql',              re: /(?<![a-zA-Z])SQL(?![a-zA-Z])/  },
  { display: 'mysql',            re: /\bmysql\b/i },
  { display: 'postgresql',       re: /\bpostgresql\b|\bpostgres\b/i },
  { display: 'adobe suite',      re: /\badobe\s+(?:creative\s+suite|suite|cc)\b|\badobe\s+(?:photoshop|illustrator|premiere|indesign|after\s+effects)\b/i },
  { display: 'figma',            re: /\bfigma\b/i },
  { display: 'canva',            re: /\bcanva\b/i },
];

function extractSkillKeywords(text: string): string[] {
  const found: string[] = [];
  for (const { display, re } of SKILL_PATTERNS) {
    if (re.test(text) && !found.includes(display)) {
      found.push(display);
      if (found.length === 10) break;
    }
  }
  return found;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function extractAnonymizedMetadata(cvText: string): AnonymizedCVMetadata {
  return {
    experience_years:   extractExperienceYears(cvText),
    degree_discipline:  extractDegreeDiscipline(cvText),
    skill_keywords:     extractSkillKeywords(cvText),
  };
}
