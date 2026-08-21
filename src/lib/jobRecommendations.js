// Local job scoring for CV-based recommendations.
// No AI calls here — matches the user's structured CV data (cv_data)
// against active job fields. Works across languages because both sides
// are normalized to English by the edge functions.

const WEIGHTS = {
  skill: 0.4,
  role: 0.25,
  location: 0.1,
  salary: 0.1,
  seniority: 0.15,
};

function tokensOf(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s+/]/gu, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

// True if the whole phrase (every significant token) appears in the haystack.
function phraseHits(phrase, haystack) {
  const toks = tokensOf(phrase);
  if (!toks.length) return false;
  return toks.every(tok => haystack.includes(tok));
}

function jobSearchText(job) {
  const quals = job.qualifications_en || job.qualifications || [];
  const resp = job.responsibilities_en || job.responsibilities || [];
  return [
    job.title_en || job.title,
    job.description_en || job.description || '',
    ...quals,
    ...resp,
    job.category || '',
    job.type || '',
  ]
    .join(' ')
    .toLowerCase();
}

export function scoreJob(job, cv) {
  if (!cv) return null;

  const haystack = jobSearchText(job);
  const skills = Array.isArray(cv.skills) ? cv.skills : [];
  const roles = Array.isArray(cv.desired_roles) ? cv.desired_roles : [];

  // 1. Skills: each skill phrase matched against the job text.
  const matched = [];
  let skillHits = 0;
  for (const skill of skills) {
    const s = String(skill).trim();
    if (!s) continue;
    if (phraseHits(s, haystack)) {
      matched.push(s);
      skillHits += 1;
    }
  }
  const skillScore = skills.length ? skillHits / skills.length : 0;

  // 2. Desired roles: any role phrase matching the title/description.
  let roleScore = 0;
  for (const role of roles) {
    const r = String(role).trim();
    if (!r) continue;
    if (phraseHits(r, haystack)) {
      roleScore = Math.max(roleScore, 1);
    } else {
      const toks = tokensOf(r);
      if (toks.length) {
        const some = toks.filter(tok => haystack.includes(tok)).length;
        roleScore = Math.max(roleScore, Math.min(1, some / toks.length));
      }
    }
  }

  // 3. Location: CV location vs job city/location.
  let locScore = 0.5;
  const cvLoc = cv.location ? cv.location.toLowerCase() : '';
  if (cvLoc) {
    const jobPlace = [job.city, job.location].filter(Boolean).join(' ').toLowerCase();
    locScore = jobPlace.includes(cvLoc) || cvLoc.includes(jobPlace) ? 1 : 0.5;
  }

  // 4. Salary fit: CV expectation vs job range.
  let salScore = 0.5;
  const exp = cv.salary_expectation || {};
  if (typeof exp.min === 'number') {
    const jobMin = job.salary_min != null ? Number(job.salary_min) : 0;
    const jobMax = job.salary_max != null ? Number(job.salary_max) : Number.MAX_SAFE_INTEGER;
    salScore = exp.min <= jobMax ? 1 : 0.2;
  }

  // 5. Seniority: CV experience vs job type.
  let senScore = 0.5;
  const yrs = cv.years_experience;
  if (typeof yrs === 'number' && yrs != null) {
    const type = (job.type || '').toLowerCase();
    if (type.includes('intern')) senScore = yrs <= 1 ? 1 : 0.4;
    else if (type.includes('part') || type.includes('contract')) senScore = 1;
    else senScore = yrs >= 2 ? 1 : 0.6;
  }

  const raw =
    skillScore * WEIGHTS.skill +
    roleScore * WEIGHTS.role +
    locScore * WEIGHTS.location +
    salScore * WEIGHTS.salary +
    senScore * WEIGHTS.seniority;

  return {
    score: Math.round(Math.max(0, Math.min(1, raw)) * 100),
    matched,
  };
}

// Sort jobs by score (descending). Jobs with no match info go last.
export function rankJobs(jobs, cv) {
  const scored = jobs.map(job => ({
    job,
    match: scoreJob(job, cv),
  }));
  scored.sort((a, b) => {
    const sa = a.match ? a.match.score : -1;
    const sb = b.match ? b.match.score : -1;
    return sb - sa;
  });
  return scored.map(s => s.job);
}
