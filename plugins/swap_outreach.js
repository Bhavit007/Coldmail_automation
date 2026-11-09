// Replaces "Prepare messages" + "Is email?" + "Send email" + "Email result" in the main workflow with the
// outreach plug-in. Run by swap_outreach.ps1 inside the n8n container. Writes /work/main.json and /work/plugin.json.
const fs = require('fs');
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const exported = read(process.argv[2]);
const main = Array.isArray(exported) ? exported[0] : exported;
const plugin = read('/plugins/outreach.json');

const byName = name => main.nodes.find(n => n.name === name);
if (byName('Outreach (plug-in)')) { console.log('Already swapped - nothing to do.'); process.exit(2); }
const old = ['Prepare messages', 'Is email?', 'Send email', 'Email result'].map(byName);
if (old.some(n => !n) || !byName('Log message')) {
  console.error('Could not find "Prepare messages", "Is email?", "Send email", "Email result" and "Log message" in this workflow.');
  process.exit(1);
}
const [prepare, , sendEmail] = old;

// The plug-in gets the Gmail login and the test settings the main workflow already uses.
const settingsNode = main.nodes.find(n => (n.parameters?.assignments?.assignments || []).some(a => a.name === 'test_email'));
const current = Object.fromEntries((settingsNode?.parameters.assignments.assignments || []).map(a => [a.name, a.value]));
for (const n of plugin.nodes) {
  if (n.name === 'Send email' && sendEmail.credentials) n.credentials = sendEmail.credentials;
  if (n.name === 'Settings') for (const a of n.parameters.assignments.assignments) if (a.name in current) a.value = current[a.name];
}

const outreach = {
  parameters: { source: 'database', workflowId: { __rl: true, value: plugin.id, mode: 'id' }, mode: 'each', options: { waitForSubWorkflow: true } },
  id: require('crypto').randomUUID(), name: 'Outreach (plug-in)', type: 'n8n-nodes-base.executeWorkflow', typeVersion: 1.2,
  position: prepare.position,
};
main.nodes = main.nodes.filter(n => !old.includes(n)).concat(outreach);

// Rewire: whatever fed "Prepare messages" now feeds the plug-in; the plug-in feeds "Log message".
for (const name of ['Prepare messages', 'Is email?', 'Send email', 'Email result']) delete main.connections[name];
for (const src of Object.values(main.connections)) {
  for (const outs of src.main || []) for (const c of outs || []) if (c.node === 'Prepare messages') c.node = 'Outreach (plug-in)';
}
main.connections['Outreach (plug-in)'] = { main: [[{ node: 'Log message', type: 'main', index: 0 }]] };

for (const k of ['versionId', 'activeVersionId', 'versionCounter', 'versionMetadata']) delete main[k];
fs.writeFileSync('/work/main.json', JSON.stringify(main));
fs.writeFileSync('/work/plugin.json', JSON.stringify(plugin));
console.log(`Swapped. Test mode: ${current.test_mode ?? 'on'}, test email: ${current.test_email ?? '(plug-in default)'}`);
