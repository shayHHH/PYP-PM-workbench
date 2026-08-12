/* 临时审计脚本：在 node 里跑数据层（U/C/SEED/S），检查两角色下所有取数与派生统计不抛异常。
   与产品代码无关，验证完可删除。 */
const fs = require('fs');
const path = require('path');
global.window = {};
global.document = { body: { setAttribute() { } } };
const dir = path.join(__dirname, 'assets/js');
for (const f of ['00-util.js', '01-config.js', '02-seed.js', '03-store.js']) {
  (0, eval)(fs.readFileSync(path.join(dir, f), 'utf8'));
  global.U = window.U; global.C = window.C; global.SEED = window.SEED; global.S = window.S;
}
const S = window.S, C = window.C;
const errs = [];
function t(label, fn) {
  try { const v = fn(); if (v === undefined) errs.push(label + ' -> undefined'); }
  catch (e) { errs.push(label + ' throws: ' + e.message); }
}
const modes = [undefined, 'auto', 'line', 'project', 'all'];
const collFns = ['reqs', 'rels', 'tasks', 'risks', 'issues', 'meetings', 'actions', 'feedbacks',
  'changes', 'deliverables', 'phases', 'milestones', 'traces', 'cross', 'roadmap', 'okrs', 'reviews', 'reports'];
const plainFns = ['todos', 'members', 'linesInScope', 'projectsInScope', 'curProject',
  'homeMetrics', 'weekFocus', 'weekDelivery', 'scopeStatus', 'savedViews'];

for (const role of ['director', 'pm']) {
  S.state.role = role;
  for (const f of collFns) for (const m of modes) t(role + '.' + f + '(' + m + ')', () => S[f](m));
  for (const f of plainFns) t(role + '.' + f, () => S[f]());
  for (const m of ['auto', 'line', 'project', 'all']) {
    t(role + '.reqFlow(' + m + ')', () => S.reqFlow(m));
    t(role + '.releaseOnTime(' + m + ')', () => S.releaseOnTime(m));
  }
  S.DB.projects.forEach(p => t(role + '.projectStat(' + p.id + ')', () => S.projectStat(p.id)));
  S.DB.lines.forEach(l => t(role + '.lineStat(' + l.id + ')', () => S.lineStat(l.id)));
  ['对账', 'REQ', 'V2', '风险', ''].forEach(k => t(role + '.search(' + k + ')', () => S.search(k)));
  C.NAV.forEach(g => g.items.forEach(it => t(role + '.permOf(' + it.key + ')', () => C.permOf(it.key, role))));
}

/* 首页指标：C.HOME 每个 key 都要能算出对象 */
for (const role of ['director', 'pm']) {
  S.state.role = role;
  const ms = S.homeMetrics();
  const want = (C.HOME[role].metrics || []).length;
  if (ms.length !== want) errs.push(role + ' homeMetrics 只算出 ' + ms.length + '/' + want);
  ms.forEach(m => { if (m.val === undefined || m.label === undefined) errs.push(role + ' 指标 ' + m.key + ' 缺 val/label'); });
}

console.log(errs.length ? ('发现 ' + errs.length + ' 处：\n' + errs.join('\n')) : '数据层 OK：两角色全部取数/派生统计无异常');
