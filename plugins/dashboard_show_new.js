// Dashboard: show leads the day they are found (status "pending"), not only after they are processed,
// and show which source found each lead. Run by dashboard_show_new.ps1 inside the n8n container.
const fs = require('fs');
const all = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const main = all.find(w => w.nodes.some(n => n.name === 'Get leads') && w.nodes.some(n => n.name === 'Draw dashboard'));
if (!main) { console.error('Could not find the dashboard workflow (nodes "Get leads" and "Draw dashboard").'); process.exit(1); }
const node = name => main.nodes.find(n => n.name === name);
const get = node('Get leads'), draw = node('Draw dashboard');
if (get.parameters.query.includes('created_at AT TIME ZONE')) { console.log('Already done - nothing to do.'); process.exit(2); }

const swap = (n, field, from, to) => {
  if (!n.parameters[field].includes(from)) { console.error(`"${n.name}" has been edited by hand (missing: ${from.slice(0, 60)}) - not changing it.`); process.exit(1); }
  n.parameters[field] = n.parameters[field].replace(from, to);
};
swap(get, 'query', 'SELECT id, name, city, category, status,', 'SELECT id, name, city, category, source, status,');
swap(get, 'query', "WHERE (processed_at AT TIME ZONE 'Asia/Kolkata')::date = $1::date",
  "WHERE $1::date IN ((processed_at AT TIME ZONE 'Asia/Kolkata')::date, (created_at AT TIME ZONE 'Asia/Kolkata')::date)");
swap(draw, 'jsCode', "const statuses = ['all', ", "const statuses = ['all', 'pending', ");
swap(draw, 'jsCode', "<div class=\"muted\">${esc(l.category || '')}</div>",
  "<div class=\"muted\">${esc(l.category || '')}${l.source ? ` · found via ${esc(String(l.source).replace(/_/g, ' '))}` : ''}</div>");
swap(draw, 'jsCode', "<span>${leads.length} leads</span>", "<span>${leads.length} leads</span><span>${count('pending')} new</span>");
swap(draw, 'jsCode', '.b-review{background:#fff8c5}', '.b-review{background:#fff8c5}.b-pending{background:#e8e0ff}');

for (const k of ['versionId', 'activeVersionId', 'versionCounter', 'versionMetadata']) delete main[k];
fs.writeFileSync('/work/main.json', JSON.stringify(main));
fs.writeFileSync('/work/main_id.txt', main.id);
console.log(`Dashboard updated in "${main.name}": new leads show the day they are found, with their source.`);
