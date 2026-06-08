/**
 * ═══════════════════════════════════════════════════════════════
 * CLIMALOGIX AI — SPOT PRICING ROUTE
 * File: src/api/routes/spotPricing.route.ts
 *
 * GET /api/spot-pricing/:batchId
 * Returns dynamic spot clearances driven by TST exposure risk.
 * ═══════════════════════════════════════════════════════════════
 */

import { Router, Request, Response, NextFunction } from 'express';
import { evaluateExposure } from '../../lib/services/merm.service';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { getBatchFromStore } from '../../lib/services/batchStore.service';
import { getWeatherByCity } from '../../lib/services/weather.service';
import { SpotPricingResponse } from '../../lib/types';
import { authenticateJWT } from '../../middleware/authenticateJWT';

const router = Router();

// TST Threshold Named Constants
const HIGH_RISK_THRESHOLD_MINS = 120; // TST below 2 hours
const MEDIUM_RISK_THRESHOLD_MINS = 240; // TST below 4 hours

// Discount Rate Named Constants (ROADMAP "10% / 30% Spot Clearances")
const HIGH_RISK_DISCOUNT = 0.30; // 30% OFF
const MEDIUM_RISK_DISCOUNT = 0.10; // 10% OFF
const SAFE_DISCOUNT = 0.00; // 0% OFF

/**
 * GET /api/spot-pricing/:batchId
 * Resolves the batch record, invokes the MERM TST engine, and calculates clearance prices.
 */
router.get('/:batchId', authenticateJWT, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { batchId } = req.params;

    // ── 1. Validate Batch ID ───────────────────────────────────
    if (!batchId || typeof batchId !== 'string' || batchId.trim().length === 0 || batchId.length > 100) {
      res.status(400).json({ error: 'Valid batchId parameter is required (max 100 characters)' });
      return;
    }

    const cleanBatchId = batchId.trim();

    // ── 2. Retrieve Batch Record ───────────────────────────────
    let batch: any = null;

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('batches')
        .select('*')
        .eq('id', cleanBatchId)
        .single();
      
      if (!error && data) {
        batch = data;
      }
    }

    // In-memory fallback
    if (!batch) {
      batch = getBatchFromStore(cleanBatchId);
    }

    if (!batch) {
      res.status(404).json({ error: 'Batch not found' });
      return;
    }

    // ── 3. Call TST Engine with Environment Weather Data ───────
    let ambientTemperature = 33; // Summer daytime regional Dhaka average
    const solarHour = new Date().getHours();

    try {
      const weather = await getWeatherByCity(batch.destination_zone || 'Dhaka', 'en');
      if (weather && weather.found) {
        ambientTemperature = weather.temperature;
      }
    } catch (weatherErr) {
      console.warn('[SpotPricing] Failed to load live weather, utilizing default 33°C:', weatherErr);
    }

    const mermResult = evaluateExposure({
      zone: batch.destination_zone || 'Old Dhaka',
      ambientTemperature,
      solarHour
    });

    const tstMinutes = mermResult.tstMinutes;

    // ── 4. Calculate Risk Tier, Discount & Prices ──────────────
    let riskTier: 'high' | 'medium' | 'safe' = 'safe';
    let riskLabel = 'Safe for Standard Transit';
    let warningMessage = 'Thermal survival time is optimal. Temperature conditions are safe for standard transport.';
    let discountRate = SAFE_DISCOUNT;

    if (tstMinutes < HIGH_RISK_THRESHOLD_MINS) {
      riskTier = 'high';
      riskLabel = 'High Risk — Fast Clearance';
      warningMessage = 'Extreme temperature exposure! Product thermal limit is critical. Clear immediately to prevent spoilage.';
      discountRate = HIGH_RISK_DISCOUNT;
    } else if (tstMinutes < MEDIUM_RISK_THRESHOLD_MINS) {
      riskTier = 'medium';
      riskLabel = 'Medium Risk — Spot Deal';
      warningMessage = 'Moderate heat stress detected. Shipping timeline is constrained. Dispatch with priority.';
      discountRate = MEDIUM_RISK_DISCOUNT;
    }

    // Real pricing logic based on product type and weight
    const pricingMap: Record<string, number> = {
      'Bio-Slurry': 500,
      'Biochar': 800,
      'EM-1 Bio-Culture': 1200,
      'Organic Compost': 300,
      'Liquid Fertiliser': 600,
    };
    
    const productType = batch.product_type || 'Unknown';
    const unitPrice = pricingMap[productType] || 1000;
    const weightFactor = (batch.weight_kg && batch.weight_kg > 0) ? (batch.weight_kg / 50) : 1;
    
    const basePrice = Math.round(unitPrice * weightFactor);
    const discountedPrice = Math.round(basePrice * (1 - discountRate));
    const discountPercent = Math.round(discountRate * 100);

    const pricingResponse: SpotPricingResponse = {
      batchId: batch.id || batch.batch_number,
      productName: batch.product_name || 'Unnamed Organic Product',
      basePrice,
      discountedPrice,
      discountPercent,
      tstMinutes,
      riskTier,
      riskLabel,
      warningMessage,
      currency: 'BDT'
    };

    res.status(200).json(pricingResponse);
  } catch (error) {
    console.error('[SpotPricingRoute] Internal Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
