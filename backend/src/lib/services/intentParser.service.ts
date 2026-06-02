/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI — INTENT PARSER SERVICE
 * File: src/lib/services/intentParser.service.ts
 *
 * Fuses Bangla & English speech transcripts into structured order payloads.
 * ═══════════════════════════════════════════════════════════════
 */

export interface CheckoutIntentResult {
  isCheckout: boolean;
  productName: string | null;
  quantity: number | null;
  unit: string | null;
  rawTranscript: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Parses raw voice transcripts in Bangla or mixed Bangla-English for checkout intent.
 * 
 * @param transcript Raw transcript text from Speech Recognition
 * @param availableProducts Known product names to match against
 */
export function parseCheckoutIntent(
  transcript: string,
  availableProducts: string[]
): CheckoutIntentResult {
  const lowerTranscript = (transcript || '').toLowerCase().trim();

  // 1. Detect checkout intent keyword
  const intentKeywords = [
    'অর্ডার', 'কিনতে চাই', 'কিনব', 'দিন', 'পাঠান',
    'order', 'buy', 'purchase', 'send', 'want'
  ];
  const isCheckout = intentKeywords.some((kw) => lowerTranscript.includes(kw));

  if (!isCheckout) {
    return {
      isCheckout: false,
      productName: null,
      quantity: null,
      unit: null,
      rawTranscript: transcript,
      confidence: 'low',
    };
  }

  // 2. Extract Product Name
  let productName: string | null = null;
  const productMappings: Record<string, string[]> = {
    'Biochar': ['biochar', 'বায়োচার', 'বায়ো-চার'],
    'Trichoderma': ['trichoderma', 'ট্রাইকোডার্মা', 'ট্রাইকো'],
    'Rhizobium': ['rhizobium', 'রাইজোবিয়াম', 'রাইজো'],
    'Neem Oil': ['neem oil', 'নিম তেল', 'নিম'],
    'Bio-Fertilizer': ['bio-fertilizer', 'fertilizer', 'জৈব সার', 'সার']
  };

  // Try mapping-based search first for the defined core products
  for (const [prodName, keywords] of Object.entries(productMappings)) {
    if (keywords.some((kw) => lowerTranscript.includes(kw))) {
      const found = availableProducts.find((p) => p.toLowerCase() === prodName.toLowerCase());
      if (found) {
        productName = found;
        break;
      }
    }
  }

  // Fallback: Direct substring check against availableProducts list
  if (!productName) {
    const found = availableProducts.find((p) => lowerTranscript.includes(p.toLowerCase()));
    if (found) {
      productName = found;
    }
  }

  // 3. Extract Quantity
  let quantity: number | null = null;
  const banglaNumWords: Record<string, number> = {
    'এক': 1, 'দুই': 2, 'তিন': 3, 'চার': 4, 'পাঁচ': 5, 'ছয়': 6, 'সাত': 7, 'আট': 8, 'নয়': 9, 'দশ': 10
  };

  // Match Bangla word numbers
  for (const [word, val] of Object.entries(banglaNumWords)) {
    if (lowerTranscript.includes(word)) {
      quantity = val;
      break;
    }
  }

  // Match digits (English or Bangla)
  if (quantity === null) {
    const digitMatch = lowerTranscript.match(/[0-9]+/);
    if (digitMatch) {
      quantity = parseInt(digitMatch[0], 10);
    } else {
      const banglaDigitMatch = lowerTranscript.match(/[০-৯]+/);
      if (banglaDigitMatch) {
        const banglaDigits = '০১২৩৪৫৬৭৮৯';
        const engDigits = '0123456789';
        const converted = banglaDigitMatch[0]
          .split('')
          .map((char) => {
            const idx = banglaDigits.indexOf(char);
            return idx !== -1 ? engDigits[idx] : char;
          })
          .join('');
        quantity = parseInt(converted, 10);
      }
    }
  }

  // 4. Extract Unit
  let unit: string | null = null;
  const unitMappings: Record<string, string[]> = {
    'bag': ['bag', 'bags', 'ব্যাগ'],
    'kg': ['kg', 'kgs', 'kilogram', 'কেজি', 'কে.জি.', 'কিলোগ্রাম'],
    'liter': ['liter', 'liters', 'litre', 'litres', 'লিটার', 'লি.টার'],
    'bottle': ['bottle', 'bottles', 'বোতল']
  };

  for (const [ut, keywords] of Object.entries(unitMappings)) {
    if (keywords.some((kw) => lowerTranscript.includes(kw))) {
      unit = ut;
      break;
    }
  }

  // 5. Determine Confidence
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (productName && quantity) {
    confidence = 'high';
  } else if (productName || quantity) {
    confidence = 'medium';
  }

  return {
    isCheckout,
    productName,
    quantity,
    unit,
    rawTranscript: transcript,
    confidence,
  };
}
