// Pallet Labels V2, Phase 4: AI packing-slip extraction.
//
// Reads a packing slip (photo or PDF) that the browser has already uploaded
// to the private `pallet-label-sources` bucket, asks Claude to transcribe
// it, and returns the raw rows for the browser's existing review table.
// It does what Claude used to do by hand from Tom's photos
// (Per4m_Pallet_Label_Handover.md section 1). This function writes nothing,
// and everything downstream (pallet splitting, the totals checks, history)
// stays in the browser exactly as before.
//
// Tenant isolation: this function never holds the service-role key. It acts
// AS the caller, using their own Auth token, so every read goes through the
// same Row Level Security policies as the browser:
//   - `businesses` returns only the caller's own row (or nothing);
//   - storage.download() of another business's path is refused by the
//     bucket's RLS policy before any bytes reach this function.
// We also check the path's first segment against the caller's own business
// id explicitly, so a cross-tenant request is rejected with a clear 403
// before Storage is asked at all (supabase/README.md, "What this does not
// yet cover"). The business id is never taken from the request body.
//
// Secrets (set with `supabase secrets set`, never in the browser):
//   ANTHROPIC_API_KEY — required.
// Provided automatically by the Supabase Edge runtime:
//   SUPABASE_URL, SUPABASE_ANON_KEY.

import Anthropic from 'npm:@anthropic-ai/sdk@1.6.0';
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const BUCKET = 'pallet-label-sources';
const MODEL = 'claude-opus-5-5';

// Size limits, checked against Anthropic's docs on 2026-11-21:
//  - Images: "10 MB (base64-encoded)" per image on the Claude API
//    (build-with-claude/vision). Base64 adds a third, so 5 MB raw is about
//    6.7 MB encoded: comfortably inside, with room for the JSON around it.
//    Images over 8000x8000 px are refused; larger-than-needed ones are
//    downscaled by the API, not rejected.
//  - PDFs: the whole request may be up to 128 MB on the first-party API
//    (build-with-claude/pdf-support; api/errors: 413 request_too_large),
//    up to 600 pages. 20 MB raw is about 27 MB encoded, far inside that.
// Both limits are deliberately conservative, not the API maximums.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PDF_BYTES = 20 * 1024 * 1024;

const IMAGE_TYPES: Record<string, 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// The shape Claude must return. Quantities are per batch row; the browser
// re-adds them itself and compares against stated_total / grand_total, so a
// misread digit shows up as a flagged line instead of slipping through.
const EXTRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['document_title', 'products', 'grand_total', 'warnings'],
  properties: {
    document_title: {
      type: ['string', 'null'],
      description: 'Title line of the sheet, e.g. "UK Manu 1 Trailer 50 (4494) ETA Wed 7 Oct", or null.',
    },
    products: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['product_text', 'flavour', 'rows', 'stated_total'],
        properties: {
          product_text: {
            type: 'string',
            description: 'Product name including its size exactly as printed, without the flavour, e.g. "Per4m Advanced Whey 2.01kg".',
          },
          flavour: {
            type: 'string',
            description: 'Flavour as printed (usually in parentheses after the product), without the parentheses. Empty string if none.',
          },
          rows: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['batch_code', 'bbe_month', 'bbe_year', 'quantity', 'uncertain'],
              properties: {
                batch_code: { type: 'string', description: 'Batch column exactly as printed, e.g. "12345-1".' },
                bbe_month: { type: 'integer', description: 'Month (1-12) of the MM/YYYY date in the LOT column.' },
                bbe_year: { type: 'integer', description: 'Four-digit year of the MM/YYYY date in the LOT column.' },
                quantity: { type: 'integer', description: 'The Total column for this batch row. Never the Count column.' },
                uncertain: {
                  type: 'boolean',
                  description: 'True if any value in this row was hard to read, hand-corrected, or is a best guess.',
                },
              },
            },
          },
          stated_total: {
            type: ['integer', 'null'],
            description: 'The number on this product\'s own "<product> Total" row, or null if the sheet has none.',
          },
        },
      },
    },
    grand_total: {
      type: ['integer', 'null'],
      description: 'The number on the sheet\'s "Grand Total" row, or null if not present.',
    },
    warnings: {
      type: 'array',
      items: { type: 'string' },
      description: 'Plain-English notes for the person checking: illegible cells, hand-written corrections, anything uncertain.',
    },
  },
} as const;

const SYSTEM_PROMPT = `You transcribe warehouse packing slips (delivery notes) so pallet labels can be printed from them. Accuracy matters more than completeness: a wrong digit becomes a wrong physical label.

The usual layout is a title line, then a table with columns Product, Batch, LOT, Total, Count. The LOT cell holds a lot number and a best-before date as MM/YYYY. Each product has one or more batch rows (the Product cell is often blank on rows after the first, meaning "same product"), then a "<product> Total" row, and a "Grand Total" at the bottom. Other suppliers' layouts may differ; map their columns onto the same fields.

Rules:
- Ignore the Count column completely. Quantity is always the Total column of each batch row.
- Copy product names, sizes, flavours and batch codes exactly as printed. Do not correct spelling or expand abbreviations.
- Put each "<product> Total" row's number in stated_total for that product, and the "Grand Total" in grand_total. Do not compute these yourself; transcribe what is printed, or null if absent.
- A hand-written correction (a circled or crossed-out number) replaces the printed number only if it equals the sum of that product's batch rows. Otherwise keep the printed number. Either way, mention the correction in warnings.
- If a cell is unreadable, give your best reading, set uncertain to true on that row, and say exactly which product and row in warnings. Never silently guess.
- If the document is not a packing slip at all, return no products and explain in warnings.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });

  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token || token === authHeader) return json(401, { error: 'Not signed in.' });

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json(500, { error: 'AI extraction is not configured on the server (ANTHROPIC_API_KEY missing).' });

  // A client that carries the caller's own token, so RLS applies to every
  // query below exactly as it does in the browser.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Supabase's documented Edge Function pattern: verify the caller's JWT
  // explicitly with the Auth server, rather than relying on a session.
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) return json(401, { error: 'Not signed in.' });

  const { data: business, error: businessError } = await supabase.from('businesses').select('id').maybeSingle();
  if (businessError) return json(500, { error: 'Could not look up your business.' });
  if (!business) return json(403, { error: 'This login is not linked to a business.' });

  let path: unknown;
  try {
    ({ path } = await req.json());
  } catch {
    return json(400, { error: 'Request body must be JSON: { "path": "..." }.' });
  }
  if (typeof path !== 'string' || !path || path.includes('..')) {
    return json(400, { error: 'Missing or invalid "path".' });
  }
  if (path.split('/')[0] !== business.id) {
    return json(403, { error: 'That file does not belong to your business.' });
  }

  const ext = (path.split('.').pop() || '').toLowerCase();
  const isPdf = ext === 'pdf';
  const imageType = IMAGE_TYPES[ext];
  if (!isPdf && !imageType) {
    return json(415, { error: 'Unsupported file type. Upload a PDF or a JPEG/PNG/WebP photo.' });
  }

  const { data: blob, error: downloadError } = await supabase.storage.from(BUCKET).download(path);
  if (downloadError || !blob) return json(404, { error: 'Uploaded file not found.' });

  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (isPdf && bytes.byteLength > MAX_PDF_BYTES) {
    return json(413, { error: 'That PDF is too large to read (over 20 MB).' });
  }
  if (!isPdf && bytes.byteLength > MAX_IMAGE_BYTES) {
    return json(413, { error: 'That photo is too large to read (over 5 MB). Try a smaller photo.' });
  }
  const data = base64Encode(bytes);

  const fileBlock = isPdf
    ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data } }
    : { type: 'image' as const, source: { type: 'base64' as const, media_type: imageType, data } };

  const anthropic = new Anthropic({ apiKey });

  let response;
  try {
    response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM_PROMPT,
      output_config: {
        effort: 'high',
        format: { type: 'json_schema', schema: EXTRACTION_SCHEMA },
      },
      messages: [
        {
          role: 'user',
          content: [fileBlock, { type: 'text', text: 'Transcribe this packing slip.' }],
        },
      ],
    });
  } catch (err) {
    // Logs carry only status codes, request ids and sizes — never document
    // content or the API's message text, which can quote parts of the input.
    if (err instanceof Anthropic.RateLimitError) {
      logSafe('claude_rate_limited', { status: err.status, request_id: err.requestID, business_id: business.id });
      return json(503, { error: 'The AI service is busy. Wait a minute and try again.' });
    }
    if (err instanceof Anthropic.BadRequestError) {
      logSafe('claude_bad_request', {
        status: err.status,
        request_id: err.requestID,
        business_id: business.id,
        file_kind: isPdf ? 'pdf' : 'image',
        file_bytes: bytes.byteLength,
      });
      return json(422, { error: 'The AI service could not read that file. Try a clearer photo or a different export.' });
    }
    if (err instanceof Anthropic.APIError) {
      logSafe('claude_api_error', { status: err.status, request_id: err.requestID, business_id: business.id });
      return json(502, { error: 'The AI service returned an error. Try again shortly.' });
    }
    logSafe('claude_unreachable', { error_name: err instanceof Error ? err.name : typeof err, business_id: business.id });
    return json(502, { error: 'Could not reach the AI service.' });
  }

  if (response.stop_reason === 'refusal') {
    return json(422, { error: 'The AI service declined to read this document.' });
  }
  if (response.stop_reason === 'max_tokens') {
    return json(422, { error: 'The packing slip was too long to read in one go. Split it into smaller files.' });
  }

  const text = response.content
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { type: string; text?: string }) => b.text || '')
    .join('');

  let extraction;
  try {
    extraction = JSON.parse(text);
  } catch {
    logSafe('unparseable_model_output', {
      request_id: response._request_id,
      business_id: business.id,
      stop_reason: response.stop_reason,
      output_chars: text.length,
    });
    return json(502, { error: 'The AI service returned an unreadable answer. Try again.' });
  }

  return json(200, { model: response.model, extraction });
});

// One JSON line per event, with only non-sensitive fields: never file
// names, paths, document text or model output.
function logSafe(event: string, fields: Record<string, string | number | null | undefined>): void {
  console.error(JSON.stringify({ event, ...fields }));
}

// Chunked so large files don't overflow the argument limit of
// String.fromCharCode.apply.
function base64Encode(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
