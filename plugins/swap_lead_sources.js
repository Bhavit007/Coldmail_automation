// Makes "Find leads" get its businesses from the lead-sources plug-in:
//  - "Amazon Location search" is replaced by "Lead source (plug-in)"; "Clean results" only builds dedupe keys.
//  - "Save new leads" also saves which source found the lead.
//  - "Next unfinished search" takes searches that never ran first, then the one that ran longest ago,
//    so every source gets a turn.
// Run by swap_lead_sources.ps1 inside the n8n container: node swap_lead_sources.js <export of all workflows>
const fs = require('fs');
const crypto = require('crypto');
const all = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const plugin = JSON.parse(fs.readFileSync('/plugins/lead_sources.json', 'utf8'));
const has = (w, name) => w.nodes.some(n => n.name === name);
const main = all.find(w => has(w, 'Amazon Location search') || has(w, 'Lead source (plug-in)'));
if (!main) { console.error('Could not find the Find leads workflow (no "Amazon Location search" node).'); process.exit(1); }
if (has(main, 'Lead source (plug-in)')) { console.log('Already swapped - nothing to do.'); process.exit(2); }
const byName = name => main.nodes.find(n => n.name === name);
for (const name of ['Settings', 'Next unfinished search', 'Clean results', 'Save new leads']) {
  if (!byName(name)) { console.error(`Could not find "${name}" in ${main.name}.`); process.exit(1); }
}

// 1. The plug-in reuses your Amazon key, AWS region, Claude key and Claude model.
const amazonOld = byName('Amazon Location search');
const region = byName('Settings').parameters.assignments.assignments.find(a => a.name === 'aws_region')?.value;
const claudeCred = all.flatMap(w => w.nodes).find(n => n.credentials?.httpHeaderAuth)?.credentials;
const enrichSettings = [...all].sort((a, b) => (b.id === 'enrichclaude0001') - (a.id === 'enrichclaude0001'))
  .flatMap(w => w.nodes).filter(n => n.name === 'Settings')
  .flatMap(n => n.parameters.assignments?.assignments || []).find(a => a.name === 'claude_model' && !/PASTE/.test(a.value));
for (const n of plugin.nodes) {
  if (n.name === 'Amazon Location' && amazonOld.credentials) n.credentials = amazonOld.credentials;
  if (n.name === 'Claude: find businesses' && claudeCred) n.credentials = claudeCred;
  if (n.name === 'Settings') for (const a of n.parameters.assignments.assignments) {
    if (a.name === 'aws_region' && region) a.value = region;
    if (a.name === 'claude_model' && enrichSettings) a.value = enrichSettings.value;
  }
}

// 2. Find leads.
const next = byName('Next unfinished search');
next.parameters.query = next.parameters.query.replace('ORDER BY q.id', 'ORDER BY q.last_run_at NULLS FIRST, q.id');
byName('Clean results').parameters.jsCode = `// The plug-in's rows -> lead rows. Duplicate check: last 10 phone digits, else name + address.
const r = $input.first().json;
const q = $('Next unfinished search').first(0, $runIndex).json;
const target = $('Settings').first().json.target_new_leads;
const digits = v => String(v || '').replace(/\\D/g, '').slice(-10);
const slug = v => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const rows = (r.rows || []).map(x => ({ ...x, dedupe_key: digits(x.phone) || slug(\`\${x.name} \${x.address || ''}\`) }));
return [{ json: { rows, next_token: r.next_token || '', query_id: q.id, remaining: target - q.new_this_run } }];
`;
const save = byName('Save new leads');
save.parameters.query = save.parameters.query
  .replace('phone text, website text, email text)', 'phone text, website text, email text, source text)')
  .replace('INSERT INTO leads (dedupe_key, name, category, address, city, phone, website, email, query_id)',
           'INSERT INTO leads (dedupe_key, name, category, address, city, phone, website, email, source, query_id)')
  .replace('SELECT dedupe_key, name, category, address, city, phone, website, email, $3::int',
           "SELECT dedupe_key, name, category, address, city, phone, website, email, COALESCE(source, 'amazon_location'), $3::int");
if (!save.parameters.query.includes('source text')) { console.error('"Save new leads" has been edited by hand - not changing it.'); process.exit(1); }

main.nodes = main.nodes.filter(n => n !== amazonOld).concat({
  parameters: { source: 'database', workflowId: { __rl: true, value: plugin.id, mode: 'id' }, mode: 'each', options: { waitForSubWorkflow: true } },
  id: crypto.randomUUID(), name: 'Lead source (plug-in)', type: 'n8n-nodes-base.executeWorkflow', typeVersion: 1.2,
  position: amazonOld.position,
});
const C = main.connections;
for (const k of Object.keys(C)) for (const outs of C[k].main) for (const c of outs) if (c.node === amazonOld.name) c.node = 'Lead source (plug-in)';
C['Lead source (plug-in)'] = C[amazonOld.name];
delete C[amazonOld.name];

for (const w of [main, plugin]) for (const k of ['versionId', 'activeVersionId', 'versionCounter', 'versionMetadata']) delete w[k];
fs.writeFileSync('/work/main.json', JSON.stringify(main));
fs.writeFileSync('/work/plugin.json', JSON.stringify(plugin));
fs.writeFileSync('/work/publish_main.sh', main.active ? `n8n publish:workflow --id=${main.id}\n` : 'true\n');
console.log(`Swapped "${main.name}" to the lead-sources plug-in (region ${region || 'default'}, Claude model ${enrichSettings?.value || 'not set yet'}).`);
