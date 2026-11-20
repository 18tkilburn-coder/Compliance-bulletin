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
  let cachedBusinessId = null;
  let cachedForAuthUserId = null;

  function supabaseConfigured() {
    return !!(window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url && window.SUPABASE_CONFIG.anonKey);
  }

  function client() {
    return SupabaseClient.get();
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
    return uploadSourceBlob(businessId, filename, blob);
  }

  async function uploadSourceBlob(businessId, filename, blob) {
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

  // `existingSourceFilePath` is set when the file is already in Storage
  // (the Phase 4 AI import uploads it before extraction), so it isn't
  // uploaded a second time.
  async function addPalletLabelBatch({ filename, sourceFileDataUrl, existingSourceFilePath, pallets, grandTotal }) {
    if (!(await useSupabase())) {
      return Store.addPalletLabelBatch({ filename, sourceFileDataUrl, pallets, grandTotal });
    }
    const businessId = await currentBusinessId();
    let sourceFilePath = existingSourceFilePath || null;
    if (!sourceFilePath && sourceFileDataUrl) {
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

  // ---- Phase 4: AI packing-slip extraction ----

  // AI extraction needs the Edge Function, which needs a signed-in
  // business. With no Supabase configured this is false, and the screen
  // keeps its original PDF-only behaviour.
  async function aiExtractionAvailable() {
    return useSupabase();
  }

  // Uploads the file into this business's own Storage folder (the same
  // RLS-checked path convention as batch history), then asks the
  // extract-packing-slip Edge Function to read it. supabase-js sends the
  // signed-in session's token with the call, and the function derives the
  // business from that token alone. Resolves to { extraction, sourceFilePath };
  // the path is handed back to addPalletLabelBatch so the file isn't
  // uploaded twice.
  async function extractPackingSlipWithAi(file) {
    const businessId = await currentBusinessId();
    if (!businessId) throw new Error('Sign in to the shared backend to use AI reading.');
    // The Edge Function picks PDF vs. image handling from the extension, so
    // make sure there is one (e.g. a pasted image with no real filename).
    const extFromType = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type];
    let name = file.name || 'packing-slip';
    if (extFromType && !/\.(pdf|jpe?g|png|webp)$/i.test(name)) name = `${name}.${extFromType}`;
    const sourceFilePath = await uploadSourceBlob(businessId, name, file);
    const { data, error } = await client().functions.invoke('extract-packing-slip', {
      body: { path: sourceFilePath },
    });
    if (error) {
      let message = error.message || 'AI reading failed';
      try {
        const body = error.context && (await error.context.json());
        if (body && body.error) message = body.error;
      } catch (_) {
        // Not a JSON error body (e.g. network failure): keep the generic message.
      }
      throw new Error(message);
    }
    if (!data || !data.extraction) throw new Error('The AI service returned no result.');
    return { extraction: data.extraction, sourceFilePath };
  }

  return {
    aiExtractionAvailable,
    extractPackingSlipWithAi,
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
