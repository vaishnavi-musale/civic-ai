const Groq = require('groq-sdk');
require('dotenv').config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const isDev = process.env.NODE_ENV !== 'production';

// ─── Reasoning / think-block sanitisation ──────────────────────────────

const stripThinkBlocks = (text) => {
  if (!text) return '';
  let result = String(text);
  result = result.replace(/<think>[\s\S]*?<\/think>/g, '');
  result = result.replace(/<think>[\s\S]*/g, '');
  return result;
};

const stripReasoning = (text) => {
  if (!text) return '';
  let result = stripThinkBlocks(String(text));

  // If the model used "Final Answer:" (or bold variant), keep only that part
  const finalMatch = result.match(/(?:\*\*)?Final Answer(?:\*\*)?:\s*([\s\S]*)$/i);
  if (finalMatch) {
    return finalMatch[1].trim();
  }

  // Remove lines that are meta-commentary / self-verification artifacts.
  // Each pattern is anchored to match only standalone self-check lines,
  // never part of a legitimate sentence in an answer.
  const lines = result.split('\n').filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;

    // Standalone self-check endings: short lines ending with "Checked."
    if (/^[\w\s-]{1,20}Checked\.?$/i.test(trimmed)) return false;

    // Lines that are JUST status markers
    if (/^Ready\.?\s*✅?$/i.test(trimmed)) return false;
    if (/^Proceed\.?\s*✅?$/i.test(trimmed)) return false;

    // Constraint self-checks (only when it starts the line)
    if (/^Word count/i.test(trimmed)) return false;
    if (/^Fits all constraints/i.test(trimmed)) return false;

    // Internal bracket notes: "[Final Check of the Prompt]"
    if (/^\[.*\]/.test(trimmed)) return false;

    return true;
  });

  result = lines.join('\n').trim();

  // Safety net: if everything was stripped, return original (with think blocks removed)
  return result || text.trim();
};

const stripFences = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/```json|```/g, '')
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .trim();
};

// ─── Robust JSON extraction ────────────────────────────────────────────

/**
 * Extract the first complete JSON value (object or array) from text
 * by tracking brace/bracket depth. Handles nested structures, strings
 * with escaped quotes, and ignores leading / trailing non-JSON content.
 * Returns the extracted JSON string or null.
 */
const extractFirstJson = (text) => {
  if (!text) return null;
  const s = String(text);

  const objStart = s.indexOf('{');
  const arrStart = s.indexOf('[');
  let start = -1;
  let startChar;

  if (objStart !== -1 && (arrStart === -1 || objStart < arrStart)) {
    start = objStart;
    startChar = '{';
  } else if (arrStart !== -1) {
    start = arrStart;
    startChar = '[';
  }

  if (start === -1) return null;

  const endChar = startChar === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escape = false;
  let inChars = s.slice(start);

  for (let i = 0; i < inChars.length; i++) {
    const ch = inChars[i];

    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }

    if (!inString) {
      if (ch === startChar) depth++;
      else if (ch === endChar) {
        depth--;
        if (depth === 0) return s.slice(start, start + i + 1);
      }
    }
  }

  return null; // unclosed JSON
};

const extractJson = (text) => {
  if (!text) return null;

  // 1. Depth-based extractor — handles extra text, multiple objects
  const first = extractFirstJson(text);
  if (first) {
    try { JSON.parse(first); return first; } catch (_) {}
  }

  // 2. Extract from ```json / ``` code fence
  const jsonBlock = text.match(/```json\s*([\s\S]*?)```/);
  if (jsonBlock) {
    const extracted = jsonBlock[1].trim();
    try { JSON.parse(extracted); return extracted; } catch (_) {}
  }

  // 3. Final fallback: strip fences, find first { and last }
  const cleaned = stripFences(text);
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = cleaned.slice(firstBrace, lastBrace + 1);
    try { JSON.parse(candidate); return candidate; } catch (_) {}
  }

  return null;
};

const parseJsonResponse = (text) => {
  try {
    const json = extractJson(text);
    if (!json) {
      if (isDev && text) {
        console.warn('Could not extract JSON from response (first 300 chars):', text.slice(0, 300));
      }
      return null;
    }
    return JSON.parse(json);
  } catch (error) {
    if (isDev) {
      console.warn('JSON parse error:', error.message, '| raw start:', text?.slice(0, 200));
    }
    return null;
  }
};

const normalizeAnalysisResponse = (parsed) => {
  if (!parsed || typeof parsed !== 'object') return null;

  const rawConfidence = parsed.confidence_percent ?? parsed.confidence;
  const normalizedConfidence = Number(rawConfidence);
  const confidencePercent = Number.isFinite(normalizedConfidence)
    ? (normalizedConfidence > 1 ? normalizedConfidence : normalizedConfidence * 100)
    : 0;

  return {
    ...parsed,
    confidence_percent: confidencePercent,
    confidence: confidencePercent
  };
};

// ─── Groq API caller ───────────────────────────────────────────────────

const callGroq = async ({ model, messages, system, prompt, max_tokens = 1000, temperature = 0.3 }) => {
  try {
    const requestMessages = [];
    if (system) {
      requestMessages.push({ role: 'system', content: system });
    }
    if (messages) {
      requestMessages.push(...messages);
    } else if (prompt) {
      requestMessages.push({ role: 'user', content: prompt });
    }

    const response = await groq.chat.completions.create({
      model,
      messages: requestMessages,
      max_tokens,
      temperature
    });

    const rawText = typeof response.choices?.[0]?.message?.content === 'string'
      ? response.choices[0].message.content
      : Array.isArray(response.choices?.[0]?.message?.content)
        ? response.choices[0].message.content.map((part) => typeof part === 'string' ? part : part?.text || '').join('')
        : '';

    return { rawText: stripThinkBlocks(rawText), response };
  } catch (error) {
    console.error('Groq request failed:', error);
    return null;
  }
};

// ─── AI feature functions ──────────────────────────────────────────────

const analyzeIssueImage = async (imageBase64, mimeType, userDescription) => {
  try {
    const result = await callGroq({
      model: 'qwen/qwen3.6-27b',
      max_tokens: 2048,
      temperature: 0.2,
      system: 'Return ONLY valid JSON. No markdown, no thinking, no reasoning, NEVER use <think> tags.',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${imageBase64}` }
            },
            {
              type: 'text',
              text: `Analyze this civic issue photo from an Indian city. Consider the user's note if present: ${userDescription || ''}. Return ONLY valid JSON no markdown: { category: one of [pothole,waterlogging,streetlight,waste,encroachment,sewage,road_damage,park,other], confidence_percent: number, severity: one of [low,medium,high,critical], severity_reason: string, suggested_title: string, ai_description: string, likely_causes: [string], recommended_department: string, estimated_resolution_days: number, priority_score: number 0-100, priority_reasons: [string], is_emergency: boolean, emergency_reason: string or null, safety_risk: one of [none,low,moderate,high,critical] }`
            }
          ]
        }
      ]
    });

    if (!result) return null;
    return normalizeAnalysisResponse(parseJsonResponse(result.rawText));
  } catch (error) {
    console.error('Error in analyzeIssueImage:', error);
    return null;
  }
};

const checkDuplicate = async (newIssue, nearbyIssues) => {
  try {
    const cleanNearby = nearbyIssues.map(({ photo_url, photo_base64, original_description, ai_analysis, ...rest }) => rest);
    const result = await callGroq({
      model: 'qwen/qwen3.6-27b',
      max_tokens: 2048,
      temperature: 0.2,
      system: 'Return ONLY valid JSON. No markdown, no thinking, no reasoning, NEVER use <think> tags.',
      prompt: `You are a duplicate detection system for a civic issue tracker.\nNew issue: ${JSON.stringify(newIssue)}\nExisting nearby issues: ${JSON.stringify(cleanNearby)}\nReturn ONLY valid JSON: { is_duplicate: boolean, duplicate_of_id: string or null, confidence: 0.0-1.0, reason: string }`
    });

    if (!result) return null;
    return normalizeAnalysisResponse(parseJsonResponse(result.rawText));
  } catch (error) {
    console.error('Error in checkDuplicate:', error);
    return null;
  }
};

const verifyResolution = async (originalImageBase64, newImageBase64, issueDescription) => {
  try {
    const result = await callGroq({
      model: 'qwen/qwen3.6-27b',
      max_tokens: 2048,
      temperature: 0.2,
      system: 'Return ONLY valid JSON. No markdown, no thinking, no reasoning, NEVER use <think> tags.',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${originalImageBase64}` }
            },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${newImageBase64}` }
            },
            {
              type: 'text',
              text: `Compare these two images. First is BEFORE (issue reported), second is AFTER (claimed resolved). Issue: ${issueDescription}. Return ONLY valid JSON: { is_resolved: boolean, confidence: 0.0-1.0, verdict: string, what_changed: string, recommendation: one of [mark_resolved, needs_admin_review, still_open] }`
            }
          ]
        }
      ]
    });

    if (!result) return null;
    return normalizeAnalysisResponse(parseJsonResponse(result.rawText));
  } catch (error) {
    console.error('Error in verifyResolution:', error);
    return null;
  }
};

const draftAdminResponse = async (issueTitle, category, newStatus, adminNotes, daysOpen) => {
  try {
    const result = await callGroq({
      model: 'qwen/qwen3.6-27b',
      system: 'Return ONLY valid JSON. No markdown, no thinking, no reasoning, NEVER use <think> tags.',
      prompt: `Write a citizen-friendly status update for a civic issue. Under 80 words. Professional and empathetic.\nIssue: ${issueTitle}, Category: ${category}, New status: ${newStatus}, Admin notes: ${adminNotes}, Days open: ${daysOpen}\nReturn ONLY valid JSON: { subject: string, message: string, estimated_resolution: string }`
    });

    if (!result) return null;
    return normalizeAnalysisResponse(parseJsonResponse(result.rawText));
  } catch (error) {
    console.error('Error in draftAdminResponse:', error);
    return null;
  }
};

const rankIssues = async (openIssues) => {
  try {
    const clean = openIssues.map(({ id, title, category, severity, status, created_at, upvotes, confirm_count, deny_count, priority_score }) => ({ id, title, category, severity, status, created_at, upvotes, confirm_count, deny_count, priority_score }));
    const result = await callGroq({
      model: 'qwen/qwen3.6-27b',
      max_tokens: 4096,
      temperature: 0.2,
      system: 'Return ONLY valid JSON. No markdown, no thinking, no reasoning, NEVER use <think> tags.',
      prompt: `Rank these civic issues by priority. Consider severity, votes, days open, safety risk.\nIssues: ${JSON.stringify(clean)}\nReturn ONLY valid JSON: { "ranked_ids": ["id1","id2"], "reasoning": { "id1": "reason for this id" } }`
    });

    if (!result) return null;
    return normalizeAnalysisResponse(parseJsonResponse(result.rawText));
  } catch (error) {
    console.error('Error in rankIssues:', error);
    return null;
  }
};

const generateInsights = async (issuesSummary) => {
  try {
    const clean = issuesSummary.map(({ id, title, category, severity, status, created_at, upvotes, confirm_count, deny_count, priority_score }) => ({ id, title, category, severity, status, created_at, upvotes, confirm_count, deny_count, priority_score }));
    const result = await callGroq({
      model: 'qwen/qwen3.6-27b',
      max_tokens: 4096,
      temperature: 0.2,
      system: 'Return ONLY valid JSON. No markdown, no thinking, no reasoning, NEVER use <think> tags.',
      prompt: `Generate a community insights report for a civic platform.\nData: ${JSON.stringify(clean)}\nReturn ONLY valid JSON: { total_reported: number, total_resolved: number, avg_resolution_days: number, top_category: string, hotspot_areas: [string], trend: string, trend_reason: string, predictions: [string], highlight: string }`
    });

    if (!result) return null;
    return normalizeAnalysisResponse(parseJsonResponse(result.rawText));
  } catch (error) {
    console.error('Error in generateInsights:', error);
    return null;
  }
};

const processVoice = async (transcript) => {
  try {
    const result = await callGroq({
      model: 'qwen/qwen3.6-27b',
      system: 'Return ONLY valid JSON. No markdown, no thinking, no reasoning, NEVER use <think> tags.',
      prompt: `Clean up this voice transcript of a civic issue report from India. Fix grammar, extract key information.\nTranscript: ${transcript}\nReturn ONLY valid JSON: { cleaned_description: string, detected_category: string, detected_location: string }`
    });

    if (!result) return null;
    return normalizeAnalysisResponse(parseJsonResponse(result.rawText));
  } catch (error) {
    console.error('Error in processVoice:', error);
    return null;
  }
};

const chatWithAssistant = async (userMessage, issueContext, userIssues) => {
  try {
    const result = await callGroq({
      model: 'qwen/qwen3.6-27b',
      system: 'You are CivicAI Assistant, a helpful civic issue tracking bot for Indian communities. Give only the final answer — no reasoning, no self-checks, no verification. Never include: "Checked", "Ready", "Proceed", "Output matches", "Word count", bracket notes, or any reference to your instructions. Never explain what you are doing. Just answer the citizen directly. Be concise and friendly. Use issue context if provided.',
      prompt: `Citizen question: ${userMessage}\nJSON context: ${JSON.stringify({ currentIssue: issueContext, recentUserIssues: userIssues })}`
    });

    if (!result) return null;

    // Strip reasoning text — centralised, applied after callGroq's think-block removal
    const sanitized = stripReasoning(result.rawText);

    // Log in dev if sanitization produced empty output (helps debug filter overreach)
    if (!sanitized || !result.rawText.trim()) {
      if (isDev) console.warn('Chat response empty — raw text:', JSON.stringify(result.rawText?.slice(0, 500)));
      return "I'm sorry, I wasn't able to generate a response. Please try rephrasing your question.";
    }

    return sanitized;
  } catch (error) {
    console.error('Error in chatWithAssistant:', error);
    return null;
  }
};

const translateText = async (text, fromLanguage) => {
  try {
    const result = await callGroq({
      model: 'qwen/qwen3.6-27b',
      system: 'Return ONLY valid JSON. No markdown, no thinking, no reasoning, NEVER use <think> tags.',
      prompt: `Translate this civic issue report from ${fromLanguage} to English. Keep it natural and clear.\nText: ${text}\nReturn ONLY valid JSON: { translated_text: string, detected_language: string }`
    });

    if (!result) return null;
    return normalizeAnalysisResponse(parseJsonResponse(result.rawText));
  } catch (error) {
    console.error('Error in translateText:', error);
    return null;
  }
};

module.exports = {
  analyzeIssueImage,
  checkDuplicate,
  verifyResolution,
  draftAdminResponse,
  rankIssues,
  generateInsights,
  processVoice,
  chatWithAssistant,
  translateText
};
