// Replaces "Enrich prompt" + "Claude: enrich" + "Score and route" in the main workflow with the
// enrichment plug-in. Run by swap_enrichment.ps1 inside the n8n container. Writes /work/main.json and /work/plugin.json.
const fs = require('fs');
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const exported = read(process.argv[2]);
const main = Array.isArray(exported) ? exported[0] : exported;
const plugin = read('/plugins/enrich_claude.json');
const paste = read('/plugins/paste_into_main_workflow.json');

const byName = name => main.nodes.find(n => n.name === name);
const oldPrompt = byName('Enrich prompt'), oldClaude = byName('Claude: enrich'), oldScore = byName('Score and route');
if (byName('Enrich (plug-in)')) { console.log('Already swapped - nothing to do.'); process.exit(2); }
if (!oldPrompt || !oldClaude || !oldScore) {
  console.error('Could not find the nodes "Enrich prompt", "Claude: enrich" and "Score and route" in this workflow.');
  process.exit(1);
}

// Plug-in gets the same Claude key and model the main workflow already uses.
const settingsNode = main.nodes.find(n => (n.parameters?.assignments?.assignments || []).some(a => a.name === 'claude_model'));
const model = settingsNode?.parameters.assignments.assignments.find(a => a.name === 'claude_model').value;
for (const n of plugin.nodes) {
  if (n.name === 'Claude: enrich' && oldClaude.credentials) n.credentials = oldClaude.credentials;
  if (n.name === 'Settings' && model) n.parameters.assignments.assignments.find(a => a.name === 'claude_model').value = model;
}

// Swap the nodes, keeping their places on the canvas.
const enrich = paste.nodes.find(n => n.name === 'Enrich (plug-in)');
const score = paste.nodes.find(n => n.name === 'Score and route');
enrich.parameters.workflowId = { __rl: true, value: plugin.id, mode: 'id' };
enrich.position = oldPrompt.position;
score.position = oldScore.position;
main.nodes = main.nodes.filter(n => ![oldPrompt, oldClaude, oldScore].includes(n)).concat(enrich, score);

// Rewire: whatever fed "Enrich prompt" now feeds the plug-in node; "Score and route" keeps its outputs.
delete main.connections['Enrich prompt'];
delete main.connections['Claude: enrich'];
for (const src of Object.values(main.connections)) {
  for (const outs of src.main || []) for (const c of outs || []) if (c.node === 'Enrich prompt') c.node = 'Enrich (plug-in)';
}
main.connections['Enrich (plug-in)'] = { main: [[{ node: 'Score and route', type: 'main', index: 0 }]] };

for (const k of ['versionId', 'activeVersionId', 'versionCounter', 'versionMetadata']) delete main[k];
fs.writeFileSync('/work/main.json', JSON.stringify(main));
fs.writeFileSync('/work/plugin.json', JSON.stringify(plugin));
console.log(`Swapped. Plug-in uses model: ${model || '(not found - set it in the plug-in Settings)'}`);
