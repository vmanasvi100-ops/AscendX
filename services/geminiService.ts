
import { GoogleGenAI, Type, Chat } from "@google/genai";
import { RubricCriterion, AuditResult } from "../types";

/**
 * NUCLEAR SANITIZATION PROTOCOL (NSP) v11.0
 * Converts ephemeral Job IDs into Permanent Pipeline Hubs.
 * Strips [1], (2) AI noise and resolves Google Redirects.
 */
export const sanitizeUrl = (url: string) => {
  if (!url) return '';
  let clean = url.trim().split(/\s+/)[0];

  // Resolve Google Redirects
  if (clean.includes('google.com/url?q=')) {
    try {
      const urlObj = new URL(clean);
      const param = urlObj.searchParams.get('q');
      if (param) clean = param;
    } catch (e) { }
  }

  // Prune ATS deep-links to land on ROOT Careers Pages
  const atsPattern = /(boards\.greenhouse\.io|jobs\.lever\.co|workdayjobs\.com|smartrecruiters\.com|workable\.com|myworkdayjobs\.com)/i;
  const deepJobPattern = /(\/jobs\/\d+)|(\/j\/[A-Z0-9]+)|(\/view\/\d+)|(\/inst\/\w+)/i;

  if (atsPattern.test(clean)) {
    clean = clean.split('?')[0];
    clean = clean.replace(deepJobPattern, '');
  }

  clean = clean.replace(/[\[\(][^\]\)]*[\]\)]+$/g, '');
  clean = clean.replace(/[.,!;:)\]]+$/, '');
  clean = clean.replace(/[\[\]\(\)]/g, '');

  if (clean && !clean.startsWith('http')) {
    clean = 'https://' + clean;
  }

  return clean.trim();
};

export const isOfficialDomain = (url: string, company: string) => {
  if (!url || !company) return false;
  const domain = url.toLowerCase();
  const aggregators = /linkedin\.com|indeed\.com|glassdoor\.com|monster\.com|careerbuilder\.com|ziprecruiter\.com/i;
  if (aggregators.test(domain)) return false;
  // Focus on career-path identifiers rather than specific TLDs
  return domain.includes('/careers') || domain.includes('/jobs') || domain.includes('/join') || domain.includes('/opportunities');
};

const PDP_SCOUT_INSTRUCTION = (role: string, anchor: string) => `SYSTEM: You are the 'Asycend.int' Primary Domain Scout. 
Find 25-30 Companies that are high-relevance leaders for the role: ${role}. 
ANCHOR: ${anchor}
CRITICAL: Bypass all aggregators (LinkedIn, Indeed, etc.). We need the DIRECT official career portal for the most relevant companies.
GOAL: Identify the official company.com/careers primary career hub URL and the specific job title they use for this role.
VERIFICATION: Ensure the company is an actual industry leader or high-growth specialized firm for this specific domain.`;

export const analyzeResume = async (
  content: string | { data: string; mimeType: string },
  criteria: RubricCriterion[],
  targetRole: string,
  jobDescription: string,
  companyName: string,
  deepThink: boolean
): Promise<AuditResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const contentPart = typeof content === 'string'
    ? { text: `CV:\n${content}` }
    : { inlineData: { data: content.data, mimeType: content.mimeType } };

  const systemPrompt = `You are AscendX, an expert occupational psychologist and career coach.
Analyse the candidate's CV against the target role and generate a structured
coherence audit. Return JSON only — no preamble, no markdown.

CV CONTENT: ${contentPart.text || 'Provided'}
TARGET ROLE: ${targetRole}
COMPANY: ${companyName}
JOB DESCRIPTION: ${jobDescription}

═══════════════════════════════════════════════════════════════════
ANALYSIS TASKS
═══════════════════════════════════════════════════════════════════

1. ALIGNMENT SCORE
   roleAlignmentScore: 0–100
   alignmentSummary: 2 sentences. What makes this candidate competitive
   for this specific role? What is the primary gap?

2. KEYWORD AUDIT
   Present in CV and JD: string[]  // keywords appearing in both
   In JD but missing from CV: string[]  // gaps to target in session
   Candidate vocabulary strengths: string[]  // strong terminology to leverage

3. STAR EVIDENCE PRE-ASSESSMENT
   For each main role listed in CV, assess:
   starEvidenceQuality: {
     roleTitle: string,
     situation: 'evidenced' | 'partial' | 'implied' | 'missing',
     task: 'evidenced' | 'partial' | 'implied' | 'missing',
     action: 'evidenced' | 'partial' | 'implied' | 'missing',
     result: 'evidenced' | 'partial' | 'implied' | 'missing'
   }[]

4. COHERENCE FLAGS
   Identify any potential misalignments to probe in session:
   coherenceFlags: {
     claim: string,           // what the CV states
     probeTarget: string,     // what the session should verify
     priority: 'high' | 'medium' | 'low'
   }[]

5. QUESTION PRIMING BRIEF
   A brief for the question generator — top 3 competency areas to probe,
   top 2 CV claims to verify, and the strongest experience to build on.
   questionPrimingBrief: {
     topCompetenciesToProbe: string[],
     cvClaimsToVerify: string[],
     strongestExperienceToLeverage: string
   }

6. CHC FIRST-PASS FROM CV (pre-session signal)
   Based on CV vocabulary and evidence quality only:
   cvCHCSignal: {
     gc_estimate: 'strong' | 'moderate' | 'weak',  // knowledge depth
     gq_estimate: 'strong' | 'moderate' | 'weak',  // result specificity
     note: string
   }`;

  const response = await ai.models.generateContent({
    model: deepThink ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview',
    contents: { parts: [contentPart, { text: systemPrompt }] },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          roleAlignmentScore: { type: Type.NUMBER },
          alignmentSummary: { type: Type.STRING },
          keywordAudit: {
            type: Type.OBJECT,
            properties: {
              present: { type: Type.ARRAY, items: { type: Type.STRING } },
              missing: { type: Type.ARRAY, items: { type: Type.STRING } },
              vocabularyStrengths: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["present", "missing", "vocabularyStrengths"]
          },
          starEvidenceQuality: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                roleTitle: { type: Type.STRING },
                situation: { type: Type.STRING, enum: ['evidenced', 'partial', 'implied', 'missing'] },
                task: { type: Type.STRING, enum: ['evidenced', 'partial', 'implied', 'missing'] },
                action: { type: Type.STRING, enum: ['evidenced', 'partial', 'implied', 'missing'] },
                result: { type: Type.STRING, enum: ['evidenced', 'partial', 'implied', 'missing'] }
              },
              required: ["roleTitle", "situation", "task", "action", "result"]
            }
          },
          coherenceFlags: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                claim: { type: Type.STRING },
                probeTarget: { type: Type.STRING },
                priority: { type: Type.STRING, enum: ['high', 'medium', 'low'] }
              },
              required: ["claim", "probeTarget", "priority"]
            }
          },
          questionPrimingBrief: {
            type: Type.OBJECT,
            properties: {
              topCompetenciesToProbe: { type: Type.ARRAY, items: { type: Type.STRING } },
              cvClaimsToVerify: { type: Type.ARRAY, items: { type: Type.STRING } },
              strongestExperienceToLeverage: { type: Type.STRING }
            },
            required: ["topCompetenciesToProbe", "cvClaimsToVerify", "strongestExperienceToLeverage"]
          },
          cvCHCSignal: {
            type: Type.OBJECT,
            properties: {
              gc_estimate: { type: Type.STRING, enum: ['strong', 'moderate', 'weak'] },
              gq_estimate: { type: Type.STRING, enum: ['strong', 'moderate', 'weak'] },
              note: { type: Type.STRING }
            },
            required: ["gc_estimate", "gq_estimate", "note"]
          }
        },
        required: [
          "roleAlignmentScore",
          "alignmentSummary",
          "keywordAudit",
          "starEvidenceQuality",
          "coherenceFlags",
          "questionPrimingBrief",
          "cvCHCSignal"
        ]
      }
    }
  });
  return JSON.parse(response.text || "{}");
};

export const startGuidanceChat = (auditResult: AuditResult, role: string): Chat => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: `You are the Lead Recruitment Auditor. Guide the candidate to bridge the Magnitude Gap for ${role}. Focus on Primary Domains.
      
      ### TONE & PSYCHOLOGICAL SAFETY
      - Be professional, constructive, and encouraging.
      - Never use demotivating language.
      - Frame all feedback as actionable growth steps.
      - Ensure the candidate feels psychologically safe and engaged with their career journey.`,
    },
  });
};

export const searchStealthVentures = async (role: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const anchor = "Venture Anchor: High-growth startups, stealth ventures, and Series A/B firms globally hiring for this specific role.";
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: PDP_SCOUT_INSTRUCTION(role, anchor),
    config: { tools: [{ googleSearch: {} }] }
  });
  return {
    text: response.text || '',
    sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((c: any) => ({ title: c.web?.title, uri: c.web?.uri })) || []
  };
};

export const searchUnderratedGems = async (role: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const anchor = "Hidden Gem Anchor: Specialized industry leaders, mid-market powerhouses, and underrated firms with high-caliber talent bars.";
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: PDP_SCOUT_INSTRUCTION(role, anchor),
    config: { tools: [{ googleSearch: {} }] }
  });
  return {
    text: response.text || '',
    sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((c: any) => ({ title: c.web?.title, uri: c.web?.uri })) || []
  };
};

export const searchGlobalJobs = async (role: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const anchor = "Enterprise Anchor: Major global corporations and market-dominant firms with robust career ecosystems.";
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: PDP_SCOUT_INSTRUCTION(role, anchor),
    config: { tools: [{ googleSearch: {} }] }
  });
  return {
    text: response.text || '',
    sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((c: any) => ({ title: c.web?.title, uri: c.web?.uri })) || []
  };
};

export const searchHCIOpportunities = async (role: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const anchor = "Specialist Anchor: Research labs, innovation studios, and deep-tech boutiques relevant to the domain.";
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: PDP_SCOUT_INSTRUCTION(role, anchor),
    config: { tools: [{ googleSearch: {} }] }
  });
  return {
    text: response.text || '',
    sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((c: any) => ({ title: c.web?.title, uri: c.web?.uri })) || []
  };
};

export const extractJobListings = async (text: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `AUDIT PROTOCOL: Extract verified company career hubs from the search text.
    Ensure the "title" is the EXACT job title found or mentioned on the portal.
    Calculate GhostProbability (0-100) and TrapScore (0-100).
    JSON: [{title, company, url, category, ghostProbability, trapScore}]. 
    Text: ${text}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            company: { type: Type.STRING },
            url: { type: Type.STRING },
            category: { type: Type.STRING },
            ghostProbability: { type: Type.NUMBER },
            trapScore: { type: Type.NUMBER }
          },
          required: ["title", "company", "url", "category", "ghostProbability", "trapScore"]
        }
      }
    }
  });
  try { return JSON.parse(response.text || "[]"); } catch (e) { return []; }
};
