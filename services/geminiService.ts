
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
    } catch (e) {}
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

  const systemPrompt = `Expert recruitment auditor. Perform 2-Stage clinical optimization for ${targetRole} at ${companyName}.
  PHASE 1 (ATS Standards): Alignment Index based on Merit Vectors (Autonomy, Competence, Relatedness).
  PHASE 2 (Coaching Blueprint): Internal Operating Model Prediction, Comm Style, and Unwritten Rules.
  Map the Magnitude Gap and identify prestige proxies. 
  
  ### TONE & PSYCHOLOGICAL SAFETY
  - Maintain a professional, constructive, and highly encouraging tone.
  - Frame gaps as "growth opportunities" or "alignment refinements."
  - Avoid demotivating language like "failed," "unqualified," or "poor."
  - The goal is to empower the candidate to bridge the gap while feeling supported.
  
  OUTPUT JSON ONLY.`;

  const response = await ai.models.generateContent({
    model: deepThink ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview',
    contents: { parts: [contentPart, { text: systemPrompt }] },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          alignmentScore: { type: Type.NUMBER },
          frictionPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
          meritVectors: {
            type: Type.OBJECT,
            properties: { autonomy: { type: Type.NUMBER }, competence: { type: Type.NUMBER }, relatedness: { type: Type.NUMBER } }
          },
          internalWorkings: {
            type: Type.OBJECT,
            properties: {
              operatingModel: { type: Type.STRING },
              commStyle: { type: Type.STRING },
              decisionMaking: { type: Type.STRING },
              unwrittenRules: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          },
          agencyShift: {
            type: Type.OBJECT,
            properties: { currentAgencyLevel: { type: Type.NUMBER }, targetAgencyLevel: { type: Type.NUMBER }, shiftPercentage: { type: Type.NUMBER }, magnitudeGap: { type: Type.STRING } }
          },
          atsMapping: {
            type: Type.ARRAY,
            items: { type: Type.OBJECT, properties: { category: { type: Type.STRING }, criterion: { type: Type.STRING }, evidenceFound: { type: Type.STRING }, strength: { type: Type.STRING } } }
          },
          optimisedCV: {
            type: Type.OBJECT,
            properties: { professionalSummary: { type: Type.STRING }, bulletPointOptimizations: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { original: { type: Type.STRING }, optimised: { type: Type.STRING }, logic: { type: Type.STRING }, bloomLevel: { type: Type.NUMBER } } } } }
          },
          biasMitigationSummary: { type: Type.ARRAY, items: { type: Type.STRING } },
          miniCaseStudy: {
            type: Type.OBJECT,
            properties: { title: { type: Type.STRING }, context: { type: Type.STRING }, tasks: { type: Type.ARRAY, items: { type: Type.STRING } }, expectedSolutions: { type: Type.STRING }, feedbackRationale: { type: Type.STRING } }
          },
          tailoredQuestions: {
            type: Type.ARRAY,
            items: { type: Type.OBJECT, properties: { text: { type: Type.STRING }, keywords: { type: Type.ARRAY, items: { type: Type.STRING } }, requirements: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, text: { type: Type.STRING }, linkedKeywords: { type: Type.ARRAY, items: { type: Type.STRING } } } } } } }
          }
        },
        required: ["summary", "alignmentScore", "meritVectors", "internalWorkings", "atsMapping", "optimisedCV", "miniCaseStudy", "tailoredQuestions"]
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
