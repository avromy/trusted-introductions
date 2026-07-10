function uniqueE2EId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildE2ERecord(prefix, overrides = {}) {
  return {
    id: uniqueE2EId(prefix),
    createdBy: 'playwright',
    cleanupTag: 'trusted-introductions-e2e',
    ...overrides,
  };
}

async function cleanupE2ERecords() {
  // Placeholder for Supabase-backed cleanup. Test-created records should include
  // cleanupTag so future database fixtures can delete only E2E-owned data.
}

module.exports = { uniqueE2EId, buildE2ERecord, cleanupE2ERecords };
