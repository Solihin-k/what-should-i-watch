import { Router } from 'express';
import PLATFORMS from '../config/platforms.js';

const router = Router();

router.get('/platforms', (req, res) => {
  // req.query.region is available for future Tier 2 filtering
  // For now, return all Tier 1 platforms regardless of region
  res.json(PLATFORMS);
});

export default router;
