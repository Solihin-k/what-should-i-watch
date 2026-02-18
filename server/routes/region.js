import { Router } from 'express';
import { detectRegion } from '../services/regionService.js';

const router = Router();

router.get('/region', async (req, res, next) => {
  try {
    const ip = req.ip;
    const region = await detectRegion(ip);
    res.json(region);
  } catch (error) {
    next(error);
  }
});

export default router;
