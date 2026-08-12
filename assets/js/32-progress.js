/* ============================================================
 * 32-progress.js  进度跟踪（项目经理专属）
 * 子页：gantt 甘特图 / delay 延期分析 / blocked 阻塞项
 * ========================================================== */
(function () {
  'use strict';
  var E = U.esc, MOD = 'progress';

  var DEF_G = { level: 'phase', phase: '', status: '' };
  var DEF_D = { kw: '', type: '', owner: '', phase: '', band: '' };
  var DEF_B = { kw: '', owner: '', phase: '' };

  var MS_TONE = { '已完成': 'done', '已延期完成': 'warn', '已延期': 'danger', '进行中': 'doing', '未开始': 'idle' };
  var BANDS = [
    { k: '1-3天', min: 1, max: 3 }, { k: '4-7天', min: 4, max: 7 },
    { k: '8-14天', min: 8, max: 14 }, { k: '15天以上', min: 15, max: 9999 }
  ];

  function pct(v) { return Math.round((v || 0) * 100); }
  function open(t) { return t.status !== '已完成' && t.status !== '已取消'; }
  function bandOf(d) {
    for (var i = 0; i < BANDS.length; i++) if (d >= BANDS[i].min && d <= BANDS[i].max) return BANDS[i].k;
    return '';
  }
  function taskTone(t) {
    if (t.status === '已完成') return 'done';
    if (t.status === '已取消') return 'idle';
    if (t.status === '已阻塞') return 'danger';
    if (t.overdue) return 'danger';
    if (U.dayDiff(S.TODAY, t.due) <= 3) return 'warn';
    if (t.status === '待开始') return 'idle';
    return 'doing';
  }
  function phaseTone(p) {
    if (p.status === '已完成') return 'done';
    if (p.status === '待开始') return 'idle';
    if (U.dayDiff(p.end, S.TODAY) > 0) return 'danger';
    if (U.dayDiff(p.end, S.TODAY) > -7) return 'warn';
    return 'doing';
  }

  /* 项目应完成进度（按日历时间线性推算），用于计划 vs 实际对比 */
  function planProgress(p) {
    var total = U.dayDiff(p.start, p.end);
    if (total <= 0) return 1;
    return U.clamp(U.dayDiff(p.start, S.TODAY) / total, 0, 1);
  }

  /* ==========================================================
   * 子页一：甘特图
   * ======================================================== */
  function gantt(ctx) {
    var f = P.flt(MOD, DEF_G);
    var projects = S.projectsInScope();
    var phases = S.phases();
    var miles = S.milestones();
    var tasks = S.tasks();

    var rows = [];
    projects.forEach(function (p) {
      var phs = phases.filter(function (x) { return x.projectId === p.id; })
        .sort(function (a, b) { return a.order - b.order; });
      if (!phs.length) return;
      rows.push({
        name: p.name, right: p.pm, start: p.start, end: p.end, type: 'grp',
        tone: p.status === '已完成' ? 'done' : (p.health === '高' ? 'danger' : 'doing'),
        tipExtra: CH.tipRow(CH.TONE.plan, '项目经理', p.pm) +
          CH.tipRow(CH.TONE.doing, '实际进度', pct(p.progress) + '%') +
          CH.tipRow(CH.TONE.idle, '应完成进度', pct(planProgress(p)) + '%'),
        _go: ['plan', 'phases']
      });
      phs.forEach(function (ph) {
        if (f.phase && ph.name !== f.phase) return;
        if (f.status && ph.status !== f.status) return;
        rows.push({
          name: ph.name, right: ph.owner, start: ph.start, end: ph.end, level: 2,
          tone: phaseTone(ph), progress: pct(ph.progress),
          tipExtra: CH.tipRow(CH.TONE.plan, '负责人', ph.owner) + CH.tipRow(CH.TONE[phaseTone(ph)], '状态', ph.status),
          _phase: ph
        });
        if (f.level === 'task') {
          tasks.filter(function (t) { return t.phaseId === ph.id; })
            .sort(function (a, b) { return a.start < b.start ? -1 : 1; })
            .forEach(function (t) {
              rows.push({
                name: '　' + t.title, right: t.owner, start: t.start, end: t.due, level: 2,
                tone: taskTone(t), progress: pct(t.progress),
                tipExtra: CH.tipRow(CH.TONE.plan, '负责人', t.owner) +
                  CH.tipRow(CH.TONE[taskTone(t)], '状态', t.status) +
                  (t.overdue && open(t) ? CH.tipRow(CH.TONE.danger, '延期', t.delayDays + ' 天') : ''),
                _task: t
              });
            });
        }
        if (f.level === 'mile') {
          miles.filter(function (m) { return m.phaseId === ph.id; }).forEach(function (m) {
            rows.push({
              name: '◆ ' + m.name, right: m.owner, start: m.date, end: m.date, type: 'mile', level: 2,
              tone: MS_TONE[m.status] || 'plan',
              tipExtra: CH.tipRow(CH.TONE[MS_TONE[m.status] || 'plan'], '状态', m.status),
              _mile: m
            });
          });
        }
      });
    });

    var opens = tasks.filter(open);
    var od = opens.filter(function (t) { return t.overdue; });
    var avgReal = U.avg(projects, 'progress'), avgPlan = U.avg(projects.map(planProgress));

    var h = P.head({
      mod: MOD, title: '甘特图',
      desc: '项目 → 阶段 → 任务的三层排期视图。条形填充为实际进度，红色为已延期，竖线为今天。',
      acts: '<button class="btn" id="gtPrint">打印</button><button class="btn" id="gtWord">导出进度报告</button>'
    });
    h += P.permTip(MOD);
    h += P.statCards([
      { label: '实际总进度', val: pct(avgReal), unit: '%', sub: '按项目等权平均', tone: UI.ptone(pct(avgReal)), ico: '◐' },
      {
        label: '应完成进度', val: pct(avgPlan), unit: '%',
        sub: (avgReal >= avgPlan ? '领先 ' : '落后 ') + Math.abs(pct(avgReal) - pct(avgPlan)) + ' 个百分点',
        tone: avgReal >= avgPlan ? 'done' : 'warn', ico: '◔'
      },
      { label: '在办任务', val: opens.length, unit: '个', sub: '总任务 ' + tasks.length + ' 个', ico: '☑' },
      { label: '延期任务', val: od.length, unit: '个', sub: od.length ? '最长延期 ' + U.max(od, 'delayDays') + ' 天' : '无延期任务', tone: od.length ? 'danger' : 'done', ico: '⚠' }
    ]);
    h += P.gap(4);

    h += '<div class="toolbar" id="gtFlt">' +
      '<span class="muted tiny">展开层级</span>' +
      P.sel('level', '', [{ v: 'phase', t: '仅到阶段' }, { v: 'mile', t: '阶段 + 里程碑' }, { v: 'task', t: '展开到任务' }], f.level) +
      P.sel('phase', '全部阶段', U.uniq(phases.map(function (x) { return x.name; })), f.phase) +
      P.sel('status', '全部阶段状态', ['待开始', '进行中', '已完成'], f.status) +
      '<button class="btn-ghost" data-reset>重置</button>' +
      '<span class="grow"></span><span class="muted tiny">共 ' + rows.length + ' 行</span>' +
      '</div>';
    h += UI.card({ title: '排期甘特', sub: '点击任意行查看详情', body: P.chart('gtMain', 420) });
    h += P.gap(4);
    h += UI.grid(2,
      UI.card({ title: '计划 vs 实际', sub: '各项目应完成进度与实际进度对比', body: P.chart('gtCmp', 280) }) +
      UI.card({ title: '阶段完成度', sub: '各阶段平均进度', body: P.chart('gtPhase', 280) })
    );

    ctx.el.innerHTML = h;

    CH.gantt('gtMain', {
      rows: rows, today: U.fmtDate(S.TODAY), maxH: 440,
      onClick: function (r) {
        if (r._task) { Shell.go('tasks', 'list'); return; }
        if (r._mile) { Shell.go('plan', 'milestones'); return; }
        if (r._phase) { Shell.go('plan', 'phases'); return; }
        if (r._go) Shell.go(r._go[0], r._go[1]);
      }
    });

    CH.bar('gtCmp', {
      labels: projects.map(function (p) { return U.ellip(p.name, 8); }), height: 280,
      series: [
        { name: '应完成', data: projects.map(function (p) { return pct(planProgress(p)); }), color: CH.TONE.idle },
        { name: '实际', data: projects.map(function (p) { return pct(p.progress); }), color: CH.TONE.doing }
      ],
      yFmt: function (v) { return v + '%'; },
      onClick: function (i) { S.setProject(projects[i].id); UI.toast('已切换到「' + projects[i].name + '」', 'ok'); }
    });

    var byPh = U.group(phases, 'name');
    var phNames = Object.keys(byPh);
    CH.bars('gtPhase', {
      data: phNames.map(function (k) {
        var v = pct(U.avg(byPh[k], 'progress'));
        return { label: k, value: v, text: v + '%', color: CH.TONE[UI.ptone(v)] };
      }),
      max: 100,
      onClick: function (i) {
        var ff = P.flt(MOD, DEF_G); ff.phase = ff.phase === phNames[i] ? '' : phNames[i];
        P.setFlt(MOD, ff); Shell.route();
      }
    });

    P.bindFlt(ctx.el.querySelector('#gtFlt'), MOD, DEF_G, function () { Shell.route(); });
    P.$('gtPrint').onclick = function () { U.printPage(); };
    P.$('gtWord').onclick = function () { wordProgress(projects, phases, tasks, miles); };
  }

  function wordProgress(projects, phases, tasks, miles) {
    var od = tasks.filter(function (t) { return t.overdue && open(t); });
    var bl = tasks.filter(function (t) { return t.status === '已阻塞'; });
    var lateMs = miles.filter(function (m) { return m.status === '已延期'; });
    P.word('项目进度报告', '项目进度跟踪报告', [
      {
        h: '一、总体进度', kv: [
          ['数据口径', P.scopeText()],
          ['项目数', projects.length + ' 个'],
          ['实际平均进度', pct(U.avg(projects, 'progress')) + '%'],
          ['应完成平均进度', pct(U.avg(projects.map(planProgress))) + '%'],
          ['在办任务', tasks.filter(open).length + ' 个'],
          ['延期任务', od.length + ' 个'],
          ['阻塞任务', bl.length + ' 个'],
          ['延期里程碑', lateMs.length + ' 个']
        ]
      },
      {
        h: '二、项目进度明细',
        table: {
          cols: [
            { t: '项目', k: 'name' }, { t: '项目经理', k: 'pm' },
            { t: '起止', get: function (p) { return p.start + ' ~ ' + p.end; } },
            { t: '应完成', get: function (p) { return pct(planProgress(p)) + '%'; } },
            { t: '实际', get: function (p) { return pct(p.progress) + '%'; } },
            { t: '偏差', get: function (p) { return (pct(p.progress) - pct(planProgress(p))) + ' pp'; } },
            { t: '状态', k: 'status' }, { t: '健康度', k: 'health' }
          ], rows: projects
        }
      },
      {
        h: '三、阶段进度',
        table: {
          cols: [
            { t: '项目', k: 'projectName' }, { t: '阶段', k: 'name' }, { t: '负责人', k: 'owner' },
            { t: '起止', get: function (p) { return p.start + ' ~ ' + p.end; } },
            { t: '进度', get: function (p) { return pct(p.progress) + '%'; } },
            { t: '状态', k: 'status' }
          ], rows: phases
        }
      },
      {
        h: '四、延期与阻塞', p: '以下任务需要在本周例会给出补救计划。',
        table: {
          cols: [
            { t: '编号', k: 'id' }, { t: '任务', k: 'title' }, { t: '阶段', k: 'phaseName' },
            { t: '负责人', k: 'owner' }, { t: '截止', k: 'due' }, { t: '状态', k: 'status' },
            { t: '延期天数', get: function (t) { return t.delayDays ? t.delayDays + ' 天' : '—'; } },
            { t: '阻塞原因', k: 'blockReason' }
          ], rows: od.concat(bl.filter(function (b) { return od.indexOf(b) < 0; }))
        }
      }
    ]);
    UI.toast('进度报告已导出', 'ok');
  }

  /* ==========================================================
   * 子页二：延期分析
   * ======================================================== */
  function delay(ctx) {
    var tasks = S.tasks();
    var all = tasks.filter(function (t) { return t.overdue && open(t); });
    var f = P.flt(MOD, DEF_D);

    var rows = all.filter(function (t) {
      if (f.type && t.type !== f.type) return false;
      if (f.owner && t.owner !== f.owner) return false;
      if (f.phase && t.phaseName !== f.phase) return false;
      if (f.band && bandOf(t.delayDays) !== f.band) return false;
      if (f.kw) {
        var k = f.kw.toLowerCase();
        if ((t.id + t.title + t.owner + t.phaseName).toLowerCase().indexOf(k) < 0) return false;
      }
      return true;
    });

    var lateMs = S.milestones().filter(function (m) { return m.status === '已延期'; });
    var totalOpen = tasks.filter(open).length;
    var rate = U.pct(all.length, totalOpen);

    var h = P.head({
      mod: MOD, title: '延期分析',
      desc: '只看已过截止日期且未关闭的任务。延期分布用于判断是「个别人扛不住」还是「整个阶段排期不合理」。',
      acts: '<button class="btn" id="dlCsv">导出 CSV</button><button class="btn" id="dlWord">导出延期分析</button>'
    });
    h += P.permTip(MOD);
    h += P.statCards([
      { label: '延期任务', val: all.length, unit: '个', sub: '占在办任务 ' + rate + '%', tone: all.length ? 'danger' : 'done', ico: '⚠' },
      { label: '平均延期', val: all.length ? Math.round(U.avg(all, 'delayDays')) : 0, unit: '天', sub: all.length ? '最长 ' + U.max(all, 'delayDays') + ' 天' : '无延期任务', tone: 'warn', ico: '⏱' },
      { label: '严重延期', val: all.filter(function (t) { return t.delayDays > 14; }).length, unit: '个', sub: '延期超过 14 天，需要升级处理', tone: 'danger', ico: '⛳' },
      { label: '延期里程碑', val: lateMs.length, unit: '个', sub: lateMs.length ? '关键节点已受影响' : '关键节点未受影响', tone: lateMs.length ? 'danger' : 'done', ico: '◆' }
    ]);
    h += P.gap(4);
    h += UI.grid(3,
      UI.card({ title: '延期时长分布', sub: '点击柱条筛选', body: P.chart('dlBand', 250) }) +
      UI.card({ title: '按阶段', sub: '定位排期最不合理的阶段', body: P.chart('dlPhase', 250) }) +
      UI.card({ title: '按负责人 TOP10', sub: '点击查看该负责人的延期任务', body: P.chart('dlOwner', 250) })
    );
    h += P.gap(4);
    h += '<div class="toolbar" id="dlFlt">' +
      '<input class="fld" data-f="kw" placeholder="搜索任务 / 编号 / 负责人" value="' + E(f.kw) + '" style="min-width:220px">' +
      P.sel('type', '全部类型', U.uniq(all.map(function (x) { return x.type; })), f.type) +
      P.sel('phase', '全部阶段', U.uniq(all.map(function (x) { return x.phaseName; })), f.phase) +
      P.sel('owner', '全部负责人', U.uniq(all.map(function (x) { return x.owner; })).sort(), f.owner) +
      P.sel('band', '全部延期区间', BANDS.map(function (b) { return b.k; }), f.band) +
      '<button class="btn-ghost" data-reset>重置</button>' +
      '<span class="grow"></span><span class="muted tiny">共 ' + rows.length + ' 条</span>' +
      '</div>';
    h += '<div id="dlTbl"></div>';

    ctx.el.innerHTML = h;

    if (!all.length) {
      P.$('dlBand').innerHTML = UI.empty('当前口径下没有延期任务');
      P.$('dlPhase').innerHTML = UI.empty('当前口径下没有延期任务');
      P.$('dlOwner').innerHTML = UI.empty('当前口径下没有延期任务');
    } else {
      var bandKeys = BANDS.map(function (b) { return b.k; });
      CH.bar('dlBand', {
        labels: bandKeys, height: 250,
        series: [{
          name: '任务数',
          data: bandKeys.map(function (k) { return all.filter(function (t) { return bandOf(t.delayDays) === k; }).length; }),
          color: CH.TONE.danger
        }],
        onClick: function (i) { setF('band', bandKeys[i]); }
      });

      var byPh = U.countBy(all, 'phaseName');
      var phKeys = Object.keys(byPh).sort(function (a, b) { return byPh[b] - byPh[a]; });
      CH.bars('dlPhase', {
        data: phKeys.map(function (k) { return { label: k, value: byPh[k], text: byPh[k] + ' 个', color: CH.TONE.warn }; }),
        onClick: function (i) { setF('phase', phKeys[i]); }
      });

      var byOw = U.countBy(all, 'owner');
      var owKeys = Object.keys(byOw).sort(function (a, b) { return byOw[b] - byOw[a]; }).slice(0, 10);
      CH.bars('dlOwner', {
        data: owKeys.map(function (k) { return { label: k, value: byOw[k], text: byOw[k] + ' 个', color: CH.TONE.danger }; }),
        onClick: function (i) { setF('owner', owKeys[i]); }
      });
    }

    UI.table(ctx.el.querySelector('#dlTbl'), {
      cols: [
        { k: 'id', t: '编号', w: '76px', sortable: true, render: function (r) { return UI.idCell(r.id); } },
        { k: 'title', t: '任务', w: '250px', sortable: true, render: function (r) { return UI.cell2(E(r.title), E(r.projectName + ' · ' + r.phaseName)); } },
        { k: 'type', t: '类型', w: '78px', sortable: true, render: function (r) { return UI.st('taskType', r.type); } },
        { k: 'priority', t: '优先级', w: '78px', sortable: true, render: function (r) { return UI.pri(r.priority); } },
        { k: 'owner', t: '负责人', w: '110px', sortable: true, render: function (r) { return UI.owner(r.owner); } },
        { k: 'due', t: '原截止', w: '105px', sortable: true },
        {
          k: 'delayDays', t: '延期', w: '92px', align: 'right', sortable: true,
          render: function (r) { return '<span class="t-danger" style="font-weight:600">' + r.delayDays + ' 天</span>'; }
        },
        { k: 'band', t: '区间', w: '92px', sortable: true, sortVal: function (r) { return r.delayDays; }, render: function (r) { return UI.tag(bandOf(r.delayDays), r.delayDays > 14 ? 'danger' : 'warn'); } },
        { k: 'progress', t: '进度', w: '130px', sortable: true, render: function (r) { return UI.pcell(pct(r.progress), 'danger'); } },
        { k: 'status', t: '状态', w: '90px', sortable: true, render: function (r) { return UI.st('status', r.status); } },
        { k: 'blockReason', t: '阻塞原因', cls: 'muted tiny' }
      ],
      rows: rows, pageSize: 15, sort: { k: 'delayDays', desc: true }, select: true,
      rowCls: function (r) { return r.delayDays > 14 ? 'row-danger' : 'row-warn'; },
      onRow: function (r) { Shell.go('tasks', 'list'); },
      empty: UI.empty('当前筛选下没有延期任务'),
      bulk: [{ t: '导出所选', fn: function (picked) { csvDelay(picked); } }],
      footNote: '延期超过 14 天的任务标红，建议在周会上单独过一遍'
    });

    P.bindFlt(ctx.el.querySelector('#dlFlt'), MOD, DEF_D, function () { Shell.route(); });
    P.$('dlCsv').onclick = function () { csvDelay(rows); };
    P.$('dlWord').onclick = function () { wordDelay(all, rows, lateMs, rate); };
  }

  function setF(k, v) {
    var f = P.flt(MOD, DEF_D);
    f[k] = f[k] === v ? '' : v;
    P.setFlt(MOD, f);
    Shell.route();
  }

  function csvDelay(rows) {
    P.csv('延期任务', rows, [
      { label: '编号', key: 'id' }, { label: '任务', key: 'title' },
      { label: '项目', key: 'projectName' }, { label: '阶段', key: 'phaseName' },
      { label: '类型', key: 'type' }, { label: '优先级', key: 'priority' },
      { label: '负责人', key: 'owner' }, { label: '原截止', key: 'due' },
      { label: '延期天数', key: 'delayDays' },
      { label: '延期区间', get: function (r) { return bandOf(r.delayDays); } },
      { label: '进度%', get: function (r) { return pct(r.progress); } },
      { label: '状态', key: 'status' }, { label: '阻塞原因', key: 'blockReason' }
    ]);
  }

  function wordDelay(all, rows, lateMs, rate) {
    var byOw = U.countBy(all, 'owner');
    var byPh = U.countBy(all, 'phaseName');
    P.word('延期分析', '项目延期分析报告', [
      {
        h: '一、延期概况', kv: [
          ['数据口径', P.scopeText()],
          ['延期任务', all.length + ' 个'],
          ['占在办任务比例', rate + '%'],
          ['平均延期天数', (all.length ? Math.round(U.avg(all, 'delayDays')) : 0) + ' 天'],
          ['最长延期', (all.length ? U.max(all, 'delayDays') : 0) + ' 天'],
          ['严重延期（>14天）', all.filter(function (t) { return t.delayDays > 14; }).length + ' 个'],
          ['受影响的里程碑', lateMs.length + ' 个']
        ]
      },
      {
        h: '二、按阶段分布', p: '延期集中的阶段通常意味着该阶段排期过紧或前置输入不到位。',
        table: {
          cols: [{ t: '阶段', k: 'k' }, { t: '延期任务数', k: 'n' }],
          rows: Object.keys(byPh).sort(function (a, b) { return byPh[b] - byPh[a]; })
            .map(function (k) { return { k: k, n: byPh[k] }; })
        }
      },
      {
        h: '三、按负责人分布',
        table: {
          cols: [{ t: '负责人', k: 'k' }, { t: '延期任务数', k: 'n' }],
          rows: Object.keys(byOw).sort(function (a, b) { return byOw[b] - byOw[a]; })
            .map(function (k) { return { k: k, n: byOw[k] }; })
        }
      },
      {
        h: '四、受影响的里程碑',
        table: {
          cols: [
            { t: '项目', k: 'projectName' }, { t: '里程碑', k: 'name' },
            { t: '负责人', k: 'owner' }, { t: '计划日期', k: 'date' },
            { t: '逾期天数', get: function (m) { return -U.dayDiff(S.TODAY, m.date) + ' 天'; } }
          ], rows: lateMs
        }
      },
      {
        h: '五、延期任务明细',
        table: {
          cols: [
            { t: '编号', k: 'id' }, { t: '任务', k: 'title' }, { t: '阶段', k: 'phaseName' },
            { t: '负责人', k: 'owner' }, { t: '原截止', k: 'due' },
            { t: '延期', get: function (t) { return t.delayDays + ' 天'; } },
            { t: '进度', get: function (t) { return pct(t.progress) + '%'; } },
            { t: '状态', k: 'status' }
          ],
          rows: rows.slice().sort(function (a, b) { return b.delayDays - a.delayDays; })
        }
      }
    ]);
    UI.toast('延期分析已导出', 'ok');
  }

  /* ==========================================================
   * 子页三：阻塞项
   * ======================================================== */
  function blocked(ctx) {
    var tasks = S.tasks();
    var all = tasks.filter(function (t) { return t.status === '已阻塞'; });
    var cross = S.cross().filter(function (c) { return ['已解决', '已关闭'].indexOf(c.status) < 0; });
    var risks = S.risks().filter(function (r) { return r.type === '进度风险' || r.level === '高'; });
    var f = P.flt(MOD, DEF_B);

    var rows = all.filter(function (t) {
      if (f.owner && t.owner !== f.owner) return false;
      if (f.phase && t.phaseName !== f.phase) return false;
      if (f.kw) {
        var k = f.kw.toLowerCase();
        if ((t.id + t.title + t.owner + t.blockReason).toLowerCase().indexOf(k) < 0) return false;
      }
      return true;
    });

    var byReason = U.countBy(all, 'blockReason');
    var reasonKeys = Object.keys(byReason).sort(function (a, b) { return byReason[b] - byReason[a]; });
    var affected = U.uniq(all.map(function (t) { return t.phaseId; })).length;

    var h = P.head({
      mod: MOD, title: '阻塞项',
      desc: '阻塞是进度的真实卡点：一条阻塞往往对应一个未闭环的外部依赖。此页把任务阻塞、跨部门在途事项与高风险项放在一起看。',
      acts: '<button class="btn" id="blCsv">导出 CSV</button><button class="btn" id="blWord">导出阻塞清单</button>'
    });
    h += P.permTip(MOD);
    h += P.statCards([
      { label: '阻塞任务', val: all.length, unit: '个', sub: '影响 ' + affected + ' 个阶段', tone: all.length ? 'danger' : 'done', ico: '⛔' },
      { label: '阻塞原因类型', val: reasonKeys.length, unit: '类', sub: reasonKeys.length ? '最高频：' + U.ellip(reasonKeys[0], 12) : '暂无阻塞', tone: 'warn', ico: '◍' },
      { label: '跨部门未闭环', val: cross.length, unit: '项', sub: '逾期 ' + cross.filter(function (c) { return c.overdue; }).length + ' 项', tone: cross.length ? 'warn' : 'done', ico: '⇄' },
      { label: '关联高风险', val: risks.length, unit: '条', sub: '进度风险或高等级风险', tone: risks.length ? 'danger' : 'done', ico: '⚠' }
    ]);
    h += P.gap(4);
    h += UI.grid(2,
      UI.card({ title: '阻塞原因分布', sub: '点击查看该原因下的任务', body: P.chart('blReason', 260) }) +
      UI.card({ title: '按阶段分布', sub: '哪个阶段被卡得最狠', body: P.chart('blPhase', 260) })
    );
    h += P.gap(4);
    h += '<div class="toolbar" id="blFlt">' +
      '<input class="fld" data-f="kw" placeholder="搜索任务 / 阻塞原因 / 负责人" value="' + E(f.kw) + '" style="min-width:240px">' +
      P.sel('phase', '全部阶段', U.uniq(all.map(function (x) { return x.phaseName; })), f.phase) +
      P.sel('owner', '全部负责人', U.uniq(all.map(function (x) { return x.owner; })).sort(), f.owner) +
      '<button class="btn-ghost" data-reset>重置</button>' +
      '<span class="grow"></span><span class="muted tiny">共 ' + rows.length + ' 条</span>' +
      '</div>';
    h += UI.card({ title: '阻塞任务清单', sub: '按优先级与延期天数排序', body: '<div id="blTbl"></div>', flush: true });
    h += P.gap(4);
    h += UI.grid(2,
      UI.card({
        title: '跨部门未闭环事项（' + cross.length + '）', sub: '外部依赖未解除是阻塞的主要来源',
        body: cross.length ? cross.slice(0, 8).map(function (c) {
          return UI.listItem({
            title: E(c.title),
            desc: E(c.fromDept + ' → ' + c.toDept) + ' · 负责人 ' + E(c.owner),
            right: UI.st('status', c.status) + (c.overdue ? ' ' + UI.tag('已逾期', 'danger') : '')
          });
        }).join('') : UI.empty('当前没有未闭环的跨部门事项'),
        foot: '<button class="btn-text" data-go="collab/cross">前往项目协同 →</button>'
      }) +
      UI.card({
        title: '相关风险（' + risks.length + '）', sub: '进度风险与高等级风险',
        body: risks.length ? risks.slice(0, 8).map(function (r) {
          return UI.listItem({
            title: E(r.title),
            desc: E(r.type) + ' · 负责人 ' + E(r.owner) + ' · ' + E(r.status),
            right: UI.light(r.level === '高' ? 'r' : (r.level === '中' ? 'y' : 'g'), r.level)
          });
        }).join('') : UI.empty('当前没有高等级风险'),
        foot: '<button class="btn-text" data-go="risks/ledger">前往风险预警 →</button>'
      })
    );

    ctx.el.innerHTML = h;

    if (!all.length) {
      P.$('blReason').innerHTML = UI.empty('当前口径下没有阻塞任务');
      P.$('blPhase').innerHTML = UI.empty('当前口径下没有阻塞任务');
    } else {
      CH.bars('blReason', {
        data: reasonKeys.map(function (k) { return { label: U.ellip(k, 16), value: byReason[k], text: byReason[k] + ' 个', color: CH.TONE.danger }; }),
        onClick: function (i) {
          var ff = P.flt(MOD, DEF_B); ff.kw = reasonKeys[i]; P.setFlt(MOD, ff); Shell.route();
        }
      });
      var byPh = U.countBy(all, 'phaseName');
      var pk = Object.keys(byPh).sort(function (a, b) { return byPh[b] - byPh[a]; });
      CH.bars('blPhase', {
        data: pk.map(function (k) { return { label: k, value: byPh[k], text: byPh[k] + ' 个', color: CH.TONE.warn }; }),
        onClick: function (i) {
          var ff = P.flt(MOD, DEF_B); ff.phase = ff.phase === pk[i] ? '' : pk[i]; P.setFlt(MOD, ff); Shell.route();
        }
      });
    }

    UI.table(ctx.el.querySelector('#blTbl'), {
      cols: [
        { k: 'id', t: '编号', w: '76px', render: function (r) { return UI.idCell(r.id); } },
        { k: 'title', t: '任务', w: '230px', sortable: true, render: function (r) { return UI.cell2(E(r.title), E(r.projectName + ' · ' + r.phaseName)); } },
        { k: 'priority', t: '优先级', w: '78px', sortable: true, render: function (r) { return UI.pri(r.priority); } },
        { k: 'owner', t: '负责人', w: '110px', sortable: true, render: function (r) { return UI.owner(r.owner); } },
        { k: 'dept', t: '部门', w: '90px', sortable: true },
        { k: 'blockReason', t: '阻塞原因', w: '220px' },
        { k: 'due', t: '截止', w: '105px', sortable: true, render: function (r) { return UI.due(r.due); } },
        {
          k: 'delayDays', t: '已延期', w: '90px', align: 'right', sortable: true,
          render: function (r) { return r.delayDays ? '<span class="t-danger">' + r.delayDays + ' 天</span>' : '<span class="muted">—</span>'; }
        },
        { k: 'progress', t: '进度', w: '120px', sortable: true, render: function (r) { return UI.pcell(pct(r.progress), 'danger'); } },
        {
          k: 'act', t: '操作', w: '110px', align: 'right', sortable: false,
          render: function () { return '<div class="row-acts"><button class="btn-sm" data-act="go">去处理</button></div>'; }
        }
      ],
      rows: rows, pageSize: 12, sort: { k: 'delayDays', desc: true }, compact: true,
      rowCls: function () { return 'row-danger'; },
      onAct: function () { Shell.go('tasks', 'kanban'); },
      onRow: function () { Shell.go('tasks', 'kanban'); },
      empty: UI.empty('当前没有阻塞任务，进度链路畅通', '', '✓')
    });

    ctx.el.querySelectorAll('[data-go]').forEach(function (n) {
      n.addEventListener('click', function () {
        var t = n.getAttribute('data-go').split('/');
        Shell.go(t[0], t[1]);
      });
    });

    P.bindFlt(ctx.el.querySelector('#blFlt'), MOD, DEF_B, function () { Shell.route(); });
    P.$('blCsv').onclick = function () { csvBlocked(rows); };
    P.$('blWord').onclick = function () { wordBlocked(all, cross, risks, reasonKeys, byReason); };
  }

  function csvBlocked(rows) {
    P.csv('阻塞任务', rows, [
      { label: '编号', key: 'id' }, { label: '任务', key: 'title' },
      { label: '项目', key: 'projectName' }, { label: '阶段', key: 'phaseName' },
      { label: '优先级', key: 'priority' }, { label: '负责人', key: 'owner' },
      { label: '部门', key: 'dept' }, { label: '阻塞原因', key: 'blockReason' },
      { label: '截止', key: 'due' }, { label: '已延期天数', key: 'delayDays' },
      { label: '进度%', get: function (r) { return pct(r.progress); } }
    ]);
  }

  function wordBlocked(all, cross, risks, reasonKeys, byReason) {
    P.word('阻塞项清单', '项目阻塞项与外部依赖清单', [
      {
        h: '一、阻塞概况', kv: [
          ['数据口径', P.scopeText()],
          ['阻塞任务', all.length + ' 个'],
          ['影响阶段', U.uniq(all.map(function (t) { return t.phaseId; })).length + ' 个'],
          ['跨部门未闭环事项', cross.length + ' 项'],
          ['关联高风险', risks.length + ' 条']
        ]
      },
      {
        h: '二、阻塞原因分布',
        table: {
          cols: [{ t: '阻塞原因', k: 'k' }, { t: '任务数', k: 'n' }],
          rows: reasonKeys.map(function (k) { return { k: k, n: byReason[k] }; })
        }
      },
      {
        h: '三、阻塞任务明细',
        table: {
          cols: [
            { t: '编号', k: 'id' }, { t: '任务', k: 'title' }, { t: '阶段', k: 'phaseName' },
            { t: '优先级', k: 'priority' }, { t: '负责人', k: 'owner' },
            { t: '阻塞原因', k: 'blockReason' }, { t: '截止', k: 'due' },
            { t: '已延期', get: function (t) { return t.delayDays ? t.delayDays + ' 天' : '—'; } }
          ], rows: all
        }
      },
      {
        h: '四、跨部门未闭环事项',
        table: {
          cols: [
            { t: '编号', k: 'id' }, { t: '事项', k: 'title' },
            { t: '发起 → 承接', get: function (c) { return c.fromDept + ' → ' + c.toDept; } },
            { t: '负责人', k: 'owner' }, { t: '要求完成', k: 'dueAt' }, { t: '状态', k: 'status' }
          ], rows: cross
        }
      },
      {
        h: '五、关联风险',
        table: {
          cols: [
            { t: '编号', k: 'id' }, { t: '风险', k: 'title' }, { t: '类型', k: 'type' },
            { t: '等级', k: 'level' }, { t: '负责人', k: 'owner' }, { t: '状态', k: 'status' }
          ], rows: risks
        }
      }
    ]);
    UI.toast('阻塞清单已导出', 'ok');
  }

  Shell.page(MOD, {
    render: function (ctx) {
      if (ctx.sub === 'delay') delay(ctx);
      else if (ctx.sub === 'blocked') blocked(ctx);
      else gantt(ctx);
    }
  });
})();
