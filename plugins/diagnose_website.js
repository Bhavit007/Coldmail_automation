// Prints what the website plug-in is set to and what happened in its last runs (read-only).
// Run by diagnose_website.ps1 inside the n8n container.
const sqlite3 = require(process.env.SQLITE_MODULE || '/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const db = new sqlite3.Database(process.env.N8N_DB || '/home/node/.n8n/database.sqlite', sqlite3.OPEN_READONLY);
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));
const ID = 'websiteplug00001';

const settingsOf = nodesJson => {
  const nodes = JSON.parse(nodesJson || '[]');
  const s = nodes.find(n => n.name === 'Settings');
  const c = nodes.find(n => n.name === 'Claude: write website');
  const b = nodes.find(n => n.name === 'Build request');
  const v = Object.fromEntries((s?.parameters.assignments.assignments || []).filter(a => a.name !== 'website_prompt').map(a => [a.name, a.value]));
  return { ...v, timeout_ms: c?.parameters.options?.timeout, response: c?.parameters.options?.response?.response?.responseFormat || 'json',
    streaming: /stream: true/.test(b?.parameters.jsCode || ''), thinking: (b?.parameters.jsCode.match(/thinking: \{[^}]*\}/) || [''])[0],
    has_credential: !!c?.credentials };
};

(async () => {
  const wf = (await all('SELECT active, nodes FROM workflow_entity WHERE id = ?', [ID]))[0];
  if (!wf) { console.log('Website plug-in (websiteplug00001) is not in n8n. Run swap_website.ps1 first.'); return; }
  console.log('== Website plug-in');
  console.log('published:', !!wf.active);
  console.log('saved settings:    ', JSON.stringify(settingsOf(wf.nodes)));
  try {
    const pub = (await all('SELECT v.nodes FROM workflow_published_version p JOIN workflow_history v ON v.versionId = p.publishedVersionId WHERE p.workflowId = ?', [ID]))[0];
    if (pub) console.log('published settings:', JSON.stringify(settingsOf(pub.nodes)));
  } catch (e) { /* older n8n: no published-version table */ }

  const runs = await all(`SELECT e.id, e.status, e.startedAt, e.stoppedAt, d.data FROM execution_entity e
    JOIN execution_data d ON d.executionId = e.id WHERE e.workflowId = ? ORDER BY e.id DESC LIMIT 5`, [ID]);
  console.log(`\n== Last ${runs.length} runs (newest first)`);
  for (const r of runs) {
    const raw = r.data || '';
    const secs = r.stoppedAt ? Math.round((new Date(r.stoppedAt) - new Date(r.startedAt)) / 1000) : null;
    const last = (re) => { const m = [...raw.matchAll(re)]; return m.length ? m[m.length - 1][1] : '-'; };
    console.log(`\nrun ${r.id}: ${r.status}, ${secs === null ? 'still running' : secs + ' s'}`);
    console.log('  stop_reason:  ', last(/stop_reason\\*"\s*:\s*\\*"(\w+)/g));
    console.log('  output_tokens:', last(/output_tokens\\*"\s*:\s*(\d+)/g));
    console.log('  thinking pieces:', (raw.match(/thinking_delta/g) || []).length, '| text pieces:', (raw.match(/text_delta/g) || []).length);
    const errs = [...new Set([...raw.matchAll(/(?:Website: |"message\\*"\s*:\s*\\*")([^"\\]{8,220})/g)].map(m => m[1]))].slice(0, 3);
    for (const e of errs) console.log('  message:', e);
  }
  db.close();
})().catch(e => { console.error('Could not read n8n database:', e.message); process.exit(1); });
