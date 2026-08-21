// job-translate: translates active jobs' title / description /
// qualifications / responsibilities into English and stores them in the
// `*_en` columns so local matching always compares English -> English.
//
// Deploy:  npx supabase functions deploy job-translate
// Secret:  npx supabase secrets set OPENAI_API_KEY=sk-xxxx
//
// Schedule: Supabase Dashboard -> Database -> Scheduled Functions,
// cron "0 3 * * *" (03:00 UTC), function: job-translate.
// Or call manually once — the function is idempotent.

import { createClient } from 'npm:@supabase/supabase-js@2.48.1';

const OPENAI_MODEL = 'gpt-4o-mini';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TRANSLATE_SCHEMA = {
  name: 'job_translation',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      title_en: { type: 'string' },
      description_en: { type: 'string' },
      qualifications_en: { type: 'array', items: { type: 'string' } },
      responsibilities_en: { type: 'array', items: { type: 'string' } },
    },
    required: ['title_en', 'description_en', 'qualifications_en', 'responsibilities_en'],
    additionalProperties: false,
  },
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

async function translateJob(
  job: { id: number; title: string; description: string | null; qualifications: unknown; responsibilities: unknown },
  apiKey: string,
) {
  const payload = {
    model: OPENAI_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You translate job postings into English. Respond ONLY with valid JSON matching the provided schema. ' +
          'Preserve meaning, do not invent facts. Keep each qualification/responsibility as a separate array item.',
      },
      {
        role: 'user',
        content:
          `Translate this job posting into English:\n\n` +
          `TITLE: ${job.title}\n` +
          `DESCRIPTION: ${job.description || ''}\n` +
          `QUALIFICATIONS: ${JSON.stringify(job.qualifications || [])}\n` +
          `RESPONSIBILITIES: ${JSON.stringify(job.responsibilities || [])}`,
      },
    ],
    response_format: { type: 'json_schema', json_schema: TRANSLATE_SCHEMA },
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error('OpenAI error:', res.status, await res.text());
    throw new Error('ai_error');
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('ai_invalid_json');
  }
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

  const { data: jobs, error: jobErr } = await supabase
    .from('jobs')
    .select('id, title, description, qualifications, responsibilities, title_en, description_en, qualifications_en, responsibilities_en')
    .eq('status', 'active')
    .limit(500);

  if (jobErr) return json({ error: 'db_error', detail: jobErr.message }, 500);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const job of jobs || []) {
    if (job.title_en && job.description_en) {
      skipped++;
      continue;
    }

    try {
      const result = await translateJob(job, apiKey);
      const { error: updErr } = await supabase
        .from('jobs')
        .update({
          title_en: result.title_en,
          description_en: result.description_en,
          qualifications_en: result.qualifications_en || [],
          responsibilities_en: result.responsibilities_en || [],
        })
        .eq('id', job.id);
      if (updErr) throw updErr;
      updated++;
    } catch (err) {
      console.error('Failed job', job.id, err);
      failed++;
    }
  }

  return json({ ok: true, updated, skipped, failed }, 200);
});
