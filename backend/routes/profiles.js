const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// GET /api/profiles/leaderboard - top 5 citizens by points
router.get('/leaderboard', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, civic_points, badge, total_reports, verified_reports')
      .not('civic_points', 'is', null)
      .order('civic_points', { ascending: false })
      .limit(5);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }

    res.json(data || []);
  } catch (error) {
    console.error('GET /api/profiles/leaderboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/profiles/:userId - get user profile with points
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, civic_points, badge, total_reports, verified_reports, role')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('GET /api/profiles/:userId error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
