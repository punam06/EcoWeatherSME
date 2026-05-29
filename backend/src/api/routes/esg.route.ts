import { Router } from 'express';
import { getESGMetrics } from '../controllers/esg.controller';

const router = Router();

router.get('/', getESGMetrics);

export default router;
