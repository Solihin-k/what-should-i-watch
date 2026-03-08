import { Router } from 'express';
import { generateRecommendations, generateGuidedRecommendations } from '../services/recommendService.js';

const router = Router();

router.post('/recommend/guided', async (req, res, next) => {
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({ error: 'Request timed out. Please try again.' });
    }
  }, 45000);

  try {
    const { tags, platforms, region } = req.body;
    console.log('[Route] POST /recommend/guided | moods:', (tags?.moods || []).join(','), '| platforms:', (platforms || []).length, '| region:', region || 'SG');

    if (!tags || !tags.moods || !Array.isArray(tags.moods)) {
      clearTimeout(timeout);
      return res.status(400).json({ error: 'tags with moods array is required' });
    }
    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      clearTimeout(timeout);
      return res.status(400).json({ error: 'platforms is required and must be a non-empty array' });
    }

    const result = await generateGuidedRecommendations({
      tags,
      platforms,
      region: region || 'SG',
    });

    clearTimeout(timeout);
    if (!res.headersSent) {
      res.json({
        recommendations: result.recommendations,
        followUpMessage: result.followUpMessage,
      });
    }
  } catch (err) {
    clearTimeout(timeout);
    if (!res.headersSent) {
      next(err);
    }
  }
});

router.post('/recommend', async (req, res, next) => {
  // Request-level timeout (~45s) — Claude takes 5-10s, validation adds 3-6s, P95 is 15-25s
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({ error: 'Request timed out. Please try again.' });
    }
  }, 45000);

  try {
    const { message, platforms, region, conversationHistory } = req.body;
    console.log('[Route] POST /recommend | message:', (message || '').substring(0, 80), '| platforms:', (platforms || []).length, '| region:', region || 'SG');

    // Input validation
    if (!message || typeof message !== 'string' || !message.trim()) {
      clearTimeout(timeout);
      return res.status(400).json({ error: 'message is required and must be a non-empty string' });
    }
    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      clearTimeout(timeout);
      return res.status(400).json({ error: 'platforms is required and must be a non-empty array' });
    }

    const result = await generateRecommendations({
      message: message.trim(),
      platforms,
      region: region || 'SG',
      conversationHistory: conversationHistory || [],
    });

    clearTimeout(timeout);
    if (!res.headersSent) {
      res.json({
        recommendations: result.recommendations,
        followUpMessage: result.followUpMessage,
        ...(result.retryable && { retryable: true }),
      });
    }
  } catch (err) {
    clearTimeout(timeout);
    if (!res.headersSent) {
      next(err);
    }
  }
});

export default router;
