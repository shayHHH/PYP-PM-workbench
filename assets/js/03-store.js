/* ==========================================================================
   03-store · 状态与数据仓库
   角色切换只改这里的 state.role，底层数据一份不变。
   所有页面通过 S.reqs() / S.tasks() 这类"带作用域"的方法取数，
   作用域规则：总监 = 按产品线聚合，项目经理 = 收敛到当前项目。
   ========================================================================== */
window.S = (function () {
  'use strict';

  /* DB = 你自己的数据，来自 localStorage。首次打开是一个空库。 */
  var DB = DATA.load();
  /* 组织抬头跟着数据走，在「上手引导 → 组织与我」里改 */
  if (DB.org) { C.ORG.name = DB.org.name || C.ORG.name; C.ORG.bu = DB.org.bu === undefined ? C.ORG.bu : DB.org.bu; }
  else { DB.org = { name: C.ORG.name, bu: C.ORG.bu }; }

  var SELF_DEF = {
    director: { id: 'M_DIRECTOR', fallback: '产品总监', func: 'director', title: '产品总监' },
    pm: { id: 'M_PM', fallback: '项目经理', func: 'pm', title: '项目经理' }
  };

  if (!DB.meByRole) DB.meByRole = { director: { name: '' }, pm: { name: '' } };
  if (!DB.meByRole.director) DB.meByRole.director = { name: (DB.me && DB.me.name) || '' };
  if (!DB.meByRole.pm) DB.meByRole.pm = { name: '' };
  if (!DB.me) DB.me = { name: DB.meByRole.director.name || '' };
  applyMe();
  function applyMe() {
    Object.keys(C.ROLES).forEach(function (k) {
      var n = DB.meByRole && DB.meByRole[k] && DB.meByRole[k].name;
      C.ROLES[k].user.name = n || '我';
    });
  }
  function selfFallback(roleKey) { return (SELF_DEF[roleKey] || {}).fallback || '我'; }
  function selfId(roleKey) { return (SELF_DEF[roleKey] || {}).id || 'M01'; }
  function selfDisplayName(roleKey) {
    var n = DB.meByRole && DB.meByRole[roleKey] && DB.meByRole[roleKey].name;
    return String(n || '').trim() || selfFallback(roleKey);
  }
  function ensureSelfMember(roleKey) {
    var def = SELF_DEF[roleKey];
    if (!def) return null;
    var m = (DB.members || []).filter(function (x) { return x.id === def.id; })[0];
    if (!m) {
      m = {
        id: def.id, name: selfDisplayName(roleKey), dept: '', title: def.title,
        func: def.func, loadPct: 0, capacity: 40, allocHours: 0, efficiency: 1,
        taskDone: 0, taskOpen: 0, taskDelay: 0, onlineDays: 0,
        email: '', skills: [], projects: [], weekHours: 0, conflict: false
      };
      DB.members.unshift(m);
    }
    return m;
  }
  function selfRoleOf(m) {
    if (!m) return '';
    if (m.id === SELF_DEF.director.id) return 'director';
    if (m.id === SELF_DEF.pm.id) return 'pm';
    if (m.id === 'M01') return state.role;
    return '';
  }
  function setSelfName(roleKey, myName, silent) {
    roleKey = SELF_DEF[roleKey] ? roleKey : state.role;
    DB.meByRole = DB.meByRole || {};
    DB.meByRole[roleKey] = DB.meByRole[roleKey] || { name: '' };
    var old = selfDisplayName(roleKey);
    var nw = String(myName || '').trim();
    DB.meByRole[roleKey] = { name: nw };
    DB.me = { name: DB.meByRole.director.name || '' };
    var self = ensureSelfMember(roleKey);
    var next = selfDisplayName(roleKey);
    if (self) self.name = next;
    var renamed = next && next !== old ? renameActor(old, next) : 0;
    applyMe();
    if (!silent) { persist(); emit('data'); }
    return renamed;
  }

  /* ============ 会话状态（记忆上一次选择）============ */
  var state = {
    role: U.load('role', 'director'),
    lineId: U.load('lineId', ''),           // '' = 全部产品线
    projectId: U.load('projectId', ''),     // '' = 还没建项目 / 未选择
    route: '',
    savedViews: U.load('savedViews', {}),   // mod -> [{name, filter}]
    prefs: U.load('prefs', {})              // mod -> {sort, desc, pageSize, cols}
  };
  var listeners = [];
  function onChange(fn) { listeners.push(fn); }
  function emit(what) { listeners.forEach(function (f) { try { f(what); } catch (e) { console.error(e); } }); }

  function role() { return state.role; }
  function roleObj() { return C.ROLES[state.role]; }
  function isDirector() { return state.role === 'director'; }
  function isPM() { return state.role === 'pm'; }

  function setRole(r) {
    if (!C.ROLES[r] || r === state.role) return;
    state.role = r;
    U.save('role', r);
    document.body.setAttribute('data-role', r);
    // 切到项目经理时，如果当前产品线下没有选中项目，自动落到该线第一个进行中的项目
    if (r === 'pm') {
      var ps = projectsInScope();
      if (!ps.some(function (p) { return p.id === state.projectId; })) {
        var first = ps.filter(function (p) { return p.status !== '已完成'; })[0] || ps[0];
        if (first) setProject(first.id, true);
      }
    }
    emit('role');
  }
  function setLine(id, silent) {
    state.lineId = id; U.save('lineId', id);
    // 产品线变了，当前项目如果不属于这条线，自动跟随
    if (id) {
      var p = DB.projects.filter(function (x) { return x.id === state.projectId; })[0];
      if (!p || p.lineId !== id) {
        var first = DB.projects.filter(function (x) { return x.lineId === id; })[0];
        if (first) { state.projectId = first.id; U.save('projectId', first.id); }
      }
    }
    if (!silent) emit('scope');
  }
  function setProject(id, silent) {
    state.projectId = id; U.save('projectId', id);
    var p = projBy(id);
    if (p && state.lineId && p.lineId !== state.lineId) { state.lineId = p.lineId; U.save('lineId', p.lineId); }
    if (!silent) emit('scope');
  }

  /* ============ 基础索引 ============ */
  function lineBy(id) { return DB.lines.filter(function (x) { return x.id === id; })[0]; }
  function projBy(id) { return DB.projects.filter(function (x) { return x.id === id; })[0]; }
  function relBy(id) { return DB.releases.filter(function (x) { return x.id === id; })[0]; }
  function reqBy(id) { return DB.requirements.filter(function (x) { return x.id === id; })[0]; }
  function taskBy(id) { return DB.tasks.filter(function (x) { return x.id === id; })[0]; }
  function riskBy(id) { return DB.risks.filter(function (x) { return x.id === id; })[0]; }
  function meetBy(id) { return DB.meetings.filter(function (x) { return x.id === id; })[0]; }
  function memBy(name) { return DB.members.filter(function (x) { return x.name === name; })[0]; }

  function curLine() { return state.lineId ? lineBy(state.lineId) : null; }
  function curProject() { return projBy(state.projectId) || DB.projects[0]; }
  function projectsInScope() {
    return state.lineId ? DB.projects.filter(function (p) { return p.lineId === state.lineId; }) : DB.projects;
  }
  function linesInScope() { return state.lineId ? [lineBy(state.lineId)] : DB.lines; }

  /* ============ 作用域过滤 ============
     mode: 'auto'（跟角色）| 'line'（强制产品线口径）| 'project'（强制项目口径）| 'all' */
  function scopeFilter(list, mode) {
    mode = mode || 'auto';
    if (mode === 'all') return list.slice();
    if (mode === 'auto') mode = isPM() ? 'project' : 'line';
    if (mode === 'project') {
      var pid = state.projectId;
      return list.filter(function (x) { return !x.projectId || x.projectId === pid; });
    }
    // line
    if (!state.lineId) return list.slice();
    var lid = state.lineId;
    return list.filter(function (x) {
      if (x.lineId) return x.lineId === lid;
      if (x.projectId) { var p = projBy(x.projectId); return p && p.lineId === lid; }
      return true;
    });
  }

  /* ============ 带作用域的取数 ============ */
  function reqs(mode) { return scopeFilter(DB.requirements, mode); }
  function rels(mode) { return scopeFilter(DB.releases, mode); }
  function tasks(mode) { return scopeFilter(DB.tasks, mode || 'project'); }
  function risks(mode) { return scopeFilter(DB.risks, mode); }
  function issues(mode) { return scopeFilter(DB.issues, mode); }
  function meetings(mode) { return scopeFilter(DB.meetings, mode); }
  function actions(mode) {
    var ms = meetings(mode), ids = ms.map(function (m) { return m.id; });
    return DB.actions.filter(function (a) { return ids.indexOf(a.meetingId) >= 0; });
  }
  function feedbacks(mode) { return scopeFilter(DB.feedbacks, mode === 'project' ? 'line' : mode); }
  function changes(mode) { return scopeFilter(DB.changes, mode); }
  function deliverables(mode) { return scopeFilter(DB.deliverables, mode); }
  function phases(mode) { return scopeFilter(DB.phases, mode || 'project'); }
  function milestones(mode) { return scopeFilter(DB.milestones, mode || 'project'); }
  function traces(mode) { return scopeFilter(DB.traces, mode); }
  function cross(mode) { return scopeFilter(DB.cross, mode); }
  function roadmap(mode) { return scopeFilter(DB.roadmap, mode === 'project' ? 'line' : mode); }
  function okrs(mode) { return scopeFilter(DB.okrs, mode === 'project' ? 'line' : mode); }
  function reviews(mode) { return scopeFilter(DB.reviews, mode === 'project' ? 'line' : mode); }
  function reports(mode) { return scopeFilter(DB.reports, mode || 'project'); }
  function todos() {
    return DB.todos.filter(function (t) { return t.role === state.role; });
  }
  function members() { return DB.members; }
  function metric(key, lineId) {
    return DB.metrics.filter(function (m) {
      return m.key === key && (m.lineId || '') === (lineId === undefined ? (state.lineId || '') : lineId);
    })[0] || DB.metrics.filter(function (m) { return m.key === key && !m.lineId; })[0];
  }

  /* ============ 派生统计 ============ */
  function progressOf(list) {
    if (!list.length) return 0;
    return U.avg(list, function (x) { return x.progress || 0; });
  }
  function projectStat(pid) {
    var ts = DB.tasks.filter(function (t) { return t.projectId === pid; });
    var ms = DB.milestones.filter(function (m) { return m.projectId === pid; });
    var rk = DB.risks.filter(function (x) { return x.projectId === pid && ['已缓解', '已关闭'].indexOf(x.status) < 0; });
    var p = projBy(pid) || {};
    return {
      project: p,
      taskTotal: ts.length,
      taskDone: ts.filter(function (t) { return t.status === '已完成'; }).length,
      taskOpen: ts.filter(function (t) { return ['已完成', '已取消'].indexOf(t.status) < 0; }).length,
      taskDelay: ts.filter(function (t) { return t.overdue; }).length,
      taskBlocked: ts.filter(function (t) { return t.status === '已阻塞'; }).length,
      msTotal: ms.length,
      msDone: ms.filter(function (m) { return /已完成/.test(m.status); }).length,
      msDelay: ms.filter(function (m) { return m.status === '已延期'; }).length,
      riskOpen: rk.length,
      riskHigh: rk.filter(function (x) { return x.level === '高'; }).length,
      progress: p.progress || 0,
      phases: DB.phases.filter(function (x) { return x.projectId === pid; })
    };
  }
  function lineStat(lid) {
    var ps = DB.projects.filter(function (p) { return p.lineId === lid; });
    var qs = DB.requirements.filter(function (q) { return q.lineId === lid; });
    var rs = DB.releases.filter(function (x) { return x.lineId === lid; });
    var rk = DB.risks.filter(function (x) { return x.lineId === lid && ['已缓解', '已关闭'].indexOf(x.status) < 0; });
    return {
      line: lineBy(lid), projects: ps.length,
      running: ps.filter(function (p) { return p.status === '进行中'; }).length,
      progress: U.avg(ps, 'progress'),
      reqTotal: qs.length,
      reqOnline: qs.filter(function (q) { return q.status === '已上线'; }).length,
      reqDoing: qs.filter(function (q) { return ['设计中', '开发中', '测试中', '待发布'].indexOf(q.status) >= 0; }).length,
      relTotal: rs.length,
      relPending: rs.filter(function (x) { return ['待发布', '测试中'].indexOf(x.status) >= 0; }).length,
      relDone: rs.filter(function (x) { return x.status === '已发布'; }).length,
      riskOpen: rk.length, riskHigh: rk.filter(function (x) { return x.level === '高'; }).length,
      health: rk.filter(function (x) { return x.level === '高'; }).length >= 2 ? '高'
        : (rk.length >= 3 ? '中' : '低')
    };
  }
  /* 需求流转效率：各状态停留量 + 平均周期 */
  function reqFlow(mode) {
    var qs = reqs(mode);
    var steps = ['待评审', '已评审', '排期中', '设计中', '开发中', '测试中', '待发布', '已上线'];
    return {
      steps: steps.map(function (s) {
        var n = qs.filter(function (q) { return q.status === s; }).length;
        return { name: s, value: n };
      }),
      avgCycle: Math.round(U.avg(qs.filter(function (q) { return q.status === '已上线'; }), 'cycleDays')),
      throughput: qs.filter(function (q) {
        return q.status === '已上线' && q.onlineAt && U.dayDiff(q.onlineAt, DB.TODAY) <= 30;
      }).length,
      rejected: qs.filter(function (q) { return q.status === '已驳回'; }).length,
      changed: qs.filter(function (q) { return q.changeCount > 0; }).length,
      total: qs.length
    };
  }
  /* 版本按期率 */
  function releaseOnTime(mode) {
    var rs = rels(mode).filter(function (x) { return x.realDate; });
    var ok = rs.filter(function (x) { return U.dayDiff(x.planDate, x.realDate) <= 0; }).length;
    return { total: rs.length, ok: ok, rate: U.pct(ok, rs.length) };
  }
  /* 本周重点事项（总监视角）：跨产品线的关键节点汇总 */
  function weekFocus() {
    var wr = U.weekRange(DB.TODAY), out = [];
    rels('line').forEach(function (rel) {
      if (U.inRange(rel.planDate, wr[0], wr[1]))
        out.push({ kind: '版本', tone: 'doing', title: rel.name + ' 计划' + (rel.status === '已发布' ? '已' : '') + '上线', date: rel.planDate, owner: rel.owner, mod: 'releases', ref: rel.id, sub: rel.lineName });
    });
    DB.milestones.forEach(function (m) {
      var p = projBy(m.projectId);
      if (!p) return;
      if (state.lineId && p.lineId !== state.lineId) return;
      if (U.inRange(m.date, wr[0], wr[1]))
        out.push({ kind: '里程碑', tone: 'plan', title: p.name + ' · ' + m.name, date: m.date, owner: m.owner, mod: 'plan', ref: m.id, sub: p.name });
    });
    risks('line').filter(function (rk) { return rk.level === '高' && ['已缓解', '已关闭'].indexOf(rk.status) < 0; }).slice(0, 3).forEach(function (rk) {
      out.push({ kind: '风险', tone: 'danger', title: rk.title, date: rk.dueAt, owner: rk.owner, mod: 'risks', ref: rk.id, sub: rk.projectName });
    });
    meetings('line').filter(function (m) { return U.inRange(m.date, wr[0], wr[1]); }).forEach(function (m) {
      out.push({ kind: '会议', tone: 'cyan', title: m.title, date: m.date, owner: m.host, mod: 'meetings', ref: m.id, sub: m.projectName });
    });
    changes('line').filter(function (c2) { return c2.status === '待审批'; }).slice(0, 3).forEach(function (c2) {
      out.push({ kind: '待审批', tone: 'warn', title: c2.title, date: c2.applyAt, owner: c2.approver, mod: 'changes', ref: c2.id, sub: c2.projectName });
    });
    return U.sortBy(out, 'date');
  }
  /* 本周交付节点（PM 视角）：当前项目的 */
  function weekDelivery() {
    var wr = U.weekRange(DB.TODAY), pid = state.projectId, out = [];
    DB.milestones.filter(function (m) { return m.projectId === pid && U.inRange(m.date, wr[0], wr[1]); })
      .forEach(function (m) { out.push({ kind: '里程碑', tone: 'plan', title: m.name, date: m.date, owner: m.owner, status: m.status, mod: 'plan', ref: m.id }); });
    DB.deliverables.filter(function (d) { return d.projectId === pid && U.inRange(d.planDate, wr[0], wr[1]); })
      .forEach(function (d) { out.push({ kind: '交付物', tone: 'cyan', title: d.name, date: d.planDate, owner: d.owner, status: d.status, mod: 'delivery', ref: d.id }); });
    DB.releases.filter(function (x) { return x.projectId === pid && U.inRange(x.planDate, wr[0], wr[1]); })
      .forEach(function (x) { out.push({ kind: '版本', tone: 'doing', title: x.name, date: x.planDate, owner: x.owner, status: x.status, mod: 'releases', ref: x.id }); });
    DB.tasks.filter(function (t) {
      return t.projectId === pid && U.inRange(t.due, wr[0], wr[1]) && ['已完成', '已取消'].indexOf(t.status) < 0;
    }).slice(0, 8).forEach(function (t) { out.push({ kind: '任务', tone: 'plain', title: t.title, date: t.due, owner: t.owner, status: t.status, mod: 'tasks', ref: t.id }); });
    return U.sortBy(out, 'date');
  }

  /* ============ 首页指标计算 ============ */
  var METRIC_DEF = {
    /* 产品总监 */
    lines: function () {
      var ls = linesInScope();
      return { label: '产品线总数', val: ls.length, unit: '条', ico: '◈', tone: '', sub: ls.filter(function (l) { return l.stage === '成长期'; }).length + ' 条处于成长期', mod: 'roadmap', sub2: 'lines' };
    },
    projects: function () {
      var ps = projectsInScope();
      var run = ps.filter(function (p) { return p.status === '进行中'; }).length;
      return { label: '进行中项目', val: run, unit: '个', ico: '◫', tone: 'doing', sub: '共 ' + ps.length + ' 个项目 · ' + ps.filter(function (p) { return p.status === '风险中'; }).length + ' 个风险中', mod: 'collab' };
    },
    pendingReleases: function () {
      var rs = rels('line').filter(function (x) { return ['待发布', '测试中'].indexOf(x.status) >= 0; });
      return { label: '待上线版本', val: rs.length, unit: '个', ico: '⬢', tone: 'warn', sub: rs.length ? '最近：' + rs[0].name : '暂无', mod: 'releases' };
    },
    criticalRisks: function () {
      var rk = risks('line').filter(function (x) { return x.level === '高' && ['已缓解', '已关闭'].indexOf(x.status) < 0; });
      return { label: '核心预警', val: rk.length, unit: '项', ico: '⚠', tone: 'danger', sub: rk.filter(function (x) { return x.escalated; }).length + ' 项已升级', mod: 'risks' };
    },
    reqThroughput: function () {
      var f = reqFlow('line');
      return { label: '近 30 天上线需求', val: f.throughput, unit: '个', ico: '☰', tone: 'done', sub: '平均流转周期 ' + f.avgCycle + ' 天', mod: 'requirements' };
    },
    onTimeRate: function () {
      var o = releaseOnTime('line');
      return { label: '版本按期率', val: o.rate, unit: '%', ico: '◔', tone: o.rate >= 85 ? 'done' : (o.rate >= 70 ? 'warn' : 'danger'), sub: o.ok + '/' + o.total + ' 个版本按期', mod: 'releases' };
    },
    /* 项目经理 */
    projProgress: function () {
      var st = projectStat(state.projectId);
      return { label: '当前项目进度', val: Math.round(st.progress * 100), unit: '%', ico: '◫', tone: 'doing', sub: st.project.name, mod: 'progress' };
    },
    milestoneRate: function () {
      var st = projectStat(state.projectId);
      return { label: '里程碑完成率', val: U.pct(st.msDone, st.msTotal), unit: '%', ico: '◈', tone: st.msDelay ? 'warn' : 'done', sub: st.msDone + '/' + st.msTotal + ' 已完成 · ' + st.msDelay + ' 延期', mod: 'plan' };
    },
    openTasks: function () {
      var st = projectStat(state.projectId);
      return { label: '未完成任务', val: st.taskOpen, unit: '个', ico: '☑', tone: '', sub: '共 ' + st.taskTotal + ' 个任务 · 已完成 ' + st.taskDone, mod: 'tasks' };
    },
    delayTasks: function () {
      var st = projectStat(state.projectId);
      return { label: '延期任务', val: st.taskDelay, unit: '个', ico: '⏱', tone: st.taskDelay ? 'danger' : 'done', sub: st.taskDelay ? '需立即介入' : '无延期', mod: 'progress' };
    },
    projRisks: function () {
      var st = projectStat(state.projectId);
      return { label: '未关闭风险', val: st.riskOpen, unit: '项', ico: '⚠', tone: st.riskHigh ? 'danger' : 'warn', sub: st.riskHigh + ' 项高风险', mod: 'risks' };
    },
    blockers: function () {
      var st = projectStat(state.projectId);
      return { label: '阻塞事项', val: st.taskBlocked, unit: '个', ico: '⛔', tone: st.taskBlocked ? 'danger' : 'done', sub: st.taskBlocked ? '平均阻塞 ' + 3 + ' 天' : '当前无阻塞', mod: 'progress', sub2: 'blocked' };
    }
  };
  function homeMetrics() {
    return (C.HOME[state.role].metrics || []).map(function (k) {
      var f = METRIC_DEF[k];
      return f ? Object.assign({ key: k }, f()) : null;
    }).filter(Boolean);
  }

  /* ============ 全局搜索 ============ */
  function search(kw) {
    if (!kw || kw.length < 1) return [];
    var out = [];
    function add(group, list, idF, titleF, subF, mod, sub) {
      var hit = list.filter(function (x) { return U.match(titleF(x), kw) || U.match(idF(x), kw); }).slice(0, 6);
      if (hit.length) out.push({
        group: group, items: hit.map(function (x) {
          return { id: idF(x), title: titleF(x), sub: subF(x), mod: mod, subPage: sub, ref: idF(x) };
        })
      });
    }
    add('需求', DB.requirements, function (x) { return x.id; }, function (x) { return x.title; },
      function (x) { return x.lineName + ' · ' + x.status; }, 'requirements', 'pool');
    add('任务', DB.tasks, function (x) { return x.id; }, function (x) { return x.title; },
      function (x) { return x.projectName + ' · ' + x.status; }, 'tasks', 'list');
    add('版本', DB.releases, function (x) { return x.id; }, function (x) { return x.name; },
      function (x) { return x.lineName + ' · ' + x.status; }, 'releases', 'plan');
    add('会议', DB.meetings, function (x) { return x.id; }, function (x) { return x.title; },
      function (x) { return x.date + ' · ' + x.type; }, 'meetings', 'list');
    add('风险', DB.risks, function (x) { return x.id; }, function (x) { return x.title; },
      function (x) { return x.level + '风险 · ' + x.status; }, 'risks', 'ledger');
    add('反馈', DB.feedbacks, function (x) { return x.id; }, function (x) { return x.title; },
      function (x) { return x.lineName + ' · ' + x.status; }, 'feedback', 'ledger');
    add('项目', DB.projects, function (x) { return x.id; }, function (x) { return x.name; },
      function (x) { return x.lineName + ' · ' + x.status; }, 'collab', 'board');
    add('交付物', DB.deliverables, function (x) { return x.id; }, function (x) { return x.name; },
      function (x) { return x.projectName + ' · ' + x.status; }, 'delivery', 'items');
    // 角色不可见的模块不出现在搜索结果里
    return out.filter(function (g) { return C.canSee(g.items[0].mod, state.role); });
  }

  /* ============ 写操作 ============
     每次写完立刻落 localStorage，刷新 / 关机都还在，不需要手动保存。 */
  function persist() {
    try { return DATA.save(); }
    catch (e) { console.error('保存失败', e); return false; }
  }
  function add(coll, obj) {
    var list = DB[coll];
    if (!list) return null;
    list.unshift(obj);
    logTrace(coll, obj, '新建');
    persist();
    emit('data');
    return obj;
  }
  function update(coll, id, patch) {
    var list = DB[coll] || [];
    var it = list.filter(function (x) { return x.id === id; })[0];
    if (!it) return null;
    Object.assign(it, patch);
    logTrace(coll, it, '更新');
    persist();
    emit('data');
    return it;
  }
  function remove(coll, id) {
    var list = DB[coll] || [];
    var i = list.findIndex(function (x) { return x.id === id; });
    if (i >= 0) { list.splice(i, 1); persist(); emit('data'); return true; }
    return false;
  }
  /* 供引导层与「数据与引导」页使用 */
  function isEmpty() { return DATA.isEmpty(DB); }
  function counts() { return DATA.counts(DB); }
  function org() { return DB.org || { name: C.ORG.name, bu: C.ORG.bu }; }
  function me() {
    return (DB.meByRole && DB.meByRole[state.role]) || { name: '' };
  }
  /* 改抬头：组织名 / 事业部 / 你的名字。名字变了要同步改成员表里的自己，
     否则历史数据的负责人会挂在一个不存在的名字上。 */
  function setOrg(name, bu, myName) {
    DB.org = { name: name || '我的组织', bu: bu || '' };
    C.ORG.name = DB.org.name; C.ORG.bu = DB.org.bu;
    if (myName !== undefined) {
      setSelfName(state.role, myName, true);
    }
    persist();
    emit('data');
  }
  /* ============ 人名引用 ============
     成员是按「姓名字符串」被引用的，不是按 id。所以改名、删人都必须
     过一遍下面三种形态，漏一种，负责人就会挂在一个查不到的名字上——
     下拉框选不回来，筛选也筛不到。

     ⚠ members 不在列表里：项目上的 members 是人数（数字），不是人名。 */
  var ACTOR_KEYS = ['owner', 'pm', 'proposer', 'assignee', 'reporter', 'actor',
    'creator', 'approver', 'host', 'sponsor', 'handler'];
  /* 值本身是名字数组 */
  var ACTOR_ARRAYS = ['attendees', 'absent'];
  /* 值是对象数组，人名藏在对象的某个键里，如 meeting.decisions[].by */
  var ACTOR_NESTED = { decisions: ['by', 'owner'], actionItems: ['owner'], risks: ['owner'] };

  /* 遍历一条记录里所有人名位置。hit(get, set) 对每一处调用一次。 */
  function eachActor(x, hit) {
    ACTOR_KEYS.forEach(function (k) {
      if (x[k] && typeof x[k] === 'string') hit(x[k], function (v) { x[k] = v; });
    });
    ACTOR_ARRAYS.forEach(function (k) {
      if (Array.isArray(x[k])) x[k].forEach(function (v, i) {
        if (typeof v === 'string') hit(v, function (nv) { x[k][i] = nv; });
      });
    });
    Object.keys(ACTOR_NESTED).forEach(function (k) {
      if (!Array.isArray(x[k])) return;
      x[k].forEach(function (o) {
        if (!o || typeof o !== 'object') return;
        ACTOR_NESTED[k].forEach(function (kk) {
          if (o[kk] && typeof o[kk] === 'string') hit(o[kk], function (v) { o[kk] = v; });
        });
      });
    });
  }

  /* 把散落在各集合里的旧名字换成新名字（只换完全相等的）。返回改了几处。 */
  function renameActor(from, to) {
    if (!from || from === to) return 0;
    var n = 0;
    DATA.COLLS.forEach(function (c) {
      (DB[c] || []).forEach(function (x) {
        eachActor(x, function (v, set) { if (v === from) { set(to); n++; } });
      });
    });
    return n;
  }

  /* 这个人被多少条业务数据引用着，分别在哪些集合。
     删人之前要先能回答这个问题——直接删掉，那些记录的负责人就成了孤儿。 */
  function actorRefs(name) {
    var out = { total: 0, byColl: {} };
    if (!name) return out;
    DATA.COLLS.forEach(function (c) {
      var n = 0;
      (DB[c] || []).forEach(function (x) {
        eachActor(x, function (v) { if (v === name) n++; });
      });
      if (n) { out.byColl[c] = n; out.total += n; }
    });
    return out;
  }
  /* ============ 产品线引用 ============
     产品线用 lineId 关联（这点是对的），但 lineName 被反范式化复制进了
     需求 / 项目 / 版本 / 规划 / OKR / 反馈 / 复盘 / 报告 等近十个集合。
     所以改产品线名字，必须把这些副本一起改，否则页面上一半显示新名字、
     一半还是旧的。删产品线同理，得先知道它底下挂了多少东西。 */
  function lineChildren(lineId) {
    var out = { total: 0, byColl: {} };
    if (!lineId) return out;
    DATA.COLLS.forEach(function (c) {
      if (c === 'lines') return;
      var n = (DB[c] || []).filter(function (x) { return x.lineId === lineId; }).length;
      if (n) { out.byColl[c] = n; out.total += n; }
    });
    return out;
  }
  /* 改名：同步所有反范式化的 lineName 副本。返回改了几处。 */
  function renameLine(lineId, to) {
    var n = 0;
    DATA.COLLS.forEach(function (c) {
      if (c === 'lines') return;
      (DB[c] || []).forEach(function (x) {
        if (x.lineId === lineId && x.lineName !== to) { x.lineName = to; n++; }
      });
    });
    return n;
  }
  /* 迁移：把一条线底下的全部内容改挂到另一条线 */
  function moveLineChildren(fromId, toId) {
    var to = lineBy(toId); if (!to) return 0;
    var n = 0;
    DATA.COLLS.forEach(function (c) {
      if (c === 'lines') return;
      (DB[c] || []).forEach(function (x) {
        if (x.lineId === fromId) { x.lineId = toId; if ('lineName' in x) x.lineName = to.name; n++; }
      });
    });
    return n;
  }
  /* 级联删除：连同这条线底下的全部内容一起删。危险，调用方必须二次确认。 */
  function dropLineChildren(lineId) {
    var n = 0;
    DATA.COLLS.forEach(function (c) {
      if (c === 'lines') return;
      var before = (DB[c] || []).length;
      DB[c] = (DB[c] || []).filter(function (x) { return x.lineId !== lineId; });
      n += before - DB[c].length;
    });
    return n;
  }

  /* 「你自己」不能删：成员表至少要留一条，否则所有负责人下拉框都是空的。 */
  function isSelf(m) {
    if (!m) return false;
    if (m.id === 'M01' || m.id === selfId('director') || m.id === selfId('pm')) return true;
    return Object.keys(SELF_DEF).some(function (k) {
      var n = DB.meByRole && DB.meByRole[k] && DB.meByRole[k].name;
      return !!n && m.name === n;
    });
  }
  var TRACE_MAP = {
    requirements: ['需求变动', 'requirement'], releases: ['版本发布', 'release'],
    tasks: ['任务流转', 'task'], risks: ['风险处置', 'risk'], meetings: ['会议决策', 'meeting'],
    changes: ['变更审批', 'change'], deliverables: ['交付验收', 'deliverable'], roadmap: ['规划调整', 'roadmap']
  };
  function logTrace(coll, obj, verb) {
    var m = TRACE_MAP[coll];
    if (!m) return;
    DB.traces.unshift({
      id: U.uid('TR'), time: U.fmtDate(new Date(), 'YYYY-MM-DD HH:mm'),
      type: m[0], title: verb + '「' + U.ellip(obj.title || obj.name, 20) + '」',
      desc: '操作人 ' + roleObj().user.name + '（' + roleObj().name + '）',
      actor: roleObj().user.name, projectId: obj.projectId || state.projectId,
      projectName: (projBy(obj.projectId || state.projectId) || {}).name || '',
      lineId: obj.lineId || state.lineId, lineName: (lineBy(obj.lineId || state.lineId) || {}).name || '',
      refType: m[1], refId: obj.id, isNew: true
    });
  }

  /* ============ 视图偏好 ============ */
  function pref(mod, key, def) {
    var p = state.prefs[mod] || {};
    return p[key] === undefined ? def : p[key];
  }
  function setPref(mod, key, val) {
    state.prefs[mod] = state.prefs[mod] || {};
    state.prefs[mod][key] = val;
    U.save('prefs', state.prefs);
  }
  function savedViews(mod) { return state.savedViews[mod] || []; }
  function saveView(mod, name, filter) {
    state.savedViews[mod] = state.savedViews[mod] || [];
    state.savedViews[mod] = state.savedViews[mod].filter(function (v) { return v.name !== name; });
    state.savedViews[mod].push({ name: name, filter: U.clone(filter) });
    U.save('savedViews', state.savedViews);
  }
  function dropView(mod, name) {
    state.savedViews[mod] = (state.savedViews[mod] || []).filter(function (v) { return v.name !== name; });
    U.save('savedViews', state.savedViews);
  }

  /* ============ 当前上下文状态标签 ============ */
  function scopeStatus() {
    if (isPM()) {
      var p = curProject();
      return { text: p ? p.status : '—', tone: C.tone('status', p ? p.status : '') };
    }
    var ls = linesInScope();
    var high = U.sum(ls, function (l) { return lineStat(l.id).riskHigh; });
    if (high >= 3) return { text: '风险中', tone: 'danger' };
    var pend = rels('line').filter(function (x) { return x.status === '待发布'; }).length;
    if (pend) return { text: '待发布 ' + pend, tone: 'warn' };
    return { text: '进行中', tone: 'doing' };
  }

  return {
    DB: DB, state: state, onChange: onChange, emit: emit,
    /* 全站唯一的「今天」，每次打开页面重算。
       业务模块一律用 S.TODAY / S.quarters，不要各自 new Date()。 */
    TODAY: DB.TODAY, quarters: DB.quarters,
    role: role, roleObj: roleObj, isDirector: isDirector, isPM: isPM,
    setRole: setRole, setLine: setLine, setProject: setProject,
    lineBy: lineBy, projBy: projBy, relBy: relBy, reqBy: reqBy, taskBy: taskBy,
    riskBy: riskBy, meetBy: meetBy, memBy: memBy,
    curLine: curLine, curProject: curProject, projectsInScope: projectsInScope, linesInScope: linesInScope,
    scopeFilter: scopeFilter,
    reqs: reqs, rels: rels, tasks: tasks, risks: risks, issues: issues,
    meetings: meetings, actions: actions, feedbacks: feedbacks, changes: changes,
    deliverables: deliverables, phases: phases, milestones: milestones, traces: traces,
    cross: cross, roadmap: roadmap, okrs: okrs, reviews: reviews, reports: reports,
    todos: todos, members: members, metric: metric,
    progressOf: progressOf, projectStat: projectStat, lineStat: lineStat,
    reqFlow: reqFlow, releaseOnTime: releaseOnTime, weekFocus: weekFocus, weekDelivery: weekDelivery,
    homeMetrics: homeMetrics, search: search,
    add: add, update: update, remove: remove, persist: persist,
    isEmpty: isEmpty, counts: counts, org: org, me: me, setOrg: setOrg,
    renameActor: renameActor, actorRefs: actorRefs, isSelf: isSelf,
    selfRoleOf: selfRoleOf, setSelfName: setSelfName,
    lineChildren: lineChildren, renameLine: renameLine,
    moveLineChildren: moveLineChildren, dropLineChildren: dropLineChildren,
    pref: pref, setPref: setPref, savedViews: savedViews, saveView: saveView, dropView: dropView,
    scopeStatus: scopeStatus
  };
})();
