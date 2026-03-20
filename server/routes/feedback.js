import { Router } from 'express';

const router = Router();

router.post('/feedback', (req, res) => {
  const { title, feedback } = req.body;

  if (!title || !feedback || !['up', 'down'].includes(feedback)) {
    return res.status(400).json({ error: 'title and feedback (up/down) are required' });
  }

  console.log(`[Feedback] ${feedback === 'up' ? '👍' : '👎'} ${title}`);
  res.json({ success: true });
});

export default router;
