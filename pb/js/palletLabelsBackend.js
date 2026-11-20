// Pallet Labels V2 — Phase 1 data-access layer.
//
// This module exists so js/screens/palletLabels.js never has to know or
// care whether it's talking to Supabase or to the original Store/
// localStorage functions. Scope, per the approved architecture
// (PALLET_LABELS_V2_DECISION_RECORD.md / PALLET_LABELS_V2_C2_REVISED.md in
// the repo root): ONLY pallet allocation rules and pallet label batch
// history move through here. Everything else Pallet Labels needs (there is
// nothing else — see the audit) stays exactly as it was.
//
// Behaviour, by design:
//  - If window.SUPABASE_CONFIG.url/anonKey are unset (see
//    js/supabaseConfig.js), OR no business is currently signed in (see
//    js/businessAuth.js), every function below transparently falls back to
//    calling the original Store.* functions, wrapped as a resolved Promise.
//    This means: until a real Supabase project is configured, the app
//    behaves EXACTLY as it did before this file existed. This is
//    deliberate — Phase 1 must not change behaviour for any deployment
//    that hasn't been set up yet.
//  - Once configured AND signed in, every function instead talks to
//    Supabase directly from the browser, relying ENTIRELY on Row Level
//    Security (see supabase/migrations/) to enforce business isolation.
//    This file implements no isolation logic of its own and must not be
//    asked to — it trusts the database to refuse whatever it should refuse.

const PalletLabelsBackend = (() => {
  let cachedClient = null;
  let cachedBusinessId = null;
  let cachedForAuthUserId = null;

  function supabaseConfigured() {
    return !!(window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url && window.SUPABASE_CONFIG.anonKey);
  }

  function client() {
    if (!cachedClient) {
      cachedClient = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
    }
    return cachedClient;
  }

  // Resolves to the signed-in business's own `businesses.id`, or null if
  // not configured / not signed in. Cached per auth session so every call
  // doesn't re-query the businesses table; invalidated automatically if
  // the signed-in user changes (sign-in/sign-out/different business).
  async function currentBusinessId() {
    if (!supabaseConfigured()) return null;
    const sb = client();
    const {
      data: { session },
    } = await sb.auth.getSession();
    if (!session) {
      cachedBusinessId = null;
      cachedForAuthUserId = null;
      return null;
    }
    if (cachedBusinessId && cachedForAuthUserId === session.user.id) {
      return cachedBusinessId;
    }
    const { data, error } = await sb.from('businesses').select('id').single();
    if (error || !data) {
      cachedBusinessId = null;
      cachedForAuthUserId = null;
      return null;
    }
    cachedBusinessId = data.id;
    cachedForAuthUserId = session.user.id;
    return cachedBusinessId;
  }

  async function useSupabase() {
    return (await currentBusinessId()) !== null;
  }

  // ---- Pallet limits ----

  async function getPalletLimits() {
    if (!(await useSupabase())) return Store.getPalletLimits();
    const businessId = await currentBusinessId();
    const { data, error } = await client()
      .from('pallet_limits')
      .select('size_key, max_qty_per_pallet')
      .eq('business_id', businessId);
    if (error) throw error;
    const limits = {};
    (data || []).forEach((row) => {
      limits[row.size_key] = row.max_qty_per_pallet;
    });
    return limits;
  }

  async function setPalletLimit(size, maxQty) {
    if (!(await useSupabase())) return Store.setPalletLimit(size, maxQty);
    const businessId = await currentBusinessId();
    const { error } = await client()
      .from('pallet_limits')
      .upsert(
        { business_id: businessId, size_key: size, max_qty_per_pallet: Number(maxQty) },
        { onConflict: 'business_id,size_key' }
      );
    if (error) throw error;
    return getPalletLimits();
  }

  async function deletePalletLimit(size) {
    if (!(await useSupabase())) return Store.deletePalletLimit(size);
    const businessId = await currentBusinessId();
    const { error } = await client().from('pallet_limits').delete().eq('business_id', businessId).eq('size_key', size);
    if (error) throw error;
    return getPalletLimits();
  }

  // ---- Pallet label batches ----

  function defaultPalletBatchName(filename) {
    if (filename) return filename;
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleDateString('en-GB', { month: 'short' });
    const year = d.getFullYear();
    return `Pallet Labels – ${day} ${month} ${year}`;
  }

  // Uploads a data-URL source file into this business's own Storage
  // folder, path-prefixed by business_id exactly as the storage RLS
  // policies expect: {business_id}/{random}/{filename}.
  async function uploadSourceFile(businessId, filename, dataUrl) {
    const blob = await (await fetch(dataUrl)).blob();
    const randomSegment =
      (window.crypto && window.crypto.randomUUID && window.crypto.randomUUID()) ||
      `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const safeName = (filename || 'packing-slip.pdf').replace(/[^\w.\-]+/g, '_');
    const path = `${businessId}/${randomSegment}/${safeName}`;
    const { error } = await client()
      .storage.from('pallet-label-sources')
      .upload(path, blob, { contentType: blob.type || 'application/pdf' });
    if (error) throw error;
    return path;
  }

  async function downloadSourceFile(path) {
    const { data, error } = await client().storage.from('pallet-label-sources').download(path);
    if (error) throw error;
    return data; // a Blob
  }

  function normaliseBatchRow(row) {
    return {
      id: row.id,
      filename: row.filename || '',
      name: row.name,
      sourceFileDataUrl: null, // only ever set on the localStorage-fallback shape
      sourceFilePath: row.source_file_path || null,
      pallets: row.pallets,
      grandTotal: row.grand_total,
      generatedAt: new Date(row.generated_at).getTime(),
    };
  }

  async function addPalletLabelBatch({ filename, sourceFileDataUrl, pallets, grandTotal }) {
    if (!(await useSupabase())) {
      return Store.addPalletLabelBatch({ filename, sourceFileDataUrl, pallets, grandTotal });
    }
    const businessId = await currentBusinessId();
    let sourceFilePath = null;
    if (sourceFileDataUrl) {
      sourceFilePath = await uploadSourceFile(businessId, filename, sourceFileDataUrl);
    }
    const name = defaultPalletBatchName(filename);
    const { data, error } = await client()
      .from('pallet_label_batches')
      .insert({
        business_id: businessId,
        name,
        filename: filename || '',
        source_file_path: sourceFilePath,
        pallets,
        grand_total: grandTotal,
        generated_by: window.BusinessAuth ? window.BusinessAuth.currentDisplayName() : null,
      })
      .select()
      .single();
    if (error) throw error;
    return normaliseBatchRow(data);
  }

  async function getPalletLabelBatches() {
    if (!(await useSupabase())) return Store.getPalletLabelBatches();
    const businessId = await currentBusinessId();
    const { data, error } = await client()
      .from('pallet_label_batches')
      .select('*')
      .eq('business_id', businessId)
      .order('generated_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(normaliseBatchRow);
  }

  async function getPalletLabelBatchById(id) {
    if (!(await useSupabase())) return Store.getPalletLabelBatchById(id);
    const businessId = await currentBusinessId();
    const { data, error } = await client()
      .from('pallet_label_batches')
      .select('*')
      .eq('id', id)
      .eq('business_id', businessId)
      .maybeSingle();
    if (error) throw error;
    return data ? normaliseBatchRow(data) : null;
  }

  async function renamePalletLabelBatch(id, name) {
    if (!(await useSupabase())) return Store.renamePalletLabelBatch(id, name);
    const businessId = await currentBusinessId();
    const trimmed = name.trim();
    if (!trimmed) return getPalletLabelBatchById(id);
    const { data, error } = await client()
      .from('pallet_label_batches')
      .update({ name: trimmed })
      .eq('id', id)
      .eq('business_id', businessId)
      .select()
      .single();
    if (error) throw error;
    return normaliseBatchRow(data);
  }

  async function deletePalletLabelBatch(id) {
    if (!(await useSupabase())) return Store.deletePalletLabelBatch(id);
    const businessId = await currentBusinessId();
    const { error } = await client().from('pallet_label_batches').delete().eq('id', id).eq('business_id', businessId);
    if (error) throw error;
  }

  return {
    getPalletLimits,
    setPalletLimit,
    deletePalletLimit,
    addPalletLabelBatch,
    getPalletLabelBatches,
    getPalletLabelBatchById,
    renamePalletLabelBatch,
    deletePalletLabelBatch,
    downloadSourceFile,
  };
})();
