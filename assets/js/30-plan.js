/* ============================================================
 * 30-plan.js  项目计划（项目经理专属）
 * 子页：phases 阶段划分 / milestones 里程碑 / deps 依赖关系
 * ========================================================== */
(function () {
  'use strict';
  var E = U.esc, MOD = 'plan';

  var DEF_P = { kw: '', status: '', owner: '' };
  var DEF_M = { kw: '', status: '', phase: '' };

  /* 里程碑状态在 C.TONE.status 里没有「已延期完成 / 已延期」，本地补映射 */
  var MS_TONE = {
    '已完成': 'done', '已延期完成': 'warn', '已延期': 'danger',
    '进行中': 'doing', '未开始': 'idle'
  };
  function msTag(s) { return UI.tag(s, MS_TONE[s] || 'plain'); }

  function phaseTone(ph) {
    if (ph.status === '已完成') return 'done';
    if (ph.status === '待开始') return 'idle';
    /* 进行中：看是否已过计划结束日 */
    if (U.dayDiff(ph.end, S.TODAY) > 0) return 'danger';
    if (U.dayDiff(ph.end, S.TODAY) > -7) return 'warn';
    return 'doing';
  }
  function pct(v) { return Math.round((v || 0) * 100); }
  function projLabel() {
    var p = S.curProject();
    return p ? p.name : '全部项目';
  }

  /* 阶段实际任务统计（seed 里 taskCount 未回填，这里现算） */
  function tasksOf(phId) {
    return S.tasks().filter(function (t) { return t.phaseId === phId; });
  }

  /* ==========================================================
   * 子页一：阶段划分
   * ======================================================== */
  function phases(ctx) {
    var all = S.phases();
    var f = P.flt(MOD, DEF_P);
    var rows = all.filter(function (p) {
      if (f.status && p.status !== f.status) return false;
      if (f.owner && p.owner !== f.owner) return false;
      if (f.kw) {
        var k = f.kw.toLowerCase();
        if ((p.name + p.projectName + p.owner + p.goal).toLowerCase().indexOf(k) < 0) return false;
      }
      return true;
    });
    rows.sort(function (a, b) { return a.projectId === b.projectId ? a.order - b.order : (a.projectId < b.projectId ? -1 : 1); });

    var done = all.filter(function (p) { return p.status === '已完成'; });
    var doing = all.filter(function (p) { return p.status === '进行中'; });
    var risky = doing.filter(function (p) { return U.dayDiff(p.end, S.TODAY) > 0; });

    var h = P.head({
      mod: MOD, title: '阶段划分',
      desc: projLabel() + ' 的阶段拆解、责任人与进度。阶段按顺序串行，前置阶段未完成会拖累后续排期。',
      acts: '<button class="btn" id="phCsv">导出 CSV</button><button class="btn" id="phWord">导出计划书</button>'
    });
    h += P.permTip(MOD);
    h += P.statCards([
      { label: '阶段总数', val: all.length, unit: '个', sub: '覆盖 ' + U.uniq(all.map(function (x) { return x.projectId; })).length + ' 个项目', ico: '◫' },
      { label: '已完成', val: done.length, unit: '个', sub: '完成率 ' + U.pct(done.length, all.length) + '%', tone: 'done', ico: '✓' },
      { label: '进行中', val: doing.length, unit: '个', sub: '其中 ' + risky.length + ' 个已超计划结束日', tone: doing.length ? 'doing' : 'idle', ico: '▶' },
      { label: '平均进度', val: pct(U.avg(all, 'progress')), unit: '%', sub: '按阶段等权平均', tone: UI.ptone(pct(U.avg(all, 'progress'))), ico: '◐' }
    ]);
    h += P.gap(4);
    h += UI.card({ title: '阶段甘特', sub: '条形为计划区间，填充为实际进度；竖线为今天', bodyId: 'phGtWrap', body: P.chart('phGt', 300) });
    h += P.gap(4);

    h += '<div class="toolbar" id="phFlt">' +
      '<input class="fld" data-f="kw" placeholder="搜索阶段 / 项目 / 负责人" value="' + E(f.kw) + '" style="min-width:220px">' +
      P.sel('status', '全部状态', ['待开始', '进行中', '已完成'], f.status) +
      P.sel('owner', '全部负责人', U.uniq(all.map(function (x) { return x.owner; })), f.owner) +
      '<button class="btn-ghost" data-reset>重置</button>' +
      '<span class="grow"></span><span class="muted tiny">共 ' + rows.length + ' 个阶段</span>' +
      '</div>';
    h += P.viewBar(MOD);
    h += '<div id="phTbl"></div>';

    ctx.el.innerHTML = h;

    CH.gantt('phGt', {
      rows: all.map(function (p) {
        return {
          name: p.name, right: p.projectName, start: p.start, end: p.end,
          tone: phaseTone(p), progress: pct(p.progress), _src: p,
          tipExtra: CH.tipRow(CH.TONE.plan, '项目', p.projectName) +
            CH.tipRow(CH.TONE.plan, '负责人', p.owner) +
            CH.tipRow(CH.TONE[phaseTone(p)], '状态', p.status)
        };
      }),
      today: U.fmtDate(S.TODAY), maxH: 320,
      onClick: function (r) { if (r._src) openPhase(r._src); }
    });

    UI.table(ctx.el.querySelector('#phTbl'), {
      cols: [
        { k: 'order', t: '#', w: '48px', align: 'center', sortable: true },
        {
          k: 'name', t: '阶段', w: '220px', sortable: true,
          render: function (r) { return UI.cell2(E(r.name), E(r.projectName)); }
        },
        { k: 'owner', t: '负责人', w: '120px', sortable: true, render: function (r) { return UI.owner(r.owner); } },
        { k: 'start', t: '开始', w: '110px', sortable: true },
        { k: 'end', t: '计划结束', w: '110px', sortable: true, render: function (r) { return UI.due(r.end); } },
        {
          k: 'days', t: '工期', w: '80px', align: 'right', sortable: true,
          sortVal: function (r) { return U.dayDiff(r.start, r.end); },
          render: function (r) { return U.dayDiff(r.start, r.end) + 1 + ' 天'; }
        },
        {
          k: 'tk', t: '任务', w: '80px', align: 'right', sortable: true,
          sortVal: function (r) { return tasksOf(r.id).length; },
          render: function (r) {
            var ts = tasksOf(r.id);
            var d = ts.filter(function (t) { return t.status === '已完成'; }).length;
            return '<span class="muted tiny">' + d + '/' + ts.length + '</span>';
          }
        },
        {
          k: 'progress', t: '进度', w: '140px', sortable: true,
          render: function (r) { return UI.pcell(pct(r.progress), UI.ptone(pct(r.progress))); }
        },
        {
          k: 'status', t: '状态', w: '110px', sortable: true,
          render: function (r) { return UI.st('status', r.status); }
        },
        {
          k: 'act', t: '操作', w: '110px', align: 'right',
          render: function () { return '<div class="row-acts"><button class="btn-sm" data-act="view">详情</button></div>'; }
        }
      ],
      rows: rows, pageSize: 15, sort: { k: 'order', desc: false },
      rowCls: function (r) {
        if (r.status === '进行中' && U.dayDiff(r.end, S.TODAY) > 0) return 'row-danger';
        if (r.status === '已完成') return 'row-done';
        return '';
      },
      onRow: openPhase,
      onAct: function (act, r) { if (act === 'view') openPhase(r); },
      empty: '没有符合条件的阶段',
      bulk: [{ t: '导出所选', fn: function (picked) { csvPhases(picked); } }],
      select: true
    });

    P.bindFlt(ctx.el.querySelector('#phFlt'), MOD, DEF_P, function () { Shell.route(); });
    P.bindViews(ctx.el, MOD, DEF_P);
    P.$('phCsv').onclick = function () { csvPhases(rows); };
    P.$('phWord').onclick = function () { wordPlan(all); };
  }

  function csvPhases(rows) {
    P.csv('阶段划分', rows, [
      { label: '项目', key: 'projectName' }, { label: '序号', key: 'order' },
      { label: '阶段', key: 'name' }, { label: '负责人', key: 'owner' },
      { label: '开始', key: 'start' }, { label: '结束', key: 'end' },
      { label: '工期(天)', get: function (r) { return U.dayDiff(r.start, r.end) + 1; } },
      { label: '进度%', get: function (r) { return pct(r.progress); } },
      { label: '状态', key: 'status' }, { label: '阶段目标', key: 'goal' }
    ]);
  }

  function wordPlan(all) {
    var byProj = U.group(all, 'projectName');
    var secs = [{
      h: '一、计划概览',
      kv: [
        ['数据口径', P.scopeText()],
        ['阶段总数', all.length + ' 个'],
        ['已完成', all.filter(function (x) { return x.status === '已完成'; }).length + ' 个'],
        ['进行中', all.filter(function (x) { return x.status === '进行中'; }).length + ' 个'],
        ['平均进度', pct(U.avg(all, 'progress')) + '%']
      ]
    }];
    Object.keys(byProj).forEach(function (nm, i) {
      var list = byProj[nm].slice().sort(function (a, b) { return a.order - b.order; });
      secs.push({
        h: '二.' + (i + 1) + '　' + nm,
        table: {
          cols: [
            { t: '序号', k: 'order' }, { t: '阶段', k: 'name' }, { t: '负责人', k: 'owner' },
            { t: '开始', k: 'start' }, { t: '计划结束', k: 'end' },
            { t: '工期', get: function (r) { return U.dayDiff(r.start, r.end) + 1 + ' 天'; } },
            { t: '进度', get: function (r) { return pct(r.progress) + '%'; } },
            { t: '状态', k: 'status' }, { t: '阶段目标', k: 'goal' }
          ], rows: list
        }
      });
    });
    P.word('项目计划书', '项目阶段计划书', secs);
    UI.toast('计划书已导出', 'ok');
  }

  function openPhase(ph) {
    var ts = tasksOf(ph.id);
    var doneN = ts.filter(function (t) { return t.status === '已完成'; }).length;
    var blocked = ts.filter(function (t) { return t.status === '已阻塞'; });
    var deps = (ph.deps || []).map(function (id) {
      return S.phases('all').filter(function (x) { return x.id === id; })[0];
    }).filter(Boolean);
    var ms = S.milestones().filter(function (m) { return m.phaseId === ph.id; });

    var b = P.hero({
      title: E(ph.name), id: ph.id,
      meta: [
        ['项目', E(ph.projectName)], ['负责人', UI.owner(ph.owner)],
        ['计划区间', E(ph.start) + ' ~ ' + E(ph.end)],
        ['状态', UI.st('status', ph.status)]
      ],
      right: UI.pbar(pct(ph.progress), UI.ptone(pct(ph.progress)), true)
    });
    b += UI.sec('阶段目标', '<div class="rich">' + E(ph.goal) + '</div>');
    b += UI.sec('执行概况', P.kv([
      ['工期', U.dayDiff(ph.start, ph.end) + 1 + ' 天'],
      ['剩余', ph.status === '已完成' ? '—' : (U.dayDiff(S.TODAY, ph.end) + ' 天')],
      ['任务完成', doneN + ' / ' + ts.length],
      ['阻塞任务', blocked.length + ' 个'],
      ['关联里程碑', ms.length ? ms.map(function (m) { return m.name; }).join('、') : '—'],
      ['前置阶段', deps.length ? deps.map(function (d) { return d.name + '（' + d.status + '）'; }).join('、') : '无']
    ]));

    b += UI.sec('任务清单（' + ts.length + '）', ts.length ? ts.slice(0, 20).map(function (t) {
      return UI.listItem({
        title: E(t.title),
        desc: E(t.owner) + ' · ' + E(t.start) + ' ~ ' + E(t.due),
        right: UI.st('status', t.status) + ' ' + UI.pri(t.priority)
      });
    }).join('') : UI.empty('该阶段暂无任务'));

    UI.drawer({
      title: ph.name, sub: ph.projectName + ' · ' + ph.id, wide: true, body: b,
      foot: '<button class="btn" data-go="tasks/list">查看全部任务</button>' +
        '<button class="btn" data-go="progress/gantt">进度跟踪</button>',
      onOpen: function (h) {
        h.el.querySelectorAll('[data-go]').forEach(function (n) {
          n.addEventListener('click', function () {
            var t = n.getAttribute('data-go').split('/');
            h.close(); Shell.go(t[0], t[1]);
          });
        });
      }
    });
  }

  /* ==========================================================
   * 子页二：里程碑
   * ======================================================== */
  function milestones(ctx) {
    var all = S.milestones();
    var phAll = S.phases('all');
    var phMap = U.by(phAll, 'id');
    var f = P.flt(MOD, DEF_M);

    var rows = all.filter(function (m) {
      if (f.status && m.status !== f.status) return false;
      if (f.phase && (phMap[m.phaseId] || {}).name !== f.phase) return false;
      if (f.kw) {
        var k = f.kw.toLowerCase();
        if ((m.name + m.projectName + m.owner).toLowerCase().indexOf(k) < 0) return false;
      }
      return true;
    });
    rows.sort(function (a, b) { return a.date < b.date ? -1 : 1; });

    var hit = all.filter(function (m) { return m.status === '已完成'; });
    var lateHit = all.filter(function (m) { return m.status === '已延期完成'; });
    var late = all.filter(function (m) { return m.status === '已延期'; });
    var rate = U.pct(hit.length, hit.length + lateHit.length + late.length);

    var h = P.head({
      mod: MOD, title: '里程碑',
      desc: projLabel() + ' 的关键交付节点。按期达成率是项目健康度的第一信号，已延期节点需在周会上给出补救方案。',
      acts: '<button class="btn" id="msCsv">导出 CSV</button><button class="btn" id="msWord">导出里程碑报告</button>'
    });
    h += P.permTip(MOD);
    h += P.statCards([
      { label: '里程碑总数', val: all.length, unit: '个', sub: '含未来节点 ' + all.filter(function (m) { return m.status === '未开始'; }).length + ' 个', ico: '◆' },
      { label: '已达成', val: hit.length + lateHit.length, unit: '个', sub: '其中延期达成 ' + lateHit.length + ' 个', tone: 'done', ico: '✓' },
      { label: '已延期未达成', val: late.length, unit: '个', sub: late.length ? '需立即跟进补救' : '暂无延期节点', tone: late.length ? 'danger' : 'done', ico: '⚠' },
      { label: '按期达成率', val: rate, unit: '%', sub: '已到期节点中按原计划完成的比例', tone: UI.ptone(rate), ico: '◎' }
    ]);
    h += P.gap(4);
    h += UI.grid(2,
      UI.card({ title: '里程碑时间线', sub: '菱形为节点，竖线为今天', bodyId: 'msGtWrap', body: P.chart('msGt', 280) }) +
      UI.card({ title: '状态分布', sub: '点击扇区可回填筛选', body: P.chart('msPie', 280) })
    );
    h += P.gap(4);

    h += '<div class="toolbar" id="msFlt">' +
      '<input class="fld" data-f="kw" placeholder="搜索里程碑 / 项目 / 负责人" value="' + E(f.kw) + '" style="min-width:220px">' +
      P.sel('status', '全部状态', ['未开始', '进行中', '已完成', '已延期完成', '已延期'], f.status) +
      P.sel('phase', '全部阶段', U.uniq(phAll.map(function (x) { return x.name; })), f.phase) +
      '<button class="btn-ghost" data-reset>重置</button>' +
      '<span class="grow"></span><span class="muted tiny">共 ' + rows.length + ' 个节点</span>' +
      '</div>';
    h += P.viewBar(MOD);
    h += '<div id="msTbl"></div>';

    ctx.el.innerHTML = h;

    CH.gantt('msGt', {
      rows: all.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).map(function (m) {
        return {
          name: m.name, right: m.projectName, start: m.date, end: m.date, type: 'mile',
          tone: MS_TONE[m.status] || 'plan', _src: m,
          tipExtra: CH.tipRow(CH.TONE.plan, '项目', m.projectName) +
            CH.tipRow(CH.TONE.plan, '负责人', m.owner) +
            CH.tipRow(CH.TONE[MS_TONE[m.status] || 'plan'], '状态', m.status)
        };
      }),
      today: U.fmtDate(S.TODAY), maxH: 300,
      legend: [
        { name: '已完成', tone: 'done' }, { name: '延期达成', tone: 'warn' },
        { name: '已延期', tone: 'danger' }, { name: '进行中', tone: 'doing' }, { name: '未开始', tone: 'idle' }
      ],
      onClick: function (r) { if (r._src) openMs(r._src, phMap); }
    });

    var byS = U.countBy(all, 'status');
    CH.donut('msPie', {
      data: Object.keys(byS).map(function (k) {
        return { name: k, value: byS[k], color: CH.TONE[MS_TONE[k] || 'plan'] };
      }),
      center: { l: '里程碑', v: all.length },
      onClick: function (i, d) {
        var ff = P.flt(MOD, DEF_M); ff.status = ff.status === d.name ? '' : d.name;
        P.setFlt(MOD, ff); Shell.route();
      }
    });

    UI.table(ctx.el.querySelector('#msTbl'), {
      cols: [
        {
          k: 'name', t: '里程碑', w: '220px', sortable: true,
          render: function (r) { return UI.cell2(E(r.name), E(r.projectName)); }
        },
        {
          k: 'phase', t: '所属阶段', w: '120px', sortable: true,
          sortVal: function (r) { return (phMap[r.phaseId] || {}).order || 0; },
          render: function (r) { return E((phMap[r.phaseId] || {}).name || '—'); }
        },
        { k: 'owner', t: '负责人', w: '110px', sortable: true, render: function (r) { return UI.owner(r.owner); } },
        { k: 'date', t: '计划日期', w: '120px', sortable: true, render: function (r) { return UI.due(r.date); } },
        {
          k: 'dd', t: '距今', w: '90px', align: 'right', sortable: true,
          sortVal: function (r) { return U.dayDiff(S.TODAY, r.date); },
          render: function (r) {
            var d = U.dayDiff(S.TODAY, r.date);
            if (r.status === '已完成' || r.status === '已延期完成') return '<span class="muted tiny">已达成</span>';
            return d >= 0 ? ('<span class="muted tiny">还有 ' + d + ' 天</span>') : ('<span class="t-danger tiny">逾期 ' + (-d) + ' 天</span>');
          }
        },
        { k: 'deliverables', t: '交付物', w: '80px', align: 'right', sortable: true, render: function (r) { return r.deliverables + ' 项'; } },
        { k: 'criteria', t: '验收标准', cls: 'muted tiny' },
        { k: 'status', t: '状态', w: '110px', sortable: true, render: function (r) { return msTag(r.status); } },
        {
          k: 'act', t: '操作', w: '110px', align: 'right',
          render: function () { return '<div class="row-acts"><button class="btn-sm" data-act="view">详情</button></div>'; }
        }
      ],
      rows: rows, pageSize: 15, sort: { k: 'date', desc: false },
      rowCls: function (r) {
        if (r.status === '已延期') return 'row-danger';
        if (r.status === '已延期完成') return 'row-warn';
        return '';
      },
      onRow: function (r) { openMs(r, phMap); },
      onAct: function (act, r) { if (act === 'view') openMs(r, phMap); },
      empty: '没有符合条件的里程碑',
      select: true,
      bulk: [{ t: '导出所选', fn: function (picked) { csvMs(picked, phMap); } }]
    });

    P.bindFlt(ctx.el.querySelector('#msFlt'), MOD, DEF_M, function () { Shell.route(); });
    P.bindViews(ctx.el, MOD, DEF_M);
    P.$('msCsv').onclick = function () { csvMs(rows, phMap); };
    P.$('msWord').onclick = function () { wordMs(all, phMap, rate); };
  }

  function csvMs(rows, phMap) {
    P.csv('里程碑', rows, [
      { label: '项目', key: 'projectName' }, { label: '里程碑', key: 'name' },
      { label: '所属阶段', get: function (r) { return (phMap[r.phaseId] || {}).name || ''; } },
      { label: '负责人', key: 'owner' }, { label: '计划日期', key: 'date' },
      { label: '状态', key: 'status' }, { label: '交付物数', key: 'deliverables' },
      { label: '验收标准', key: 'criteria' }
    ]);
  }

  function wordMs(all, phMap, rate) {
    var late = all.filter(function (m) { return m.status === '已延期'; });
    var soon = all.filter(function (m) {
      var d = U.dayDiff(S.TODAY, m.date);
      return d >= 0 && d <= 21 && m.status !== '已完成' && m.status !== '已延期完成';
    });
    P.word('里程碑报告', '项目里程碑达成报告', [
      {
        h: '一、总体情况', kv: [
          ['数据口径', P.scopeText()],
          ['里程碑总数', all.length + ' 个'],
          ['已达成', all.filter(function (m) { return m.status === '已完成' || m.status === '已延期完成'; }).length + ' 个'],
          ['已延期未达成', late.length + ' 个'],
          ['按期达成率', rate + '%']
        ]
      },
      {
        h: '二、延期节点', p: late.length ? '以下节点已过计划日期仍未达成，需在本周项目例会给出补救方案。' : '本期无延期未达成的里程碑。',
        table: {
          cols: [
            { t: '项目', k: 'projectName' }, { t: '里程碑', k: 'name' },
            { t: '阶段', get: function (r) { return (phMap[r.phaseId] || {}).name || '—'; } },
            { t: '负责人', k: 'owner' }, { t: '计划日期', k: 'date' },
            { t: '逾期天数', get: function (r) { return -U.dayDiff(S.TODAY, r.date) + ' 天'; } }
          ], rows: late
        }
      },
      {
        h: '三、未来三周节点', p: '以下节点将在 21 天内到期，请提前确认交付物与验收准备。',
        table: {
          cols: [
            { t: '项目', k: 'projectName' }, { t: '里程碑', k: 'name' },
            { t: '负责人', k: 'owner' }, { t: '计划日期', k: 'date' },
            { t: '状态', k: 'status' }, { t: '交付物数', k: 'deliverables' }
          ], rows: soon
        }
      },
      {
        h: '四、全部节点',
        table: {
          cols: [
            { t: '项目', k: 'projectName' }, { t: '里程碑', k: 'name' },
            { t: '阶段', get: function (r) { return (phMap[r.phaseId] || {}).name || '—'; } },
            { t: '计划日期', k: 'date' }, { t: '状态', k: 'status' },
            { t: '验收标准', k: 'criteria' }
          ], rows: all.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; })
        }
      }
    ]);
    UI.toast('里程碑报告已导出', 'ok');
  }

  function openMs(m, phMap) {
    var ph = phMap[m.phaseId];
    var d = U.dayDiff(S.TODAY, m.date);
    var b = P.hero({
      title: E(m.name), id: m.id,
      meta: [
        ['项目', E(m.projectName)], ['所属阶段', E(ph ? ph.name : '—')],
        ['负责人', UI.owner(m.owner)], ['计划日期', E(m.date)],
        ['状态', msTag(m.status)]
      ]
    });
    b += UI.sec('节点信息', P.kv([
      ['距今', (m.status === '已完成' || m.status === '已延期完成') ? '已达成' : (d >= 0 ? '还有 ' + d + ' 天' : '逾期 ' + (-d) + ' 天')],
      ['交付物数量', m.deliverables + ' 项'],
      ['所属阶段进度', ph ? pct(ph.progress) + '%' : '—'],
      ['阶段负责人', ph ? ph.owner : '—']
    ]));
    b += UI.sec('验收标准', '<div class="rich">' + E(m.criteria) + '</div>');

    if (ph) {
      var ts = tasksOf(ph.id).filter(function (t) { return t.status !== '已完成' && t.status !== '已取消'; });
      b += UI.sec('影响达成的未完成任务（' + ts.length + '）', ts.length ? ts.slice(0, 15).map(function (t) {
        return UI.listItem({
          title: E(t.title), desc: E(t.owner) + ' · 截止 ' + E(t.due),
          right: UI.st('status', t.status) + ' ' + UI.pri(t.priority)
        });
      }).join('') : UI.empty('该阶段任务已全部关闭'));
    }

    UI.drawer({ title: m.name, sub: m.projectName + ' · ' + m.id, wide: true, body: b });
  }

  /* ==========================================================
   * 子页三：依赖关系
   * ======================================================== */
  function deps(ctx) {
    var phAll = S.phases();
    var phMap = U.by(S.phases('all'), 'id');
    var ts = S.tasks();
    var blocked = ts.filter(function (t) { return t.status === '已阻塞'; });

    /* 每个阶段的可开工判断 */
    var rows = phAll.map(function (p) {
      var pre = (p.deps || []).map(function (id) { return phMap[id]; }).filter(Boolean);
      var preOk = pre.every(function (x) { return x.status === '已完成'; });
      var bl = ts.filter(function (t) { return t.phaseId === p.id && t.status === '已阻塞'; });
      var ready, risk;
      if (p.status === '已完成') { ready = '已完成'; risk = '无'; }
      else if (!preOk && p.status === '进行中') { ready = '前置未完成但已开工'; risk = '高'; }
      else if (!preOk) { ready = '等待前置'; risk = '中'; }
      else if (bl.length) { ready = '已开工但有阻塞'; risk = '高'; }
      else { ready = '可开工'; risk = '低'; }
      return {
        id: p.id, name: p.name, projectName: p.projectName, order: p.order, owner: p.owner,
        start: p.start, end: p.end, status: p.status, progress: p.progress,
        preText: pre.length ? pre.map(function (x) { return x.name; }).join('、') : '无',
        preStatus: pre.length ? pre.map(function (x) { return x.status; }).join('、') : '—',
        preOk: preOk, blocked: bl.length, ready: ready, risk: risk, _pre: pre, _bl: bl
      };
    });
    rows.sort(function (a, b) { return a.projectName === b.projectName ? a.order - b.order : (a.projectName < b.projectName ? -1 : 1); });

    var depCount = phAll.reduce(function (s, p) { return s + (p.deps || []).length; }, 0);
    var waiting = rows.filter(function (r) { return r.ready === '等待前置'; });
    var hi = rows.filter(function (r) { return r.risk === '高'; });

    var h = P.head({
      mod: MOD, title: '依赖关系',
      desc: '阶段之间为串行依赖，任务之间通过阻塞项传导风险。此页回答两个问题：哪个阶段现在能开工，哪些阻塞正在卡住关键路径。',
      acts: '<button class="btn" id="dpCsv">导出 CSV</button><button class="btn" id="dpWord">导出依赖分析</button>'
    });
    h += P.permTip(MOD);
    h += P.statCards([
      { label: '依赖关系', val: depCount, unit: '条', sub: '覆盖 ' + phAll.length + ' 个阶段', ico: '⇢' },
      { label: '等待前置', val: waiting.length, unit: '个', sub: '前置阶段未完成，暂不可开工', tone: waiting.length ? 'warn' : 'done', ico: '⏸' },
      { label: '阻塞任务', val: blocked.length, unit: '个', sub: '分布在 ' + U.uniq(blocked.map(function (t) { return t.phaseId; })).length + ' 个阶段', tone: blocked.length ? 'danger' : 'done', ico: '⛔' },
      { label: '高风险阶段', val: hi.length, unit: '个', sub: '前置未完成即开工 或 存在阻塞', tone: hi.length ? 'danger' : 'done', ico: '⚠' }
    ]);
    h += P.gap(4);

    /* 依赖链可视化：按项目分组画链 */
    var byProj = U.group(phAll, 'projectName');
    var chain = Object.keys(byProj).map(function (nm) {
      var list = byProj[nm].slice().sort(function (a, b) { return a.order - b.order; });
      return '<div class="dep-chain"><div class="dep-chain-t">' + E(nm) + '</div><div class="dep-chain-b">' +
        list.map(function (p, i) {
          var bl = ts.filter(function (t) { return t.phaseId === p.id && t.status === '已阻塞'; }).length;
          return (i ? '<span class="dep-arrow">→</span>' : '') +
            '<span class="dep-node dep-' + phaseTone(p) + '" data-ph="' + E(p.id) + '" title="' + E(p.name + ' · ' + p.status + ' · ' + pct(p.progress) + '%') + '">' +
            E(p.name) + '<b>' + pct(p.progress) + '%</b>' +
            (bl ? '<i class="dep-bl" title="阻塞任务 ' + bl + ' 个">⛔' + bl + '</i>' : '') +
            '</span>';
        }).join('') + '</div></div>';
    }).join('');
    h += UI.card({ title: '阶段依赖链', sub: '点击节点查看阶段详情；⛔ 表示该阶段存在阻塞任务', body: chain || UI.empty('当前口径下暂无阶段'), id: 'dpChain' });
    h += P.gap(4);

    h += UI.card({ title: '阶段开工条件', sub: '前置状态 / 是否可开工 / 风险等级', bodyId: 'dpTblWrap', body: '<div id="dpTbl"></div>', flush: true });
    h += P.gap(4);
    h += UI.card({ title: '阻塞任务清单（' + blocked.length + '）', sub: '阻塞会沿依赖链向后传导，需优先清理', bodyId: 'dpBlWrap', body: '<div id="dpBl"></div>', flush: true });

    ctx.el.innerHTML = h;

    ctx.el.querySelectorAll('[data-ph]').forEach(function (n) {
      n.addEventListener('click', function () {
        var p = phMap[n.getAttribute('data-ph')];
        if (p) openPhase(p);
      });
    });

    UI.table(ctx.el.querySelector('#dpTbl'), {
      cols: [
        {
          k: 'name', t: '阶段', w: '200px', sortable: true,
          render: function (r) { return UI.cell2(E(r.name), E(r.projectName)); }
        },
        { k: 'owner', t: '负责人', w: '110px', render: function (r) { return UI.owner(r.owner); } },
        { k: 'preText', t: '前置阶段', w: '160px' },
        {
          k: 'preStatus', t: '前置状态', w: '120px',
          render: function (r) { return r._pre.length ? r._pre.map(function (x) { return UI.st('status', x.status); }).join(' ') : '<span class="muted">—</span>'; }
        },
        { k: 'status', t: '本阶段状态', w: '110px', sortable: true, render: function (r) { return UI.st('status', r.status); } },
        { k: 'blocked', t: '阻塞任务', w: '90px', align: 'right', sortable: true, render: function (r) { return r.blocked ? '<span class="t-danger">' + r.blocked + '</span>' : '<span class="muted">0</span>'; } },
        {
          k: 'ready', t: '开工条件', w: '150px', sortable: true,
          render: function (r) {
            var tone = r.ready === '可开工' ? 'done' : (r.ready === '已完成' ? 'plain' : (r.ready === '等待前置' ? 'warn' : 'danger'));
            return UI.tag(r.ready, tone);
          }
        },
        {
          k: 'risk', t: '风险', w: '80px', sortable: true,
          render: function (r) { return UI.light(r.risk === '高' ? 'r' : (r.risk === '中' ? 'y' : 'g'), r.risk); }
        },
        {
          k: 'act', t: '操作', w: '100px', align: 'right',
          render: function () { return '<div class="row-acts"><button class="btn-sm" data-act="view">详情</button></div>'; }
        }
      ],
      rows: rows, pageSize: 12, compact: true,
      rowCls: function (r) { return r.risk === '高' ? 'row-danger' : (r.risk === '中' ? 'row-warn' : ''); },
      onAct: function (act, r) { var p = phMap[r.id]; if (p) openPhase(p); },
      onRow: function (r) { var p = phMap[r.id]; if (p) openPhase(p); },
      empty: '当前口径下暂无阶段'
    });

    UI.table(ctx.el.querySelector('#dpBl'), {
      cols: [
        { k: 'id', t: '编号', w: '80px', render: function (r) { return UI.idCell(r.id); } },
        { k: 'title', t: '任务', w: '240px', render: function (r) { return UI.cell2(E(r.title), E(r.projectName + ' · ' + r.phaseName)); } },
        { k: 'owner', t: '负责人', w: '110px', render: function (r) { return UI.owner(r.owner); } },
        { k: 'priority', t: '优先级', w: '80px', sortable: true, render: function (r) { return UI.pri(r.priority); } },
        { k: 'due', t: '截止', w: '110px', sortable: true, render: function (r) { return UI.due(r.due); } },
        { k: 'blockReason', t: '阻塞原因', cls: 'muted tiny' },
        {
          k: 'delayDays', t: '延期', w: '80px', align: 'right', sortable: true,
          render: function (r) { return r.delayDays ? '<span class="t-danger">' + r.delayDays + ' 天</span>' : '<span class="muted">—</span>'; }
        }
      ],
      rows: blocked, pageSize: 10, compact: true,
      rowCls: function () { return 'row-danger'; },
      empty: '当前没有阻塞任务，依赖链畅通'
    });

    P.$('dpCsv').onclick = function () {
      P.csv('阶段依赖关系', rows, [
        { label: '项目', key: 'projectName' }, { label: '阶段', key: 'name' },
        { label: '负责人', key: 'owner' }, { label: '前置阶段', key: 'preText' },
        { label: '前置状态', key: 'preStatus' }, { label: '本阶段状态', key: 'status' },
        { label: '阻塞任务数', key: 'blocked' }, { label: '开工条件', key: 'ready' },
        { label: '风险', key: 'risk' }
      ]);
    };
    P.$('dpWord').onclick = function () {
      P.word('依赖与阻塞分析', '项目依赖关系与阻塞分析', [
        {
          h: '一、总体', kv: [
            ['数据口径', P.scopeText()], ['依赖关系', depCount + ' 条'],
            ['等待前置阶段', waiting.length + ' 个'], ['阻塞任务', blocked.length + ' 个'],
            ['高风险阶段', hi.length + ' 个']
          ]
        },
        {
          h: '二、高风险阶段', p: hi.length ? '以下阶段存在「前置未完成即开工」或「进行中存在阻塞任务」的情况，是当前计划最脆弱的环节。' : '暂无高风险阶段。',
          table: {
            cols: [
              { t: '项目', k: 'projectName' }, { t: '阶段', k: 'name' }, { t: '负责人', k: 'owner' },
              { t: '前置阶段', k: 'preText' }, { t: '前置状态', k: 'preStatus' },
              { t: '阻塞任务', k: 'blocked' }, { t: '开工条件', k: 'ready' }
            ], rows: hi
          }
        },
        {
          h: '三、阻塞任务清单',
          table: {
            cols: [
              { t: '编号', k: 'id' }, { t: '任务', k: 'title' },
              { t: '阶段', k: 'phaseName' }, { t: '负责人', k: 'owner' },
              { t: '优先级', k: 'priority' }, { t: '截止', k: 'due' },
              { t: '阻塞原因', k: 'blockReason' }
            ], rows: blocked
          }
        },
        {
          h: '四、全部阶段开工条件',
          table: {
            cols: [
              { t: '项目', k: 'projectName' }, { t: '阶段', k: 'name' },
              { t: '状态', k: 'status' }, { t: '前置阶段', k: 'preText' },
              { t: '开工条件', k: 'ready' }, { t: '风险', k: 'risk' }
            ], rows: rows
          }
        }
      ]);
      UI.toast('依赖分析已导出', 'ok');
    };
  }

  Shell.page(MOD, {
    render: function (ctx) {
      if (ctx.sub === 'milestones') milestones(ctx);
      else if (ctx.sub === 'deps') deps(ctx);
      else phases(ctx);
    }
  });
})();
