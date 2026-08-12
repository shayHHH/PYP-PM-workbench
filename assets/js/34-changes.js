/* ============================================================
 * 34-changes.js  需求变更（项目经理专属）
 * 子页：list 变更申请 / impact 影响评估
 * ========================================================== */
(function () {
  'use strict';
  var E = U.esc, MOD = 'changes';

  var DEF_L = { kw: '', status: '', reason: '', risk: '', applicant: '', flag: '' };
  var DEF_I = { reason: '', risk: '', status: '' };

  var ST_ALL = ['草稿', '待审批', '评估中', '已批准', '已驳回', '已实施'];
  var ST_FLOW = ['草稿', '待审批', '评估中', '已批准', '已实施'];
  var RISK = ['高', '中', '低'];

  function pending(c) { return ['草稿', '待审批', '评估中'].indexOf(c.status) >= 0; }
  function approved(c) { return ['已批准', '已实施'].indexOf(c.status) >= 0; }
  function riskTone(r) { return C.tone('level', r); }

  function apply(list, f) {
    return list.filter(function (c) {
      if (f.status && c.status !== f.status) return false;
      if (f.reason && c.reason !== f.reason) return false;
      if (f.risk && c.impactRisk !== f.risk) return false;
      if (f.applicant && c.applicant !== f.applicant) return false;
      if (f.flag === 'pending' && !pending(c)) return false;
      if (f.flag === 'heavy' && !(c.impactDays >= 5 || c.impactRisk === '高')) return false;
      if (f.kw) {
        var k = f.kw.toLowerCase();
        if ((c.id + c.title + c.reqTitle + c.applicant + c.approver + c.projectName).toLowerCase().indexOf(k) < 0) return false;
      }
      return true;
    });
  }

  function cards(all) {
    var pd = all.filter(pending);
    var ap = all.filter(approved);
    var days = U.sum(ap, 'impactDays');
    return P.statCards([
      { label: '变更申请', val: all.length, unit: '条', sub: '本项目累计提交', ico: '⇄' },
      { label: '待处理', val: pd.length, unit: '条', sub: pd.length ? '需在本周评审会上闭环' : '当前无待处理变更', tone: pd.length ? 'warn' : 'done', ico: '⏳' },
      { label: '已批准工期影响', val: days, unit: '天', sub: '累计顺延，含已实施变更', tone: days > 20 ? 'danger' : (days > 8 ? 'warn' : 'done'), ico: '📅' },
      { label: '批准率', val: U.pct(ap.length, all.filter(function (c) { return c.status !== '草稿'; }).length), unit: '%', sub: '驳回 ' + all.filter(function (c) { return c.status === '已驳回'; }).length + ' 条', ico: '✓' }
    ]);
  }

  /* ==========================================================
   * 子页一：变更申请
   * ======================================================== */
  function list(ctx) {
    var all = S.changes();
    var f = P.flt(MOD, DEF_L);
    var rows = apply(all, f);
    var pd = all.filter(pending);

    var h = P.head({
      mod: MOD, title: '变更申请',
      desc: '记录项目范围、工期、验收标准的变更全流程：申请 → 影响评估 → 审批 → 实施。所有变更均留痕，可追溯发起人与审批意见。',
      acts: '<button class="btn" data-go2="impact">影响评估</button>' +
        '<button class="btn" id="cgCsv">导出 CSV</button>' +
        '<button class="btn" id="cgWord">导出变更台账</button>' +
        P.createBtn(MOD, 'change.new', '提交变更')
    });
    h += P.permTip(MOD);
    h += cards(all);

    if (pd.length) {
      h += P.gap(3);
      h += UI.notice('warn',
        '有 <b>' + pd.length + '</b> 条变更处于「草稿 / 待审批 / 评估中」，其中 ' +
        pd.filter(function (c) { return c.impactRisk === '高'; }).length +
        ' 条为高影响变更。变更未闭环会导致范围与排期口径不一致，建议在项目周会上集中处理。', '⚠');
    }

    h += P.gap(4);
    h += UI.grid(3,
      UI.card({ title: '审批状态分布', sub: '点击扇区筛选', body: P.chart('cgPie', 240) }) +
      UI.card({ title: '变更原因排行', sub: '点击柱条筛选原因', body: P.chart('cgReason', 240) }) +
      UI.card({ title: '审批流转', sub: '各环节滞留数量', body: P.chart('cgFlow', 240) })
    );

    h += P.gap(4);
    h += '<div class="toolbar" id="cgFlt">' +
      '<input class="fld" data-f="kw" placeholder="搜索变更 / 编号 / 关联需求 / 申请人" value="' + E(f.kw) + '" style="min-width:250px">' +
      P.sel('status', '全部状态', ST_ALL, f.status) +
      P.sel('reason', '全部变更原因', C.DICT.changeReason, f.reason) +
      P.sel('risk', '全部影响等级', RISK, f.risk) +
      P.sel('applicant', '全部申请人', U.uniq(all.map(function (c) { return c.applicant; })), f.applicant) +
      P.sel('flag', '不限', [{ v: 'pending', t: '仅待处理' }, { v: 'heavy', t: '仅高影响' }], f.flag) +
      '<button class="btn-ghost" data-reset>重置</button>' +
      '</div>';
    h += '<div id="cgTbl"></div>';

    ctx.el.innerHTML = h;

    var byS = U.countBy(all, 'status');
    CH.donut('cgPie', {
      data: ST_ALL.filter(function (s) { return byS[s]; }).map(function (s) {
        return { name: s, value: byS[s], color: CH.TONE[C.tone('status', s)] };
      }),
      height: 240, center: { l: '变更', v: all.length },
      onClick: function (i, d) { setF(DEF_L, 'status', d.name); }
    });

    var byR = U.countBy(all, 'reason');
    var rKeys = Object.keys(byR).sort(function (a, b) { return byR[b] - byR[a]; });
    CH.bars('cgReason', {
      data: rKeys.map(function (k) { return { label: k, value: byR[k], text: byR[k] + ' 条' }; }),
      onClick: function (i) { setF(DEF_L, 'reason', rKeys[i]); }
    });

    CH.bar('cgFlow', {
      labels: ST_FLOW, height: 240,
      series: [{
        name: '变更数', color: CH.TONE.doing,
        data: ST_FLOW.map(function (s) { return byS[s] || 0; })
      }],
      onClick: function (i) { setF(DEF_L, 'status', ST_FLOW[i]); }
    });

    UI.table(ctx.el.querySelector('#cgTbl'), {
      cols: [
        { k: 'id', t: '编号', w: '76px', render: function (r) { return UI.idCell(r.id); } },
        { k: 'title', t: '变更内容', w: '270px', render: function (r) { return UI.cell2(E(r.title), '关联需求 ' + E(r.reqId) + ' · ' + E(U.ellip(r.reqTitle, 16))); } },
        { k: 'reason', t: '变更原因', w: '120px', render: function (r) { return UI.tag(r.reason, 'plan'); } },
        { k: 'applicant', t: '申请人', w: '100px', render: function (r) { return UI.owner(r.applicant); } },
        { k: 'applyAt', t: '申请日期', w: '100px' },
        { k: 'impactDays', t: '工期影响', w: '92px', align: 'right', render: function (r) { return r.impactDays ? '<b>+' + r.impactDays + '</b><span class="muted tiny">天</span>' : '<span class="muted">—</span>'; } },
        { k: 'impactCost', t: '成本影响', w: '92px', align: 'right', render: function (r) { return r.impactCost ? '<b>+' + r.impactCost + '</b><span class="muted tiny">人日</span>' : '<span class="muted">—</span>'; } },
        { k: 'impactRisk', t: '影响等级', w: '92px', sortVal: function (r) { return RISK.indexOf(r.impactRisk); }, render: function (r) { return UI.light(C.tone('light', r.impactRisk), r.impactRisk); } },
        { k: 'approver', t: '审批人', w: '100px', render: function (r) { return UI.owner(r.approver); } },
        { k: 'status', t: '状态', w: '90px', render: function (r) { return UI.st('status', r.status); } },
        {
          k: 'act', t: '操作', w: '150px', align: 'right', sortable: false,
          render: function (r) {
            return '<div class="row-acts"><button class="btn-sm" data-act="view">详情</button>' +
              (P.ed(MOD) && pending(r) ? '<button class="btn-sm" data-act="ok">批准</button><button class="btn-sm" data-act="no">驳回</button>' : '') +
              '</div>';
          }
        }
      ],
      rows: rows, pageSize: 15, sort: { k: 'applyAt', desc: true }, select: true,
      rowCls: function (r) {
        if (r.status === '已驳回') return 'row-done';
        if (r.impactRisk === '高' && pending(r)) return 'row-danger';
        if (pending(r)) return 'row-warn';
        return '';
      },
      onRow: openChange,
      onAct: function (act, r) {
        if (act === 'ok') decide(r, true);
        else if (act === 'no') decide(r, false);
        else openChange(r);
      },
      empty: UI.empty('没有符合条件的变更申请', '<button class="btn" data-reset2>清空筛选条件</button>'),
      bulk: [{ t: '导出所选', fn: function (picked) { csv(picked); } }],
      footNote: '高影响且未闭环的变更标红，待处理变更标黄，已驳回变更淡化显示'
    });

    var r2 = ctx.el.querySelector('[data-reset2]');
    if (r2) r2.addEventListener('click', function () { P.setFlt(MOD, Object.assign({}, DEF_L)); Shell.route(); });
    P.bindFlt(ctx.el.querySelector('#cgFlt'), MOD, DEF_L, function () { Shell.route(); });
    ctx.el.querySelector('[data-go2]').onclick = function () { Shell.go(MOD, 'impact'); };
    P.$('cgCsv').onclick = function () { csv(rows); };
    P.$('cgWord').onclick = function () { word(all, pd); };
  }

  function setF(def, k, v) {
    var f = P.flt(MOD, def);
    f[k] = f[k] === v ? '' : v;
    P.setFlt(MOD, f);
    Shell.route();
  }

  /* ==========================================================
   * 子页二：影响评估
   * ======================================================== */
  function impact(ctx) {
    var all = S.changes();
    var f = P.flt(MOD, DEF_I);
    var rows = all.filter(function (c) {
      if (f.reason && c.reason !== f.reason) return false;
      if (f.risk && c.impactRisk !== f.risk) return false;
      if (f.status && c.status !== f.status) return false;
      return true;
    });

    var ap = all.filter(approved);
    var pd = all.filter(pending);
    var days = U.sum(ap, 'impactDays');
    var cost = U.sum(ap, 'impactCost');
    var pdDays = U.sum(pd, 'impactDays');
    var proj = S.curProject();
    var base = Math.max(1, U.dayDiff(proj.start, proj.end));

    var h = P.head({
      mod: MOD, title: '影响评估',
      desc: '量化变更对工期、成本与范围的累计影响，用于判断是否需要重新基线化项目计划。',
      acts: '<button class="btn" data-go2="list">回到变更申请</button>' +
        '<button class="btn" id="ciWord">导出影响评估报告</button>' +
        '<button class="btn" id="ciPrint">打印</button>'
    });
    h += P.permTip(MOD);
    h += P.statCards([
      { label: '已批准工期影响', val: days, unit: '天', sub: '占原计划工期 ' + U.pct(days, base) + '%', tone: U.pct(days, base) > 10 ? 'danger' : 'warn', ico: '📅' },
      { label: '已批准成本影响', val: cost, unit: '人日', sub: '约合 ' + Math.round(cost / 5) + ' 人周', ico: '💰' },
      { label: '待定影响', val: pdDays, unit: '天', sub: pd.length + ' 条变更尚未审批完成', tone: pdDays ? 'warn' : 'done', ico: '⏳' },
      { label: '高影响变更', val: all.filter(function (c) { return c.impactRisk === '高'; }).length, unit: '条', sub: '需重点评估基线是否调整', tone: 'danger', ico: '⚠' }
    ]);

    h += P.gap(3);
    h += UI.notice(U.pct(days, base) > 10 ? 'danger' : 'info',
      '当前项目原计划工期 <b>' + base + '</b> 天（' + E(proj.start) + ' 至 ' + E(proj.end) + '），已批准变更累计顺延 <b>' + days + '</b> 天，' +
      '待审批变更潜在再增加 <b>' + pdDays + '</b> 天。' +
      (U.pct(days + pdDays, base) > 10
        ? '累计影响已超过原计划的 10%，建议启动<b>计划重新基线化</b>，并同步更新里程碑与交付承诺。'
        : '累计影响仍在可吸收范围内，按现有缓冲消化即可。'));

    h += P.gap(4);
    h += UI.grid(2,
      UI.card({ title: '工期与成本影响对比', sub: '按变更原因汇总，点击柱条筛选', body: P.chart('ciCmp', 280) }) +
      UI.card({ title: '影响等级 × 审批状态', sub: '堆叠展示各等级变更的处理进度', body: P.chart('ciRisk', 280) })
    );

    h += P.gap(4);
    h += UI.grid(2,
      UI.card({ title: '工期影响 TOP8', sub: '点击查看变更详情', body: P.chart('ciTop', 260) }) +
      UI.card({
        title: '范围影响面', sub: '按影响描述归类', body: P.chart('ciScope', 260)
      })
    );

    h += P.gap(4);
    h += '<div class="toolbar" id="ciFlt">' +
      P.sel('reason', '全部变更原因', C.DICT.changeReason, f.reason) +
      P.sel('risk', '全部影响等级', RISK, f.risk) +
      P.sel('status', '全部状态', ST_ALL, f.status) +
      '<button class="btn-ghost" data-reset>重置</button>' +
      '<span class="muted tiny" style="margin-left:auto">合计工期影响 ' + U.sum(rows, 'impactDays') + ' 天 · 成本影响 ' + U.sum(rows, 'impactCost') + ' 人日</span>' +
      '</div>';
    h += '<div id="ciTbl"></div>';

    ctx.el.innerHTML = h;

    var byR = U.group(all, 'reason');
    var rKeys = Object.keys(byR);
    CH.bar('ciCmp', {
      labels: rKeys.map(function (k) { return U.ellip(k, 6); }), height: 280,
      series: [
        { name: '工期影响(天)', data: rKeys.map(function (k) { return U.sum(byR[k], 'impactDays'); }), color: CH.TONE.warn },
        { name: '成本影响(人日)', data: rKeys.map(function (k) { return U.sum(byR[k], 'impactCost'); }), color: CH.TONE.doing }
      ],
      onClick: function (i) { setF(DEF_I, 'reason', rKeys[i]); }
    });

    CH.bar('ciRisk', {
      labels: RISK, height: 280, stack: true,
      series: [
        { name: '待处理', color: CH.TONE.warn, data: RISK.map(function (r) { return all.filter(function (c) { return c.impactRisk === r && pending(c); }).length; }) },
        { name: '已批准', color: CH.TONE.done, data: RISK.map(function (r) { return all.filter(function (c) { return c.impactRisk === r && approved(c); }).length; }) },
        { name: '已驳回', color: CH.TONE.idle, data: RISK.map(function (r) { return all.filter(function (c) { return c.impactRisk === r && c.status === '已驳回'; }).length; }) }
      ],
      onClick: function (i) { setF(DEF_I, 'risk', RISK[i]); }
    });

    var top = all.slice().sort(function (a, b) { return b.impactDays - a.impactDays; }).slice(0, 8);
    CH.bars('ciTop', {
      data: top.map(function (c) {
        return {
          label: U.ellip(c.title, 14), value: c.impactDays,
          text: '+' + c.impactDays + ' 天 · ' + c.status,
          color: CH.TONE[riskTone(c.impactRisk)]
        };
      }),
      onClick: function (i) { openChange(top[i]); }
    });

    var byScope = U.countBy(all, 'impactScope');
    var sKeys = Object.keys(byScope).sort(function (a, b) { return byScope[b] - byScope[a]; });
    CH.bars('ciScope', {
      data: sKeys.map(function (k, i) { return { label: U.ellip(k, 12), value: byScope[k], text: byScope[k] + ' 条', color: CH.PAL[i % CH.PAL.length] }; })
    });

    UI.table(ctx.el.querySelector('#ciTbl'), {
      cols: [
        { k: 'id', t: '编号', w: '76px', render: function (r) { return UI.idCell(r.id); } },
        { k: 'title', t: '变更内容', w: '250px', render: function (r) { return UI.cell2(E(r.title), E(r.reason)); } },
        { k: 'impactScope', t: '影响范围', w: '200px', render: function (r) { return '<span class="muted">' + E(r.impactScope) + '</span>'; } },
        { k: 'impactDays', t: '工期影响', w: '110px', align: 'right', render: function (r) { return r.impactDays ? '<b style="color:var(--s-warn)">+' + r.impactDays + ' 天</b>' : '<span class="muted">无</span>'; } },
        { k: 'impactCost', t: '成本影响', w: '110px', align: 'right', render: function (r) { return r.impactCost ? '<b>+' + r.impactCost + ' 人日</b>' : '<span class="muted">无</span>'; } },
        { k: 'impactRisk', t: '影响等级', w: '92px', sortVal: function (r) { return RISK.indexOf(r.impactRisk); }, render: function (r) { return UI.light(C.tone('light', r.impactRisk), r.impactRisk); } },
        { k: 'status', t: '审批状态', w: '96px', render: function (r) { return UI.st('status', r.status); } },
        { k: 'opinion', t: '审批意见', w: '200px', render: function (r) { return r.opinion ? '<span class="muted">' + E(U.ellip(r.opinion, 20)) + '</span>' : '<span class="muted">—</span>'; } }
      ],
      rows: rows, pageSize: 15, sort: { k: 'impactDays', desc: true },
      rowCls: function (r) { return r.impactRisk === '高' ? 'row-danger' : (r.impactDays >= 5 ? 'row-warn' : ''); },
      onRow: openChange,
      empty: UI.empty('没有符合条件的变更'),
      footNote: '高影响变更标红；工期影响 ≥ 5 天标黄'
    });

    P.bindFlt(ctx.el.querySelector('#ciFlt'), MOD, DEF_I, function () { Shell.route(); });
    ctx.el.querySelector('[data-go2]').onclick = function () { Shell.go(MOD, 'list'); };
    P.$('ciPrint').onclick = function () { U.printPage(); };
    P.$('ciWord').onclick = function () { impactWord(all, ap, pd, proj, base, days, cost, pdDays); };
  }

  /* ==========================================================
   * 变更详情抽屉
   * ======================================================== */
  function openChange(c) {
    var body = P.hero({
      title: E(c.title), id: c.id,
      meta: [['关联需求', E(c.reqId)], ['变更原因', E(c.reason)], ['申请人', E(c.applicant)], ['申请日期', c.applyAt]],
      right: UI.st('status', c.status) + ' ' + UI.light(C.tone('light', c.impactRisk), c.impactRisk + '影响')
    });

    body += UI.sec('影响评估', P.kv([
      ['影响范围', E(c.impactScope)],
      ['影响等级', c.impactRisk],
      ['工期影响', c.impactDays ? '+' + c.impactDays + ' 天' : '无'],
      ['成本影响', c.impactCost ? '+' + c.impactCost + ' 人日' : '无'],
      ['关联需求', E(c.reqId + ' · ' + c.reqTitle)],
      ['所属项目', E(c.projectName)]
    ]));

    body += UI.sec('审批信息', P.kv([
      ['审批人', E(c.approver)],
      ['审批日期', c.approveAt || '—'],
      ['当前状态', c.status],
      ['审批意见', c.opinion ? E(c.opinion) : '—']
    ]));

    body += UI.sec('审批流转', UI.tline((c.history || []).map(function (x) {
      return { time: x.at, title: E(x.text), meta: E(x.by), tone: 'on' };
    }).concat(c.approveAt ? [{
      time: c.approveAt, title: c.status === '已驳回' ? '审批驳回' : '审批通过',
      desc: E(c.opinion || ''), meta: E(c.approver),
      tone: c.status === '已驳回' ? 'danger' : 'done'
    }] : [])));

    body += UI.sec('处置建议',
      (pending(c)
        ? UI.notice(c.impactRisk === '高' ? 'danger' : 'warn',
          '该变更尚未闭环。' + (c.impactRisk === '高'
            ? '影响等级为「高」，建议在项目周会上由项目经理与产品负责人共同评审，明确是否顺延里程碑。'
            : '建议在 3 个工作日内完成评估与审批，避免范围口径不一致。'))
        : UI.notice(c.status === '已驳回' ? 'plain' : 'done',
          c.status === '已驳回' ? '该变更已驳回，如需重启请重新提交申请并补充新的业务依据。'
            : '该变更已批准' + (c.status === '已实施' ? '并完成实施' : '，请在任务与里程碑中同步顺延排期') + '。')) +
      (c.impactDays >= 5 ? UI.notice('warn', '单条变更工期影响达 <b>' + c.impactDays + '</b> 天，需同步更新对客交付承诺。') : ''));

    var d = UI.drawer({
      title: '变更申请详情', sub: E(c.id + ' · ' + c.reason), body: body, wide: true,
      foot: '<button class="btn" data-close>关闭</button>' +
        '<button class="btn" id="cgGoReq">查看关联需求</button>' +
        (P.ed(MOD) && pending(c)
          ? '<button class="btn" id="cgNo">驳回</button><button class="btn-primary" id="cgOk">批准</button>' : '')
    });
    d.el.querySelector('#cgGoReq').onclick = function () { d.close(); Shell.go('requirements', 'pool'); };
    var ok = d.el.querySelector('#cgOk'), no = d.el.querySelector('#cgNo');
    if (ok) ok.onclick = function () { d.close(); decide(c, true); };
    if (no) no.onclick = function () { d.close(); decide(c, false); };
  }

  /* ==========================================================
   * 审批
   * ======================================================== */
  function decide(c, pass) {
    if (!P.ed(MOD)) { UI.toast('当前角色无编辑权限', 'warn'); return; }
    UI.formModal({
      title: pass ? '批准变更申请' : '驳回变更申请',
      tip: pass
        ? '批准后需同步更新任务排期与里程碑日期，工期影响会计入「影响评估」的累计口径。'
        : '驳回后该变更不再计入影响评估，如需重启请重新提交申请。',
      fields: [
        { k: 'ref', label: '变更内容', type: 'static', html: '<b>' + E(c.id) + '</b> ' + E(c.title) },
        { k: 'impact', label: '影响概要', type: 'static', html: '工期 +' + c.impactDays + ' 天 · 成本 +' + c.impactCost + ' 人日 · 影响等级 ' + E(c.impactRisk) },
        { k: 'opinion', label: '审批意见', type: 'textarea', req: true, full: true, rows: 3,
          val: pass ? '同意变更，相关任务排期顺延 ' + c.impactDays + ' 天。' : '本期范围已冻结，建议下个版本处理。' }
      ],
      okText: pass ? '确认批准' : '确认驳回',
      onSubmit: function (d, hd) {
        var his = (c.history || []).slice();
        his.push({ at: U.fmtDate(S.TODAY), by: S.roleObj().user.name, text: (pass ? '审批通过：' : '审批驳回：') + d.opinion });
        S.update('changes', c.id, {
          status: pass ? '已批准' : '已驳回',
          approver: S.roleObj().user.name,
          approveAt: U.fmtDate(S.TODAY),
          opinion: d.opinion, history: his
        });
        hd.close();
        UI.toast('变更 ' + c.id + ' 已' + (pass ? '批准' : '驳回'), pass ? 'ok' : 'warn');
        Shell.route();
      }
    });
  }

  /* ==========================================================
   * 导出
   * ======================================================== */
  function csv(rows) {
    P.csv('变更申请台账', rows, [
      { label: '编号', key: 'id' }, { label: '变更内容', key: 'title' },
      { label: '项目', key: 'projectName' }, { label: '关联需求', key: 'reqId' },
      { label: '需求标题', key: 'reqTitle' }, { label: '变更原因', key: 'reason' },
      { label: '申请人', key: 'applicant' }, { label: '申请日期', key: 'applyAt' },
      { label: '影响范围', key: 'impactScope' },
      { label: '工期影响(天)', key: 'impactDays' }, { label: '成本影响(人日)', key: 'impactCost' },
      { label: '影响等级', key: 'impactRisk' }, { label: '审批人', key: 'approver' },
      { label: '审批日期', key: 'approveAt' }, { label: '状态', key: 'status' },
      { label: '审批意见', key: 'opinion' }
    ]);
  }

  var CG_COLS = [
    { t: '编号', k: 'id' }, { t: '变更内容', k: 'title' }, { t: '原因', k: 'reason' },
    { t: '申请人', k: 'applicant' }, { t: '申请日期', k: 'applyAt' },
    { t: '工期影响', get: function (r) { return '+' + r.impactDays + ' 天'; } },
    { t: '成本影响', get: function (r) { return '+' + r.impactCost + ' 人日'; } },
    { t: '影响等级', k: 'impactRisk' }, { t: '状态', k: 'status' }
  ];

  function word(all, pd) {
    P.word('变更申请台账', '需求变更申请台账', [
      { h3: '一、总体情况', kv: [
        ['统计口径', P.scopeText()],
        ['变更总数', all.length + ' 条'],
        ['待处理', pd.length + ' 条'],
        ['已批准/已实施', all.filter(approved).length + ' 条'],
        ['已驳回', all.filter(function (c) { return c.status === '已驳回'; }).length + ' 条'],
        ['已批准累计工期影响', U.sum(all.filter(approved), 'impactDays') + ' 天']
      ] },
      { h3: '二、待处理变更', table: { cols: CG_COLS, rows: pd } },
      { h3: '三、全部变更明细', table: { cols: CG_COLS, rows: all } },
      { h3: '四、审批意见摘录', list: all.filter(function (c) { return c.opinion; })
        .map(function (c) { return c.id + '「' + U.ellip(c.title, 20) + '」' + c.status + '：' + c.opinion; }) }
    ], ['生成日期：' + U.fmtDate(S.TODAY)]);
  }

  function impactWord(all, ap, pd, proj, base, days, cost, pdDays) {
    P.word('变更影响评估报告', '需求变更影响评估报告', [
      { h3: '一、评估结论', p:
        '本项目「' + proj.name + '」原计划工期 ' + base + ' 天（' + proj.start + ' 至 ' + proj.end + '）。' +
        '截至 ' + U.fmtDate(S.TODAY) + '，已批准变更 ' + ap.length + ' 条，累计工期影响 ' + days + ' 天（占原计划 ' + U.pct(days, base) + '%），' +
        '累计成本影响 ' + cost + ' 人日。另有 ' + pd.length + ' 条变更待审批，潜在追加工期 ' + pdDays + ' 天。' +
        (U.pct(days + pdDays, base) > 10
          ? '累计影响已超过原计划的 10%，建议启动计划重新基线化，并同步更新里程碑与对客交付承诺。'
          : '累计影响处于可吸收范围，按现有计划缓冲消化即可。') },
      { h3: '二、按变更原因汇总', table: {
        cols: [
          { t: '变更原因', k: 'k' }, { t: '数量', k: 'n' },
          { t: '工期影响(天)', k: 'd' }, { t: '成本影响(人日)', k: 'c' }
        ],
        rows: Object.keys(U.group(all, 'reason')).map(function (k) {
          var g = U.group(all, 'reason')[k];
          return { k: k, n: g.length, d: U.sum(g, 'impactDays'), c: U.sum(g, 'impactCost') };
        })
      } },
      { h3: '三、高影响变更清单', table: {
        cols: CG_COLS, rows: all.filter(function (c) { return c.impactRisk === '高' || c.impactDays >= 5; })
      } },
      { h3: '四、待审批变更与建议', list: pd.length
        ? pd.map(function (c) { return c.id + '「' + U.ellip(c.title, 20) + '」当前 ' + c.status + '，预估工期影响 ' + c.impactDays + ' 天、影响等级 ' + c.impactRisk + '，建议在项目周会上完成决策。'; })
        : ['当前无待审批变更。'] },
      { h3: '五、后续动作', list: [
        '已批准变更需在「任务管理」中同步顺延相关任务的截止时间。',
        '工期影响累计超过 10% 时，需在「项目计划 · 里程碑」中重新设定基线日期并知会干系人。',
        '所有变更审批记录已写入「工作留痕」，可用于项目复盘与验收举证。'
      ] }
    ], ['项目：' + proj.name, '生成日期：' + U.fmtDate(S.TODAY)]);
  }

  Shell.page(MOD, {
    render: function (ctx) {
      if (ctx.sub === 'impact') impact(ctx);
      else list(ctx);
    }
  });
})();
