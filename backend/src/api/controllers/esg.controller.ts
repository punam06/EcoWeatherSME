import { Request, Response } from 'express';
import { calculateESGMetrics } from '../../lib/services/esg.service';

export const getESGMetrics = async (req: Request, res: Response) => {
  try {
    const trustScore = parseFloat(req.query.trustScore as string ?? '84');
    const dvs = parseFloat(req.query.dvs as string ?? '72');
    const metrics = await calculateESGMetrics(trustScore, dvs);
    res.json(metrics);
  } catch (error) {
    console.error('Error getting ESG metrics:', error);
    res.status(500).json({ error: 'Failed to get ESG metrics' });
  }
};
