/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI — SHARED BATCH STORE SERVICE
 * File: src/lib/services/batchStore.service.ts
 *
 * Implements a shared in-memory database store for organic batches.
 * Serves as a robust fallback when Supabase is not configured,
 * ensuring dynamic updates are fully preserved across API calls.
 * ═══════════════════════════════════════════════════════════════
 */

export interface Batch {
  id: string;
  batch_number: string;
  product_name: string;
  product_type: string;
  weight_kg: number;
  packaging_type: string;
  destination_zone: string;
  status: 'pending' | 'active' | 'certified' | 'dispatched' | 'delivered';
  trust_score: number;
  processor_id?: string;
  created_at: string;
  certificate_url?: string;
  qr_code_url?: string;
}

const _now = new Date();
const _seed = _now.getFullYear() * 100 + _now.getMonth() * 10 + _now.getDate();

const INITIAL_BATCHES: Batch[] = [
  { id: `BCH-${_seed+0}`, batch_number: `BCH-${_seed+0}`, product_name: "Bio-Slurry Concentrate",    status: "certified",  trust_score: 70+((_seed+0*7)%30),  destination_zone: "Old Dhaka",   weight_kg: 80+((_seed+0*13)%220),  product_type: "Bio-Slurry", packaging_type: "Standard", created_at: new Date(Date.now()-0*18000000).toISOString() },
  { id: `BCH-${_seed+1}`, batch_number: `BCH-${_seed+1}`, product_name: "Biochar Granules",           status: "active",     trust_score: 70+((_seed+1*7)%30),  destination_zone: "Mirpur",      weight_kg: 80+((_seed+1*13)%220),  product_type: "Biochar", packaging_type: "Standard", created_at: new Date(Date.now()-1*18000000).toISOString() },
  { id: `BCH-${_seed+2}`, batch_number: `BCH-${_seed+2}`, product_name: "EM-1 Bio-Culture",           status: "pending",    trust_score: 70+((_seed+2*7)%30),  destination_zone: "Gulshan",     weight_kg: 80+((_seed+2*13)%220),  product_type: "EM-1 Bio-Culture", packaging_type: "Standard", created_at: new Date(Date.now()-2*18000000).toISOString() },
  { id: `BCH-${_seed+3}`, batch_number: `BCH-${_seed+3}`, product_name: "Organic Compost",            status: "dispatched", trust_score: 70+((_seed+3*7)%30),  destination_zone: "Savar",       weight_kg: 80+((_seed+3*13)%220),  product_type: "Organic Compost", packaging_type: "Standard", created_at: new Date(Date.now()-3*18000000).toISOString() },
  { id: `BCH-${_seed+4}`, batch_number: `BCH-${_seed+4}`, product_name: "Liquid Fertiliser",          status: "delivered",  trust_score: 70+((_seed+4*7)%30),  destination_zone: "Dhanmondi",   weight_kg: 80+((_seed+4*13)%220),  product_type: "Liquid Fertiliser", packaging_type: "Standard", created_at: new Date(Date.now()-4*18000000).toISOString() },
  { id: `BCH-${_seed+5}`, batch_number: `BCH-${_seed+5}`, product_name: "Thermal-Safe Vaccine Batch", status: "certified",  trust_score: 70+((_seed+5*7)%30),  destination_zone: "Uttara",      weight_kg: 80+((_seed+5*13)%220),  product_type: "Thermal-Safe Vaccine Batch", packaging_type: "Standard", created_at: new Date(Date.now()-5*18000000).toISOString() },
  { id: `BCH-${_seed+6}`, batch_number: `BCH-${_seed+6}`, product_name: "Fresh Dairy Mix",            status: "active",     trust_score: 70+((_seed+6*7)%30),  destination_zone: "Banani",      weight_kg: 80+((_seed+6*13)%220),  product_type: "Fresh Dairy Mix", packaging_type: "Standard", created_at: new Date(Date.now()-6*18000000).toISOString() },
  { id: `BCH-${_seed+7}`, batch_number: `BCH-${_seed+7}`, product_name: "Carbon-Neutral Biochar",     status: "certified",  trust_score: 70+((_seed+7*7)%30),  destination_zone: "Motijheel",   weight_kg: 80+((_seed+7*13)%220),  product_type: "Biochar", packaging_type: "Standard", created_at: new Date(Date.now()-7*18000000).toISOString() },
  { id: `BCH-${_seed+8}`, batch_number: `BCH-${_seed+8}`, product_name: "Cold-Chain Fish Paste",      status: "pending",    trust_score: 70+((_seed+8*7)%30),  destination_zone: "Jatrabari",   weight_kg: 80+((_seed+8*13)%220),  product_type: "Cold-Chain Fish Paste", packaging_type: "Standard", created_at: new Date(Date.now()-8*18000000).toISOString() },
  { id: `BCH-${_seed+9}`, batch_number: `BCH-${_seed+9}`, product_name: "Poultry Probiotic Mix",      status: "dispatched", trust_score: 70+((_seed+9*7)%30),  destination_zone: "Tejgaon",     weight_kg: 80+((_seed+9*13)%220),  product_type: "Poultry Probiotic Mix", packaging_type: "Standard", created_at: new Date(Date.now()-9*18000000).toISOString() }
];

let batches: Batch[] = [...INITIAL_BATCHES];

/**
 * Returns all batches in the in-memory database.
 */
export function getBatchesList(): Batch[] {
  return batches;
}

/**
 * Adds a new batch to the in-memory database.
 */
export function addBatch(batch: Omit<Batch, 'id' | 'created_at'> & { id?: string }): Batch {
  const _now = new Date();
  const id = batch.id || batch.batch_number || `BCH-${Date.now().toString().slice(-6)}`;
  const newBatch: Batch = {
    ...batch,
    id,
    batch_number: batch.batch_number || id,
    created_at: _now.toISOString()
  };
  batches.unshift(newBatch); // Prepends to keep it as the first item in lists
  return newBatch;
}

/**
 * Updates a batch in the in-memory database by ID or batch_number.
 */
export function updateBatchInStore(id: string, updates: Partial<Batch>): Batch | undefined {
  const index = batches.findIndex(b => b.id === id || b.batch_number === id);
  if (index !== -1) {
    batches[index] = { ...batches[index], ...updates };
    return batches[index];
  }
  return undefined;
}

/**
 * Retrieves a single batch from the in-memory database.
 */
export function getBatchFromStore(id: string): Batch | undefined {
  return batches.find(b => b.id === id || b.batch_number === id);
}

/**
 * Deletes a batch from the in-memory database.
 */
export function deleteBatchFromStore(id: string): boolean {
  const index = batches.findIndex(b => b.id === id || b.batch_number === id);
  if (index !== -1) {
    batches.splice(index, 1);
    return true;
  }
  return false;
}

