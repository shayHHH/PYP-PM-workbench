/* ============================================================
 * 33-resources.js  资源协调（项目经理专属）
 * 子页：alloc 人员安排 / load 工时负载 / cross 跨部门协同
 * ========================================================== */
(function () {
  'use strict';
  var E = U.esc, MOD = 'resources';

  var DEF_A = { kw: '', dept: '', func: '', band: '' };
  var DEF_L = { dept: '', band: '' };
  var DEF_C = { kw: '', status: '', dept: '', priority: '', flag: '' };

  var CX_ST = ['待处理', '处理中', '已解决', '已关闭'];
  var BANDS = [
    { k: '闲置(<60%)', min: 0, max: 59, tone: 'idle' },
    { k: '正常(60-85%)', min: 60, max: 85, tone: 'done' },
    { k: '饱和(86-100%)', min: 86, max: 100, tone: 'warn' },
    { k: '超载(>100%)', min: 101, max: 9999, tone: 'danger' }
  ];
  function bandOf(p) {
    for (var i = 0; i < BANDS.length; i++) if (p >= BANDS[i].min && p <= BANDS[i].max) return BANDS[i];
    return BANDS[0];
  }
  function loadTone(p) { return bandOf(p).tone; }

  /* ---------- 口径工具 ---------- */
  function scopeProjIds() {
    return S.projectsInScope().map(function (p) { return p.id; });
  }
  function weeks() {
    return U.uniq(S.DB.allocs.map(function (a) { return a.weekStart; })).sort();
  }
  function curWeek() { return U.fmtDate(U.weekRange(S.TODAY)[0]); }

  /* 参与当前口径项目的成员 + 派生投入指标 */
  function crew() {
    var ids = scopeProjIds(), ws = curWeek();
    var ts = S.tasks();
    var out = [];
    S.members().forEach(function (m) {
      var mine = S.DB.allocs.filter(function (a) { return a.memberId === m.id && ids.indexOf(a.projectId) >= 0; });
      if (!mine.length) return;
      var inWeek = U.sum(mine.filter(function (a) { return a.weekStart === ws; }), 'hours');
      var allWeek = U.sum(S.DB.allocs.filter(function (a) { return a.memberId === m.id && a.weekStart === ws; }), 'hours');
      var mt = ts.filter(function (t) { return t.owner === m.name; });
      var opens = mt.filter(function (t) { return t.status !== '已完成' && t.status !== '已取消'; });
      out.push({
        id: m.id, name: m.name, dept: m.dept, title: m.title, func: m.func,
        email: m.email, capacity: m.capacity, efficiency: m.efficiency,
        projHours: inWeek, totalHours: allWeek,
        loadPct: Math.round(allWeek / 40 * 100),
        projPct: Math.round(inWeek / 40 * 100),
        share: allWeek ? Math.round(inWeek / allWeek * 100) : 0,
        conflict: allWeek > 40,
        projCount: U.uniq(S.DB.allocs.filter(function (a) { return a.memberId === m.id; }).map(function (a) { return a.projectId; })).length,
        taskOpen: opens.length,
        taskDelay: opens.filter(function (t) { return t.overdue; }).length,
        taskBlocked: opens.filter(function (t) { return t.status === '已阻塞'; }).length,
        taskDone: mt.filter(function (t) { return t.status === '已完成'; }).length,
        _m: m, _tasks: mt
      });
    });
    return out.sort(function (a, b) { return b.loadPct - a.loadPct; });
  }

  /* 某成员当周的跨项目工时明细 */
  function weekSplit(mid, ws) {
    return S.DB.allocs.filter(function (a) { return a.memberId === mid && a.weekStart === ws; });
  }

  /* ==========================================================
   * 子页一：人员安排
   * ======================================================== */
  function alloc(ctx) {
    var all = crew();
    var f = P.flt(MOD + '.alloc', DEF_A);
    var rows = all.filter(function (m) {
      if (f.dept && m.dept !== f.dept) return false;
      if (f.func && m.title !== f.func) return false;
      if (f.band && bandOf(m.loadPct).k !== f.band) return false;
      if (f.kw && (m.name + m.dept + m.title + m.id).toLowerCase().indexOf(f.kw.toLowerCase()) < 0) return false;
      return true;
    });

    var conf = all.filter(function (m) { return m.conflict; });
    var idle = all.filter(function (m) { return m.loadPct < 60; });
    var totalH = U.sum(all, 'projHours');

    var h = P.head({
      mod: MOD, title: '人员安排',
      desc: '当前' + P.scopeText() + '的投入人员一览。负载按本周全部项目工时 ÷ 40h 标准工时计算，超过 100% 视为跨项目冲突。',
      acts: '<button class="btn" id="raCsv">导出 CSV</button>' +
        '<button class="btn" id="raWord">导出人员投入表</button>' +
        '<button class="btn" data-go2="load">查看工时负载</button>'
    });
    h += P.permTip(MOD);
    h += P.statCards([
      { label: '投入人员', val: all.length, unit: '人', sub: '覆盖 ' + U.uniq(all.map(function (m) { return m.dept; })).length + ' 个部门', ico: '👥' },
      { label: '本周项目投入', val: totalH, unit: 'h', sub: '人均 ' + (all.length ? Math.round(totalH / all.length) : 0) + 'h/周', ico: '⏱' },
      { label: '负载冲突', val: conf.length, unit: '人', sub: conf.length ? '本周工时超 40h，需协调' : '本周无超载人员', tone: conf.length ? 'danger' : 'done', ico: '⚠' },
      { label: '可支援人力', val: idle.length, unit: '人', sub: idle.length ? '负载低于 60%，可承接增补任务' : '暂无富余人力', tone: idle.length ? 'done' : 'warn', ico: '＋' }
    ]);

    if (conf.length) {
      h += P.gap(3);
      h += UI.notice('warn',
        '本周有 <b>' + conf.length + '</b> 人存在跨项目工时冲突：' +
        conf.slice(0, 6).map(function (m) { return E(m.name) + '（' + m.loadPct + '%）'; }).join('、') +
        (conf.length > 6 ? ' 等' : '') + '。建议在资源协调会上与相关项目经理确认优先级。', '⚠');
    }

    h += P.gap(4);
    h += UI.grid(3,
      UI.card({ title: '部门人力构成', sub: '点击扇区筛选部门', body: P.chart('raDept', 240) }) +
      UI.card({ title: '本项目投入 TOP10', sub: '本周投入工时，点击查看该成员', body: P.chart('raTop', 240) }) +
      UI.card({ title: '负载区间分布', sub: '点击柱条筛选区间', body: P.chart('raBand', 240) })
    );

    h += P.gap(4);
    h += '<div class="toolbar" id="raFlt">' +
      '<input class="fld" data-f="kw" placeholder="搜索姓名 / 部门 / 职位" value="' + E(f.kw) + '" style="min-width:220px">' +
      P.sel('dept', '全部部门', U.uniq(all.map(function (m) { return m.dept; })), f.dept) +
      P.sel('func', '全部职位', U.uniq(all.map(function (m) { return m.title; })), f.func) +
      P.sel('band', '全部负载区间', BANDS.map(function (b) { return b.k; }), f.band) +
      '<button class="btn-ghost" data-reset>重置</button>' +
      '</div>';
    h += '<div id="raTbl"></div>';

    ctx.el.innerHTML = h;

    var byDept = U.countBy(all, 'dept');
    var dKeys = Object.keys(byDept);
    CH.donut('raDept', {
      data: dKeys.map(function (k, i) { return { name: k, value: byDept[k], color: CH.PAL[i % CH.PAL.length] }; }),
      height: 240, center: { l: '投入人力', v: all.length },
      onClick: function (i, d) { setF('alloc', DEF_A, 'dept', d.name); }
    });

    var top = all.slice().sort(function (a, b) { return b.projHours - a.projHours; }).slice(0, 10);
    CH.bars('raTop', {
      data: top.map(function (m) {
        return { label: m.name, value: m.projHours, text: m.projHours + 'h · 负载 ' + m.loadPct + '%', color: CH.TONE[loadTone(m.loadPct)] };
      }),
      onClick: function (i) { openMember(top[i]); }
    });

    CH.bars('raBand', {
      data: BANDS.map(function (b) {
        var n = all.filter(function (m) { return bandOf(m.loadPct).k === b.k; }).length;
        return { label: b.k, value: n, text: n + ' 人', color: CH.TONE[b.tone] };
      }),
      onClick: function (i) { setF('alloc', DEF_A, 'band', BANDS[i].k); }
    });

    UI.table(ctx.el.querySelector('#raTbl'), {
      cols: [
        { k: 'name', t: '成员', w: '150px', render: function (r) { return UI.cell2(UI.owner(r.name), E(r.title)); } },
        { k: 'dept', t: '部门', w: '100px' },
        { k: 'projHours', t: '本项目工时', w: '110px', align: 'right', render: function (r) { return '<b>' + r.projHours + '</b><span class="muted tiny">h/周</span>'; } },
        { k: 'totalHours', t: '总工时', w: '96px', align: 'right', render: function (r) { return '<span class="muted">' + r.totalHours + 'h</span>'; } },
        { k: 'share', t: '本项目占比', w: '130px', render: function (r) { return UI.pcell(r.share, 'doing'); } },
        { k: 'loadPct', t: '综合负载', w: '130px', render: function (r) { return UI.pcell(Math.min(r.loadPct, 100), loadTone(r.loadPct)) + (r.loadPct > 100 ? ' <span class="tag tag-danger">' + r.loadPct + '%</span>' : ''); } },
        { k: 'projCount', t: '并行项目', w: '90px', align: 'center', render: function (r) { return r.projCount > 1 ? UI.tag(r.projCount + ' 个', 'warn') : '<span class="muted">1 个</span>'; } },
        { k: 'taskOpen', t: '在办任务', w: '90px', align: 'right' },
        {
          k: 'taskDelay', t: '延期/阻塞', w: '100px', align: 'center',
          sortVal: function (r) { return r.taskDelay * 10 + r.taskBlocked; },
          render: function (r) {
            if (!r.taskDelay && !r.taskBlocked) return '<span class="muted">—</span>';
            return (r.taskDelay ? UI.tag('延 ' + r.taskDelay, 'danger') : '') + (r.taskBlocked ? ' ' + UI.tag('阻 ' + r.taskBlocked, 'warn') : '');
          }
        },
        {
          k: 'act', t: '操作', w: '96px', align: 'right', sortable: false,
          render: function () { return '<div class="row-acts"><button class="btn-sm" data-act="view">详情</button></div>'; }
        }
      ],
      rows: rows, pageSize: 15, sort: { k: 'loadPct', desc: true },
      rowCls: function (r) { return r.loadPct > 100 ? 'row-danger' : (r.loadPct >= 86 ? 'row-warn' : ''); },
      onRow: openMember,
      onAct: function (act, r) { openMember(r); },
      empty: UI.empty('没有符合条件的成员', '<button class="btn" data-reset2>清空筛选条件</button>'),
      footNote: '负载 = 本周全部项目分配工时 ÷ 40h；超载行标红，饱和行标黄'
    });

    var r2 = ctx.el.querySelector('[data-reset2]');
    if (r2) r2.addEventListener('click', function () { P.setFlt(MOD + '.alloc', Object.assign({}, DEF_A)); Shell.route(); });
    P.bindFlt(ctx.el.querySelector('#raFlt'), MOD + '.alloc', DEF_A, function () { Shell.route(); });
    ctx.el.querySelector('[data-go2]').onclick = function () { Shell.go(MOD, 'load'); };
    P.$('raCsv').onclick = function () { allocCsv(rows); };
    P.$('raWord').onclick = function () { allocWord(all, conf, idle); };
  }

  function setF(sub, def, k, v) {
    var key = MOD + '.' + sub;
    var f = P.flt(key, def);
    f[k] = f[k] === v ? '' : v;
    P.setFlt(key, f);
    Shell.route();
  }

  function allocCsv(rows) {
    P.csv('人员安排', rows, [
      { label: '工号', key: 'id' }, { label: '姓名', key: 'name' },
      { label: '部门', key: 'dept' }, { label: '职位', key: 'title' },
      { label: '本项目周工时', key: 'projHours' }, { label: '总周工时', key: 'totalHours' },
      { label: '本项目占比%', key: 'share' }, { label: '综合负载%', key: 'loadPct' },
      { label: '并行项目数', key: 'projCount' }, { label: '在办任务', key: 'taskOpen' },
      { label: '延期任务', key: 'taskDelay' }, { label: '阻塞任务', key: 'taskBlocked' },
      { label: '已完成任务', key: 'taskDone' }, { label: '邮箱', key: 'email' }
    ]);
  }

  function allocWord(all, conf, idle) {
    P.word('人员投入表', '项目人员投入与负载说明', [
      { h3: '一、投入概览', kv: [
        ['统计口径', P.scopeText()],
        ['统计周', curWeek() + ' 起当周'],
        ['投入人数', all.length + ' 人'],
        ['本周项目投入工时', U.sum(all, 'projHours') + ' 小时'],
        ['负载冲突人数', conf.length + ' 人'],
        ['可支援人力', idle.length + ' 人']
      ] },
      { h3: '二、人员投入明细', table: {
        cols: [
          { t: '姓名', k: 'name' }, { t: '部门', k: 'dept' }, { t: '职位', k: 'title' },
          { t: '本项目工时', get: function (r) { return r.projHours + 'h'; } },
          { t: '综合负载', get: function (r) { return r.loadPct + '%'; } },
          { t: '并行项目', get: function (r) { return r.projCount + ' 个'; } },
          { t: '在办任务', k: 'taskOpen' }
        ], rows: all
      } },
      { h3: '三、冲突与协调建议', list: conf.length
        ? conf.map(function (m) { return m.name + '（' + m.dept + '）本周合计 ' + m.totalHours + 'h，负载 ' + m.loadPct + '%，并行 ' + m.projCount + ' 个项目，建议与相关项目经理确认优先级或补充人力。'; })
        : ['本周无跨项目负载冲突。'] },
      { h3: '四、可支援人力', list: idle.length
        ? idle.map(function (m) { return m.name + '（' + m.dept + ' · ' + m.title + '）当前负载 ' + m.loadPct + '%，可承接增补任务。'; })
        : ['当前无明显富余人力，如需增补建议走资源申请流程。'] }
    ], ['生成日期：' + U.fmtDate(S.TODAY)]);
  }

  /* 成员详情抽屉 */
  function openMember(m) {
    var ws = weeks(), cw = curWeek();
    var split = weekSplit(m.id, cw);
    var ids = scopeProjIds();
    var opens = m._tasks.filter(function (t) { return t.status !== '已完成' && t.status !== '已取消'; });

    var body = P.hero({
      title: E(m.name), id: m.id,
      meta: [['部门', E(m.dept)], ['职位', E(m.title)], ['本周项目工时', m.projHours + 'h'], ['综合负载', m.loadPct + '%']],
      right: UI.tag(bandOf(m.loadPct).k, bandOf(m.loadPct).tone, { lg: true })
    });

    body += UI.sec('本周工时构成',
      split.length
        ? split.map(function (a) {
          var mine = ids.indexOf(a.projectId) >= 0;
          return UI.listItem({
            ico: mine ? '★' : '○',
            title: E(a.projectName) + (mine ? ' ' + UI.tag('本口径', 'doing') : ''),
            desc: a.projectId,
            right: '<b>' + a.hours + '</b><span class="muted tiny">h</span>'
          });
        }).join('')
        : UI.empty('本周暂无工时分配'));

    body += UI.sec('近 6 周工时走势', '<div id="mbTrend" class="chart-h" style="height:180px"></div>');

    body += UI.sec('在办任务（' + opens.length + '）',
      opens.length
        ? '<div id="mbTask"></div>'
        : UI.empty('该成员在当前口径下没有在办任务'));

    body += UI.sec('协同提示',
      UI.notice('plain', '并行项目 <b>' + m.projCount + '</b> 个，本项目占其本周工时的 <b>' + m.share + '%</b>。') +
      UI.notice(m.efficiency >= 1 ? 'done' : 'info',
        '历史效率系数 <b>' + m.efficiency + '</b>，' +
        (m.efficiency >= 1 ? '产出高于团队基准，可承担关键路径任务。' : '低于团队基准，排期时建议预留缓冲。')) +
      (m.taskDelay ? UI.notice('danger', '存在 <b>' + m.taskDelay + '</b> 个延期任务，需在周会上确认原因。') : '') +
      (m.taskBlocked ? UI.notice('warn', '存在 <b>' + m.taskBlocked + '</b> 个阻塞任务，需协调外部依赖。') : '') +
      (m.loadPct > 100 ? UI.notice('danger', '本周负载 <b>' + m.loadPct + '%</b> 已超标准工时，建议削减任务或申请增补。') : ''));

    var d = UI.drawer({
      title: '成员资源详情',
      sub: E(m.name + ' · ' + m.dept + ' · ' + m.title),
      body: body, wide: true,
      foot: '<button class="btn" data-close>关闭</button>' +
        '<button class="btn-primary" id="mbGoTask">查看其任务</button>'
    });

    CH.line('mbTrend', {
      labels: ws.map(function (w) { return U.fmtMD(w); }), height: 180,
      series: [
        { name: '本项目', data: ws.map(function (w) { return U.sum(weekSplit(m.id, w).filter(function (a) { return ids.indexOf(a.projectId) >= 0; }), 'hours'); }), color: CH.TONE.doing, area: true },
        { name: '全部项目', data: ws.map(function (w) { return U.sum(weekSplit(m.id, w), 'hours'); }), color: CH.TONE.warn }
      ],
      yFmt: function (v) { return v + 'h'; }
    });

    if (opens.length) {
      UI.table(d.body.querySelector('#mbTask'), {
        cols: [
          { k: 'title', t: '任务', render: function (r) { return UI.cell2(E(U.ellip(r.title, 22)), E(r.phaseName)); } },
          { k: 'priority', t: '优先级', w: '76px', render: function (r) { return UI.pri(r.priority); } },
          { k: 'due', t: '截止', w: '96px', render: function (r) { return UI.due(r.due); } },
          { k: 'status', t: '状态', w: '84px', render: function (r) { return UI.st('status', r.status); } }
        ],
        rows: opens, pageSize: 8, compact: true,
        onRow: function () { d.close(); Shell.go('tasks', 'list'); }
      });
    }
    var gt = d.el.querySelector('#mbGoTask');
    if (gt) gt.onclick = function () { d.close(); Shell.go('tasks', 'list'); };
  }

  /* ==========================================================
   * 子页二：工时负载
   * ======================================================== */
  function load(ctx) {
    var all = crew();
    var f = P.flt(MOD + '.load', DEF_L);
    var ws = weeks(), cw = curWeek();
    var ids = scopeProjIds();

    var rows = all.filter(function (m) {
      if (f.dept && m.dept !== f.dept) return false;
      if (f.band && bandOf(m.loadPct).k !== f.band) return false;
      return true;
    });

    var conf = all.filter(function (m) { return m.conflict; });
    var avgLoad = all.length ? Math.round(U.avg(all, 'loadPct')) : 0;
    var peak = ws.map(function (w) {
      return U.sum(all.map(function (m) { return { h: U.sum(weekSplit(m.id, w).filter(function (a) { return ids.indexOf(a.projectId) >= 0; }), 'hours') }; }), 'h');
    });

    var h = P.head({
      mod: MOD, title: '工时负载',
      desc: '按周查看成员工时投入与负载水位。热力矩阵展示近 6 周（前 2 周至后 3 周）的排布，用于提前发现资源缺口与冲突。',
      acts: '<button class="btn" id="rlCsv">导出负载矩阵</button>' +
        '<button class="btn" id="rlPrint">打印</button>' +
        '<button class="btn" data-go2="alloc">回到人员安排</button>'
    });
    h += P.permTip(MOD);
    h += P.statCards([
      { label: '平均负载', val: avgLoad, unit: '%', sub: '标准工时 40h/周', tone: avgLoad > 100 ? 'danger' : (avgLoad > 85 ? 'warn' : 'done'), ico: '📊' },
      { label: '超载人数', val: conf.length, unit: '人', sub: conf.length ? '本周工时超 40h' : '本周无人超载', tone: conf.length ? 'danger' : 'done', ico: '⚠' },
      { label: '本周项目投入', val: U.sum(all, 'projHours'), unit: 'h', sub: '峰值周 ' + U.fmtMD(ws[peak.indexOf(Math.max.apply(null, peak))] || cw) + '（' + Math.max.apply(null, peak) + 'h）', ico: '⏱' },
      { label: '可支援人力', val: all.filter(function (m) { return m.loadPct < 60; }).length, unit: '人', sub: '负载低于 60%', tone: 'done', ico: '＋' }
    ]);

    h += P.gap(4);
    h += UI.card({
      title: '成员 × 周 工时热力矩阵',
      sub: '数值为该成员当周在全部项目的合计工时；颜色越深负载越高，点击查看该成员',
      body: '<div id="rlHeat"></div>',
      extra: '<span class="muted tiny">口径：' + P.scopeText() + ' 涉及人员</span>'
    });

    h += P.gap(4);
    h += UI.grid(2,
      UI.card({ title: '各周投入工时趋势', sub: '本项目投入 vs 全部项目', body: P.chart('rlTrend', 260) }) +
      UI.card({ title: '部门投入构成', sub: '本周项目工时，点击筛选部门', body: P.chart('rlDept', 260) })
    );

    h += P.gap(4);
    h += UI.grid(2,
      UI.card({
        title: '负载冲突清单', sub: '本周合计工时超过 40h 的成员',
        body: conf.length
          ? conf.map(function (m) {
            var sp = weekSplit(m.id, cw);
            return UI.listItem({
              ico: '⚠', icoStyle: 'color:var(--s-danger)',
              title: E(m.name) + ' <span class="muted tiny">' + E(m.dept) + '</span>',
              desc: sp.map(function (a) { return E(U.ellip(a.projectName, 10)) + ' ' + a.hours + 'h'; }).join(' ｜ '),
              right: UI.tag(m.loadPct + '%', 'danger'),
              click: true, data: ' data-mid="' + E(m.id) + '"'
            });
          }).join('')
          : UI.empty('本周没有负载冲突，资源排布健康', '', '✓'),
        bodyId: 'rlConf'
      }) +
      UI.card({
        title: '可支援人力', sub: '负载低于 60%，可承接增补任务',
        body: (function () {
          var idle = all.filter(function (m) { return m.loadPct < 60; });
          return idle.length
            ? idle.map(function (m) {
              return UI.listItem({
                ico: '＋', icoStyle: 'color:var(--s-done)',
                title: E(m.name) + ' <span class="muted tiny">' + E(m.title) + '</span>',
                desc: m.dept + ' · 本周 ' + m.totalHours + 'h · 在办 ' + m.taskOpen + ' 个任务',
                right: UI.tag('余 ' + Math.max(0, 40 - m.totalHours) + 'h', 'done'),
                click: true, data: ' data-mid="' + E(m.id) + '"'
              });
            }).join('')
            : UI.empty('当前无明显富余人力');
        })(),
        bodyId: 'rlIdle'
      })
    );

    h += P.gap(4);
    h += '<div class="toolbar" id="rlFlt">' +
      P.sel('dept', '全部部门', U.uniq(all.map(function (m) { return m.dept; })), f.dept) +
      P.sel('band', '全部负载区间', BANDS.map(function (b) { return b.k; }), f.band) +
      '<button class="btn-ghost" data-reset>重置</button>' +
      '<span class="muted tiny" style="margin-left:auto">筛选同时作用于热力矩阵与下方明细</span>' +
      '</div>';
    h += '<div id="rlTbl"></div>';

    ctx.el.innerHTML = h;

    var hm = rows.slice(0, 24);
    CH.heat('rlHeat', {
      rows: hm.map(function (m) { return m.name; }),
      cols: ws.map(function (w) { return U.fmtMD(w) + (w === cw ? '(本周)' : ''); }),
      matrix: hm.map(function (m) { return ws.map(function (w) { return U.sum(weekSplit(m.id, w), 'hours'); }); }),
      max: 48, labelW: 76, vLabel: '合计工时',
      fmt: function (v) { return v ? v + 'h' : '—'; },
      onClick: function (ri) { openMember(hm[ri]); }
    });

    CH.line('rlTrend', {
      labels: ws.map(function (w) { return U.fmtMD(w); }), height: 260,
      series: [
        { name: '本项目投入', data: peak, color: CH.TONE.doing, area: true },
        { name: '全部项目投入', data: ws.map(function (w) { return U.sum(all.map(function (m) { return { h: U.sum(weekSplit(m.id, w), 'hours') }; }), 'h'); }), color: CH.TONE.warn }
      ],
      yFmt: function (v) { return v + 'h'; }
    });

    var byD = U.group(all, 'dept');
    var dKeys = Object.keys(byD);
    CH.bars('rlDept', {
      data: dKeys.map(function (k, i) {
        var v = U.sum(byD[k], 'projHours');
        return { label: k, value: v, text: v + 'h · ' + byD[k].length + ' 人', color: CH.PAL[i % CH.PAL.length] };
      }).sort(function (a, b) { return b.value - a.value; }),
      onClick: function (i, d) { setF('load', DEF_L, 'dept', d.label); }
    });

    UI.table(ctx.el.querySelector('#rlTbl'), {
      cols: [
        { k: 'name', t: '成员', w: '140px', render: function (r) { return UI.cell2(UI.owner(r.name), E(r.dept + ' · ' + r.title)); } }
      ].concat(ws.map(function (w) {
        return {
          k: 'w_' + w, t: U.fmtMD(w) + (w === cw ? ' ·本周' : ''), w: '92px', align: 'right',
          sortVal: function (r) { return U.sum(weekSplit(r.id, w), 'hours'); },
          render: function (r) {
            var tot = U.sum(weekSplit(r.id, w), 'hours');
            var mine = U.sum(weekSplit(r.id, w).filter(function (a) { return ids.indexOf(a.projectId) >= 0; }), 'hours');
            if (!tot) return '<span class="muted">—</span>';
            return '<b' + (tot > 40 ? ' style="color:var(--s-danger)"' : '') + '>' + tot + 'h</b>' +
              '<div class="muted tiny">本项目 ' + mine + 'h</div>';
          }
        };
      })).concat([
        { k: 'loadPct', t: '本周负载', w: '120px', render: function (r) { return UI.pcell(Math.min(r.loadPct, 100), loadTone(r.loadPct)); } },
        { k: 'band', t: '水位', w: '110px', sortVal: function (r) { return r.loadPct; }, render: function (r) { var b = bandOf(r.loadPct); return UI.tag(b.k, b.tone); } }
      ]),
      rows: rows, pageSize: 15, sort: { k: 'loadPct', desc: true },
      rowCls: function (r) { return r.loadPct > 100 ? 'row-danger' : (r.loadPct >= 86 ? 'row-warn' : ''); },
      onRow: openMember,
      empty: UI.empty('没有符合条件的成员'),
      maxH: 520,
      footNote: '每格上方为该周全部项目合计工时，下方为本口径项目占用；超 40h 标红'
    });

    P.bindFlt(ctx.el.querySelector('#rlFlt'), MOD + '.load', DEF_L, function () { Shell.route(); });
    ctx.el.querySelector('[data-go2]').onclick = function () { Shell.go(MOD, 'alloc'); };
    P.$('rlPrint').onclick = function () { U.printPage(); };
    P.$('rlCsv').onclick = function () {
      P.csv('工时负载矩阵', all, [
        { label: '姓名', key: 'name' }, { label: '部门', key: 'dept' }, { label: '职位', key: 'title' }
      ].concat(ws.map(function (w) {
        return { label: w, get: function (r) { return U.sum(weekSplit(r.id, w), 'hours'); } };
      })).concat([
        { label: '本周负载%', key: 'loadPct' },
        { label: '水位', get: function (r) { return bandOf(r.loadPct).k; } }
      ]));
    };

    ['rlConf', 'rlIdle'].forEach(function (id) {
      var box = P.$(id); if (!box) return;
      box.addEventListener('click', function (e) {
        var li = e.target.closest('[data-mid]'); if (!li) return;
        var m = all.filter(function (x) { return x.id === li.getAttribute('data-mid'); })[0];
        if (m) openMember(m);
      });
    });
  }

  /* ==========================================================
   * 子页三：跨部门协同
   * ======================================================== */
  function cross(ctx) {
    var all = S.cross();
    var f = P.flt(MOD + '.cross', DEF_C);
    var rows = all.filter(function (c) {
      if (f.status && c.status !== f.status) return false;
      if (f.dept && c.toDept !== f.dept) return false;
      if (f.priority && c.priority !== f.priority) return false;
      if (f.flag === 'open' && ['已解决', '已关闭'].indexOf(c.status) >= 0) return false;
      if (f.flag === 'overdue' && !c.overdue) return false;
      if (f.kw && (c.id + c.title + c.toDept + c.owner + c.requester + c.projectName).toLowerCase().indexOf(f.kw.toLowerCase()) < 0) return false;
      return true;
    });

    var opens = all.filter(function (c) { return ['已解决', '已关闭'].indexOf(c.status) < 0; });
    var od = all.filter(function (c) { return c.overdue; });
    var closed = all.length - opens.length;

    var h = P.head({
      mod: MOD, title: '跨部门协同',
      desc: '记录项目对外的资源与配合请求，跟踪承接部门、期望完成时间与闭环结果，避免跨部门事项在会议之外失联。',
      acts: '<button class="btn" id="rcCsv">导出 CSV</button>' +
        '<button class="btn" id="rcWord">导出协同清单</button>' +
        (P.ed(MOD) ? '<button class="btn-primary" id="rcNew">＋ 新建协同事项</button>' : '')
    });
    h += P.permTip(MOD);
    h += P.statCards([
      { label: '协同事项', val: all.length, unit: '项', sub: '已闭环 ' + closed + ' 项', ico: '🤝' },
      { label: '进行中', val: opens.length, unit: '项', sub: '涉及 ' + U.uniq(opens.map(function (c) { return c.toDept; })).length + ' 个部门', tone: 'doing', ico: '↻' },
      { label: '已逾期', val: od.length, unit: '项', sub: od.length ? '需升级至项目周会' : '暂无逾期', tone: od.length ? 'danger' : 'done', ico: '⚠' },
      { label: '闭环率', val: U.pct(closed, all.length), unit: '%', sub: '目标 ≥ 80%', tone: U.pct(closed, all.length) >= 80 ? 'done' : 'warn', ico: '✓' }
    ]);

    h += P.gap(4);
    h += UI.grid(3,
      UI.card({ title: '状态分布', sub: '点击扇区筛选', body: P.chart('rcPie', 240) }) +
      UI.card({ title: '承接部门 TOP', sub: '点击柱条筛选部门', body: P.chart('rcDept', 240) }) +
      UI.card({ title: '逾期与待处理', sub: '按承接部门统计未闭环事项', body: P.chart('rcOd', 240) })
    );

    h += P.gap(4);
    h += '<div class="toolbar" id="rcFlt">' +
      '<input class="fld" data-f="kw" placeholder="搜索事项 / 编号 / 承接方 / 责任人" value="' + E(f.kw) + '" style="min-width:240px">' +
      P.sel('status', '全部状态', CX_ST, f.status) +
      P.sel('dept', '全部承接部门', U.uniq(all.map(function (c) { return c.toDept; })), f.dept) +
      P.sel('priority', '全部优先级', ['P0', 'P1', 'P2'], f.priority) +
      P.sel('flag', '不限', [{ v: 'open', t: '仅未闭环' }, { v: 'overdue', t: '仅已逾期' }], f.flag) +
      '<button class="btn-ghost" data-reset>重置</button>' +
      '</div>';
    h += '<div id="rcTbl"></div>';

    ctx.el.innerHTML = h;

    var byS = U.countBy(all, 'status');
    CH.donut('rcPie', {
      data: CX_ST.filter(function (s) { return byS[s]; }).map(function (s) {
        return { name: s, value: byS[s], color: CH.TONE[C.tone('status', s)] };
      }),
      height: 240, center: { l: '协同事项', v: all.length },
      onClick: function (i, d) { setF('cross', DEF_C, 'status', d.name); }
    });

    var byD = U.countBy(all, 'toDept');
    var dKeys = Object.keys(byD).sort(function (a, b) { return byD[b] - byD[a]; });
    CH.bars('rcDept', {
      data: dKeys.map(function (k, i) { return { label: k, value: byD[k], text: byD[k] + ' 项', color: CH.PAL[i % CH.PAL.length] }; }),
      onClick: function (i) { setF('cross', DEF_C, 'dept', dKeys[i]); }
    });

    var byDO = U.group(opens, 'toDept');
    var doKeys = Object.keys(byDO);
    CH.bar('rcOd', {
      labels: doKeys.map(function (k) { return U.ellip(k, 5); }), height: 240, stack: true,
      series: [
        { name: '按期跟进', data: doKeys.map(function (k) { return byDO[k].filter(function (c) { return !c.overdue; }).length; }), color: CH.TONE.doing },
        { name: '已逾期', data: doKeys.map(function (k) { return byDO[k].filter(function (c) { return c.overdue; }).length; }), color: CH.TONE.danger }
      ],
      onClick: function (i) { setF('cross', DEF_C, 'dept', doKeys[i]); }
    });

    UI.table(ctx.el.querySelector('#rcTbl'), {
      cols: [
        { k: 'id', t: '编号', w: '76px', render: function (r) { return UI.idCell(r.id); } },
        { k: 'title', t: '协同事项', w: '240px', render: function (r) { return UI.cell2(E(r.title), E(r.projectName)); } },
        { k: 'toDept', t: '承接部门', w: '110px', render: function (r) { return UI.tag(r.toDept, 'plan'); } },
        { k: 'requester', t: '发起人', w: '100px', render: function (r) { return UI.owner(r.requester); } },
        { k: 'owner', t: '对接责任人', w: '110px', render: function (r) { return UI.owner(r.owner); } },
        { k: 'priority', t: '优先级', w: '80px', render: function (r) { return UI.pri(r.priority); } },
        { k: 'requestAt', t: '发起日期', w: '100px' },
        { k: 'dueAt', t: '期望完成', w: '110px', render: function (r) { return ['已解决', '已关闭'].indexOf(r.status) < 0 ? UI.due(r.dueAt) : '<span class="muted tiny">' + E(r.dueAt) + '</span>'; } },
        { k: 'status', t: '状态', w: '90px', render: function (r) { return UI.st('status', r.status) + (r.overdue ? ' ' + UI.tag('逾期', 'danger') : ''); } },
        {
          k: 'act', t: '操作', w: '130px', align: 'right', sortable: false,
          render: function (r) {
            return '<div class="row-acts"><button class="btn-sm" data-act="view">详情</button>' +
              (P.ed(MOD) && ['已解决', '已关闭'].indexOf(r.status) < 0 ? '<button class="btn-sm" data-act="done">标记解决</button>' : '') + '</div>';
          }
        }
      ],
      rows: rows, pageSize: 15, sort: { k: 'dueAt', desc: false }, select: true,
      rowCls: function (r) { return r.overdue ? 'row-danger' : (['已解决', '已关闭'].indexOf(r.status) >= 0 ? 'row-done' : ''); },
      onRow: openCross,
      onAct: function (act, r) { if (act === 'done') markDone(r); else openCross(r); },
      empty: UI.empty('没有符合条件的协同事项', '<button class="btn" data-reset2>清空筛选条件</button>'),
      bulk: [{ t: '导出所选', fn: function (picked) { crossCsv(picked); } }],
      footNote: '逾期事项标红；已闭环事项淡化显示'
    });

    var r2 = ctx.el.querySelector('[data-reset2]');
    if (r2) r2.addEventListener('click', function () { P.setFlt(MOD + '.cross', Object.assign({}, DEF_C)); Shell.route(); });
    P.bindFlt(ctx.el.querySelector('#rcFlt'), MOD + '.cross', DEF_C, function () { Shell.route(); });
    P.$('rcCsv').onclick = function () { crossCsv(rows); };
    P.$('rcWord').onclick = function () { crossWord(all, opens, od); };
    var nb = P.$('rcNew');
    if (nb) nb.onclick = newCross;
  }

  function markDone(c) {
    if (!P.ed(MOD)) { UI.toast('当前角色无编辑权限', 'warn'); return; }
    UI.confirm('确认将「<b>' + E(c.title) + '</b>」标记为已解决？', function () {
      S.update('cross', c.id, { status: '已解决', overdue: false, result: '已支持到位' });
      UI.toast('协同事项已标记解决', 'ok');
      Shell.route();
    }, { title: '标记解决', okText: '确认', tip: '原型为内存态，操作会写入工作留痕，刷新页面后还原。' });
  }

  function newCross() {
    UI.formModal({
      title: '新建跨部门协同事项', wide: true,
      tip: '协同事项会同步到「项目协同 · 跨部门事项」，并计入闭环率统计。',
      fields: [
        { k: 'title', label: '事项标题', type: 'text', req: true, full: true, placeholder: '如：协调数据部支援 2 人' },
        { k: 'projectId', label: '所属项目', type: 'select', req: true, opts: P.projOpts(), val: S.curProject().id },
        { k: 'toDept', label: '承接部门', type: 'select', req: true, opts: C.DICT.dept.filter(function (d) { return d !== '产品部'; }) },
        { k: 'owner', label: '对接责任人', type: 'select', req: true, opts: P.memberNames() },
        { k: 'priority', label: '优先级', type: 'select', req: true, opts: ['P0', 'P1', 'P2'], val: 'P1' },
        { k: 'dueAt', label: '期望完成', type: 'date', req: true, val: U.fmtDate(U.addDay(S.TODAY, 14)) },
        { k: 'desc', label: '事项说明', type: 'textarea', full: true, rows: 3, placeholder: '说明背景、期望产出与影响范围' }
      ],
      okText: '提交协同申请',
      onSubmit: function (d, hd) {
        var p = S.projectsInScope().filter(function (x) { return x.id === d.projectId; })[0] || S.curProject();
        S.add('cross', {
          id: 'CX' + U.pad(S.DB.cross.length + 1),
          title: d.title, projectId: p.id, projectName: p.name,
          fromDept: '产品部', toDept: d.toDept,
          status: '待处理', owner: d.owner, requester: S.roleObj().user.name,
          requestAt: U.fmtDate(S.TODAY), dueAt: d.dueAt,
          overdue: false, priority: d.priority, result: '', desc: d.desc || ''
        });
        hd.close();
        UI.toast('协同事项已提交', 'ok');
        Shell.route();
      }
    });
  }

  function openCross(c) {
    var body = P.hero({
      title: E(c.title), id: c.id,
      meta: [['所属项目', E(c.projectName)], ['承接部门', E(c.toDept)], ['优先级', c.priority], ['期望完成', c.dueAt]],
      right: UI.st('status', c.status) + (c.overdue ? ' ' + UI.tag('已逾期', 'danger') : '')
    });
    body += UI.sec('协同信息', P.kv([
      ['发起部门', c.fromDept], ['发起人', c.requester],
      ['承接部门', c.toDept], ['对接责任人', c.owner],
      ['发起日期', c.requestAt], ['期望完成', c.dueAt],
      ['当前状态', c.status], ['处理结果', c.result || '—']
    ]));
    if (c.desc) body += UI.sec('事项说明', '<div class="rich">' + E(c.desc) + '</div>');
    body += UI.sec('协同建议',
      (c.overdue
        ? UI.notice('danger', '该事项已超过期望完成时间 <b>' + U.dayDiff(c.dueAt, S.TODAY) + '</b> 天，建议在项目周会上升级处理。')
        : UI.notice('info', '距期望完成还有 <b>' + Math.max(0, U.dayDiff(S.TODAY, c.dueAt)) + '</b> 天，按计划跟进即可。')) +
      UI.notice('plain', '对接责任人 <b>' + E(c.owner) + '</b>，如长期无进展可在「会议纪要」中登记为 Action Item 跟踪。'));

    var d = UI.drawer({
      title: '协同事项详情', sub: E(c.id + ' · ' + c.toDept),
      body: body,
      foot: '<button class="btn" data-close>关闭</button>' +
        '<button class="btn" id="cxGo">在项目协同中查看</button>' +
        (P.ed(MOD) && ['已解决', '已关闭'].indexOf(c.status) < 0 ? '<button class="btn-primary" id="cxDone">标记解决</button>' : '')
    });
    d.el.querySelector('#cxGo').onclick = function () { d.close(); Shell.go('collab', 'cross'); };
    var db = d.el.querySelector('#cxDone');
    if (db) db.onclick = function () { d.close(); markDone(c); };
  }

  function crossCsv(rows) {
    P.csv('跨部门协同', rows, [
      { label: '编号', key: 'id' }, { label: '事项', key: 'title' },
      { label: '项目', key: 'projectName' }, { label: '发起部门', key: 'fromDept' },
      { label: '承接部门', key: 'toDept' }, { label: '发起人', key: 'requester' },
      { label: '对接责任人', key: 'owner' }, { label: '优先级', key: 'priority' },
      { label: '发起日期', key: 'requestAt' }, { label: '期望完成', key: 'dueAt' },
      { label: '状态', key: 'status' }, { label: '是否逾期', get: function (r) { return r.overdue ? '是' : '否'; } },
      { label: '处理结果', key: 'result' }
    ]);
  }

  function crossWord(all, opens, od) {
    P.word('跨部门协同清单', '跨部门协同事项跟踪表', [
      { h3: '一、总体情况', kv: [
        ['统计口径', P.scopeText()],
        ['协同事项总数', all.length + ' 项'],
        ['未闭环', opens.length + ' 项'],
        ['已逾期', od.length + ' 项'],
        ['闭环率', U.pct(all.length - opens.length, all.length) + '%']
      ] },
      { h3: '二、未闭环事项', table: {
        cols: [
          { t: '编号', k: 'id' }, { t: '事项', k: 'title' }, { t: '承接部门', k: 'toDept' },
          { t: '责任人', k: 'owner' }, { t: '优先级', k: 'priority' },
          { t: '期望完成', k: 'dueAt' }, { t: '状态', k: 'status' }
        ], rows: opens
      } },
      { h3: '三、逾期事项与升级建议', list: od.length
        ? od.map(function (c) { return c.id + '「' + c.title + '」由' + c.toDept + '承接，已超期 ' + U.dayDiff(c.dueAt, S.TODAY) + ' 天，建议升级至项目周会决策。'; })
        : ['当前无逾期协同事项。'] },
      { h3: '四、已闭环事项', table: {
        cols: [
          { t: '编号', k: 'id' }, { t: '事项', k: 'title' }, { t: '承接部门', k: 'toDept' },
          { t: '状态', k: 'status' }, { t: '处理结果', k: 'result' }
        ], rows: all.filter(function (c) { return ['已解决', '已关闭'].indexOf(c.status) >= 0; })
      } }
    ], ['生成日期：' + U.fmtDate(S.TODAY)]);
  }

  Shell.page(MOD, {
    render: function (ctx) {
      if (ctx.sub === 'load') load(ctx);
      else if (ctx.sub === 'cross') cross(ctx);
      else alloc(ctx);
    }
  });
})();
