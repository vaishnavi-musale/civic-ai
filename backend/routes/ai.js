const express = require('express');
const router = express.Router();
const geminiService = require('../services/geminiService');
const supabase = require('../config/supabase');

const FALLBACK_AI_RESULT = {
  category: 'other',
  confidence_percent: 60,
  severity: 'medium',
  severity_reason: 'AI analysis temporarily unavailable, manual review recommended',
  suggested_title: 'Community Issue',
  ai_description: 'Please add a description manually.',
  likely_causes: [],
  recommended_department: 'Municipal Corporation',
  estimated_resolution_days: 5,
  priority_score: 50,
  priority_reasons: [],
  is_emergency: false,
  emergency_reason: null,
  safety_risk: 'low'
};

// POST /api/ai/analyze-image
router.post('/analyze-image', async (req, res) => {
  try {
    console.log('POST /api/ai/analyze-image body keys', Object.keys(req.body));
    console.log('POST /api/ai/analyze-image mimeType', req.body.mimeType, 'imageBase64 length', req.body.imageBase64 ? req.body.imageBase64.length : 0);
    const { imageBase64, mimeType, userDescription } = req.body;

    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ error: 'imageBase64 and mimeType are required' });
    }

    let result;
    try {
      result = await geminiService.analyzeIssueImage(imageBase64, mimeType, userDescription);
    } catch (groqError) {
      console.error('FULL ANALYZE ERROR:', groqError.response?.data || groqError.message || groqError);
    }

    if (!result) {
      return res.json(FALLBACK_AI_RESULT);
    }
    if (result.error === 'AI_UNAVAILABLE') {
      console.warn('AI unavailable:', result.message || 'Unknown issue');
      return res.json(FALLBACK_AI_RESULT);
    }

    // Log a compact summary to help debugging without printing large image data
    console.log('AI analyze result:', {
      category: result.category,
      confidence: result.confidence || result.confidence_percent,
      priority_score: result.priority_score,
      suggested_title: result.suggested_title,
    });

    res.json(result);
  } catch (error) {
    console.error('FULL ANALYZE ERROR:', error.response?.data || error.message || error);
    res.json(FALLBACK_AI_RESULT);
  }
});

// POST /api/ai/check-duplicate
router.post('/check-duplicate', async (req, res) => {
  try {
    const { newIssue, nearbyIssues } = req.body;
    
    if (!newIssue || !nearbyIssues) {
      return res.status(400).json({ error: 'newIssue and nearbyIssues are required' });
    }
    
    const result = await geminiService.checkDuplicate(newIssue, nearbyIssues);
    if (!result) return res.status(500).json({ error: 'Failed to check duplicate' });
    
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/ai/verify-resolution
router.post('/verify-resolution', async (req, res) => {
  try {
    const { originalImageBase64, newImageBase64, issueDescription } = req.body;
    
    if (!originalImageBase64 || !newImageBase64 || !issueDescription) {
      return res.status(400).json({ error: 'originalImageBase64, newImageBase64, and issueDescription are required' });
    }
    
    const result = await geminiService.verifyResolution(originalImageBase64, newImageBase64, issueDescription);
    if (!result) return res.status(500).json({ error: 'Failed to verify resolution' });
    
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/ai/draft-response
router.post('/draft-response', async (req, res) => {
  try {
    const { issueTitle, category, newStatus, adminNotes, daysOpen } = req.body;
    
    if (!issueTitle || !category || !newStatus || daysOpen === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await geminiService.draftAdminResponse(issueTitle, category, newStatus, adminNotes, daysOpen);
    if (!result) return res.status(500).json({ error: 'Failed to draft response' });
    
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/ai/rank-issues
router.post('/rank-issues', async (req, res) => {
  try {
    const { openIssues } = req.body;
    
    if (!openIssues) {
      return res.status(400).json({ error: 'openIssues is required' });
    }
    
    const result = await geminiService.rankIssues(openIssues);
    if (!result) return res.status(500).json({ error: 'Failed to rank issues' });
    
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/ai/insights
router.get('/insights', async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: issues, error } = await supabase
      .from('issues')
      .select('*')
      .gte('created_at', thirtyDaysAgo.toISOString());
      
    if (error) {
      console.error('Insights DB error:', error);
      return res.status(500).json({ error: 'Failed to fetch issues from database' });
    }

    if (!issues || issues.length === 0) {
      return res.status(200).json({
        total_reported: 0,
        total_resolved: 0,
        avg_resolution_days: null,
        top_category: null,
        hotspot_areas: [],
        trend: 'insufficient_data',
        trend_reason: 'No issues reported in the last 30 days',
        predictions: [],
        highlight: 'No recent issues to report.'
      });
    }
    
    const result = await geminiService.generateInsights(issues);
    if (!result) {
      console.error('generateInsights returned null');
      return res.status(500).json({ error: 'Failed to generate insights' });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Insights route error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/ai/process-voice
router.post('/process-voice', async (req, res) => {
  try {
    const { transcript } = req.body;
    if (!transcript) {
      return res.status(400).json({ error: 'transcript is required' });
    }

    const result = await geminiService.processVoice(transcript);
    if (!result) return res.status(500).json({ error: 'Failed to process voice input' });
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/ai/chat
router.post('/chat', async (req, res) => {
  try {
    const { message, userId, trackingId } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    let issueContext = null;
    let userIssues = [];

    if (trackingId) {
      const { data, error } = await supabase
        .from('issues')
        .select('id, tracking_id, title, description, category, severity, status, location_address, created_at, ai_analysis, admin_message, timeline_steps, resolution_verified_at')
        .eq('tracking_id', String(trackingId).trim().toUpperCase())
        .maybeSingle();

      if (!error && data) {
        issueContext = data;
      }
    }

    if (userId) {
      const { data, error } = await supabase
        .from('issues')
        .select('id, tracking_id, title, category, severity, status, location_address, created_at, ai_analysis, admin_message')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!error && data) {
        userIssues = data;
      }
    }

    const result = await geminiService.chatWithAssistant(message, issueContext, userIssues);
    if (!result) return res.status(500).json({ error: 'Failed to generate chat response' });

    res.json({ reply: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/ai/translate
router.post('/translate', async (req, res) => {
  try {
    const { text, fromLanguage } = req.body;
    if (!text || !fromLanguage) {
      return res.status(400).json({ error: 'text and fromLanguage are required' });
    }

    const result = await geminiService.translateText(text, fromLanguage);
    if (!result) return res.status(500).json({ error: 'Failed to translate text' });
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
