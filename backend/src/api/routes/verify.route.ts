/**
 * ═══════════════════════════════════════════════════════════════
 * CLIMALOGIX AI — PUBLIC VERIFY ROUTE
 * File: src/api/routes/verify.route.ts
 *
 *   GET /api/verify/:batch_id
 *
 * This is the consumer-facing endpoint hit by the QR code on
 * the product label. It returns:
 *
 *   - the trust score and grade
 *   - the latest QA report (or a hash-chained demo chain if
 *     the database has no events)
 *   - whether the chain is verified (no tampering)
 *
 * No authentication required.
 * ═══════════════════════════════════════════════════════════════
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { demoChain, verifyChain } from '../../lib/services/provenance.service';

const router = Router();

/**
 * GET /api/verify/:batch_id
 *
 * Response shape:
 *   {
 *     success: true,
 *     data: {
 *       batch_id,
 *       trust: { score, grade, isViable, reference } | null,
 *       chain: { head_hash, verified, events: [...] },
 *       source: 'database' | 'demo'
 *     }
 *   }
 */
router.get(
  '/:batch_id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { batch_id } = req.params;
      if (!batch_id || batch_id.length > 100) {
        res.status(400).json({ success: false, error: 'Invalid batch_id' });
        return;
      }

      if (!isSupabaseConfigured()) {
        // Offline / pre-demo fallback — return a deterministic demo chain
        const chain = demoChain(batch_id);
        res.status(200).json({
          success: true,
          data: {
            batch_id,
            trust: null,
            chain,
            source: 'demo',
          },
        });
        return;
      }

      const supabase = getSupabaseClient();

      // 1. Latest trust score
      const { data: trustRow } = await supabase
        .from('trust_score_logs')
        .select('score, grade, is_viable, created_at')
        .eq('batch_id', batch_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // 2. Provenance events
      const { data: events, error: evErr } = await supabase
        .from('provenance_records')
        .select('seq, type, actor, data, prev_hash, current_hash, timestamp')
        .eq('batch_id', batch_id)
        .order('seq', { ascending: true });

      if (evErr) {
        res.status(500).json({ success: false, error: evErr.message });
        return;
      }

      let chain;
      let source: 'database' | 'demo';
      if (!events || events.length === 0) {
        chain = demoChain(batch_id);
        source = 'demo';
      } else {
        const { verified, reason } = verifyChain(events);
        chain = {
          batch_id,
          events,
          head_hash: events[events.length - 1].current_hash,
          verified,
          ...(reason ? { reason } : {}),
        };
        source = 'database';
      }

      res.status(200).json({
        success: true,
        data: {
          batch_id,
          trust: trustRow
            ? {
                score: trustRow.score,
                grade: trustRow.grade,
                isViable: trustRow.is_viable,
              }
            : null,
          chain,
          source,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
