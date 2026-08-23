// Profile completion calculator.
// Returns { percent, missing } where missing is a list of field keys.

const CHECKS = [
  ['avatar', (p) => !!p.avatar_url],
  ['cover', (p) => !!p.cover_url],
  ['fullName', (p) => !!(p.full_name && String(p.full_name).trim())],
  ['username', (p) => !!p.username],
  ['jobTitle', (p) => !!(p.job_title && String(p.job_title).trim())],
  ['location', (p) => !!(p.location && String(p.location).trim())],
  ['bio', (p) => !!(p.bio && String(p.bio).trim().length >= 20)],
  [
    'socialLinks',
    (p) => Array.isArray(p.social_links) && p.social_links.filter(Boolean).length > 0,
  ],
  ['cv', (p) => !!p.cv_url],
];

export function getProfileCompletion(profile) {
  if (!profile) return { percent: 0, missing: [] };
  const done = CHECKS.filter(([, ok]) => ok(profile)).length;
  const percent = Math.round((done / CHECKS.length) * 100);
  const missing = CHECKS.filter(([, ok]) => !ok(profile)).map(([key]) => key);
  return { percent, missing };
}
