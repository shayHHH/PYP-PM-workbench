/* ============================================================
 * 37-exchange.js  分发与汇报（总监 ⇅ 项目经理）
 *
 * 这套工具没有后端，两边各自一份 localStorage。要让总监能跟进多个 PM 的进度，
 * 只能靠文件传递。方向是固定的：
 *
 *   总监建产品线/项目/成员 → 导出「项目包」→ PM 导入
 *   PM 拆任务、填进度      → 每周导出「汇报包」→ 总监导入
 *
 * 为什么必须是这个方向：项目 id 由总监那边生成，两边一致，
 * 总监才能按 id 精确对齐同一个项目跨周的变化。PM 自己开项目的话，
 * id 各生成各的，只能按名字猜，改个名追踪就断了。
 *
 * ⚠ 两条不能违反的规矩：
 *   1. 导入汇报包**绝不走 DATA.importJSON**——那是整库替换，会清空总监自己的数据。
 *      汇报包一律作为**只读快照**存进 submissions，不合并进主库。
 *   2. 快照只读、按 (汇报人 + 周次) 去重，重复导入同一周会覆盖那一条，不会越堆越多。
 * ========================================================== */
(function () {
  'use strict';
  var E = U.esc;

  /* ---------------- 周次 ---------------- */
  /* ISO 周：以周四所在年为准，避免跨年那一周算错年份 */
  function weekKey(d) {
    var t = new Date(d ? new Date(d).getTime() : Date.now());
    t.setHours(0, 0, 0, 0);
    t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
    var y = t.getFullYear();
    var first = new Date(y, 0, 4);
    var n = 1 + Math.round(((t - first) / 864e5 - 3 + ((first.getDay() + 6) % 7)) / 7);
    return y + '-W' + (n < 10 ? '0' + n : n);
  }
  function weekAgo(key, back) {
    var m = /^(\d{4})-W(\d{2})$/.exec(key || '');
    if (!m) return '';
    var d = new Date(+m[1], 0, 4);
    d.setDate(d.getDate() + (+m[2] - 1) * 7 - back * 7);
    return weekKey(d);
  }
  function thisWeek() { return weekKey(S.TODAY); }

  function stamp() { return U.fmtDate(new Date(), 'YYYY-MM-DD HH:mm'); }
  function me() { return (S.me() && S.me().name) || S.roleObj().user.name || '我'; }

  /* ================= 总监侧：导出项目包 ================= */
  /* 只带「PM 开工需要的骨架」：他负责的项目 + 这些项目所属的产品线 + 成员表
     + 已排的阶段/里程碑/版本。不带需求、反馈、经营指标——那些不是 PM 该维护的。 */
  function buildDispatch(pmName) {
    var projects = S.DB.projects.filter(function (p) { return p.pm === pmName; });
    var pids = projects.map(function (p) { return p.id; });
    var lids = U.uniq(projects.map(function (p) { return p.lineId; }).filter(Boolean));
    function byProj(coll) {
      return (S.DB[coll] || []).filter(function (x) { return pids.indexOf(x.projectId) >= 0; });
    }
    return {
      _app: '产品管理工作台', _kind: 'dispatch', _ver: 1,
      _at: stamp(), _from: me(), _to: pmName,
      data: {
        lines: S.DB.lines.filter(function (l) { return lids.indexOf(l.id) >= 0; }),
        projects: projects,
        members: S.DB.members,
        phases: byProj('phases'),
        milestones: byProj('milestones'),
        releases: S.DB.releases.filter(function (r) { return lids.indexOf(r.lineId) >= 0; })
      }
    };
  }
  function dispatchCounts(pmName) {
    var d = buildDispatch(pmName).data;
    return { projects: d.projects.length, lines: d.lines.length, milestones: d.milestones.length, phases: d.phases.length };
  }

  /* ================= PM 侧：导入项目包 ================= */
  /* 按 id 覆盖式合入：同 id 更新档案，新 id 追加。
     绝不动 PM 自己的 tasks / risks / 进度——那是他的产出，总监的包里也没有。 */
  function applyDispatch(obj) {
    if (!obj || obj._kind !== 'dispatch') return { ok: false, msg: '这不是「项目包」文件（缺少 _kind:dispatch）' };
    var d = obj.data || {};
    var stat = { add: 0, upd: 0 };
    /* store 只有 lineBy / projBy 这类具名取值，没有通用的 get(coll,id)，这里自己查 */
    function findById(coll, id) {
      var a = S.DB[coll] || [];
      for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i];
      return null;
    }
    ['lines', 'projects', 'members', 'phases', 'milestones', 'releases'].forEach(function (coll) {
      if (!S.DB[coll]) S.DB[coll] = [];
      (d[coll] || []).forEach(function (rec) {
        if (!rec || !rec.id) return;
        var cur = findById(coll, rec.id);
        if (cur) { Object.keys(rec).forEach(function (k) { cur[k] = rec[k]; }); stat.upd++; }
        else { S.DB[coll].push(U.clone(rec)); stat.add++; }
      });
    });
    S.persist(); S.emit('data');
    return { ok: true, msg: '已导入：新增 ' + stat.add + ' 条，更新 ' + stat.upd + ' 条', stat: stat };
  }

  /* ================= PM 侧：生成周汇报包 ================= */
  /* 只带「进度与风险」，不整库上交：项目进度、任务口径、里程碑、风险、交付物、周报正文。 */
  function buildSubmission(wk) {
    wk = wk || thisWeek();
    var projects = S.DB.projects.filter(function (p) { return p.pm === me(); });
    if (!projects.length) projects = S.DB.projects;      /* 没标 pm 的库，就报全部 */
    var pids = projects.map(function (p) { return p.id; });
    function mine(coll) {
      return (S.DB[coll] || []).filter(function (x) { return pids.indexOf(x.projectId) >= 0; });
    }
    var tasks = mine('tasks'), ms = mine('milestones'), rks = mine('risks'), dvs = mine('deliverables');
    var open = tasks.filter(function (t) { return ['已完成', '已取消'].indexOf(t.status) < 0; });

    return {
      _app: '产品管理工作台', _kind: 'submission', _ver: 1,
      _at: stamp(), _by: me(), _week: wk,
      data: {
        projects: projects.map(function (p) {
          return {
            id: p.id, name: p.name, lineId: p.lineId, lineName: p.lineName,
            status: p.status, progress: p.progress || 0, pm: p.pm, health: p.health || ''
          };
        }),
        summary: {
          taskTotal: tasks.length,
          taskDone: tasks.filter(function (t) { return t.status === '已完成'; }).length,
          taskOpen: open.length,
          taskDelay: open.filter(function (t) { return t.overdue; }).length,
          taskBlock: open.filter(function (t) { return t.status === '已阻塞'; }).length,
          msTotal: ms.length,
          msDelay: ms.filter(function (m) { return m.status === '已延期'; }).length,
          riskOpen: rks.filter(function (r) { return ['已缓解', '已关闭'].indexOf(r.status) < 0; }).length,
          riskHigh: rks.filter(function (r) { return r.level === '高' && ['已缓解', '已关闭'].indexOf(r.status) < 0; }).length,
          dvAccept: dvs.filter(function (x) { return x.status === '已验收'; }).length,
          dvTotal: dvs.length
        },
        /* 明细只带「需要总监知道的」：延期/阻塞的任务、未闭环风险、延期里程碑 */
        delayTasks: open.filter(function (t) { return t.overdue || t.status === '已阻塞'; })
          .map(function (t) { return { id: t.id, title: t.title, projectId: t.projectId, status: t.status, due: t.due, assignee: t.assignee }; }),
        risks: rks.filter(function (r) { return ['已缓解', '已关闭'].indexOf(r.status) < 0; })
          .map(function (r) { return { id: r.id, title: r.title, projectId: r.projectId, level: r.level, status: r.status, owner: r.owner }; }),
        milestones: ms.filter(function (m) { return m.status !== '已完成'; })
          .map(function (m) { return { id: m.id, name: m.name, projectId: m.projectId, date: m.date, status: m.status }; }),
        note: ''
      }
    };
  }

  /* ================= 总监侧：收汇报包 ================= */
  function applySubmission(obj) {
    if (!obj || obj._kind !== 'submission') return { ok: false, msg: '这不是「汇报包」文件（缺少 _kind:submission）' };
    if (!obj._by || !obj._week) return { ok: false, msg: '汇报包缺少「汇报人」或「周次」，无法归档' };
    var rec = {
      id: 'SUB-' + obj._by + '-' + obj._week,
      by: obj._by, week: obj._week, at: obj._at || stamp(),
      importedAt: stamp(), data: obj.data || {}
    };
    var old = S.DB.submissions.filter(function (x) { return x.id === rec.id; })[0];
    var dup = !!old;
    /* 同一人同一周重复导入 → 覆盖，不堆积 */
    S.DB.submissions = S.DB.submissions.filter(function (x) { return x.id !== rec.id; });
    S.DB.submissions.unshift(rec);
    S.log && S.log('导入', '', '收到 ' + rec.by + ' 的 ' + rec.week + ' 汇报', '');
    S.persist(); S.emit('data');
    return { ok: true, dup: dup, rec: rec, msg: (dup ? '已覆盖' : '已归档') + ' ' + rec.by + ' 的 ' + rec.week + ' 汇报' };
  }

  function subsOf(week) { return S.DB.submissions.filter(function (s) { return s.week === week; }); }
  function subBy(by, week) { return S.DB.submissions.filter(function (s) { return s.by === by && s.week === week; })[0]; }
  /* 应报名单：库里所有「担任了项目 pm」的人 */
  function expectedPMs() {
    return U.uniq(S.DB.projects.map(function (p) { return p.pm; }).filter(Boolean));
  }

  /* 同一项目本周 vs 上周的进度差 */
  function progressDelta(week) {
    var cur = {}, prev = {};
    subsOf(week).forEach(function (s) {
      (s.data.projects || []).forEach(function (p) { cur[p.id] = p; });
    });
    subsOf(weekAgo(week, 1)).forEach(function (s) {
      (s.data.projects || []).forEach(function (p) { prev[p.id] = p; });
    });
    return Object.keys(cur).map(function (id) {
      var c = cur[id], p = prev[id];
      var d = p ? Math.round((c.progress - p.progress) * 100) : null;
      return { p: c, delta: d, prevKnown: !!p };
    });
  }

  /* ================= 文件读写 ================= */
  function download(name, obj) { U.exportJSON(name, obj); }
  function pickFile(onText) {
    var inp = document.getElementById('hiddenFileInput');
    inp.value = '';
    inp.onchange = function () {
      var f = inp.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () { onText(r.result, f.name); };
      r.readAsText(f);
    };
    inp.click();
  }

  /* ================= 页面：总监 · 分发项目包 ================= */
  function dispatchPage(ctx) {
    var pms = expectedPMs();
    var rows = pms.map(function (n) {
      var c = dispatchCounts(n);
      return { pm: n, projects: c.projects, lines: c.lines, milestones: c.milestones, phases: c.phases };
    });

    ctx.el.innerHTML =
      P.head({
        mod: 'exchange', title: '分发项目包',
        desc: '把项目骨架发给对应的项目经理。他导入后就能在里面拆任务、填进度，每周再导出汇报包给你。'
      }) +
      UI.notice('info',
        '<b>为什么要先分发：</b>项目 id 在你这边生成，分发过去两边就一致了，' +
        '你收汇报时才能按 id 精确对齐同一个项目、看出它这周相比上周走了多少。' +
        '如果让 PM 自己开项目，只能按名字猜，改个名追踪就断。') + P.gap(4) +
      (rows.length
        ? UI.card({
            title: '按项目经理分发', ico: '⇅', flush: true,
            sub: '名单来自「项目」里填的项目负责人，共 ' + rows.length + ' 人',
            body: '<div id="dpTbl"></div>'
          })
        : UI.empty('还没有指定了项目负责人的项目。\n先到「项目协同」新建项目并填上「项目负责人」，这里才有可分发的对象。', '', '⇅')) +
      P.gap(4) +
      UI.card({
        title: '包里有什么', ico: '≣',
        body: UI.dl([
          ['带过去的', '该 PM 负责的项目、这些项目所属的产品线、成员表、已排的阶段 / 里程碑 / 版本'],
          ['不带的', '需求、用户反馈、经营指标、其它 PM 的项目——这些不归他维护，也不该给他'],
          ['PM 那边怎么用', '打开 <b>pm.html</b>（项目经理版）→「我的汇报 → 导入项目包」'],
          ['重复分发', '安全。按 id 覆盖档案信息，不会动他已经填的任务与进度']
        ])
      });

    if (rows.length) {
      UI.table('#dpTbl', {
        rows: rows, compact: true,
        cols: [
          { k: 'pm', t: '项目经理', w: 160, render: function (r) { return UI.owner(r.pm); } },
          { k: 'projects', t: '项目', w: 80, align: 'right' },
          { k: 'lines', t: '涉及产品线', w: 100, align: 'right' },
          { k: 'phases', t: '阶段', w: 80, align: 'right' },
          { k: 'milestones', t: '里程碑', w: 80, align: 'right' },
          {
            k: 'op', t: '操作', w: 120,
            render: function (r) { return '<button class="btn-sm" data-dp="' + E(r.pm) + '">导出项目包</button>'; }
          }
        ]
      });
      U.on(ctx.el, 'click', '[data-dp]', function () {
        var n = this.getAttribute('data-dp');
        var pack = buildDispatch(n);
        if (!pack.data.projects.length) { UI.toast('「' + n + '」名下没有项目', 'warn'); return; }
        download('项目包_' + n + '_' + U.fmtDate(new Date(), 'YYYYMMDD'), pack);
        UI.toast('已导出「' + n + '」的项目包，含 ' + pack.data.projects.length + ' 个项目', 'ok');
      });
    }
  }

  /* ================= 页面：总监 · 团队汇报 ================= */
  function inboxPage(ctx) {
    var wk = P.flt('exchange', { week: thisWeek() }).week || thisWeek();
    var expect = expectedPMs();
    var got = subsOf(wk);
    var gotNames = got.map(function (s) { return s.by; });
    var missing = expect.filter(function (n) { return gotNames.indexOf(n) < 0; });
    var deltas = progressDelta(wk);

    /* 汇总本周所有汇报包里的风险与延期 */
    var allRisk = [], allDelay = [], allMs = [];
    got.forEach(function (s) {
      (s.data.risks || []).forEach(function (r) { allRisk.push({ by: s.by, r: r }); });
      (s.data.delayTasks || []).forEach(function (t) { allDelay.push({ by: s.by, t: t }); });
      (s.data.milestones || []).forEach(function (m) { if (m.status === '已延期') allMs.push({ by: s.by, m: m }); });
    });
    var highRisk = allRisk.filter(function (x) { return x.r.level === '高'; });

    var weeks = [];
    for (var i = 0; i < 8; i++) weeks.push(weekAgo(thisWeek(), i));

    ctx.el.innerHTML =
      P.head({
        mod: 'exchange', title: '团队汇报',
        desc: '收各项目经理每周导出的汇报包。这里只读，不会动你自己的数据。',
        acts: '<button class="btn-primary" data-imp>导入汇报包</button>'
      }) +
      '<div class="toolbar" style="border:1px solid var(--c-border);border-radius:var(--radius-lg)">' +
      '<span class="tb-l">周次</span><select id="exWk" class="inp" style="width:140px">' +
      weeks.map(function (w) { return '<option value="' + w + '"' + (w === wk ? ' selected' : '') + '>' + w + (w === thisWeek() ? '（本周）' : '') + '</option>'; }).join('') +
      '</select></div>' + P.gap(4) +
      P.statCards([
        { label: '已收到', val: got.length, unit: '份', ico: '⇅', tone: 'done', sub: '应报 ' + expect.length + ' 人' },
        { label: '未提交', val: missing.length, unit: '人', ico: '!', tone: missing.length ? 'danger' : 'done', sub: missing.length ? missing.join('、') : '都交齐了' },
        { label: '高危风险', val: highRisk.length, unit: '项', ico: '⚠', tone: highRisk.length ? 'danger' : 'done', sub: '合计未闭环 ' + allRisk.length + ' 项' },
        { label: '延期 / 阻塞', val: allDelay.length, unit: '条', ico: '◷', tone: allDelay.length ? 'warn' : 'done', sub: '里程碑延期 ' + allMs.length + ' 个' }
      ]) + P.gap(4) +
      (got.length
        ? UI.card({
            title: '项目进度（本周 vs 上周）', ico: '▤', flush: true,
            sub: '按项目 id 对齐。「—」表示上周没有这个项目的汇报，无法比较',
            body: '<div id="exProg"></div>'
          }) + P.gap(4) +
          UI.grid(2,
            UI.card({
              title: '未闭环风险 · ' + allRisk.length, ico: '⚠', flush: true,
              body: allRisk.length ? '<div id="exRisk"></div>' : UI.empty('本周汇报里没有未闭环风险')
            }) +
            UI.card({
              title: '延期与阻塞 · ' + allDelay.length, ico: '◷', flush: true,
              body: allDelay.length ? '<div id="exDelay"></div>' : UI.empty('本周汇报里没有延期或阻塞')
            })
          ) + P.gap(4) +
          UI.card({
            title: '收到的汇报包', ico: '≣', flush: true, body: '<div id="exSubs"></div>'
          })
        : UI.empty('本周（' + wk + '）还没有收到任何汇报包。\n' +
            '让项目经理在他那边打开 pm.html →「我的汇报」→ 导出本周汇报包，把文件发给你，再点右上角导入。', '', '⇅'));

    document.getElementById('exWk').onchange = function () {
      P.setFlt('exchange', { week: this.value }); Shell.route();
    };
    U.on(ctx.el, 'click', '[data-imp]', function () {
      pickFile(function (text, fname) {
        var obj;
        try { obj = JSON.parse(text); }
        catch (e) { UI.toast('不是合法的 JSON：' + e.message, 'err', 4000); return; }
        var r = applySubmission(obj);
        if (!r.ok) { UI.toast(r.msg, 'err', 4500); return; }
        P.setFlt('exchange', { week: r.rec.week });
        Shell.route();
        UI.toast(r.msg + '（' + fname + '）', 'ok', 3200);
      });
    });

    if (!got.length) return;

    UI.table('#exProg', {
      rows: deltas, compact: true,
      cols: [
        { k: 'name', t: '项目', render: function (r) { return UI.cell2(r.p.name, r.p.lineName || ''); } },
        { k: 'pm', t: '负责人', w: 120, render: function (r) { return UI.owner(r.p.pm); } },
        { k: 'status', t: '状态', w: 90, render: function (r) { return UI.st('status', r.p.status); } },
        {
          k: 'progress', t: '本周进度', w: 150, sortable: true,
          sortVal: function (r) { return r.p.progress; },
          render: function (r) { return UI.pcell(Math.round(r.p.progress * 100), 'doing'); }
        },
        {
          k: 'delta', t: '较上周', w: 110, align: 'right', sortable: true,
          sortVal: function (r) { return r.delta === null ? -999 : r.delta; },
          render: function (r) {
            if (r.delta === null) return '<span class="muted">—</span>';
            if (r.delta === 0) return '<span class="tag tag-warn">持平</span>';
            return UI.trend({ dir: r.delta > 0 ? 'up' : 'down', text: (r.delta > 0 ? '+' : '') + r.delta + 'pt' });
          }
        }
      ],
      empty: '本周汇报里没有项目数据'
    });

    if (allRisk.length) {
      UI.table('#exRisk', {
        rows: allRisk, compact: true, pageSize: 8,
        cols: [
          { k: 'title', t: '风险', render: function (x) { return UI.cell2(x.r.title, x.by + ' 报'); } },
          { k: 'level', t: '等级', w: 70, render: function (x) { return UI.light(C.tone('light', x.r.level), x.r.level); } },
          { k: 'status', t: '状态', w: 90, render: function (x) { return UI.st('status', x.r.status); } }
        ]
      });
    }
    if (allDelay.length) {
      UI.table('#exDelay', {
        rows: allDelay, compact: true, pageSize: 8,
        cols: [
          { k: 'title', t: '任务', render: function (x) { return UI.cell2(x.t.title, x.by + ' 报'); } },
          { k: 'status', t: '状态', w: 90, render: function (x) { return UI.st('status', x.t.status); } },
          { k: 'due', t: '截止', w: 100, render: function (x) { return UI.due(x.t.due); } }
        ]
      });
    }
    UI.table('#exSubs', {
      rows: got, compact: true,
      cols: [
        { k: 'by', t: '汇报人', w: 140, render: function (s) { return UI.owner(s.by); } },
        { k: 'week', t: '周次', w: 110 },
        { k: 'at', t: '导出时间', w: 140, cls: 'muted' },
        { k: 'importedAt', t: '导入时间', w: 140, cls: 'muted' },
        {
          k: 'sum', t: '概况',
          render: function (s) {
            var q = s.data.summary || {};
            return '项目 ' + (s.data.projects || []).length + ' 个 · 任务完成 ' + (q.taskDone || 0) + '/' + (q.taskTotal || 0) +
              ' · 延期 ' + (q.taskDelay || 0) + ' · 高危风险 ' + (q.riskHigh || 0);
          }
        },
        {
          k: 'op', t: '', w: 70,
          render: function (s) { return '<button class="btn-sm" data-del-sub="' + E(s.id) + '">删除</button>'; }
        }
      ]
    });
    U.on(ctx.el, 'click', '[data-del-sub]', function () {
      var id = this.getAttribute('data-del-sub');
      UI.confirm('删除这份汇报快照？', function () {
        S.DB.submissions = S.DB.submissions.filter(function (x) { return x.id !== id; });
        S.persist(); Shell.route(); UI.toast('已删除');
      }, { danger: true, okText: '删除', tip: '只删这份快照，不影响你自己的项目数据。' });
    });
  }

  /* ================= 页面：PM · 我的汇报 ================= */
  function minePage(ctx) {
    var wk = thisWeek();
    var pack = buildSubmission(wk);
    var q = pack.data.summary;
    var mineProj = pack.data.projects;

    ctx.el.innerHTML =
      P.head({
        mod: 'myreport', title: '我的汇报',
        desc: '从产品总监那里拿到项目包导入进来；每周把进度导出一份发回给他。',
        acts: '<button class="btn" data-imp-dp>导入项目包</button>' +
          '<button class="btn-primary" data-exp>导出本周汇报包</button>'
      }) +
      (mineProj.length
        ? P.statCards([
            { label: '我的项目', val: mineProj.length, unit: '个', ico: '◫', tone: 'doing' },
            { label: '任务完成', val: q.taskDone + '/' + q.taskTotal, ico: '☑', tone: 'done', sub: '在办 ' + q.taskOpen + ' 条' },
            { label: '延期 / 阻塞', val: q.taskDelay + ' / ' + q.taskBlock, ico: '◷', tone: (q.taskDelay || q.taskBlock) ? 'warn' : 'done' },
            { label: '未闭环风险', val: q.riskOpen, unit: '项', ico: '⚠', tone: q.riskHigh ? 'danger' : 'plan', sub: '高危 ' + q.riskHigh + ' 项' }
          ]) + P.gap(4)
        : UI.notice('warn', '现在库里没有项目。<b>先向产品总监要一份「项目包」</b>，用上面的「导入项目包」导进来，再开始拆任务。') + P.gap(4)) +
      UI.card({
        title: '本周汇报包 · ' + wk, ico: '⇅',
        sub: '导出前可以先看看会报上去什么',
        body: UI.dl([
          ['汇报人', E(me()) + '<span class="muted"> （取自「上手引导 → 组织与我」里填的姓名，填错了总监那边会对不上人）</span>'],
          ['覆盖项目', mineProj.length ? mineProj.map(function (p) { return E(p.name) + ' <span class="muted">' + Math.round(p.progress * 100) + '%</span>'; }).join('、') : '<span class="muted">无</span>'],
          ['会报上去的', '项目进度与状态、任务完成/延期/阻塞的条数、未闭环风险、未完成里程碑、交付物验收情况'],
          ['不会报的', '会议纪要、个人笔记、需求明细——这些留在你自己这儿']
        ])
      }) + P.gap(4) +
      UI.card({
        title: '每周怎么做', ico: '◎',
        body: '<ol class="hp-ol" style="margin:0;padding-left:20px;line-height:1.9">' +
          '<li>把本周的任务状态、进度、风险更新完</li>' +
          '<li>回到这一页，点右上角<b>「导出本周汇报包」</b></li>' +
          '<li>把下载的 JSON 文件发给产品总监（邮件 / 企微都行）</li>' +
          '<li>总监在他那边导入，就能看到你这周相比上周走了多少</li>' +
          '</ol>' +
          '<div class="muted" style="margin-top:10px">同一周重复导出没关系——总监那边按「人 + 周次」去重，后导入的会覆盖前一份。</div>'
      });

    U.on(ctx.el, 'click', '[data-exp]', function () {
      if (!mineProj.length) { UI.toast('还没有项目，先导入项目包', 'warn'); return; }
      download('汇报包_' + me() + '_' + wk, buildSubmission(wk));
      UI.toast('已导出 ' + wk + ' 汇报包，发给产品总监即可', 'ok', 3200);
    });
    U.on(ctx.el, 'click', '[data-imp-dp]', function () {
      pickFile(function (text, fname) {
        var obj;
        try { obj = JSON.parse(text); }
        catch (e) { UI.toast('不是合法的 JSON：' + e.message, 'err', 4000); return; }
        var r = applyDispatch(obj);
        if (!r.ok) { UI.toast(r.msg, 'err', 4500); return; }
        Shell.route();
        UI.toast(r.msg + '（' + fname + '）', 'ok', 3200);
      });
    });
  }

  /* ================= 注册 ================= */
  Shell.page('exchange', {
    render: function (ctx) {
      if (ctx.sub === 'inbox') inboxPage(ctx);
      else dispatchPage(ctx);
    }
  });
  Shell.page('myreport', { render: function (ctx) { minePage(ctx); } });

  /* 供其它模块/自检使用 */
  window.EX = {
    weekKey: weekKey, weekAgo: weekAgo, thisWeek: thisWeek,
    buildDispatch: buildDispatch, applyDispatch: applyDispatch,
    buildSubmission: buildSubmission, applySubmission: applySubmission,
    expectedPMs: expectedPMs, progressDelta: progressDelta
  };
})();
