const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const geminiService = require('../services/geminiService');
const { advanceTimelineToStep, buildTimelineSteps } = require('../utils/timeline');

// GET /api/admin/issues
router.get('/issues', async (req, res) => {
  try {
    const { data: issues, error } = await supabase
      .from('issues')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching admin issues:', error);
      return res.status(500).json({ error: 'Failed to fetch issues' });
    }

    res.json(issues);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/admin/issues/:id/status
router.put('/issues/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    // 1. Fetch issue to get details for Groq
    const { data: issue, error: fetchError } = await supabase
      .from('issues')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    // Calculate days open
    const createdDate = new Date(issue.created_at);
    const today = new Date();
    const daysOpen = Math.floor((today - createdDate) / (1000 * 60 * 60 * 24));

    // 2. Draft Admin Response using Groq
    let adminMessage = null;
    const draft = await geminiService.draftAdminResponse(
      issue.title,
      issue.category,
      status,
      adminNotes,
      daysOpen
    );

    if (draft && draft.message) {
      adminMessage = draft.message;
    }

    const updatePayload = {
      status,
      admin_message: adminMessage,
      timeline_steps: buildTimelineSteps(status, issue.timeline_steps),
    };

    if (status === 'resolved') {
      updatePayload.resolution_verified_at = issue.resolution_verified_at || new Date().toISOString();
    }

    if (status === 'in-progress') {
      updatePayload.resolution_verified_at = null;
    }

    // 3. Update issue in Supabase
    const { data: updatedIssue, error: updateError } = await supabase
      .from('issues')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating issue status:', updateError);
      return res.status(500).json({ error: 'Failed to update issue status' });
    }

    res.json({
      issue: updatedIssue,
      drafted_response: draft
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/admin/issues/:id/timeline-step
router.put('/issues/:id/timeline-step', async (req, res) => {
  try {
    const { id } = req.params;
    const { stepId, mode = 'current' } = req.body;

    const { data: issue, error: fetchError } = await supabase
      .from('issues')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    const { status, steps } = advanceTimelineToStep(stepId, issue.timeline_steps, mode);
    const payload = {
      status,
      timeline_steps: steps,
    };

    if (status === 'resolved') {
      payload.resolution_verified_at = issue.resolution_verified_at || new Date().toISOString();
    }

    const { data: updatedIssue, error: updateError } = await supabase
      .from('issues')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating issue timeline:', updateError);
      return res.status(500).json({ error: 'Failed to update timeline step' });
    }

    res.json(updatedIssue);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/broadcast
router.post('/broadcast', async (req, res) => {
  try {
    const { message, type, severity } = req.body;

    if (!message || !type || !severity) {
      return res.status(400).json({ error: 'Message, type, and severity are required' });
    }

    const { data, error } = await supabase
      .from('broadcasts')
      .insert([
        { message, type, severity, is_active: true }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating broadcast:', error);
      return res.status(500).json({ error: 'Failed to create broadcast' });
    }

    res.status(201).json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/emergency
router.post('/emergency', async (req, res) => {
  try {
    const { message, severity } = req.body;

    if (!message || !severity) {
      return res.status(400).json({ error: 'Message and severity are required' });
    }

    const { data, error } = await supabase
      .from('broadcasts')
      .insert([
        { message, type: 'emergency', severity, is_active: true }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating emergency:', error);
      return res.status(500).json({ error: 'Failed to create emergency' });
    }

    res.status(201).json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/broadcasts
router.get('/broadcasts', async (req, res) => {
  try {
    const { data: broadcasts, error } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching broadcasts:', error);
      return res.status(500).json({ error: 'Failed to fetch broadcasts' });
    }

    res.json(broadcasts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
