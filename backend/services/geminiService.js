const Groq = require('groq-sdk');
require('dotenv').config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const stripFences = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/```json|```/g, '')
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .trim();
};

const extractJson = (text) => {
  if (!text) return null;
  // Try ```json ... ``` block first
  const jsonBlock = text.match(/```json\s*([\s\S]*?)```/);
  if (jsonBlock) {
    const extracted = jsonBlock[1].trim();
    try { JSON.parse(extracted); return extracted; } catch (_) {}
  }
  // Strip code fences and think blocks
  const cleaned = stripFences(text);
  // Try extracting JSON array first [...]
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    const candidate = cleaned.slice(firstBracket, lastBracket + 1);
    try { JSON.parse(candidate); return candidate; } catch (_) { /* fall through */ }
  }
  // Fallback: find first { and last }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) return null;
  return cleaned.slice(firstBrace, lastBrace + 1);
};

const parseJsonResponse = (text) => {
  try {
    const json = extractJson(text);
    if (!json) return null;
    return JSON.parse(json);
  } catch (error) {
    console.error('Error parsing JSON from Groq:', error);
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

    return { rawText, response };
  } catch (error) {
    console.error('Groq request failed:', error);
    return null;
  }
};

const analyzeIssueImage = async (imageBase64, mimeType, userDescription) => {
  try {
    const result = await callGroq({
      model: 'qwen/qwen3.6-27b',
      max_tokens: 2048,
      temperature: 0.2,
      system: 'Return ONLY valid JSON. No markdown, no thinking.',
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
      system: 'Return ONLY valid JSON. No markdown, no thinking.',
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
      system: 'Return ONLY valid JSON. No markdown, no thinking.',
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
      system: 'Return ONLY valid JSON. Do NOT include any thinking, reasoning, or explanation.',
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
      system: 'Return ONLY valid JSON. Do NOT include any thinking, reasoning, or explanation.',
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
      system: 'You are CivicAI Assistant, a helpful civic issue tracking bot for Indian communities. Help citizens understand their issue status, expected resolution times, and how the system works. Be concise, friendly, and factual under 80 words. Use the provided issue data to answer specific questions.',
      prompt: `Citizen question: ${userMessage}\nJSON context: ${JSON.stringify({ currentIssue: issueContext, recentUserIssues: userIssues })}`
    });

    if (!result) return null;
    return result.rawText;
  } catch (error) {
    console.error('Error in chatWithAssistant:', error);
    return null;
  }
};

const translateText = async (text, fromLanguage) => {
  try {
    const result = await callGroq({
      model: 'qwen/qwen3.6-27b',
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
