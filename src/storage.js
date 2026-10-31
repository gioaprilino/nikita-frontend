const KEY = 'nikita_cases';

export function loadCases() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCases(cases) {
  localStorage.setItem(KEY, JSON.stringify(cases));
}

export function addCase(entry) {
  const cases = loadCases();
  const idx = cases.findIndex((c) => c.id === entry.id);
  if (idx >= 0) cases[idx] = entry;
  else cases.unshift(entry);
  saveCases(cases);
  return entry;
}

export function getCase(id) {
  return loadCases().find((c) => c.id === id) || null;
}

export function updateVerdict(id, verdict) {
  const cases = loadCases();
  const c = cases.find((x) => x.id === id);
  if (c) {
    c.verdict = verdict;
    saveCases(cases);
  }
  return c;
}