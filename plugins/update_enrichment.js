// Replaces the enrichment plug-in with v2 (Crawl4AI reads the website, Claude fills the gaps, US sources),
// keeping your Claude key and model from the current version.
// Run by update_enrichment.ps1 inside the n8n container: node update_enrichment.js <export of all workflows>
const fs = require('fs');
const all = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const plugin = JSON.parse(fs.readFileSync('/plugins/enrich_claude.json', 'utf8'));
const current = all.find(w => w.id === plugin.id);
if (!current) { console.error(`The enrichment plug-in (${plugin.id}) is not in n8n. Run swap_enrichment.ps1 first.`); process.exit(1); }
if (current.nodes.some(n => n.name === 'Crawl4AI: read website')) { console.log('Already updated - nothing to do.'); process.exit(2); }

const old = name => current.nodes.find(n => n.name === name);
const model = (old('Settings')?.parameters.assignments.assignments || []).find(a => a.name === 'claude_model')?.value;
for (const n of plugin.nodes) {
  if (n.name === 'Claude: enrich' && old('Claude: enrich')?.credentials) n.credentials = old('Claude: enrich').credentials;
  if (n.name === 'Settings' && model) n.parameters.assignments.assignments.find(a => a.name === 'claude_model').value = model;
}
for (const k of ['versionId', 'activeVersionId', 'versionCounter', 'versionMetadata']) delete plugin[k];
fs.writeFileSync('/work/plugin.json', JSON.stringify(plugin));
console.log(`Enrichment plug-in updated (Claude model: ${model || 'not set - set it in the plug-in Settings'}).`);
