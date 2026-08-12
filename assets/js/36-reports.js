/* ============================================================
 * 36-reports.js  周报月报（项目经理专属）
 * 子页：weekly 周报 / monthly 月报
 * 报告内容不手工填写，全部由 tasks / milestones / risks /
 * changes / deliverables / cross 实时汇总生成，可导出 Word / 打印 PDF。
 * ========================================================== */
(function () {
  'use strict';
  var E = U.esc, MOD = 'reports';

  var DEF_W = { kw: '', status: '', author: '' };
  var DEF_M = { kw: '', status: '', author: '' };
  var ST = ['草稿', '已提交'];

  /* ---------- 期间计算 ---------- */
  /* off: 0=本期，-1=上一期 */
  function periodOf(kind, off) {
    var t = S.TODAY;
    if (kind === 'weekly') {
      var r = U.weekRange(U.addDay(t, 7 * (off || 0)));
      return { from: r[0], to: r[1], label: U.weekOf(r[0]), text: U.fmtMD(r[0]) + ' ~ ' + U.fmtMD(r[1]) };
    }
    var d = new Date(t.getFullYear(), t.getMonth() + (off || 0), 1);
    var end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { from: d, to: end, label: U.monthOf(d), text: U.fmtDate(d, 'YYYY 年 MM 月') };
  }
  function inP(v, p) {
    if (!v) return false;
    var d = U.toDate(v);
    if (!d) return false;
    return U.dayDiff(p.from, d) >= 0 && U.dayDiff(d, p.to) >= 0;
  }

  /* ---------- 自动汇总 ---------- */
  function digest(kind, off) {
    var p = periodOf(kind, off);
    var prev = periodOf(kind, (off || 0) - 1);
    var proj = S.curProject() || {};
    var ts = S.tasks(), ms = S.milestones(), rk = S.risks();
    var cg = S.changes(), dv = S.deliverables(), cx = S.cross(), ph = S.phases();

    var done = ts.filter(function (t) { return t.status === '已完成' && inP(t.doneAt, p); });
    var donePrev = ts.filter(function (t) { return t.status === '已完成' && inP(t.doneAt, prev); });
    var open = ts.filter(function (t) { return ['已完成', '已取消'].indexOf(t.status) < 0; });
    var delay = open.filter(function (t) { return t.overdue; });
    var block = open.filter(function (t) { return t.status === '已阻塞'; });
    var nextDue = open.filter(function (t) { return inP(t.due, periodOf(kind, (off || 0) + 1)); });

    var msHit = ms.filter(function (m) { return inP(m.date, p) && m.status.indexOf('已完成') >= 0; });
    var msMiss = ms.filter(function (m) { return inP(m.date, p) && m.status === '已延期'; });
    var msNext = ms.filter(function (m) { return inP(m.date, periodOf(kind, (off || 0) + 1)); });

    var rkNew = rk.filter(function (r) { return inP(r.foundAt, p); });
    var rkOpen = rk.filter(function (r) { return ['已缓解', '已关闭'].indexOf(r.status) < 0; });
    var rkHigh = rkOpen.filter(function (r) { return r.level === '高'; });

    var cgNew = cg.filter(function (c) { return inP(c.applyAt, p); });
    var cgOk = cg.filter(function (c) { return inP(c.approveAt, p) && ['已批准', '已实施'].indexOf(c.status) >= 0; });
    var cgPend = cg.filter(function (c) { return ['草稿', '待审批', '评估中'].indexOf(c.status) >= 0; });

    var dvDone = dv.filter(function (d) { return inP(d.acceptAt, p) && ['已验收', '已归档'].indexOf(d.status) >= 0; });
    var dvWait = dv.filter(function (d) { return ['待验收', '验收中'].indexOf(d.status) >= 0; });

    var cxOpen = cx.filter(function (c) { return ['待处理', '处理中'].indexOf(c.status) >= 0; });
    var cxDone = cx.filter(function (c) { return inP(c.requestAt, p) && ['已解决', '已关闭'].indexOf(c.status) >= 0; });

    var curPh = ph.filter(function (x) { return x.status === '进行中'; })[0] ||
      ph.filter(function (x) { return x.status !== '已完成'; })[0] || ph[ph.length - 1];

    var hours = U.sum(done, 'realHours');
    var prog = Math.round((proj.progress || 0) * 100);
    var planProg = proj.start && proj.end
      ? Math.min(100, Math.max(0, U.pct(U.dayDiff(proj.start, S.TODAY), Math.max(1, U.dayDiff(proj.start, proj.end)))))
      : prog;

    return {
      kind: kind, p: p, prev: prev, proj: proj, phase: curPh,
      prog: prog, planProg: planProg, gap: prog - planProg,
      done: done, donePrev: donePrev, open: open, delay: delay, block: block, nextDue: nextDue,
      msHit: msHit, msMiss: msMiss, msNext: msNext,
      rkNew: rkNew, rkOpen: rkOpen, rkHigh: rkHigh,
      cgNew: cgNew, cgOk: cgOk, cgPend: cgPend,
      dvDone: dvDone, dvWait: dvWait, cxOpen: cxOpen, cxDone: cxDone,
      hours: hours, ts: ts, ph: ph
    };
  }

  /* 亮点 / 风险 / 下期计划：由数据推导成自然语言 */
  function highlights(g) {
    var out = [];
    if (g.done.length) out.push('完成任务 ' + g.done.length + ' 项，投入实际工时 ' + g.hours + 'h，较上期' +
      (g.done.length >= g.donePrev.length ? '增加 ' + (g.done.length - g.donePrev.length) : '减少 ' + (g.donePrev.length - g.done.length)) + ' 项。');
    if (g.msHit.length) out.push('达成里程碑：' + g.msHit.map(function (m) { return m.name; }).join('、') + '。');
    if (g.dvDone.length) out.push('完成交付物验收 ' + g.dvDone.length + ' 项：' + g.dvDone.slice(0, 3).map(function (d) { return d.name; }).join('、') + (g.dvDone.length > 3 ? ' 等' : '') + '。');
    if (g.cgOk.length) out.push('完成变更审批 ' + g.cgOk.length + ' 条，工期影响累计 ' + U.sum(g.cgOk, 'impactDays') + ' 天，已同步至计划。');
    if (g.cxDone.length) out.push('闭环跨部门协同事项 ' + g.cxDone.length + ' 项。');
    if (g.phase) out.push('当前处于「' + g.phase.name + '」阶段，阶段进度 ' + Math.round((g.phase.progress || 0) * 100) + '%。');
    if (!out.length) out.push('本期无已完成任务与里程碑记录，建议核对任务状态是否及时更新。');
    return out;
  }
  function risklist(g) {
    var out = [];
    if (g.rkHigh.length) out.push('高等级未闭环风险 ' + g.rkHigh.length + ' 项：' + g.rkHigh.slice(0, 3).map(function (r) { return r.title; }).join('；') + '。');
    if (g.delay.length) out.push('延期任务 ' + g.delay.length + ' 项，最长延期 ' + U.max(g.delay, 'delayDays') + ' 天，需重排负责人与截止时间。');
    if (g.block.length) out.push('阻塞任务 ' + g.block.length + ' 项，责任人：' + U.uniq(g.block.map(function (t) { return t.owner; })).slice(0, 4).join('、') + '，需在例会上协调解除。');
    if (g.msMiss.length) out.push('里程碑延期 ' + g.msMiss.length + ' 个：' + g.msMiss.map(function (m) { return m.name; }).join('、') + '。');
    if (g.cgPend.length) out.push('待处理变更 ' + g.cgPend.length + ' 条未闭环，范围口径存在不确定性。');
    if (g.cxOpen.length) out.push('未闭环跨部门事项 ' + g.cxOpen.length + ' 项，其中逾期 ' + g.cxOpen.filter(function (c) { return c.overdue; }).length + ' 项。');
    if (g.gap < -5) out.push('实际进度 ' + g.prog + '% 落后计划 ' + Math.abs(g.gap) + ' 个百分点，需评估是否重新基线化。');
    if (!out.length) out.push('本期无重大风险与阻塞，整体推进符合预期。');
    return out;
  }
  function nextplan(g) {
    var out = [];
    if (g.nextDue.length) out.push('推进 ' + g.nextDue.length + ' 项到期任务：' + g.nextDue.slice(0, 4).map(function (t) { return U.ellip(t.title, 14); }).join('、') + (g.nextDue.length > 4 ? ' 等' : '') + '。');
    if (g.msNext.length) out.push('冲刺里程碑：' + g.msNext.map(function (m) { return m.name + '（' + m.date + '）'; }).join('、') + '。');
    if (g.delay.length) out.push('清理 ' + g.delay.length + ' 项延期任务，逐条确认新的完成日期。');
    if (g.dvWait.length) out.push('组织 ' + g.dvWait.length + ' 项交付物验收：' + g.dvWait.slice(0, 3).map(function (d) { return d.name; }).join('、') + '。');
    if (g.cgPend.length) out.push('完成 ' + g.cgPend.length + ' 条变更的评估与审批决策。');
    if (g.rkHigh.length) out.push('针对 ' + g.rkHigh.length + ' 项高风险落实应对措施并更新跟踪记录。');
    if (!out.length) out.push('保持当前节奏，按计划推进各阶段任务。');
    return out;
  }
  function needs(g) {
    var out = [];
    g.cxOpen.slice(0, 6).forEach(function (c) {
      out.push('【' + c.toDept + '】' + c.title + '（' + c.priority + '，要求 ' + c.dueAt + ' 前' + (c.overdue ? '，已逾期' : '') + '）');
    });
    if (g.block.length) out.push('【项目管理办公室】协调解除 ' + g.block.length + ' 项阻塞任务，涉及 ' + U.uniq(g.block.map(function (t) { return t.dept; })).join('、') + '。');
    if (!out.length) out.push('本期无需上级或跨部门额外支持。');
    return out;
  }

  /* ==========================================================
   * 报告正文（页面内预览 + Word 复用同一份结构）
   * ======================================================== */
  function preview(g) {
    var kn = g.kind === 'weekly' ? '周报' : '月报';
    var h = '';

    h += UI.grid(4, [
      UI.metric({ label: '本期完成任务', val: g.done.length, unit: '项', sub: '上期 ' + g.donePrev.length + ' 项', tone: g.done.length >= g.donePrev.length ? 'done' : 'warn', ico: '✓' }),
      UI.metric({ label: '项目进度', val: g.prog, unit: '%', sub: '计划 ' + g.planProg + '%，偏差 ' + (g.gap >= 0 ? '+' : '') + g.gap + 'pt', tone: g.gap >= 0 ? 'done' : (g.gap > -8 ? 'warn' : 'danger'), ico: '◔' }),
      UI.metric({ label: '延期 / 阻塞', val: g.delay.length + ' / ' + g.block.length, sub: '在办任务共 ' + g.open.length + ' 项', tone: (g.delay.length + g.block.length) ? 'danger' : 'done', ico: '⚠' }),
      UI.metric({ label: '未闭环风险', val: g.rkOpen.length, unit: '项', sub: '其中高等级 ' + g.rkHigh.length + ' 项', tone: g.rkHigh.length ? 'danger' : 'done', ico: '⛑' })
    ].join(''));

    h += P.gap(4);
    h += UI.card({
      title: kn + '正文预览', sub: g.proj.name + ' · ' + g.p.text + '（' + g.p.label + '）',
      extra: '<span class="tag tag-accent">自动汇总</span>',
      body:
        UI.sec('一、整体结论',
          '<div class="rich"><p>' + E(conclusion(g)) + '</p></div>') +
        UI.sec('二、本期进展', ul(highlights(g))) +
        UI.sec('三、里程碑与交付', UI.dl([
          ['本期达成里程碑', g.msHit.length ? E(g.msHit.map(function (m) { return m.name; }).join('、')) : '<span class="muted">无</span>'],
          ['延期里程碑', g.msMiss.length ? '<span style="color:var(--s-danger)">' + E(g.msMiss.map(function (m) { return m.name + '（原定 ' + m.date + '）'; }).join('、')) + '</span>' : '<span class="muted">无</span>'],
          ['完成验收交付物', g.dvDone.length + ' 项'],
          ['待验收交付物', g.dvWait.length + ' 项'],
          ['本期变更', '新增 ' + g.cgNew.length + ' 条 · 批准 ' + g.cgOk.length + ' 条 · 待处理 ' + g.cgPend.length + ' 条']
        ], 'dl-2col')) +
        UI.sec('四、风险与问题', ul(risklist(g))) +
        UI.sec('五、下期计划', ul(nextplan(g))) +
        UI.sec('六、需协调事项', ul(needs(g)))
    });
    return h;
  }
  function ul(list) {
    return '<div class="rich"><ul>' + list.map(function (x) { return '<li>' + E(x) + '</li>'; }).join('') + '</ul></div>';
  }
  function conclusion(g) {
    var kn = g.kind === 'weekly' ? '本周' : '本月';
    var s = kn + '共完成任务 ' + g.done.length + ' 项，项目整体进度 ' + g.prog + '%（计划 ' + g.planProg + '%），';
    s += g.gap >= 0 ? '进度符合或优于计划；' : '进度落后计划 ' + Math.abs(g.gap) + ' 个百分点；';
    s += '当前存在延期任务 ' + g.delay.length + ' 项、阻塞任务 ' + g.block.length + ' 项、未闭环风险 ' + g.rkOpen.length + ' 项（高等级 ' + g.rkHigh.length + ' 项）。';
    s += g.rkHigh.length || g.block.length
      ? '需重点关注高风险与阻塞事项的闭环，必要时在项目周会上升级处理。'
      : '整体交付节奏可控，按既定计划推进即可。';
    return s;
  }

  /* ==========================================================
   * 子页渲染（weekly / monthly 共用）
   * ======================================================== */
  function page(kind, ctx) {
    var kn = kind === 'weekly' ? '周报' : '月报';
    var pfx = kind === 'weekly' ? 'rw' : 'rm';
    var DEF = kind === 'weekly' ? DEF_W : DEF_M;
    var key = MOD + '.' + kind;

    var hist = S.reports().filter(function (r) { return r.type === kn; });
    var f = P.flt(key, DEF);
    var rows = hist.filter(function (r) {
      if (f.status && r.status !== f.status) return false;
      if (f.author && r.author !== f.author) return false;
      if (f.kw) {
        var k = f.kw.toLowerCase();
        if ((r.id + r.period + r.periodText + r.author + r.projectName + r.summary).toLowerCase().indexOf(k) < 0) return false;
      }
      return true;
    });

    var off = +(S.pref(key, 'off', 0) || 0);
    var g = digest(kind, off);

    var h = P.head({
      mod: MOD, title: kn,
      desc: kind === 'weekly'
        ? '按自然周自动汇总任务完成、里程碑达成、风险与阻塞、变更与验收情况，一键生成可提交的周报，无需手工誊抄。'
        : '按自然月汇总项目整体进展与偏差，形成月度汇报底稿，可直接导出 Word 或打印为 PDF。',
      acts: '<button class="btn" id="' + pfx + 'Print">打印 / 导出 PDF</button>' +
        '<button class="btn" id="' + pfx + 'Csv">导出历史 CSV</button>' +
        '<button class="btn-primary" id="' + pfx + 'Word">导出' + kn + ' Word</button>'
    });
    h += P.permTip(MOD);

    /* 期间切换 */
    h += '<div class="toolbar" id="' + pfx + 'Per">' +
      '<span class="muted tiny">报告期间</span>' +
      P.sel('off', '', periodOpts(kind), String(off)) +
      '<span class="tag tag-plain">' + E(g.p.text) + '</span>' +
      '<span class="tag tag-plain">' + E(g.proj.name || '未选择项目') + '</span>' +
      '<span class="grow"></span>' +
      '<span class="muted tiny">数据实时取自任务 / 里程碑 / 风险 / 变更 / 交付 / 协同，切换项目后自动重算</span>' +
      '</div>';
    h += P.gap(3);

    h += '<div id="' + pfx + 'Body">' + preview(g) + '</div>';

    /* 图表 */
    h += P.gap(4);
    h += UI.grid(2,
      UI.card({ title: '近 8 期任务完成趋势', sub: '按' + (kind === 'weekly' ? '周' : '月') + '统计已完成任务数与实际工时', body: P.chart(pfx + 'Trend', 260) }) +
      UI.card({ title: '本期任务构成', sub: '按职能类型分布', body: P.chart(pfx + 'Type', 260) })
    );

    /* 历史报告 */
    h += P.gap(4);
    h += '<div class="toolbar" id="' + pfx + 'Flt">' +
      '<input class="fld" data-f="kw" placeholder="搜索历史' + kn + ' / 期间 / 编制人" value="' + E(f.kw) + '" style="min-width:240px">' +
      P.sel('status', '全部状态', ST, f.status) +
      P.sel('author', '全部编制人', U.uniq(hist.map(function (r) { return r.author; })), f.author) +
      '<button class="btn-ghost" data-reset>重置</button>' +
      '</div>';
    h += '<div id="' + pfx + 'Tbl"></div>';

    ctx.el.innerHTML = h;

    /* --- 趋势图 --- */
    var seq = [];
    for (var i = 7; i >= 0; i--) seq.push(digestLite(kind, off - i));
    CH.line(pfx + 'Trend', {
      labels: seq.map(function (x) { return x.text; }),
      series: [
        { name: '完成任务（项）', type: 'bar', color: CH.TONE.doing, data: seq.map(function (x) { return x.n; }) },
        { name: '投入人日（d）', color: CH.TONE.warn, data: seq.map(function (x) { return Math.round(x.h / 8); }) }
      ],
      height: 260, xEvery: 1
    });

    var byType = U.countBy(g.done, 'type');
    var tk = Object.keys(byType);
    if (tk.length) {
      CH.donut(pfx + 'Type', {
        data: tk.map(function (k) { return { name: k, value: byType[k] }; }),
        height: 260, center: { l: '完成', v: g.done.length }
      });
    } else {
      P.$(pfx + 'Type').innerHTML = UI.empty('本期暂无已完成任务');
    }

    /* --- 历史表 --- */
    UI.table(ctx.el.querySelector('#' + pfx + 'Tbl'), {
      cols: [
        { k: 'id', t: '编号', w: '76px', render: function (r) { return UI.idCell(r.id); } },
        { k: 'period', t: '期间', w: '110px', render: function (r) { return UI.cell2(E(r.period), E(r.periodText)); } },
        { k: 'projectName', t: '项目', w: '160px' },
        { k: 'author', t: '编制人', w: '100px', render: function (r) { return UI.owner(r.author); } },
        { k: 'createAt', t: '编制日期', w: '100px' },
        {
          k: 'progress', t: '期末进度', w: '130px', align: 'right',
          render: function (r) {
            var d = r.progress - r.planProgress;
            return '<b>' + r.progress + '%</b><div class="muted tiny">计划 ' + r.planProgress + '% · ' +
              (d >= 0 ? '<span style="color:var(--s-done)">+' : '<span style="color:var(--s-danger)">') + d + 'pt</span></div>';
          }
        },
        { k: 'doneCount', t: '完成', w: '72px', align: 'right' },
        { k: 'openCount', t: '在办', w: '72px', align: 'right' },
        { k: 'delayCount', t: '延期', w: '72px', align: 'right', render: function (r) { return r.delayCount ? '<b style="color:var(--s-danger)">' + r.delayCount + '</b>' : '<span class="muted">0</span>'; } },
        { k: 'riskCount', t: '风险', w: '72px', align: 'right', render: function (r) { return r.riskCount ? '<b style="color:var(--s-warn)">' + r.riskCount + '</b>' : '<span class="muted">0</span>'; } },
        { k: 'status', t: '状态', w: '90px', render: function (r) { return UI.st('status', r.status); } },
        {
          k: 'act', t: '操作', w: '96px', align: 'right', sortable: false,
          render: function () { return '<div class="row-acts"><button class="btn-sm" data-act="view">查看</button></div>'; }
        }
      ],
      rows: rows, pageSize: 10, sort: { k: 'createAt', desc: true }, select: true,
      rowCls: function (r) { return r.status === '草稿' ? 'row-warn' : ''; },
      onRow: openReport, onAct: function (act, r) { openReport(r); },
      empty: UI.empty('暂无历史' + kn, '<button class="btn" data-reset2>清空筛选条件</button>'),
      bulk: [{ t: '导出所选', fn: function (picked) { csv(kn, picked); } }],
      footNote: '状态为「草稿」的报告标黄，表示尚未提交给上级'
    });

    var r2 = ctx.el.querySelector('[data-reset2]');
    if (r2) r2.addEventListener('click', function () { P.setFlt(key, Object.assign({}, DEF)); Shell.route(); });
    P.bindFlt(ctx.el.querySelector('#' + pfx + 'Flt'), key, DEF, function () { Shell.route(); });

    var perSel = ctx.el.querySelector('#' + pfx + 'Per [data-f="off"]');
    if (perSel) perSel.addEventListener('change', function () {
      S.setPref(key, 'off', +perSel.value || 0);
      Shell.route();
    });

    P.$(pfx + 'Print').onclick = function () { U.printPage(); };
    P.$(pfx + 'Csv').onclick = function () { csv(kn, rows); };
    P.$(pfx + 'Word').onclick = function () { word(g); };
  }

  function periodOpts(kind) {
    var out = [];
    for (var i = 0; i >= -7; i--) {
      var p = periodOf(kind, i);
      out.push({ v: String(i), t: p.text + (i === 0 ? '（本期）' : '') });
    }
    return out;
  }

  /* 轻量汇总：只算完成任务数与工时，供趋势图使用 */
  function digestLite(kind, off) {
    var p = periodOf(kind, off);
    var done = S.tasks().filter(function (t) { return t.status === '已完成' && inP(t.doneAt, p); });
    return {
      text: kind === 'weekly' ? U.fmtMD(p.from) : U.fmtDate(p.from, 'YYYY-MM'),
      n: done.length, h: U.sum(done, 'realHours')
    };
  }

  /* ==========================================================
   * 历史报告详情抽屉
   * ======================================================== */
  function openReport(r) {
    var body = P.hero({
      title: E(r.type + ' · ' + r.periodText), id: r.id,
      meta: [
        ['项目', E(r.projectName)],
        ['期间', E(r.period)],
        ['编制人', E(r.author)],
        ['编制日期', E(r.createAt)],
        ['状态', UI.st('status', r.status)]
      ]
    });

    body += UI.sec('整体结论', '<div class="rich"><p>' + E(r.summary) + '</p></div>');
    body += UI.sec('关键数据', UI.dl([
      ['期末进度', r.progress + '%（计划 ' + r.planProgress + '%）'],
      ['完成任务', r.doneCount + ' 项'],
      ['在办任务', r.openCount + ' 项'],
      ['延期任务', r.delayCount + ' 项'],
      ['风险数量', r.riskCount + ' 项']
    ], 'dl-2col'));
    body += UI.sec('本期进展', ul(r.highlights || []));
    body += UI.sec('风险与问题', ul(r.risks || []));
    body += UI.sec('下期计划', ul(r.nextPlan || []));

    var d = UI.drawer({
      title: E(r.type + ' ' + r.period), sub: E(r.projectName + ' · ' + r.periodText),
      body: body, wide: true,
      foot: '<button class="btn" data-close>关闭</button>' +
        '<button class="btn-primary" id="rpWord">导出 Word</button>'
    });
    d.el.querySelector('#rpWord').onclick = function () {
      P.word('report-' + r.id, r.type + '｜' + r.projectName + '｜' + r.periodText, [
        { h: '一、整体结论', p: r.summary },
        { h: '二、关键数据', kv: [
          ['报告期间', r.period + '（' + r.periodText + '）'],
          ['项目', r.projectName], ['编制人', r.author], ['编制日期', r.createAt],
          ['期末进度', r.progress + '%'], ['计划进度', r.planProgress + '%'],
          ['完成任务', r.doneCount + ' 项'], ['在办任务', r.openCount + ' 项'],
          ['延期任务', r.delayCount + ' 项'], ['风险数量', r.riskCount + ' 项']
        ] },
        { h: '三、本期进展', list: r.highlights || [] },
        { h: '四、风险与问题', list: r.risks || [] },
        { h: '五、下期计划', list: r.nextPlan || [] }
      ], ['报告状态：' + r.status]);
      UI.toast('已导出 ' + r.id, 'ok');
    };
  }

  /* ==========================================================
   * 导出
   * ======================================================== */
  function csv(kn, rows) {
    P.csv(kn === '周报' ? 'weekly-reports' : 'monthly-reports', rows, [
      { label: '编号', key: 'id' }, { label: '类型', key: 'type' },
      { label: '期间', key: 'period' }, { label: '期间说明', key: 'periodText' },
      { label: '项目', key: 'projectName' }, { label: '编制人', key: 'author' },
      { label: '编制日期', key: 'createAt' }, { label: '状态', key: 'status' },
      { label: '期末进度%', key: 'progress' }, { label: '计划进度%', key: 'planProgress' },
      { label: '完成任务', key: 'doneCount' }, { label: '在办任务', key: 'openCount' },
      { label: '延期任务', key: 'delayCount' }, { label: '风险数量', key: 'riskCount' },
      { label: '整体结论', key: 'summary' }
    ]);
  }

  function word(g) {
    var kn = g.kind === 'weekly' ? '周报' : '月报';
    P.word(
      (g.kind === 'weekly' ? 'weekly' : 'monthly') + '-' + g.p.label,
      g.proj.name + '｜项目' + kn + '｜' + g.p.text,
      [
        { h: '一、整体结论', p: conclusion(g) },
        { h: '二、关键数据', kv: [
          ['报告期间', g.p.text + '（' + g.p.label + '）'],
          ['项目', g.proj.name], ['项目经理', g.proj.pm || '—'],
          ['当前阶段', g.phase ? g.phase.name : '—'],
          ['实际进度', g.prog + '%'], ['计划进度', g.planProg + '%'],
          ['进度偏差', (g.gap >= 0 ? '+' : '') + g.gap + ' 个百分点'],
          ['本期完成任务', g.done.length + ' 项（上期 ' + g.donePrev.length + ' 项）'],
          ['本期投入工时', g.hours + ' h'],
          ['在办任务', g.open.length + ' 项'],
          ['延期任务', g.delay.length + ' 项'], ['阻塞任务', g.block.length + ' 项'],
          ['未闭环风险', g.rkOpen.length + ' 项（高 ' + g.rkHigh.length + ' 项）'],
          ['本期变更', '新增 ' + g.cgNew.length + ' 条 / 批准 ' + g.cgOk.length + ' 条 / 待处理 ' + g.cgPend.length + ' 条'],
          ['交付验收', '本期验收 ' + g.dvDone.length + ' 项 / 待验收 ' + g.dvWait.length + ' 项']
        ] },
        { h: '三、本期进展', list: highlights(g) },
        { h: '四、本期完成任务明细', table: {
          cols: [
            { t: '任务', get: function (t) { return t.title; } },
            { t: '类型', k: 'type' }, { t: '负责人', k: 'owner' },
            { t: '完成日期', k: 'doneAt' },
            { t: '预估/实际工时', get: function (t) { return t.estHours + 'h / ' + t.realHours + 'h'; } }
          ],
          rows: g.done
        } },
        { h: '五、里程碑与交付' },
        { h3: '5.1 本期里程碑', list: g.msHit.map(function (m) { return '【达成】' + m.name + '（' + m.date + '）'; })
          .concat(g.msMiss.map(function (m) { return '【延期】' + m.name + '（原定 ' + m.date + '）'; }))
          .concat(g.msHit.length || g.msMiss.length ? [] : ['本期无里程碑节点。']) },
        { h3: '5.2 下期里程碑', list: g.msNext.length
          ? g.msNext.map(function (m) { return m.name + '，计划 ' + m.date + '，负责人 ' + m.owner; })
          : ['下期无里程碑节点。'] },
        { h3: '5.3 交付物验收', table: {
          cols: [
            { t: '交付物', k: 'name' }, { t: '类型', k: 'type' }, { t: '责任人', k: 'owner' },
            { t: '状态', k: 'status' }, { t: '计划日期', k: 'planDate' }, { t: '验收人', k: 'acceptBy' }
          ],
          rows: g.dvDone.concat(g.dvWait)
        } },
        { h: '六、风险与问题', list: risklist(g) },
        { h3: '6.1 未闭环风险清单', table: {
          cols: [
            { t: '编号', k: 'id' }, { t: '风险', k: 'title' }, { t: '等级', k: 'level' },
            { t: '状态', k: 'status' }, { t: '负责人', k: 'owner' }, { t: '截止', k: 'dueAt' },
            { t: '应对', k: 'response' }
          ],
          rows: g.rkOpen
        } },
        { h3: '6.2 延期与阻塞任务', table: {
          cols: [
            { t: '任务', k: 'title' }, { t: '状态', k: 'status' }, { t: '负责人', k: 'owner' },
            { t: '截止', k: 'due' }, { t: '延期天数', get: function (t) { return t.delayDays || 0; } }
          ],
          rows: g.delay.concat(g.block.filter(function (t) { return !t.overdue; }))
        } },
        { h: '七、下期计划', list: nextplan(g) },
        { h: '八、需协调事项', list: needs(g) },
        { h: '九、说明', list: [
          '本报告由「产品管理工作台 · 周报月报」模块按当前项目口径自动汇总生成，数据实时取自任务、里程碑、风险、变更、交付与跨部门协同记录。',
          '如需补充人工说明，可在导出的 Word 文档中直接编辑后再行提交。'
        ] }
      ],
      ['报告期间：' + g.p.text, '生成日期：' + U.fmtDate(S.TODAY)]
    );
    UI.toast(kn + '已导出', 'ok');
  }

  Shell.page(MOD, {
    render: function (ctx) {
      if (ctx.sub === 'monthly') page('monthly', ctx);
      else page('weekly', ctx);
    }
  });
})();
