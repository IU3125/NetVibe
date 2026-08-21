// cv-analyze: reads a user's CV (PDF from the 'cvs' bucket), extracts
// structured data with OpenAI (translated to English) and stores it in cv_data.
//
// Deploy:  npx supabase functions deploy cv-analyze
// Secret:  npx supabase secrets set OPENAI_API_KEY=sk-xxxx
// Call:    supabase.functions.invoke('cv-analyze', { body: { cvUrl } })
//
// Rate limit: 1 analysis per user / 24h (cv_analysis_log).

import { createClient } from 'npm:@supabase/supabase-js@2.48.1';
import pdfParse from 'npm:pdf-parse@1.1.1';

const OPENAI_MODEL = 'gpt-4o-mini';
const MAX_CV_CHARS = 8000;
const MIN_TEXT_CHARS = 50;
const RATE_LIMIT_HOURS = 24;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXTRACTION_SCHEMA = {
  name: 'cv_extraction',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      skills: { type: 'array', items: { type: 'string' } },
      desired_roles: { type: 'array', items: { type: 'string' } },
      years_experience: { type: ['number', 'null'], default: null },
      location: { type: 'string' },
      salary_expectation: {
        type: 'object',
        properties: {
          min: { type: ['number', 'null'], default: null },
          max: { type: ['number', 'null'], default: null },
          currency: { type: 'string' },
          period: { type: 'string' },
        },
        required: ['min', 'max', 'currency', 'period'],
        additionalProperties: false,
      },
      summary: { type: 'string' },
    },
    required: [
      'skills', 'desired_roles', 'years_experience',
      'location', 'salary_expectation', 'summary',
    ],
    additionalProperties: false,
  },
};

function json(body: unknown, status: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...headers },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!apiKey || !supabaseUrl || !serviceRole) {
    return json({ error: 'server_not_configured' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRole);

  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace('Bearer ', '');
  const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !user) return json({ error: 'unauthorized' }, 401);

  let body: { cvUrl?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const { cvUrl } = body;
  if (!cvUrl || typeof cvUrl !== 'string') {
    return json({ error: 'missing_cv_url' }, 400);
  }

  // Rate limit: max 1 analysis per user / 24h.
  const since = new Date(Date.now() - RATE_LIMIT_HOURS * 3600_000).toISOString();
  const { data: recent, error: logErr } = await supabase
    .from('cv_analysis_log')
    .select('id')
    .eq('user_id', user.id)
    .gte('created_at', since)
    .maybeSingle();
  if (logErr) return json({ error: 'db_error', detail: logErr.message }, 500);
  if (recent) return json({ error: 'rate_limited' }, 429);

  // Download the PDF.
  let pdfRes: Response;
  try {
    pdfRes = await fetch(cvUrl);
  } catch {
    return json({ error: 'cv_download_failed' }, 400);
  }
  if (!pdfRes.ok) return json({ error: 'cv_download_failed' }, 400);
  const pdfBuf = new Uint8Array(await pdfRes.arrayBuffer());

  // Extract text.
  let text = '';
  try {
    const dataBuffer = (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function')
      ? Buffer.from(pdfBuf)
      : pdfBuf;
    const parsed = await pdfParse(dataBuffer as unknown as ArrayBuffer);
    text = parsed.text || '';
  } catch (err) {
    return json({ error: 'pdf_parse_failed', detail: String(err) }, 400);
  }

  text = text.replace(/\s+/g, ' ').trim();
  if (text.length < MIN_TEXT_CHARS) {
    return json({ error: 'scanned_pdf' }, 422);
  }
  if (text.length > MAX_CV_CHARS) text = text.slice(0, MAX_CV_CHARS);

  // OpenAI structured extraction (English output).
  const aiPayload = {
    model: OPENAI_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You extract structured data from CVs. Respond ONLY with valid JSON matching the provided schema. ' +
          'All string values must be in English — translate them from the source language. ' +
          'If a value is missing, use an empty array/string or null.',
      },
      { role: 'user', content: `Extract from this CV:\n\n${text}` },
    ],
    response_format: { type: 'json_schema', json_schema: EXTRACTION_SCHEMA },
  };

  const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(aiPayload),
  });

  if (!aiRes.ok) {
    const errBody = await aiRes.text();
    console.error('OpenAI error:', aiRes.status, errBody);
    return json({ error: 'ai_error' }, 502);
  }

  const aiData = await aiRes.json();
  const raw = aiData?.choices?.[0]?.message?.content;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return json({ error: 'ai_invalid_json' }, 502);
  }

  // Idempotency: bump the version so a slower, older response never wins.
  const { data: existing } = await supabase
    .from('cv_data')
    .select('analysis_version')
    .eq('user_id', user.id)
    .maybeSingle();

  const salary = (parsed.salary_expectation as Record<string, unknown>) || {};
  const row = {
    user_id: user.id,
    skills: Array.isArray(parsed.skills) ? parsed.skills : [],
    desired_roles: Array.isArray(parsed.desired_roles) ? parsed.desired_roles : [],
    years_experience: typeof parsed.years_experience === 'number' ? parsed.years_experience : null,
    location: typeof parsed.location === 'string' ? parsed.location : null,
    salary_expectation: salary,
    summary: typeof parsed.summary === 'string' ? parsed.summary : null,
    source_url: cvUrl,
    analysis_version: (existing?.analysis_version ?? 0) + 1,
    analyzed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error: upsertErr } = await supabase
    .from('cv_data')
    .upsert(row, { onConflict: 'user_id' });
  if (upsertErr) return json({ error: 'db_error', detail: upsertErr.message }, 500);

  await supabase.from('cv_analysis_log').insert({ user_id: user.id });

  return json({ ok: true, data: parsed }, 200);
});
