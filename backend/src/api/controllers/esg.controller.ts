import { Request, Response } from 'express';
import { calculateESGMetrics } from '../../lib/services/esg.service';

export const getESGMetrics = async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const metrics = await calculateESGMetrics(req.user.id);
    res.json(metrics);
  } catch (error) {
    console.error('Error getting ESG metrics:', error);
    res.status(500).json({ error: 'Failed to get ESG metrics' });
  }
};
