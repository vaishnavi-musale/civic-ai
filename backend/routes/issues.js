const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const https = require('https');
const http = require('http');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const supabase = require('../config/supabase');
const geminiService = require('../services/geminiService');
const { buildTimelineSteps } = require('../utils/timeline');

const upload = multer({ storage: multer.memoryStorage() });
let issuePhotosBucketReady = false;

const ensureIssuePhotosBucket = async () => {
  if (issuePhotosBucketReady) return true;

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (!listError && Array.isArray(buckets) && buckets.some((bucket) => bucket.name === 'issue-photos')) {
    issuePhotosBucketReady = true;
    return true;
  }

  const { error: createError } = await supabase.storage.createBucket('issue-photos', {
    public: true,
  });

  if (!createError) {
    issuePhotosBucketReady = true;
    return true;
  }

  console.error('Failed to ensure issue-photos bucket:', createError);
  return false;
};

// Helper: download a URL as a buffer (works with http and https)
const downloadBuffer = (url) => {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
};

// Helper to generate Civic Tracking ID
const generateTrackingId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'CIVIC-';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};

const normalizeText = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

const tokenise = (value) => normalizeText(value).split(' ').filter(Boolean);

const similarityScore = (a, b) => {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left || !right) return 0;
  if (left === right) return 1;

  const leftTokens = tokenise(left);
  const rightTokens = tokenise(right);
  if (!leftTokens.length || !rightTokens.length) return 0;

  const overlap = leftTokens.filter((token) => rightTokens.includes(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union ? overlap / union : 0;
};

const findHeuristicDuplicate = (newIssue, recentIssues) => {
  const category = normalizeText(newIssue.category);
  const newLocation = normalizeText(newIssue.location_address);
  const newTitle = normalizeText(newIssue.title);
  const newDescription = normalizeText(newIssue.description);

  for (const issue of recentIssues || []) {
    const issueCategory = normalizeText(issue.category);
    if (category && issueCategory && category !== issueCategory) continue;

    const titleScore = similarityScore(newIssue.title, issue.title);
    const descriptionScore = similarityScore(newIssue.description, issue.description);
    const combinedScore = Math.max(titleScore, descriptionScore, (titleScore + descriptionScore) / 2);
    const locationMatch = newLocation && normalizeText(issue.location_address) && (newLocation === normalizeText(issue.location_address) || newLocation.includes(normalizeText(issue.location_address)) || normalizeText(issue.location_address).includes(newLocation));
    const tokenOverlap = similarityScore(`${newIssue.title} ${newIssue.description}`, `${issue.title} ${issue.description}`);

    if ((combinedScore >= 0.6 && tokenOverlap >= 0.45) || (locationMatch && combinedScore >= 0.4) || (locationMatch && tokenOverlap >= 0.4)) {
      return issue;
    }
  }

  return null;
};

const getBadgeForPoints = (points) => {
  if (points >= 300) return { name: 'City Champion', icon: '🏆' };
  if (points >= 151) return { name: 'Community Hero', icon: '🦸' };
  if (points >= 51) return { name: 'Active Citizen', icon: '⭐' };
  return { name: 'Newcomer', icon: '🌱' };
};

const compressImage = async (buffer) => {
  const MAX_SIZE = 1024 * 1024;
  if (buffer.length <= MAX_SIZE) return buffer;
  try {
    const sharp = require('sharp');
    console.log(`Compressing image from ${(buffer.length / 1024 / 1024).toFixed(2)}MB...`);
    const compressed = await sharp(buffer)
      .resize({ width: 1200, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    console.log(`Compressed to ${(compressed.length / 1024 / 1024).toFixed(2)}MB`);
    return compressed;
  } catch (e) {
    console.warn('Image compression unavailable, uploading original:', e.message);
    return buffer;
  }
};

const awardPoints = async (userId, points) => {
  if (!userId) return;
  const { data: profile } = await supabase.from('profiles').select('civic_points, badge').eq('id', userId).single();
  if (!profile) return;
  const newPoints = (profile.civic_points || 0) + points;
  const badge = getBadgeForPoints(newPoints).name;
  await supabase.from('profiles').update({ civic_points: newPoints, badge }).eq('id', userId);
};

// POST /api/issues
router.post('/', upload.single('photo'), async (req, res) => {
  try {
    const { title, description, original_description, reported_language, location_address, latitude, longitude, user_id, user_email, bypassDuplicate, ai_analysis: providedAnalysis } = req.body;
    const file = req.file;

    console.log('POST /api/issues body keys:', Object.keys(req.body).join(', '), '| has ai_analysis:', !!providedAnalysis, '| file size:', file?.size || 0);

    if (!file) {
      return res.status(400).json({ error: 'Photo is required' });
    }

    // Compress image if over 1MB before upload
    const compressedBuffer = await compressImage(file.buffer);
    const uploadBuffer = compressedBuffer;
    const uploadMimeType = file.mimetype === 'image/png' && compressedBuffer !== file.buffer ? 'image/jpeg' : file.mimetype;

    // Use AI analysis from frontend if provided, otherwise fallback
    let aiAnalysis = null;
    if (providedAnalysis) {
      try {
        aiAnalysis = typeof providedAnalysis === 'string' ? JSON.parse(providedAnalysis) : providedAnalysis;
        console.log('Parsed ai_analysis from frontend:', aiAnalysis?.category, aiAnalysis?.severity);
      } catch (e) {
        console.warn('Failed to parse provided ai_analysis, will re-analyze:', e.message);
      }
    }

    // Generate tracking ID early
    const trackingId = generateTrackingId();

    // Step A: Upload photo to Supabase Storage
    const fileName = `${Date.now()}-${uuidv4()}-${file.originalname}`;
    let photoUrl = null;

    // Step B: Fetch recent issues for duplicate check (parallelizable)
    let nearbyIssues = [];
    let duplicateInfo = null;
    let isDuplicate = false;
    let existingIssue = null;

    const doUpload = async () => {
      console.time('photo-upload');
      const bucketReady = await ensureIssuePhotosBucket();
      if (bucketReady) {
        const { error: uploadError } = await supabase.storage
          .from('issue-photos')
          .upload(fileName, uploadBuffer, {
            contentType: uploadMimeType,
          });

        if (uploadError) {
          console.error('Supabase upload error:', uploadError);
        } else {
          const { data: publicUrlData } = supabase.storage
            .from('issue-photos')
            .getPublicUrl(fileName);
          photoUrl = publicUrlData.publicUrl;
        }
      }
      console.timeEnd('photo-upload');
    };

    const doFetchRecent = async () => {
      if (bypassDuplicate) return;
      console.time('fetch-recent-issues');
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: recentIssues, error: recentError } = await supabase
        .from('issues')
        .select('id, tracking_id, title, description, category, severity, status, location_address, latitude, longitude, photo_url, upvotes, created_at')
        .eq('category', aiAnalysis?.category || 'other')
        .neq('status', 'resolved')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false, nullsFirst: false })
        .limit(20);

      if (!recentError) {
        nearbyIssues = recentIssues || [];
      } else {
        console.error('Recent issue lookup error:', recentError);
      }
      console.timeEnd('fetch-recent-issues');
    };

    // Run upload and fetch-recent in parallel
    console.time('duplicate-plus-photo');
    await Promise.all([doUpload(), doFetchRecent()]);
    console.timeEnd('duplicate-plus-photo');

    // Fallback AI analysis if not provided from frontend
    if (!aiAnalysis) {
      console.time('ai-analyze-on-submit');
      const imageBase64 = file.buffer.toString('base64');
      aiAnalysis = await geminiService.analyzeIssueImage(imageBase64, file.mimetype, description);
      console.timeEnd('ai-analyze-on-submit');
    }

    // Step C: Check for duplicates (sequential - heuristic then Groq if needed)
    if (!bypassDuplicate && nearbyIssues.length > 0) {
      console.time('duplicate-check');
      const newIssueContext = {
        title,
        description,
        location_address,
        category: aiAnalysis?.category || 'other',
        severity: aiAnalysis?.severity || 'low',
        latitude,
        longitude,
      };

      const heuristicMatch = findHeuristicDuplicate(newIssueContext, nearbyIssues);
      if (heuristicMatch) {
        duplicateInfo = {
          is_duplicate: true,
          confidence: 88,
          reason: 'Similar recent issue detected by CivicAI rules',
          duplicate_of_id: heuristicMatch.id,
        };
      } else {
        duplicateInfo = await geminiService.checkDuplicate(newIssueContext, nearbyIssues);
      }

      const duplicateConfidence = Number(duplicateInfo?.confidence || 0) / 100;
      const matchedIssue = nearbyIssues.find((issue) => issue.id === duplicateInfo?.duplicate_of_id) || heuristicMatch || nearbyIssues[0];

      if (duplicateInfo?.is_duplicate && (duplicateConfidence > 0.6 || heuristicMatch)) {
        const hoursAgo = matchedIssue?.created_at ? Math.max(1, Math.round((Date.now() - new Date(matchedIssue.created_at)) / (1000 * 60 * 60))) : 1;
        const distanceText = location_address && matchedIssue?.location_address ? `${matchedIssue.location_address}` : 'near your reported location';
        existingIssue = {
          id: matchedIssue?.id,
          tracking_id: matchedIssue?.tracking_id,
          title: matchedIssue?.title,
          distance_text: distanceText,
          created_at: matchedIssue?.created_at,
          upvotes: matchedIssue?.upvotes || 0,
          photo_url: matchedIssue?.photo_url,
        };
        isDuplicate = true;
      }
      console.timeEnd('duplicate-check');
    }

    if (isDuplicate) {
      const message = `This issue was already reported ${Math.max(1, Math.round((Date.now() - new Date(existingIssue?.created_at || Date.now())) / (1000 * 60 * 60)))} hours ago`;
      return res.status(200).json({
        is_duplicate: true,
        existing_issue: existingIssue,
        message,
        ai_analysis: aiAnalysis,
      });
    }

    // 4. Save to Supabase
    console.time('db-insert');
    const insertPayload = {
      tracking_id: trackingId,
      user_id: user_id || null,
      user_email: user_email || null,
      title,
      description,
      original_description: original_description || null,
      reported_language: reported_language || 'English',
      category: aiAnalysis?.category || 'other',
      severity: aiAnalysis?.severity || 'low',
      location_address,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      photo_url: photoUrl,
      ai_analysis: aiAnalysis,
      status: 'pending',
      timeline_steps: buildTimelineSteps('pending'),
      confirm_count: 0,
      deny_count: 0,
      priority_score: aiAnalysis?.priority_score || 0,
      recommended_department: aiAnalysis?.recommended_department || null,
      confidence_percent: aiAnalysis?.confidence_percent || 0,
    };

    const { data: insertedIssue, error: insertError } = await supabase
      .from('issues')
      .insert([insertPayload])
      .select()
      .single();

    console.timeEnd('db-insert');

    if (insertError) {
      console.error('Supabase insert error:', insertError);
      return res.status(500).json({ error: 'Failed to save issue' });
    }

    // Award points for report submission
    if (user_id) {
      await awardPoints(user_id, 10);
      const { data: prof } = await supabase.from('profiles').select('total_reports').eq('id', user_id).single();
      if (prof) {
        await supabase.from('profiles').update({ total_reports: (prof.total_reports || 0) + 1 }).eq('id', user_id);
      }
    }

    // 6. Trigger emergency broadcast if needed
    if (aiAnalysis?.is_emergency || aiAnalysis?.safety_risk === 'critical') {
      await supabase
        .from('broadcasts')
        .insert([
          {
            message: `⚠ Emergency reported at ${location_address || 'your location'}. Please avoid the area.`,
            type: 'emergency',
            severity: 'high',
            is_active: true,
          }
        ]);
    }

    // 7. Return response
    res.status(201).json({
      tracking_id: trackingId,
      issue_id: insertedIssue.id,
      ai_analysis: aiAnalysis,
      is_duplicate: isDuplicate,
      duplicate_info: duplicateInfo,
      photo_upload_warning: photoUrl ? null : 'Issue saved without public photo URL'
    });

  } catch (error) {
    console.error('POST /api/issues error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/issues — all issues for community feed
router.get('/', async (req, res) => {
  try {
    const { data: issues, error } = await supabase
      .from('issues')
      .select('id, tracking_id, title, category, severity, status, location_address, latitude, longitude, photo_url, upvotes, created_at, ai_analysis, confirm_count, deny_count, priority_score, recommended_department, confidence_percent')
      .order('created_at', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('Error fetching issues:', error);
      return res.status(500).json({ error: 'Failed to fetch issues' });
    }

    res.json(issues);
  } catch (error) {
    console.error('GET /api/issues error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/issues/stats — must be BEFORE /:trackingId
router.get('/stats', async (req, res) => {
  try {
    const { data: issues, error } = await supabase
      .from('issues')
      .select('id, status, created_at');

    if (error) return res.status(500).json({ error: 'Failed to fetch stats' });

    const total = issues.length;

    const now = new Date();
    const resolvedIssues = issues.filter(i => i.status === 'resolved');
    let avgResolutionDays = 0;
    if (resolvedIssues.length > 0) {
      const totalDays = resolvedIssues.reduce((sum, i) => {
        const days = Math.max(0, Math.floor((now - new Date(i.created_at)) / (1000 * 60 * 60 * 24)));
        return sum + days;
      }, 0);
      avgResolutionDays = Math.round(totalDays / resolvedIssues.length);
    }

    res.json({ total, resolved_total: resolvedIssues.length, avg_resolution_days: avgResolutionDays });
  } catch (error) {
    console.error('GET /api/issues/stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/issues/check-duplicate
router.post('/check-duplicate', async (req, res) => {
  try {
    const { title, description, location_address, category, latitude, longitude, ai_analysis } = req.body;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: recentIssues, error } = await supabase
      .from('issues')
      .select('*')
      .eq('category', category || 'other')
      .neq('status', 'resolved')
      .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false, nullsFirst: false })
        .limit(20);

    if (error) {
      return res.status(500).json({ error: 'Failed to evaluate duplicates' });
    }

    if (!recentIssues?.length) {
      return res.json({ is_duplicate: false });
    }

    const newIssueContext = { title, description, location_address, category, latitude, longitude };
    const heuristicMatch = findHeuristicDuplicate(newIssueContext, recentIssues);
    let duplicateInfo = null;

    if (heuristicMatch) {
      duplicateInfo = { is_duplicate: true, confidence: 88, reason: 'Similar recent issue detected by CivicAI rules', duplicate_of_id: heuristicMatch.id };
    } else {
      duplicateInfo = await geminiService.checkDuplicate(newIssueContext, recentIssues);
    }

    const duplicateConfidence = Number(duplicateInfo?.confidence || 0) / 100;
    const matchedIssue = recentIssues.find((issue) => issue.id === duplicateInfo?.duplicate_of_id) || heuristicMatch || recentIssues[0];

    if (duplicateInfo?.is_duplicate && (duplicateConfidence > 0.6 || heuristicMatch)) {
      const hoursAgo = matchedIssue?.created_at ? Math.max(1, Math.round((Date.now() - new Date(matchedIssue.created_at)) / (1000 * 60 * 60))) : 1;
      return res.json({
        is_duplicate: true,
        existing_issue: {
          id: matchedIssue?.id,
          tracking_id: matchedIssue?.tracking_id,
          title: matchedIssue?.title,
          distance_text: location_address && matchedIssue?.location_address ? matchedIssue.location_address : 'near your reported location',
          created_at: matchedIssue?.created_at,
          upvotes: matchedIssue?.upvotes || 0,
          photo_url: matchedIssue?.photo_url,
        },
        message: `This issue was already reported ${hoursAgo} hours ago`,
        ai_analysis,
      });
    }

    return res.json({ is_duplicate: false });
  } catch (error) {
    console.error('POST /api/issues/check-duplicate error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/issues/:id/upvote
router.post('/:id/upvote', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: issue, error: fetchError } = await supabase
      .from('issues')
      .select('upvotes')
      .eq('id', id)
      .single();

    if (fetchError || !issue) return res.status(404).json({ error: 'Issue not found' });

    const newCount = (issue.upvotes || 0) + 1;
    const { error: updateError } = await supabase
      .from('issues')
      .update({ upvotes: newCount })
      .eq('id', id);

    if (updateError) return res.status(500).json({ error: 'Failed to upvote' });

    res.json({ upvotes: newCount });
  } catch (error) {
    console.error('POST /api/issues/:id/upvote error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/issues/:id/confirm
router.post('/:id/confirm', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;
    const { data: issue, error: fetchError } = await supabase
      .from('issues')
      .select('id, confirm_count, deny_count, user_id')
      .eq('id', id)
      .single();

    if (fetchError || !issue) return res.status(404).json({ error: 'Issue not found' });

    const newConfirmCount = (issue.confirm_count || 0) + 1;
    const { error: updateError } = await supabase
      .from('issues')
      .update({ confirm_count: newConfirmCount })
      .eq('id', id);

    if (updateError) return res.status(500).json({ error: 'Failed to confirm issue' });

    // Award points for confirming another's issue
    if (user_id && user_id !== issue.user_id) {
      await awardPoints(user_id, 5);
    }

    // If confirm_count > 3, award verified points to the reporter
    if (newConfirmCount > 3 && issue.user_id) {
      await awardPoints(issue.user_id, 20);
      const { data: prof } = await supabase.from('profiles').select('verified_reports').eq('id', issue.user_id).single();
      if (prof) {
        await supabase.from('profiles').update({ verified_reports: (prof.verified_reports || 0) + 1 }).eq('id', issue.user_id);
      }
    }

    res.json({ confirm_count: newConfirmCount, deny_count: issue.deny_count || 0 });
  } catch (error) {
    console.error('POST /api/issues/:id/confirm error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/issues/:id/deny
router.post('/:id/deny', async (req, res) => {
  try {
    const { id } = req.params;
    const { data: issue, error: fetchError } = await supabase
      .from('issues')
      .select('id, confirm_count, deny_count')
      .eq('id', id)
      .single();

    if (fetchError || !issue) return res.status(404).json({ error: 'Issue not found' });

    const { error: updateError } = await supabase
      .from('issues')
      .update({ deny_count: (issue.deny_count || 0) + 1 })
      .eq('id', id);

    if (updateError) return res.status(500).json({ error: 'Failed to deny issue' });

    res.json({ confirm_count: issue.confirm_count || 0, deny_count: (issue.deny_count || 0) + 1 });
  } catch (error) {
    console.error('POST /api/issues/:id/deny error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/issues/:trackingId
router.get('/:trackingId', async (req, res) => {
  try {
    const { trackingId } = req.params;
    const { data: issue, error } = await supabase
      .from('issues')
      .select('*')
      .eq('tracking_id', trackingId)
      .single();
      
    if (error || !issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }
    
    res.json(issue);
  } catch (error) {
    console.error('GET /api/issues/:trackingId error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/issues/:trackingId/verify-resolved
router.post('/:trackingId/verify-resolved', upload.single('photo'), async (req, res) => {
  try {
    const { trackingId } = req.params;
    const newPhotoFile = req.file;

    if (!newPhotoFile) {
      return res.status(400).json({ error: 'New photo is required' });
    }

    // Fetch issue
    const { data: issue, error: fetchError } = await supabase
      .from('issues')
      .select('*')
      .eq('tracking_id', trackingId)
      .single();

    if (fetchError || !issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    // Download original photo from Supabase Storage URL
    let originalBase64 = null;
    if (issue.photo_url) {
      const originalBuffer = await downloadBuffer(issue.photo_url);
      originalBase64 = originalBuffer.toString('base64');
    }

    if (!originalBase64) {
      return res.status(400).json({ error: 'Original photo not available for comparison' });
    }

    const newBase64 = newPhotoFile.buffer.toString('base64');

    // Call Groq verifyResolution
    const result = await geminiService.verifyResolution(
      originalBase64,
      newBase64,
      issue.description
    );

    if (!result) {
      return res.status(500).json({ error: 'AI verification failed' });
    }

    let resolutionPhotoUrl = null;
    const bucketReady = await ensureIssuePhotosBucket();
    if (bucketReady) {
      const resolutionFileName = `resolution-${Date.now()}-${uuidv4()}-${newPhotoFile.originalname}`;
      const { error: uploadError } = await supabase.storage
        .from('issue-photos')
        .upload(resolutionFileName, newPhotoFile.buffer, {
          contentType: newPhotoFile.mimetype,
        });

      if (uploadError) {
        console.error('Resolution photo upload error:', uploadError);
      } else {
        const { data: publicUrlData } = supabase.storage
          .from('issue-photos')
          .getPublicUrl(resolutionFileName);
        resolutionPhotoUrl = publicUrlData.publicUrl;
      }
    }

    const confidencePercent = Number(result.confidence_percent ?? result.confidence ?? 0);
    const verificationPayload = {
      ...(issue.ai_analysis || {}),
      resolution_verification: {
        verdict: result.verdict,
        is_resolved: result.is_resolved,
        confidence: confidencePercent,
        recommendation: result.recommendation,
        what_changed: result.what_changed,
        submitted_at: new Date().toISOString(),
      }
    };

    // AI-approved citizen photos move to admin confirmation instead of closing immediately.
    if (result.recommendation === 'mark_resolved') {
      await supabase
        .from('issues')
        .update({
          status: 'verification',
          resolution_photo_url: resolutionPhotoUrl,
          resolution_verified_at: new Date().toISOString(),
          ai_analysis: verificationPayload,
          timeline_steps: buildTimelineSteps('verification', issue.timeline_steps),
        })
        .eq('tracking_id', trackingId);

      // Award points to the reporter for verified resolution
      if (issue.user_id) {
        await awardPoints(issue.user_id, 50);
      }
    }

    res.json({
      verdict: result.verdict,
      is_resolved: result.is_resolved,
      confidence: confidencePercent,
      recommendation: result.recommendation,
      what_changed: result.what_changed,
      resolution_photo_url: resolutionPhotoUrl
    });
  } catch (error) {
    console.error('POST verify-resolved error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/issues/:trackingId/pdf
router.get('/:trackingId/pdf', async (req, res) => {
  try {
    const { trackingId } = req.params;

    const { data: issue, error } = await supabase
      .from('issues')
      .select('*')
      .eq('tracking_id', trackingId)
      .single();

    if (error || !issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const civicBlue = rgb(0.118, 0.251, 0.686); // #1e40af
    const darkGray = rgb(0.2, 0.2, 0.2);
    const midGray = rgb(0.5, 0.5, 0.5);

    // Header bar
    page.drawRectangle({ x: 0, y: height - 70, width, height: 70, color: civicBlue });
    page.drawText('CivicAI', { x: 40, y: height - 42, size: 26, font: boldFont, color: rgb(1, 1, 1) });
    page.drawText('Community Issue Report', { x: 40, y: height - 60, size: 11, font, color: rgb(0.8, 0.85, 1) });
    page.drawText(new Date().toLocaleDateString(), { x: width - 120, y: height - 45, size: 10, font, color: rgb(0.8, 0.85, 1) });

    let y = height - 110;

    // Tracking ID
    page.drawText('Tracking ID', { x: 40, y, size: 10, font, color: midGray });
    y -= 22;
    page.drawText(issue.tracking_id, { x: 40, y, size: 22, font: boldFont, color: civicBlue });
    y -= 35;

    // Divider
    page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });
    y -= 20;

    const drawField = (label, value, labelColor = midGray) => {
      page.drawText(label.toUpperCase(), { x: 40, y, size: 9, font, color: labelColor });
      y -= 16;
      const safeValue = String(value || 'N/A').substring(0, 80);
      page.drawText(safeValue, { x: 40, y, size: 12, font: boldFont, color: darkGray });
      y -= 28;
    };

    drawField('Title', issue.title);
    drawField('Category', issue.category);
    drawField('Severity', issue.severity);
    drawField('Location', issue.location_address);
    drawField('Date Reported', new Date(issue.created_at).toLocaleString());
    drawField('Current Status', issue.status);

    if (issue.ai_analysis) {
      y -= 5;
      page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });
      y -= 20;
      page.drawText('AI ANALYSIS', { x: 40, y, size: 10, font: boldFont, color: civicBlue });
      y -= 20;

      if (issue.ai_analysis.severity_reason) {
        page.drawText('Severity Reason:', { x: 40, y, size: 9, font, color: midGray });
        y -= 15;
        const words = issue.ai_analysis.severity_reason.split(' ');
        let line = '';
        for (const word of words) {
          if ((line + word).length > 80) {
            page.drawText(line.trim(), { x: 40, y, size: 11, font, color: darkGray });
            y -= 14;
            line = '';
          }
          line += word + ' ';
        }
        if (line.trim()) {
          page.drawText(line.trim(), { x: 40, y, size: 11, font, color: darkGray });
          y -= 18;
        }
      }

      if (issue.ai_analysis.estimated_resolution_days) {
        drawField('Estimated Resolution', `${issue.ai_analysis.estimated_resolution_days} days`);
      }
    }

    if (issue.admin_message) {
      y -= 5;
      page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });
      y -= 20;
      page.drawText('ADMIN MESSAGE', { x: 40, y, size: 10, font: boldFont, color: civicBlue });
      y -= 18;
      const words = issue.admin_message.split(' ');
      let line = '';
      for (const word of words) {
        if ((line + word).length > 80) {
          page.drawText(line.trim(), { x: 40, y, size: 11, font, color: darkGray });
          y -= 14;
          line = '';
        }
        line += word + ' ';
      }
      if (line.trim()) page.drawText(line.trim(), { x: 40, y, size: 11, font, color: darkGray });
    }

    // Footer
    page.drawRectangle({ x: 0, y: 0, width, height: 35, color: rgb(0.97, 0.97, 0.97) });
    page.drawText('Generated by CivicAI — Empowering communities through transparent governance.', {
      x: 40, y: 12, size: 9, font, color: midGray
    });

    const pdfBytes = await pdfDoc.save();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=CivicAI_${trackingId}.pdf`);
    res.send(Buffer.from(pdfBytes));

  } catch (error) {
    console.error('GET /pdf error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// POST /api/issues/:id/comments
router.post('/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, user_email, comment_text } = req.body;

    if (!comment_text || !comment_text.trim()) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    const { data: comment, error } = await supabase
      .from('issue_comments')
      .insert({
        issue_id: id,
        user_id: user_id || null,
        user_email: user_email || 'Anonymous',
        comment_text: comment_text.trim(),
      })
      .select()
      .single();

    if (error) {
      console.error('POST /api/issues/:id/comments error:', error);
      return res.status(500).json({ error: 'Failed to post comment' });
    }

    res.status(201).json(comment);
  } catch (error) {
    console.error('POST /api/issues/:id/comments error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/issues/:id/comments
router.get('/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: comments, error } = await supabase
      .from('issue_comments')
      .select('*')
      .eq('issue_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('GET /api/issues/:id/comments error:', error);
      return res.status(500).json({ error: 'Failed to fetch comments' });
    }

    const masked = (comments || []).map((c) => {
      let maskedEmail = 'Anonymous';
      if (c.user_email && c.user_email.includes('@')) {
        const [user, domain] = c.user_email.split('@');
        maskedEmail = `${user.slice(0, 2)}***@${domain}`;
      }
      return { ...c, masked_email: maskedEmail };
    });

    res.json(masked);
  } catch (error) {
    console.error('GET /api/issues/:id/comments error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
