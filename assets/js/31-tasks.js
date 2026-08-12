/* ============================================================
 * 31-tasks.js  任务管理（项目经理专属）
 * 子页：list 任务列表 / kanban 看板视图
 * ========================================================== */
(function () {
  'use strict';
  var E = U.esc, MOD = 'tasks';

  var DEF = { kw: '', status: '', type: '', priority: '', owner: '', phase: '', flag: '' };
  var K_COLS = [
    { key: '待开始', name: '待开始', tone: 'idle' },
    { key: '进行中', name: '进行中', tone: 'doing' },
    { key: '已阻塞', name: '已阻塞', tone: 'danger' },
    { key: '待评审', name: '待评审', tone: 'plan' },
    { key: '已完成', name: '已完成', tone: 'done' }
  ];
  var ST_ALL = ['待开始', '进行中', '已阻塞', '待评审', '已完成', '已取消'];

  function pct(v) { return Math.round((v || 0) * 100); }
  function open(t) { return t.status !== '已完成' && t.status !== '已取消'; }

  function apply(list, f) {
    return list.filter(function (t) {
      if (f.status && t.status !== f.status) return false;
      if (f.type && t.type !== f.type) return false;
      if (f.priority && t.priority !== f.priority) return false;
      if (f.owner && t.owner !== f.owner) return false;
      if (f.phase && t.phaseName !== f.phase) return false;
      if (f.flag === 'overdue' && !(t.overdue && open(t))) return false;
      if (f.flag === 'blocked' && t.status !== '已阻塞') return false;
      if (f.flag === 'mine' && t.owner !== S.roleObj().user.name) return false;
      if (f.flag === 'week') {
        var d = U.dayDiff(S.TODAY, t.due);
        if (!(open(t) && d >= 0 && d <= 7)) return false;
      }
      if (f.kw) {
        var k = f.kw.toLowerCase();
        if ((t.id + t.title + t.owner + t.phaseName + (t.reqTitle || '') + t.projectName).toLowerCase().indexOf(k) < 0) return false;
      }
      return true;
    });
  }

  function fltBar(f, all) {
    return '<div class="toolbar" id="tkFlt">' +
      '<input class="fld" data-f="kw" placeholder="搜索任务 / 编号 / 负责人 / 关联需求" value="' + E(f.kw) + '" style="min-width:240px">' +
      P.sel('status', '全部状态', ST_ALL, f.status) +
      P.sel('type', '全部类型', U.uniq(all.map(function (x) { return x.type; })), f.type) +
      P.sel('priority', '全部优先级', ['P0', 'P1', 'P2', 'P3'], f.priority) +
      P.sel('owner', '全部负责人', U.uniq(all.map(function (x) { return x.owner; })).sort(), f.owner) +
      P.sel('phase', '全部阶段', U.uniq(all.map(function (x) { return x.phaseName; })), f.phase) +
      P.sel('flag', '不限', [
        { v: 'mine', t: '仅我负责' }, { v: 'overdue', t: '仅已延期' },
        { v: 'blocked', t: '仅阻塞' }, { v: 'week', t: '7 天内到期' }
      ], f.flag) +
      '<button class="btn-ghost" data-reset>重置</button>' +
      '</div>';
  }

  function cards(all) {
    var opens = all.filter(open);
    var od = opens.filter(function (t) { return t.overdue; });
    var bl = all.filter(function (t) { return t.status === '已阻塞'; });
    var done = all.filter(function (t) { return t.status === '已完成'; });
    return P.statCards([
      { label: '任务总数', val: all.length, unit: '个', sub: '在办 ' + opens.length + ' 个', ico: '☑' },
      { label: '已完成', val: done.length, unit: '个', sub: '完成率 ' + U.pct(done.length, all.length) + '%', tone: 'done', ico: '✓' },
      { label: '已延期', val: od.length, unit: '个', sub: od.length ? '平均延期 ' + Math.round(U.avg(od, 'delayDays')) + ' 天' : '无延期任务', tone: od.length ? 'danger' : 'done', ico: '⚠' },
      { label: '阻塞中', val: bl.length, unit: '个', sub: bl.length ? '需优先清理阻塞原因' : '当前无阻塞', tone: bl.length ? 'danger' : 'done', ico: '⛔' }
    ]);
  }

  /* ==========================================================
   * 子页一：任务列表
   * ======================================================== */
  function list(ctx) {
    var all = S.tasks();
    var f = P.flt(MOD, DEF);
    var rows = apply(all, f);

    var h = P.head({
      mod: MOD, title: '任务列表',
      desc: '项目全部任务的统一视图。默认按截止时间升序，延期与阻塞任务高亮置顶提示。',
      acts: '<button class="btn" data-go2="kanban">切到看板</button>' +
        '<button class="btn" id="tkCsv">导出 CSV</button>' +
        '<button class="btn" id="tkWord">导出任务清单</button>' +
        P.createBtn(MOD, 'task.new', '新建任务')
    });
    h += P.permTip(MOD);
    h += cards(all);
    h += P.gap(4);
    h += UI.grid(3,
      UI.card({ title: '状态分布', sub: '点击扇区筛选', body: P.chart('tkPie', 240) }) +
      UI.card({ title: '按类型', sub: '点击柱条筛选', body: P.chart('tkType', 240) }) +
      UI.card({ title: '负责人在办 TOP10', sub: '点击查看该负责人任务', body: P.chart('tkOwner', 240) })
    );
    h += P.gap(4);
    h += fltBar(f, all);
    h += P.viewBar(MOD);
    h += '<div id="tkTbl"></div>';

    ctx.el.innerHTML = h;

    var byS = U.countBy(all, 'status');
    CH.donut('tkPie', {
      data: ST_ALL.filter(function (s) { return byS[s]; }).map(function (s) {
        return { name: s, value: byS[s], color: CH.TONE[C.tone('status', s)] };
      }),
      height: 240, center: { l: '任务', v: all.length },
      onClick: function (i, d) { setF('status', d.name); }
    });

    var byT = U.countBy(all, 'type');
    var tKeys = Object.keys(byT);
    CH.bar('tkType', {
      labels: tKeys, height: 240,
      series: [{ name: '任务数', data: tKeys.map(function (k) { return byT[k]; }), color: CH.TONE.doing }],
      onClick: function (i) { setF('type', tKeys[i]); }
    });

    var byO = U.countBy(all.filter(open), 'owner');
    var ownerRows = Object.keys(byO).map(function (k) { return { label: k, value: byO[k], text: byO[k] + ' 个' }; })
      .sort(function (a, b) { return b.value - a.value; }).slice(0, 10);
    CH.bars('tkOwner', {
      data: ownerRows,
      onClick: function (i) { setF('owner', ownerRows[i].label); }
    });

    UI.table(ctx.el.querySelector('#tkTbl'), {
      cols: [
        { k: 'id', t: '编号', w: '76px', sortable: true, render: function (r) { return UI.idCell(r.id); } },
        {
          k: 'title', t: '任务', w: '260px', sortable: true,
          render: function (r) { return UI.cell2(E(r.title), E(r.phaseName) + (r.reqTitle ? ' · 关联 ' + E(U.ellip(r.reqTitle, 14)) : '')); }
        },
        { k: 'type', t: '类型', w: '80px', sortable: true, render: function (r) { return UI.st('taskType', r.type); } },
        { k: 'priority', t: '优先级', w: '80px', sortable: true, render: function (r) { return UI.pri(r.priority); } },
        { k: 'owner', t: '负责人', w: '110px', sortable: true, render: function (r) { return UI.owner(r.owner); } },
        { k: 'dept', t: '部门', w: '90px', sortable: true },
        { k: 'due', t: '截止', w: '110px', sortable: true, render: function (r) { return open(r) ? UI.due(r.due) : '<span class="muted tiny">' + E(r.doneAt || r.due) + '</span>'; } },
        {
          k: 'progress', t: '进度', w: '130px', sortable: true,
          render: function (r) { return UI.pcell(pct(r.progress), UI.ptone(pct(r.progress), r.overdue && open(r))); }
        },
        {
          k: 'hours', t: '工时', w: '90px', align: 'right', sortable: true,
          sortVal: function (r) { return r.realHours; },
          render: function (r) { return '<span class="muted tiny">' + r.realHours + ' / ' + r.estHours + 'h</span>'; }
        },
        { k: 'status', t: '状态', w: '90px', sortable: true, render: function (r) { return UI.st('status', r.status); } },
        {
          k: 'act', t: '操作', w: '120px', align: 'right', sortable: false,
          render: function () { return '<div class="row-acts"><button class="btn-sm" data-act="view">详情</button>' + (P.ed(MOD) ? '<button class="btn-sm" data-act="edit">编辑</button>' : '') + '</div>'; }
        }
      ],
      rows: rows, pageSize: 15, sort: { k: 'due', desc: false }, select: true,
      rowCls: function (r) {
        if (r.status === '已阻塞') return 'row-danger';
        if (r.overdue && open(r)) return 'row-warn';
        if (r.status === '已完成' || r.status === '已取消') return 'row-done';
        return '';
      },
      onRow: openTask,
      onAct: function (act, r) { if (act === 'edit') editTask(r); else openTask(r); },
      empty: UI.empty('没有符合条件的任务', '<button class="btn" data-reset2>清空筛选条件</button>'),
      bulk: [
        { t: '导出所选', fn: function (picked) { csv(picked); } },
        { t: '标记为已完成', cls: 'primary', fn: function (picked, clear) { bulkDone(picked, clear); } }
      ],
      footNote: '延期任务标黄、阻塞任务标红，已关闭任务淡化显示'
    });

    var r2 = ctx.el.querySelector('[data-reset2]');
    if (r2) r2.addEventListener('click', function () { P.setFlt(MOD, Object.assign({}, DEF)); Shell.route(); });

    P.bindFlt(ctx.el.querySelector('#tkFlt'), MOD, DEF, function () { Shell.route(); });
    P.bindViews(ctx.el, MOD, DEF);
    P.$('tkCsv').onclick = function () { csv(rows); };
    P.$('tkWord').onclick = function () { word(rows, all); };
    ctx.el.querySelector('[data-go2]').onclick = function () { Shell.go(MOD, 'kanban'); };
  }

  function setF(k, v) {
    var f = P.flt(MOD, DEF);
    f[k] = f[k] === v ? '' : v;
    P.setFlt(MOD, f);
    Shell.route();
  }

  function bulkDone(picked, clear) {
    if (!P.ed(MOD)) { UI.toast('当前角色无编辑权限', 'warn'); return; }
    var todo = picked.filter(open);
    if (!todo.length) { UI.toast('所选任务均已关闭', 'warn'); return; }
    UI.confirm('将把 <b>' + todo.length + '</b> 个任务标记为「已完成」，进度置为 100%。', function () {
      todo.forEach(function (t) {
        S.update('tasks', t.id, {
          status: '已完成', progress: 1, overdue: false, delayDays: 0,
          doneAt: U.fmtDate(S.TODAY), blockReason: ''
        });
      });
      if (clear) clear();
      Shell.route();
      UI.toast(todo.length + ' 个任务已标记完成', 'ok');
    }, { title: '批量标记完成', okText: '确认完成', tip: '原型为内存态，操作会写入工作留痕，刷新页面后还原。' });
  }

  function csv(rows) {
    P.csv('任务清单', rows, [
      { label: '编号', key: 'id' }, { label: '任务', key: 'title' },
      { label: '项目', key: 'projectName' }, { label: '阶段', key: 'phaseName' },
      { label: '类型', key: 'type' }, { label: '优先级', key: 'priority' },
      { label: '负责人', key: 'owner' }, { label: '部门', key: 'dept' },
      { label: '开始', key: 'start' }, { label: '截止', key: 'due' },
      { label: '完成日期', key: 'doneAt' },
      { label: '进度%', get: function (r) { return pct(r.progress); } },
      { label: '预估工时', key: 'estHours' }, { label: '实际工时', key: 'realHours' },
      { label: '状态', key: 'status' }, { label: '延期天数', key: 'delayDays' },
      { label: '阻塞原因', key: 'blockReason' }, { label: '关联需求', key: 'reqTitle' }
    ]);
  }

  function word(rows, all) {
    var od = rows.filter(function (t) { return t.overdue && open(t); });
    var bl = rows.filter(function (t) { return t.status === '已阻塞'; });
    var cols = [
      { t: '编号', k: 'id' }, { t: '任务', k: 'title' }, { t: '阶段', k: 'phaseName' },
      { t: '类型', k: 'type' }, { t: '优先级', k: 'priority' }, { t: '负责人', k: 'owner' },
      { t: '截止', k: 'due' }, { t: '进度', get: function (r) { return pct(r.progress) + '%'; } },
      { t: '状态', k: 'status' }
    ];
    P.word('任务清单', '项目任务执行清单', [
      {
        h: '一、执行概况', kv: [
          ['数据口径', P.scopeText()],
          ['任务总数（全量）', all.length + ' 个'],
          ['本次导出', rows.length + ' 个'],
          ['已完成', all.filter(function (t) { return t.status === '已完成'; }).length + ' 个'],
          ['已延期', od.length + ' 个'],
          ['阻塞中', bl.length + ' 个']
        ]
      },
      {
        h: '二、延期任务', p: od.length ? '以下任务已超出截止日期，请负责人在例会同步补救计划。' : '本次导出范围内无延期任务。',
        table: {
          cols: cols.concat([{ t: '延期天数', get: function (r) { return r.delayDays + ' 天'; } }]),
          rows: od
        }
      },
      {
        h: '三、阻塞任务', p: bl.length ? '阻塞会沿阶段依赖向后传导，需在 24 小时内明确解除责任人。' : '本次导出范围内无阻塞任务。',
        table: { cols: cols.concat([{ t: '阻塞原因', k: 'blockReason' }]), rows: bl }
      },
      { h: '四、全部任务', table: { cols: cols, rows: rows } }
    ]);
    UI.toast('任务清单已导出', 'ok');
  }

  /* ==========================================================
   * 子页二：看板视图
   * ======================================================== */
  function kanban(ctx) {
    var all = S.tasks();
    var f = P.flt(MOD, DEF);
    var rows = apply(all, f).filter(function (t) { return t.status !== '已取消'; });

    var h = P.head({
      mod: MOD, title: '看板视图',
      desc: '按状态分列，可拖拽卡片改变任务状态' + (P.ed(MOD) ? '' : '（当前角色只读，拖拽已禁用）') + '。看板与列表共用同一套筛选条件。',
      acts: '<button class="btn" data-go2="list">切到列表</button>' +
        '<button class="btn" id="kbCsv">导出 CSV</button>' +
        P.createBtn(MOD, 'task.new', '新建任务')
    });
    h += P.permTip(MOD);
    h += cards(all);
    h += P.gap(4);
    h += fltBar(f, all);
    h += P.viewBar(MOD);
    h += '<div id="kbBox"></div>';

    ctx.el.innerHTML = h;

    UI.kanban(ctx.el.querySelector('#kbBox'), {
      cols: K_COLS, rows: rows, groupKey: 'status', max: 40,
      card: function (t) {
        return '<div class="kcard-t">' + E(t.title) + '</div>' +
          '<div class="kcard-m">' + UI.pri(t.priority) + UI.tag(t.type, C.tone('taskType', t.type)) +
          '<span class="muted tiny">' + E(t.id) + ' · ' + E(t.phaseName) + '</span></div>' +
          (t.status === '已阻塞' && t.blockReason
            ? '<div class="tag tag-danger" style="margin:6px 0;white-space:normal;line-height:1.5">⛔ ' + E(U.ellip(t.blockReason, 22)) + '</div>' : '') +
          UI.pbar(pct(t.progress), UI.ptone(pct(t.progress), t.overdue && open(t))) +
          '<div class="kcard-f">' + UI.owner(t.owner) +
          '<span class="tiny">' + (open(t) ? UI.due(t.due) : '<span class="muted">' + E(t.doneAt || '') + '</span>') +
          (t.attachCount ? ' <span class="muted">📎' + t.attachCount + '</span>' : '') +
          ((t.comments || []).length ? ' <span class="muted">💬' + t.comments.length + '</span>' : '') +
          '</span></div>';
      },
      onCard: openTask,
      onMove: P.ed(MOD) ? function (t, toKey) {
        var patch = { status: toKey };
        if (toKey === '已完成') { patch.progress = 1; patch.doneAt = U.fmtDate(S.TODAY); patch.overdue = false; patch.delayDays = 0; patch.blockReason = ''; }
        if (toKey === '待开始') patch.progress = 0;
        if (toKey === '进行中' && t.progress >= 1) patch.progress = 0.8;
        if (toKey !== '已阻塞') patch.blockReason = '';
        S.update('tasks', t.id, patch);
        UI.toast('「' + U.ellip(t.title, 14) + '」已移动到「' + toKey + '」', 'ok');
        Shell.route();
      } : null,
      onAdd: P.ed(MOD) ? function () { Shell.create('task.new'); } : null,
      addText: '新建任务'
    });

    P.bindFlt(ctx.el.querySelector('#tkFlt'), MOD, DEF, function () { Shell.route(); });
    P.bindViews(ctx.el, MOD, DEF);
    P.$('kbCsv').onclick = function () { csv(rows); };
    ctx.el.querySelector('[data-go2]').onclick = function () { Shell.go(MOD, 'list'); };
  }

  /* ==========================================================
   * 任务详情抽屉
   * ======================================================== */
  function openTask(t) {
    var b = P.hero({
      title: E(t.title), id: t.id,
      meta: [
        ['项目', E(t.projectName)], ['阶段', E(t.phaseName)],
        ['负责人', UI.owner(t.owner)], ['优先级', UI.pri(t.priority)],
        ['状态', UI.st('status', t.status)]
      ],
      right: UI.pbar(pct(t.progress), UI.ptone(pct(t.progress), t.overdue && open(t)), true)
    });

    if (t.status === '已阻塞' && t.blockReason) {
      b += UI.notice('danger', '<b>阻塞原因：</b>' + E(t.blockReason) + '　该阻塞会影响所在阶段的整体交付，请尽快明确解除责任人与时间。');
    } else if (t.overdue && open(t)) {
      b += UI.notice('warn', '该任务已延期 <b>' + t.delayDays + '</b> 天，请补充延期原因并给出新的完成时间。');
    }

    b += UI.sec('基础信息', P.kv([
      ['任务类型', UI.st('taskType', t.type)],
      ['所属部门', t.dept],
      ['计划开始', t.start],
      ['计划截止', t.due],
      ['实际完成', t.doneAt || '—'],
      ['预估工时', t.estHours + ' h'],
      ['实际工时', t.realHours + ' h'],
      ['工时偏差', (t.realHours - t.estHours >= 0 ? '+' : '') + (t.realHours - t.estHours) + ' h'],
      ['关联需求', t.reqTitle ? E(t.reqId + ' ' + t.reqTitle) : '—'],
      ['附件', t.attachCount ? t.attachCount + ' 个' : '无']
    ]));

    var cs = t.comments || [];
    b += UI.sec('评论与进展（' + cs.length + '）', cs.length
      ? UI.tline(cs.map(function (c) {
        return { time: c.at, title: '<b>' + E(c.by) + '</b>', desc: E(c.text) };
      }))
      : UI.empty('暂无评论'));

    if (P.ed(MOD)) {
      b += UI.sec('追加评论',
        '<div style="display:flex;gap:var(--sp-2);align-items:flex-end">' +
        '<textarea class="fld" id="tkCmt" rows="2" style="flex:1" placeholder="记录一条进展或阻塞说明"></textarea>' +
        '<button class="btn-primary" id="tkCmtBtn">提交</button></div>');
    }

    UI.drawer({
      title: t.title, sub: t.projectName + ' · ' + t.id, wide: true, body: b,
      foot: (P.ed(MOD) ? '<button class="btn-primary" data-edit>编辑任务</button>' : '') +
        (t.reqId ? '<button class="btn" data-req>查看关联需求</button>' : '') +
        '<button class="btn" data-phase>查看所属阶段</button>',
      onOpen: function (h) {
        var ed = h.el.querySelector('[data-edit]');
        if (ed) ed.addEventListener('click', function () { h.close(); editTask(t); });
        var rq = h.el.querySelector('[data-req]');
        if (rq) rq.addEventListener('click', function () { h.close(); Shell.go('requirements', 'pool', t.reqId); });
        var ph = h.el.querySelector('[data-phase]');
        if (ph) ph.addEventListener('click', function () { h.close(); Shell.go('plan', 'phases'); });
        var cb = h.el.querySelector('#tkCmtBtn');
        if (cb) cb.addEventListener('click', function () {
          var ta = h.el.querySelector('#tkCmt');
          var v = (ta.value || '').trim();
          if (!v) { UI.toast('请先填写评论内容', 'warn'); return; }
          t.comments = t.comments || [];
          t.comments.push({ by: S.roleObj().user.name, at: U.fmtDate(new Date(), 'YYYY-MM-DD HH:mm'), text: v });
          S.update('tasks', t.id, { comments: t.comments });
          h.close(); openTask(t);
          UI.toast('评论已提交', 'ok');
        });
      }
    });
  }

  /* ==========================================================
   * 任务编辑
   * ======================================================== */
  function editTask(t) {
    UI.formModal({
      title: '编辑任务 · ' + t.id, wide: true,
      tip: '原型内存态：修改会写入工作留痕，刷新页面后还原为初始数据。',
      fields: [
        { k: 'title', label: '任务标题', val: t.title, req: true, full: true },
        { k: 'type', label: '任务类型', type: 'select', val: t.type, req: true, opts: ['产品', '设计', '前端', '后端', '测试', '数据', '运维', '文档'] },
        { k: 'priority', label: '优先级', type: 'select', val: t.priority, req: true, opts: ['P0', 'P1', 'P2', 'P3'] },
        { k: 'owner', label: '负责人', type: 'select', val: t.owner, req: true, opts: P.memberNames() },
        { k: 'status', label: '状态', type: 'select', val: t.status, req: true, opts: ST_ALL },
        { k: 'start', label: '计划开始', type: 'date', val: t.start },
        { k: 'due', label: '计划截止', type: 'date', val: t.due, req: true },
        { k: 'estHours', label: '预估工时(h)', type: 'number', val: t.estHours },
        { k: 'realHours', label: '实际工时(h)', type: 'number', val: t.realHours },
        { k: 'progress', label: '进度(%)', type: 'number', val: pct(t.progress), min: 0, max: 100 },
        { k: 'blockReason', label: '阻塞原因', type: 'textarea', val: t.blockReason, full: true, rows: 2, hint: '仅当状态为「已阻塞」时需要填写' }
      ],
      okText: '保存',
      onSubmit: function (d) {
        var pr = U.clamp(+d.progress || 0, 0, 100) / 100;
        if (d.status === '已完成') pr = 1;
        var od = d.status !== '已完成' && d.status !== '已取消' && U.dayDiff(d.due, S.TODAY) > 0;
        S.update('tasks', t.id, {
          title: d.title, type: d.type, priority: d.priority, owner: d.owner, status: d.status,
          start: d.start, due: d.due, estHours: +d.estHours || 0, realHours: +d.realHours || 0,
          progress: +pr.toFixed(2), overdue: od, delayDays: od ? U.dayDiff(d.due, S.TODAY) : 0,
          blockReason: d.status === '已阻塞' ? (d.blockReason || '未填写') : '',
          doneAt: d.status === '已完成' ? (t.doneAt || U.fmtDate(S.TODAY)) : ''
        });
        Shell.route();
        UI.toast('任务已更新', 'ok');
      }
    });
  }

  Shell.page(MOD, {
    render: function (ctx) {
      if (ctx.sub === 'kanban') kanban(ctx);
      else list(ctx);
    }
  });
})();
