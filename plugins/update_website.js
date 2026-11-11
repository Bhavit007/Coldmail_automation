// Updates the website plug-in (new Claude thinking settings + streaming) and makes the dashboard show progress:
// "Building page..." under the lead's status while Claude works, the reason if it fails, and an auto-refresh.
// Run by update_website.ps1 inside the n8n container: node update_website.js <main export> <plug-in export>
const fs = require('fs');
const read = f => { const d = JSON.parse(fs.readFileSync(f, 'utf8')); return Array.isArray(d) ? d[0] : d; };
const main = read(process.argv[2]);
const current = read(process.argv[3]);
const plugin = read('/plugins/website.json');
const strip = w => { for (const k of ['versionId', 'activeVersionId', 'versionCounter', 'versionMetadata']) delete w[k]; return w; };

// 1. New plug-in, keeping your Claude key, model and website prompt from the current one.
const old = name => current.nodes.find(n => n.name === name);
const oldSettings = Object.fromEntries((old('Settings')?.parameters.assignments.assignments || []).map(a => [a.name, a.value]));
for (const n of plugin.nodes) {
  if (n.name === 'Claude: write website' && old('Claude: write website')?.credentials) n.credentials = old('Claude: write website').credentials;
  if (n.name === 'Settings') for (const a of n.parameters.assignments.assignments) {
    if (['claude_model', 'website_prompt'].includes(a.name) && oldSettings[a.name]) a.value = oldSettings[a.name];
  }
}

// 2. Dashboard progress (each change only once).
const node = name => main.nodes.find(n => n.name === name);
const changed = [];
const build = node('Get leads to build');
if (build && !build.parameters.query.startsWith('UPDATE')) {
  build.parameters.query = "UPDATE leads SET notes = 'Building page... (1-3 min)' WHERE id = ANY($1::int[])\n" +
    'RETURNING id, name, category, address, city, phone, email, website, enrichment::text AS enrichment;';
  changed.push('marks leads "Building page..." when you click Build page');
}
const list = node('Get leads');
if (list && !/status, notes,/.test(list.parameters.query)) {
  list.parameters.query = list.parameters.query.replace('SELECT id, name, city, category, status,', 'SELECT id, name, city, category, status, notes,');
  changed.push('dashboard reads notes');
}
const draw = node('Draw dashboard');
if (draw && !draw.parameters.jsCode.includes('http-equiv="refresh"')) {
  draw.parameters.jsCode = draw.parameters.jsCode
    .replace('<td>${badge(l.status)}</td>',
      "<td>${badge(l.status)}${l.notes ? `<div class=\"muted\">${esc(String(l.notes).slice(0, 160))}</div>` : ''}</td>")
    .replace('<title>Cold outreach dashboard</title>',
      "${leads.some(l => String(l.notes || '').startsWith('Building')) ? '<meta http-equiv=\"refresh\" content=\"20\">' : ''}<title>Cold outreach dashboard</title>");
  changed.push('dashboard shows progress / errors and refreshes itself while a page is building');
}

fs.writeFileSync('/work/main.json', JSON.stringify(strip(main)));
fs.writeFileSync('/work/plugin.json', JSON.stringify(strip(plugin)));
console.log(`Website plug-in updated (model: ${oldSettings.claude_model || 'default'}).` + (changed.length ? ' Dashboard: ' + changed.join('; ') + '.' : ''));
