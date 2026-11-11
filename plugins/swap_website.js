// Makes the website plug-in build every landing page:
//  - Process leads: "Score and route" stops building the basic page; leads that reach 8+ go through
//    "Website (plug-in)" before "Save result".
//  - Dashboard: the "Build page" button uses "Website (force build)" instead of "Build pages", and answers
//    the browser straight away because Claude takes a minute or two per page.
// Run by swap_website.ps1 inside the n8n container. Writes /work/main.json and /work/plugin.json.
const fs = require('fs');
const crypto = require('crypto');
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const exported = read(process.argv[2]);
const main = Array.isArray(exported) ? exported[0] : exported;
const plugin = read('/plugins/website.json');
const byName = name => main.nodes.find(n => n.name === name);
const C = main.connections;
const to = (node, index = 0) => ({ node, type: 'main', index });
const pluginNode = (name, position) => ({
  parameters: { source: 'database', workflowId: { __rl: true, value: plugin.id, mode: 'id' }, mode: 'each', options: { waitForSubWorkflow: true } },
  id: crypto.randomUUID(), name, type: 'n8n-nodes-base.executeWorkflow', typeVersion: 1.2, position,
});

if (byName('Website (plug-in)') || byName('Website (force build)')) { console.log('Already swapped - nothing to do.'); process.exit(2); }
const score = byName('Score and route'), buildPages = byName('Build pages');
if (!score && !buildPages) { console.error('Could not find "Score and route" or "Build pages" in this workflow.'); process.exit(1); }

// The plug-in uses the same Claude key as the rest of the workflow.
const claudeNode = main.nodes.find(n => n.credentials?.httpHeaderAuth);
for (const n of plugin.nodes) if (n.name === 'Claude: write website' && claudeNode) n.credentials = claudeNode.credentials;

if (score) {
  const old = "landing_html: status === 'ready_to_send' ? page(lead, d) : ''";
  if (!score.parameters.jsCode.includes(old)) { console.error('"Score and route" has been edited by hand - not changing it.'); process.exit(1); }
  score.parameters.jsCode = score.parameters.jsCode.replace(old, "landing_html: ''");
  const [x, y] = score.position;
  main.nodes.push({
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, combinator: 'and',
      conditions: [{ id: crypto.randomUUID(), leftValue: "={{ $json.status === 'ready_to_send' }}", rightValue: '',
        operator: { type: 'boolean', operation: 'true', singleValue: true } }] }, options: {} },
    id: crypto.randomUUID(), name: 'Needs page?', type: 'n8n-nodes-base.if', typeVersion: 2, position: [x + 220, y],
  }, pluginNode('Website (plug-in)', [x + 440, y - 120]));
  C['Score and route'] = { main: [[to('Needs page?')]] };
  C['Needs page?'] = { main: [[to('Website (plug-in)')], [to('Save result')]] };
  C['Website (plug-in)'] = { main: [[to('Save result')]] };
}

if (buildPages) {
  for (const name of ['Get leads to build', 'Save pages', 'Which button?', 'Read request']) {
    if (!byName(name)) { console.error(`Could not find "${name}" in this workflow.`); process.exit(1); }
  }
  // Give the plug-in everything it needs about each lead.
  byName('Get leads to build').parameters.query =
    'SELECT id, name, category, address, city, phone, email, website, enrichment::text AS enrichment FROM leads WHERE id = ANY($1::int[]);';
  // Only mark ready when a page came back; otherwise keep the status and save the reason.
  const save = byName('Save pages');
  save.parameters.query = "UPDATE leads SET landing_html = $2, status = CASE WHEN $2 <> '' THEN 'ready_to_send' ELSE status END, notes = $3 WHERE id = $1::int;";
  save.parameters.options.queryReplacement = "={{ [$json.id, $json.landing_html ?? '', $json.notes ?? ''] }}";
  // Answer the browser first, then build in the background.
  const read = byName('Read request');
  read.parameters.jsCode = read.parameters.jsCode
    .replace("build: 'Pages built for'", "build: 'Building pages for'")
    .replace("(action === 'send' ? ' Refresh", "(['send', 'build'].includes(action) ? ' Refresh");
  const back = byName('Back to dashboard') || byName('Sending... back to dashboard');
  const reply = { ...JSON.parse(JSON.stringify(back)), id: crypto.randomUUID(), name: 'Building... back to dashboard',
    position: [buildPages.position[0] - 440, buildPages.position[1] - 120] };
  main.nodes = main.nodes.filter(n => n !== buildPages).concat(reply, pluginNode('Website (force build)', buildPages.position));
  const buttonOuts = C['Which button?'].main;
  buttonOuts[1] = buttonOuts[1].map(c => (c.node === 'Get leads to build' ? to('Building... back to dashboard') : c));
  C['Building... back to dashboard'] = { main: [[to('Get leads to build')]] };
  C['Get leads to build'] = { main: [[to('Website (force build)')]] };
  C['Website (force build)'] = { main: [[to('Save pages')]] };
  delete C['Build pages'];
  delete C['Save pages'];
}

for (const k of ['versionId', 'activeVersionId', 'versionCounter', 'versionMetadata']) delete main[k];
fs.writeFileSync('/work/main.json', JSON.stringify(main));
fs.writeFileSync('/work/plugin.json', JSON.stringify(plugin));
console.log(`Swapped:${score ? ' lead processing' : ''}${buildPages ? ' dashboard Build page button' : ''}.`);
