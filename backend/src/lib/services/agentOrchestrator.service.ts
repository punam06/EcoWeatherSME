/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI — AGENT ORCHESTRATOR SERVICE
 * File: src/lib/services/agentOrchestrator.service.ts
 *
 * Central router orchestrating user message classification, execution,
 * BARI RAG lookup, and order transactions. Log all events.
 * ═══════════════════════════════════════════════════════════════
 */

import { getSupabaseClient, isSupabaseConfigured } from '../supabase';
import { getSession, createSession, appendMessage, PendingOrder } from './chatSession.service';
import { classifyIntent } from './intentClassifier.service';
import { searchProducts, Product } from './productSearch.service';
import { initiateOrder, confirmOrder, cancelOrder, getAutoRecommendation, OrderResult } from './orderExecution.service';
import { queryRAGConversational } from './rag.service';

export interface AgentResponse {
  type:
    | 'TEXT'
    | 'PRODUCT_LIST'
    | 'ORDER_CONFIRM_PROMPT'
    | 'ORDER_SUCCESS'
    | 'ORDER_CANCELLED'
    | 'NAVIGATION'
    | 'AUTH_REQUIRED';
  message: string;
  language: 'bn' | 'en';
  products?: Product[];
  pendingOrder?: PendingOrder;
  orderResult?: OrderResult;
  navigationTarget?: string;
  requiresAuth?: boolean;
  sessionId: string;
}

/**
 * Main process pipeline.
 */
export async function processMessage(
  query: string,
  language: 'bn' | 'en',
  sessionId?: string,
  farmerId?: string
): Promise<AgentResponse> {
  // 1. Resolve or Create Session
  let activeSessionId = sessionId;
  let session = sessionId ? getSession(sessionId) : undefined;
  if (!session) {
    const newSession = createSession(farmerId);
    activeSessionId = newSession.sessionId;
    session = newSession;
  }

  // Sync farmerId if provided on this request
  if (farmerId) {
    session.farmerId = farmerId;
  }

  // Append user message to history
  appendMessage(activeSessionId!, 'user', query);

  // 2. Classify Intent
  const classification = classifyIntent(query);
  const { intent, extractedEntities } = classification;

  let responseType: AgentResponse['type'] = 'TEXT';
  let message = '';
  let responseProducts: Product[] | undefined;
  let responsePendingOrder: PendingOrder | undefined;
  let responseOrderResult: OrderResult | undefined;
  let responseNavigationTarget: string | undefined;
  let requiresAuth = false;

  // 3. Routing Engine
  switch (intent) {
    case 'NAVIGATE': {
      responseType = 'NAVIGATION';
      responseNavigationTarget = extractedEntities.targetPage || '/marketplace';
      message =
        language === 'bn'
          ? `আপনাকে সরাসরি ${responseNavigationTarget} পেজে নিয়ে যাচ্ছি...`
          : `Navigating you to ${responseNavigationTarget} page...`;
      break;
    }

    case 'PRODUCT_SEARCH': {
      const results = await searchProducts(extractedEntities.productType, extractedEntities.cropType);
      session.lastSeenProducts = results;

      if (results.length > 0) {
        responseType = 'PRODUCT_LIST';
        responseProducts = results;
        message =
          language === 'bn'
            ? `আমি আপনার জন্য কিছু উন্নত মানের প্রোডাক্ট খুঁজে পেয়েছি। অনুগ্রহ করে নির্বাচন করুন:`
            : `I found these matching products for you. Please select one:`;
      } else {
        responseType = 'TEXT';
        message =
          language === 'bn'
            ? `দুঃখিত, আপনার পছন্দের সাথে মেলে এমন কোনো প্রোডাক্ট এই মুহূর্তে পাওয়া যায়নি।`
            : `Sorry, I couldn't find any products matching your requirements right now.`;
      }
      break;
    }

    case 'PURCHASE_PRODUCT': {
      const results = await searchProducts(extractedEntities.productType, extractedEntities.cropType);
      session.lastSeenProducts = results;

      if (results.length === 1) {
        const qty = extractedEntities.quantity || 1;
        const pending = initiateOrder(activeSessionId!, results[0], qty, session.farmerId);
        responseType = 'ORDER_CONFIRM_PROMPT';
        responsePendingOrder = pending;
        message =
          language === 'bn'
            ? `আপনি কি BCH-${results[0].name} (${qty} টি) অর্ডার কনফার্ম করতে চান?`
            : `Do you want to confirm the order for ${results[0].name} (Qty: ${qty})?`;
      } else if (results.length > 1) {
        responseType = 'PRODUCT_LIST';
        responseProducts = results;
        message =
          language === 'bn'
            ? `আমি একাধিক প্রোডাক্ট পেয়েছি। অনুগ্রহ করে নিচে থেকে আপনার প্রয়োজনীয় প্রোডাক্টটি নির্বাচন করুন:`
            : `I found multiple matching products. Please pick the correct product to buy:`;
      } else {
        responseType = 'TEXT';
        message =
          language === 'bn'
            ? `দুঃখিত, কোনো প্রোডাক্ট পাওয়া যায়নি।`
            : `Sorry, no products found to purchase.`;
      }
      break;
    }

    case 'PRODUCT_SELECT': {
      const lastList = session.lastSeenProducts;
      const index = extractedEntities.selectionIndex ?? 0;
      if (lastList && lastList[index]) {
        const product = lastList[index];
        const pending = initiateOrder(activeSessionId!, product, 1, session.farmerId);
        responseType = 'ORDER_CONFIRM_PROMPT';
        responsePendingOrder = pending;
        message =
          language === 'bn'
            ? `আপনি "${product.name}" প্রোডাক্টটি নির্বাচন করেছেন। অর্ডার সম্পন্ন করতে কনফার্ম করুন:`
            : `You selected "${product.name}". Please confirm to complete order:`;
      } else {
        responseType = 'TEXT';
        message =
          language === 'bn'
            ? `অনুগ্রহ করে তালিকা থেকে সঠিক প্রোডাক্টটি পুনরায় নির্বাচন করুন।`
            : `Please make a valid selection from the product list.`;
      }
      break;
    }

    case 'AUTO_RECOMMEND_BUY': {
      const best = await getAutoRecommendation(extractedEntities.productType, extractedEntities.cropType);
      if (best) {
        const qty = extractedEntities.quantity || 1;
        const pending = initiateOrder(activeSessionId!, best, qty, session.farmerId);
        responseType = 'ORDER_CONFIRM_PROMPT';
        responsePendingOrder = pending;
        const cropName = extractedEntities.cropType || 'আপনার ফসল';
        message =
          language === 'bn'
            ? `আমি ${cropName} এর জন্য সেরা প্রোডাক্ট "${best.name}" নির্বাচন করেছি। কনফার্ম করতে চেক করুন:`
            : `I selected the best product "${best.name}" for your ${cropName}. Confirm order below:`;
      } else {
        responseType = 'TEXT';
        message =
          language === 'bn'
            ? `দুঃখিত, এই মুহূর্তে অটো-সুপারিশ করার মতো কোনো প্রোডাক্ট পাওয়া যায়নি।`
            : `Sorry, I couldn't find any products to automatically recommend right now.`;
      }
      break;
    }

    case 'ORDER_CONFIRM': {
      if (!session.pendingOrder) {
        responseType = 'TEXT';
        message =
          language === 'bn'
            ? `আপনার কোনো পেন্ডিং অর্ডার নেই। নতুন অর্ডার করতে প্রোডাক্ট খুঁজুন।`
            : `No pending order found. Find a product first.`;
      } else {
        const result = await confirmOrder(activeSessionId!, session.farmerId);
        if (result.success) {
          responseType = 'ORDER_SUCCESS';
          responseOrderResult = result;
          message =
            language === 'bn'
              ? `অভিনন্দন! আপনার অর্ডারটি সফলভাবে সম্পন্ন হয়েছে। অর্ডার আইডি: ${result.orderId}`
              : `Congratulations! Your order has been placed. Order ID: ${result.orderId}`;
        } else if (result.requiresAuth) {
          responseType = 'AUTH_REQUIRED';
          requiresAuth = true;
          message =
            language === 'bn'
              ? `অর্ডার করতে অনুগ্রহ করে লগইন করুন।`
              : `Please log in to complete your purchase.`;
        } else {
          responseType = 'TEXT';
          message = result.message;
        }
      }
      break;
    }

    case 'ORDER_CANCEL': {
      cancelOrder(activeSessionId!);
      responseType = 'ORDER_CANCELLED';
      message =
        language === 'bn'
          ? `আপনার অর্ডারটি সফলভাবে বাতিল করা হয়েছে।`
          : `Your pending order has been successfully canceled.`;
      break;
    }

    case 'GENERAL_ADVICE':
    case 'UNKNOWN':
    default: {
      const ragResult = await queryRAGConversational(query, language, session.history.slice(-5, -1));
      responseType = 'TEXT';
      message = ragResult.answer;
      break;
    }
  }

  // Append assistant message to history
  appendMessage(activeSessionId!, 'assistant', message);

  // 4. Log interaction asynchronously to Supabase
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    (async () => {
      try {
        const { error } = await supabase
          .from('agent_interaction_logs')
          .insert({
            session_id: activeSessionId,
            farmer_id: session.farmerId || null,
            message: query,
            intent,
            response_type: responseType,
            language,
          });
        if (error) {
          console.warn('[AgentOrchestrator] Interaction log failed:', error.message);
        }
      } catch (err: any) {
        console.warn('[AgentOrchestrator] Interaction log failed with exception:', err.message || err);
      }
    })();
  }

  return {
    type: responseType,
    message,
    language,
    products: responseProducts,
    pendingOrder: responsePendingOrder,
    orderResult: responseOrderResult,
    navigationTarget: responseNavigationTarget,
    requiresAuth,
    sessionId: activeSessionId!,
  };
}
