import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleGenAI } from "@google/genai";

const apiKey = typeof process !== 'undefined' && process.env ? process.env.GEMINI_API_KEY || "" : "";

export interface GeminiHealthReport {
  status: 'operational' | 'degraded' | 'unconfigured' | 'error';
  configured: boolean;
  model: string;
  latencyMs?: number;
  lastChecked: Date;
  details?: string;
  error?: string;
}

export async function checkGeminiHealth(): Promise<GeminiHealthReport> {
  const modelName = 'gemini-2.5-flash';
  
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return {
      status: 'unconfigured',
      configured: false,
      model: modelName,
      lastChecked: new Date(),
      details: 'GEMINI_API_KEY is not configured or using placeholder value.',
      error: 'Missing or placeholder API key',
    };
  }

  const startTime = performance.now();
  try {
    // Attempt using modern @google/genai SDK
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: modelName,
      contents: 'Ping. Reply with: OK',
    });

    const elapsed = Math.round(performance.now() - startTime);
    const text = response.text || '';

    return {
      status: 'operational',
      configured: true,
      model: modelName,
      latencyMs: elapsed,
      lastChecked: new Date(),
      details: `Active connection established (${elapsed}ms). Probe response: "${text.trim().substring(0, 30)}"`,
    };
  } catch (err: any) {
    const elapsed = Math.round(performance.now() - startTime);
    const errMsg = err?.message || String(err);
    
    // Check if error is quota / rate limit or key error
    if (errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('429')) {
      return {
        status: 'degraded',
        configured: true,
        model: modelName,
        latencyMs: elapsed,
        lastChecked: new Date(),
        details: 'Rate limit or quota reached on Gemini API.',
        error: errMsg,
      };
    }

    return {
      status: 'error',
      configured: true,
      model: modelName,
      latencyMs: elapsed,
      lastChecked: new Date(),
      details: 'Gemini API probe request failed.',
      error: errMsg,
    };
  }
}

export async function summarizeIncident(description: string, severity: string) {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `You are a senior election security analyst. Please provide a brief, professional summary and potential action plan for the following incident report. 
    Report Description: "${description}"
    Severity Level: ${severity}
    
    Format the response as two short sections:
    1. SUMMARY
    2. RECOMMENDED ACTION
    
    Keep it concise and professional.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini Error:", error);
    return "AI generation failed. Please review manually.";
  }
}

