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

      // ── QR Scan Logging (non-blocking) ──────────────────────────────
      // Every hit to /api/verify/:batch_id is a QR scan. Log it so the
      // operator dashboard can show "Recent QR Scans" and the Tracking
      // view can display the full source-to-consumer journey.
      let scanCount = 0;
      try {
        const supabase2 = getSupabaseClient();
        // Insert scan record (fire-and-forget — don't block the response)
        const userAgent = req.headers['user-agent'] || 'unknown';
        const ipHash = (() => {
          const raw = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
          // Simple hash so we never store raw IPs
          let h = 0;
          for (let i = 0; i < raw.length; i++) h = ((h << 5) - h + raw.charCodeAt(i)) | 0;
          return `h_${Math.abs(h).toString(36)}`;
        })();

        // Fire-and-forget: don't await, don't block the response.
        // Wrap in Promise.resolve to give us a real Promise with .catch.
        Promise.resolve(supabase2.from('qr_scans').insert({
          batch_id,
          user_agent: userAgent.slice(0, 255),
          ip_hash: ipHash,
          scanned_at: new Date().toISOString(),
        })).catch(() => { /* scan logging is best-effort */ });

        // Count total scans for this batch (best-effort)
        const { count } = await supabase2
          .from('qr_scans')
          .select('*', { count: 'exact', head: true })
          .eq('batch_id', batch_id);
        scanCount = count ?? 0;
      } catch (_scanErr) { /* scan logging is best-effort */ }

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
          scanCount,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
