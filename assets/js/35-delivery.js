/* ============================================================
 * 35-delivery.js  交付管理（项目经理专属）
 * 子页：items 交付物清单 / accept 验收记录 / archive 文档归档
 * ========================================================== */
(function () {
  'use strict';
  var E = U.esc, MOD = 'delivery';

  var DEF_I = { kw: '', status: '', type: '', owner: '', flag: '' };
  var DEF_A = { kw: '', result: '', type: '', acceptBy: '' };
  var DEF_R = { kw: '', type: '', year: '' };

  var ST_ALL = ['未开始', '制作中', '待验收', '验收中', '已验收', '验收不通过', '已归档'];
  var ST_FLOW = ['未开始', '制作中', '待验收', '验收中', '已验收', '已归档'];

  function accepted(d) { return ['已验收', '已归档'].indexOf(d.status) >= 0; }
  function inAccept(d) { return ['待验收', '验收中'].indexOf(d.status) >= 0; }
  function overdue(d) { return !accepted(d) && d.status !== '验收不通过' && U.dayDiff(d.planDate, S.TODAY) > 0; }
  function delayDays(d) { return Math.max(0, U.dayDiff(d.planDate, S.TODAY)); }

  function cards(all) {
    var ac = all.filter(accepted);
    var od = all.filter(overdue);
    var fail = all.filter(function (d) { return d.status === '验收不通过'; });
    return P.statCards([
      { label: '交付物', val: all.length, unit: '项', sub: '覆盖 ' + U.uniq(all.map(function (d) { return d.type; })).length + ' 类产物', ico: '⬓' },
      { label: '已验收', val: ac.length, unit: '项', sub: '验收率 ' + U.pct(ac.length, all.length) + '%', tone: 'done', ico: '✓' },
      { label: '逾期未交付', val: od.length, unit: '项', sub: od.length ? '最长逾期 ' + U.max(od.map(function (d) { return { v: delayDays(d) }; }), 'v') + ' 天' : '全部按计划推进', tone: od.length ? 'danger' : 'done', ico: '⚠' },
      { label: '验收不通过', val: fail.length, unit: '项', sub: fail.length ? '需整改后重新提交' : '暂无退回项', tone: fail.length ? 'warn' : 'done', ico: '↺' }
    ]);
  }

  /* ==========================================================
   * 子页一：交付物清单
   * ======================================================== */
  function items(ctx) {
    var all = S.deliverables();
    var f = P.flt(MOD + '.items', DEF_I);
    var rows = all.filter(function (d) {
      if (f.status && d.status !== f.status) return false;
      if (f.type && d.type !== f.type) return false;
      if (f.owner && d.owner !== f.owner) return false;
      if (f.flag === 'overdue' && !overdue(d)) return false;
      if (f.flag === 'todo' && accepted(d)) return false;
      if (f.flag === 'accept' && !inAccept(d)) return false;
      if (f.kw && (d.id + d.name + d.type + d.owner + d.version + d.projectName).toLowerCase().indexOf(f.kw.toLowerCase()) < 0) return false;
      return true;
    });
    var od = all.filter(overdue);

    var h = P.head({
      mod: MOD, title: '交付物清单',
      desc: '项目全部交付产物的统一台账：制作状态、责任人、计划与实际交付日期、版本与归档链接，作为验收与结项的举证依据。',
      acts: '<button class="btn" data-go2="accept">验收记录</button>' +
        '<button class="btn" id="dvCsv">导出 CSV</button>' +
        '<button class="btn" id="dvWord">导出交付清单</button>' +
        P.createBtn(MOD, 'delivery.new', '登记交付物')
    });
    h += P.permTip(MOD);
    h += cards(all);

    if (od.length) {
      h += P.gap(3);
      h += UI.notice('danger',
        '有 <b>' + od.length + '</b> 项交付物已超过计划交付日期：' +
        od.slice(0, 5).map(function (d) { return E(U.ellip(d.name, 12)) + '（逾期 ' + delayDays(d) + ' 天）'; }).join('、') +
        (od.length > 5 ? ' 等' : '') + '。逾期交付物会直接影响里程碑达成与客户验收节奏。', '⚠');
    }

    h += P.gap(4);
    h += UI.grid(3,
      UI.card({ title: '交付状态分布', sub: '点击扇区筛选', body: P.chart('dvPie', 240) }) +
      UI.card({ title: '按产物类型', sub: '点击柱条筛选类型', body: P.chart('dvType', 240) }) +
      UI.card({ title: '交付流转', sub: '各环节在制数量', body: P.chart('dvFlow', 240) })
    );

    h += P.gap(4);
    h += '<div class="toolbar" id="dvFlt">' +
      '<input class="fld" data-f="kw" placeholder="搜索交付物 / 编号 / 责任人 / 版本" value="' + E(f.kw) + '" style="min-width:240px">' +
      P.sel('status', '全部状态', ST_ALL, f.status) +
      P.sel('type', '全部类型', U.uniq(all.map(function (d) { return d.type; })), f.type) +
      P.sel('owner', '全部责任人', U.uniq(all.map(function (d) { return d.owner; })).sort(), f.owner) +
      P.sel('flag', '不限', [
        { v: 'todo', t: '仅未验收' }, { v: 'overdue', t: '仅逾期' }, { v: 'accept', t: '验收中' }
      ], f.flag) +
      '<button class="btn-ghost" data-reset>重置</button>' +
      '</div>';
    h += '<div id="dvTbl"></div>';

    ctx.el.innerHTML = h;

    var byS = U.countBy(all, 'status');
    CH.donut('dvPie', {
      data: ST_ALL.filter(function (s) { return byS[s]; }).map(function (s) {
        return { name: s, value: byS[s], color: CH.TONE[C.tone('status', s)] };
      }),
      height: 240, center: { l: '交付物', v: all.length },
      onClick: function (i, d) { setF('items', DEF_I, 'status', d.name); }
    });

    var byT = U.countBy(all, 'type');
    var tKeys = Object.keys(byT).sort(function (a, b) { return byT[b] - byT[a]; });
    CH.bars('dvType', {
      data: tKeys.map(function (k, i) { return { label: k, value: byT[k], text: byT[k] + ' 项', color: CH.PAL[i % CH.PAL.length] }; }),
      onClick: function (i) { setF('items', DEF_I, 'type', tKeys[i]); }
    });

    CH.bar('dvFlow', {
      labels: ST_FLOW, height: 240,
      series: [{ name: '交付物数', color: CH.TONE.doing, data: ST_FLOW.map(function (s) { return byS[s] || 0; }) }],
      onClick: function (i) { setF('items', DEF_I, 'status', ST_FLOW[i]); }
    });

    UI.table(ctx.el.querySelector('#dvTbl'), {
      cols: [
        { k: 'id', t: '编号', w: '76px', render: function (r) { return UI.idCell(r.id); } },
        { k: 'name', t: '交付物', w: '230px', render: function (r) { return UI.cell2(E(r.name), E(r.version) + ' · ' + E(r.size)); } },
        { k: 'type', t: '类型', w: '110px', render: function (r) { return UI.tag(r.type, 'plan'); } },
        { k: 'owner', t: '责任人', w: '100px', render: function (r) { return UI.owner(r.owner); } },
        { k: 'planDate', t: '计划交付', w: '110px', render: function (r) { return accepted(r) ? '<span class="muted tiny">' + E(r.planDate) + '</span>' : UI.due(r.planDate); } },
        { k: 'realDate', t: '实际交付', w: '100px', render: function (r) { return r.realDate ? E(r.realDate) : '<span class="muted">—</span>'; } },
        {
          k: 'gap', t: '偏差', w: '84px', align: 'right',
          sortVal: function (r) { return r.realDate ? U.dayDiff(r.planDate, r.realDate) : delayDays(r); },
          render: function (r) {
            if (r.realDate) {
              var g = U.dayDiff(r.planDate, r.realDate);
              if (g > 0) return '<span class="tag tag-warn">+' + g + '天</span>';
              return '<span class="tag tag-done">准时</span>';
            }
            return overdue(r) ? '<span class="tag tag-danger">逾期' + delayDays(r) + '天</span>' : '<span class="muted">—</span>';
          }
        },
        { k: 'status', t: '状态', w: '96px', render: function (r) { return UI.st('status', r.status); } },
        {
          k: 'act', t: '操作', w: '150px', align: 'right', sortable: false,
          render: function (r) {
            return '<div class="row-acts"><button class="btn-sm" data-act="view">详情</button>' +
              (P.ed(MOD) && inAccept(r) ? '<button class="btn-sm" data-act="acc">登记验收</button>' : '') +
              (P.ed(MOD) && r.status === '已验收' ? '<button class="btn-sm" data-act="arc">归档</button>' : '') +
              '</div>';
          }
        }
      ],
      rows: rows, pageSize: 15, sort: { k: 'planDate', desc: false }, select: true,
      rowCls: function (r) {
        if (overdue(r)) return 'row-danger';
        if (r.status === '验收不通过') return 'row-warn';
        if (r.status === '已归档') return 'row-done';
        return '';
      },
      onRow: openItem,
      onAct: function (act, r) {
        if (act === 'acc') doAccept(r);
        else if (act === 'arc') doArchive(r);
        else openItem(r);
      },
      empty: UI.empty('没有符合条件的交付物', '<button class="btn" data-reset2>清空筛选条件</button>'),
      bulk: [{ t: '导出所选', fn: function (picked) { csv(picked); } }],
      footNote: '逾期交付物标红，验收不通过标黄，已归档淡化显示'
    });

    var r2 = ctx.el.querySelector('[data-reset2]');
    if (r2) r2.addEventListener('click', function () { P.setFlt(MOD + '.items', Object.assign({}, DEF_I)); Shell.route(); });
    P.bindFlt(ctx.el.querySelector('#dvFlt'), MOD + '.items', DEF_I, function () { Shell.route(); });
    ctx.el.querySelector('[data-go2]').onclick = function () { Shell.go(MOD, 'accept'); };
    P.$('dvCsv').onclick = function () { csv(rows); };
    P.$('dvWord').onclick = function () { itemsWord(all, od); };
  }

  function setF(sub, def, k, v) {
    var key = MOD + '.' + sub;
    var f = P.flt(key, def);
    f[k] = f[k] === v ? '' : v;
    P.setFlt(key, f);
    Shell.route();
  }

  /* ==========================================================
   * 子页二：验收记录
   * ======================================================== */
  function accept(ctx) {
    var all = S.deliverables();
    var done = all.filter(function (d) { return accepted(d) || d.status === '验收不通过'; });
    var f = P.flt(MOD + '.accept', DEF_A);
    var rows = done.filter(function (d) {
      var res = d.status === '验收不通过' ? '不通过' : '通过';
      if (f.result && res !== f.result) return false;
      if (f.type && d.type !== f.type) return false;
      if (f.acceptBy && d.acceptBy !== f.acceptBy) return false;
      if (f.kw && (d.id + d.name + (d.acceptBy || '') + (d.acceptResult || '')).toLowerCase().indexOf(f.kw.toLowerCase()) < 0) return false;
      return true;
    });

    var pass = done.filter(accepted);
    var fail = done.filter(function (d) { return d.status === '验收不通过'; });
    var waiting = all.filter(inAccept);
    var onTime = pass.filter(function (d) { return d.realDate && U.dayDiff(d.planDate, d.realDate) <= 0; });

    var h = P.head({
      mod: MOD, title: '验收记录',
      desc: '沉淀每一次验收的验收方、验收日期与验收结论。验收不通过的交付物会退回制作环节，整改后重新提交。',
      acts: '<button class="btn" data-go2="items">交付物清单</button>' +
        '<button class="btn" id="acCsv">导出 CSV</button>' +
        '<button class="btn" id="acWord">导出验收报告</button>'
    });
    h += P.permTip(MOD);
    h += P.statCards([
      { label: '已验收', val: pass.length, unit: '项', sub: '一次通过率 ' + U.pct(pass.length, done.length) + '%', tone: 'done', ico: '✓' },
      { label: '验收不通过', val: fail.length, unit: '项', sub: fail.length ? '需整改后重新提交' : '无退回记录', tone: fail.length ? 'warn' : 'done', ico: '↺' },
      { label: '待验收/验收中', val: waiting.length, unit: '项', sub: waiting.length ? '需约客户或内部验收时间' : '当前无排队验收', tone: waiting.length ? 'warn' : 'done', ico: '⏳' },
      { label: '准时交付率', val: U.pct(onTime.length, pass.length), unit: '%', sub: '实际交付 ≤ 计划交付日期', tone: U.pct(onTime.length, pass.length) >= 80 ? 'done' : 'warn', ico: '📅' }
    ]);

    h += P.gap(4);
    h += UI.grid(2,
      UI.card({ title: '验收方分布', sub: '客户验收 vs 内部验收，点击筛选', body: P.chart('acBy', 260) }) +
      UI.card({ title: '各类型验收通过情况', sub: '通过 vs 不通过', body: P.chart('acType', 260) })
    );

    h += P.gap(4);
    h += UI.grid(2,
      UI.card({
        title: '待验收队列', sub: '按计划交付日期排序，越早越紧急',
        body: waiting.length
          ? U.sortBy(waiting, 'planDate').slice(0, 8).map(function (d) {
            return UI.listItem({
              ico: '⏳', icoStyle: 'color:var(--s-warn)',
              title: E(d.name) + ' <span class="muted tiny">' + E(d.version) + '</span>',
              desc: E(d.type) + ' · 责任人 ' + E(d.owner),
              right: UI.due(d.planDate) + ' ' + UI.st('status', d.status),
              click: true, data: ' data-dv="' + E(d.id) + '"'
            });
          }).join('')
          : UI.empty('当前没有待验收的交付物', '', '✓'),
        bodyId: 'acWait'
      }) +
      UI.card({
        title: '验收退回记录', sub: '需整改后重新提交',
        body: fail.length
          ? fail.map(function (d) {
            return UI.listItem({
              ico: '↺', icoStyle: 'color:var(--s-danger)',
              title: E(d.name) + ' <span class="muted tiny">' + E(d.version) + '</span>',
              desc: E(d.acceptResult || '未填写退回原因'),
              right: UI.owner(d.owner),
              click: true, data: ' data-dv="' + E(d.id) + '"'
            });
          }).join('')
          : UI.empty('没有验收退回记录，交付质量良好', '', '✓'),
        bodyId: 'acFail'
      })
    );

    h += P.gap(4);
    h += '<div class="toolbar" id="acFlt">' +
      '<input class="fld" data-f="kw" placeholder="搜索交付物 / 验收方 / 验收结论" value="' + E(f.kw) + '" style="min-width:240px">' +
      P.sel('result', '全部验收结论', ['通过', '不通过'], f.result) +
      P.sel('type', '全部类型', U.uniq(done.map(function (d) { return d.type; })), f.type) +
      P.sel('acceptBy', '全部验收方', U.uniq(done.map(function (d) { return d.acceptBy; }).filter(Boolean)), f.acceptBy) +
      '<button class="btn-ghost" data-reset>重置</button>' +
      '</div>';
    h += '<div id="acTbl"></div>';

    ctx.el.innerHTML = h;

    var byBy = U.countBy(done.filter(function (d) { return d.acceptBy; }), 'acceptBy');
    var bKeys = Object.keys(byBy);
    CH.donut('acBy', {
      data: bKeys.map(function (k, i) { return { name: k, value: byBy[k], color: CH.PAL[i % CH.PAL.length] }; }),
      height: 260, center: { l: '验收记录', v: done.length },
      onClick: function (i, d) { setF('accept', DEF_A, 'acceptBy', d.name); }
    });

    var tKeys = U.uniq(done.map(function (d) { return d.type; }));
    CH.bar('acType', {
      labels: tKeys.map(function (k) { return U.ellip(k, 5); }), height: 260, stack: true,
      series: [
        { name: '通过', color: CH.TONE.done, data: tKeys.map(function (k) { return done.filter(function (d) { return d.type === k && accepted(d); }).length; }) },
        { name: '不通过', color: CH.TONE.danger, data: tKeys.map(function (k) { return done.filter(function (d) { return d.type === k && d.status === '验收不通过'; }).length; }) }
      ],
      onClick: function (i) { setF('accept', DEF_A, 'type', tKeys[i]); }
    });

    UI.table(ctx.el.querySelector('#acTbl'), {
      cols: [
        { k: 'id', t: '编号', w: '76px', render: function (r) { return UI.idCell(r.id); } },
        { k: 'name', t: '交付物', w: '220px', render: function (r) { return UI.cell2(E(r.name), E(r.type) + ' · ' + E(r.version)); } },
        { k: 'owner', t: '责任人', w: '100px', render: function (r) { return UI.owner(r.owner); } },
        { k: 'acceptBy', t: '验收方', w: '140px', render: function (r) { return r.acceptBy ? UI.tag(r.acceptBy, r.acceptBy.indexOf('客户') === 0 ? 'cyan' : 'plan') : '<span class="muted">—</span>'; } },
        { k: 'acceptAt', t: '验收日期', w: '110px' },
        { k: 'realDate', t: '实际交付', w: '100px', render: function (r) { return r.realDate ? E(r.realDate) : '<span class="muted">—</span>'; } },
        {
          k: 'result', t: '验收结论', w: '100px',
          sortVal: function (r) { return r.status === '验收不通过' ? 0 : 1; },
          render: function (r) { return r.status === '验收不通过' ? UI.tag('不通过', 'danger') : UI.tag('通过', 'done'); }
        },
        { k: 'acceptResult', t: '结论说明', w: '250px', render: function (r) { return '<span class="muted">' + E(r.acceptResult || '—') + '</span>'; } }
      ],
      rows: rows, pageSize: 15, sort: { k: 'acceptAt', desc: true },
      rowCls: function (r) { return r.status === '验收不通过' ? 'row-danger' : ''; },
      onRow: openItem,
      empty: UI.empty('没有符合条件的验收记录'),
      footNote: '验收不通过的记录标红，需在交付物清单中跟进整改'
    });

    P.bindFlt(ctx.el.querySelector('#acFlt'), MOD + '.accept', DEF_A, function () { Shell.route(); });
    ctx.el.querySelector('[data-go2]').onclick = function () { Shell.go(MOD, 'items'); };
    P.$('acCsv').onclick = function () { acceptCsv(rows); };
    P.$('acWord').onclick = function () { acceptWord(all, pass, fail, waiting, onTime); };

    ['acWait', 'acFail'].forEach(function (id) {
      var box = P.$(id); if (!box) return;
      box.addEventListener('click', function (e) {
        var li = e.target.closest('[data-dv]'); if (!li) return;
        var d = all.filter(function (x) { return x.id === li.getAttribute('data-dv'); })[0];
        if (d) openItem(d);
      });
    });
  }

  /* ==========================================================
   * 子页三：文档归档
   * ======================================================== */
  function archive(ctx) {
    var all = S.deliverables();
    var arc = all.filter(function (d) { return d.archived; });
    var f = P.flt(MOD + '.archive', DEF_R);
    var rows = arc.filter(function (d) {
      if (f.type && d.type !== f.type) return false;
      if (f.year && String(d.acceptAt || d.planDate).slice(0, 4) !== f.year) return false;
      if (f.kw && (d.id + d.name + d.version + d.docLink + d.projectName).toLowerCase().indexOf(f.kw.toLowerCase()) < 0) return false;
      return true;
    });

    var pendingArc = all.filter(function (d) { return d.status === '已验收' && !d.archived; });
    var sizeMB = Math.round(U.sum(arc.map(function (d) { return { v: parseInt(d.size, 10) || 0 }; }), 'v') / 1024);

    var h = P.head({
      mod: MOD, title: '文档归档',
      desc: '已验收交付物的归档库。归档后文档进入只读状态，作为项目结项、审计与后续复盘的正式底稿。',
      acts: '<button class="btn" data-go2="accept">验收记录</button>' +
        '<button class="btn" id="arCsv">导出归档索引</button>' +
        '<button class="btn" id="arWord">导出归档目录</button>' +
        (P.ed(MOD) && pendingArc.length ? '<button class="btn-primary" id="arBatch">批量归档 (' + pendingArc.length + ')</button>' : '')
    });
    h += P.permTip(MOD);
    h += P.statCards([
      { label: '已归档', val: arc.length, unit: '项', sub: '归档率 ' + U.pct(arc.length, all.length) + '%', tone: 'done', ico: '🗄' },
      { label: '待归档', val: pendingArc.length, unit: '项', sub: pendingArc.length ? '已验收但尚未归档' : '验收产物已全部归档', tone: pendingArc.length ? 'warn' : 'done', ico: '⏳' },
      { label: '归档体量', val: sizeMB, unit: 'MB', sub: '覆盖 ' + U.uniq(arc.map(function (d) { return d.type; })).length + ' 类产物', ico: '💾' },
      { label: '文档类型', val: U.uniq(all.map(function (d) { return d.type; })).length, unit: '类', sub: '按类型建立归档目录', ico: '📁' }
    ]);

    if (pendingArc.length) {
      h += P.gap(3);
      h += UI.notice('warn',
        '有 <b>' + pendingArc.length + '</b> 项交付物已验收但尚未归档：' +
        pendingArc.slice(0, 5).map(function (d) { return E(U.ellip(d.name, 12)); }).join('、') +
        (pendingArc.length > 5 ? ' 等' : '') + '。结项前需完成全部归档，否则无法通过审计。', '⚠');
    }

    h += P.gap(4);
    h += UI.grid(2,
      UI.card({ title: '归档构成', sub: '按产物类型，点击筛选', body: P.chart('arType', 260) }) +
      UI.card({ title: '归档进度', sub: '各类型 已归档 / 未归档', body: P.chart('arProg', 260) })
    );

    h += P.gap(4);
    h += '<div class="toolbar" id="arFlt">' +
      '<input class="fld" data-f="kw" placeholder="搜索文档名 / 编号 / 版本 / 路径" value="' + E(f.kw) + '" style="min-width:250px">' +
      P.sel('type', '全部类型', U.uniq(arc.map(function (d) { return d.type; })), f.type) +
      P.sel('year', '全部年份', U.uniq(arc.map(function (d) { return String(d.acceptAt || d.planDate).slice(0, 4); })).sort(), f.year) +
      '<button class="btn-ghost" data-reset>重置</button>' +
      '<span class="muted tiny" style="margin-left:auto">共 ' + rows.length + ' 份归档文档</span>' +
      '</div>';
    h += '<div id="arTbl"></div>';

    ctx.el.innerHTML = h;

    var byT = U.countBy(arc, 'type');
    var tKeys = Object.keys(byT).sort(function (a, b) { return byT[b] - byT[a]; });
    CH.bars('arType', {
      data: tKeys.map(function (k, i) { return { label: k, value: byT[k], text: byT[k] + ' 份', color: CH.PAL[i % CH.PAL.length] }; }),
      onClick: function (i) { setF('archive', DEF_R, 'type', tKeys[i]); }
    });

    var aKeys = U.uniq(all.map(function (d) { return d.type; }));
    CH.bar('arProg', {
      labels: aKeys.map(function (k) { return U.ellip(k, 5); }), height: 260, stack: true,
      series: [
        { name: '已归档', color: CH.TONE.done, data: aKeys.map(function (k) { return all.filter(function (d) { return d.type === k && d.archived; }).length; }) },
        { name: '未归档', color: CH.TONE.idle, data: aKeys.map(function (k) { return all.filter(function (d) { return d.type === k && !d.archived; }).length; }) }
      ]
    });

    UI.table(ctx.el.querySelector('#arTbl'), {
      cols: [
        { k: 'id', t: '编号', w: '76px', render: function (r) { return UI.idCell(r.id); } },
        { k: 'name', t: '文档名称', w: '240px', render: function (r) { return UI.cell2(E(r.name), E(r.projectName)); } },
        { k: 'type', t: '类型', w: '110px', render: function (r) { return UI.tag(r.type, 'plan'); } },
        { k: 'version', t: '版本', w: '80px' },
        { k: 'size', t: '大小', w: '90px', align: 'right', sortVal: function (r) { return parseInt(r.size, 10) || 0; } },
        { k: 'owner', t: '责任人', w: '100px', render: function (r) { return UI.owner(r.owner); } },
        { k: 'acceptBy', t: '验收方', w: '130px', render: function (r) { return r.acceptBy ? '<span class="muted">' + E(r.acceptBy) + '</span>' : '<span class="muted">—</span>'; } },
        { k: 'acceptAt', t: '归档日期', w: '110px' },
        { k: 'docLink', t: '归档路径', w: '180px', render: function (r) { return '<code class="muted tiny">' + E(r.docLink) + '</code>'; } },
        {
          k: 'act', t: '操作', w: '96px', align: 'right', sortable: false,
          render: function () { return '<div class="row-acts"><button class="btn-sm" data-act="view">详情</button></div>'; }
        }
      ],
      rows: rows, pageSize: 15, sort: { k: 'acceptAt', desc: true }, select: true,
      onRow: openItem,
      onAct: function (act, r) { openItem(r); },
      empty: UI.empty('归档库中暂无符合条件的文档'),
      bulk: [{ t: '导出所选索引', fn: function (picked) { arcCsv(picked); } }],
      footNote: '归档文档为只读底稿，如需修订请新建版本后重新走验收流程'
    });

    P.bindFlt(ctx.el.querySelector('#arFlt'), MOD + '.archive', DEF_R, function () { Shell.route(); });
    ctx.el.querySelector('[data-go2]').onclick = function () { Shell.go(MOD, 'accept'); };
    P.$('arCsv').onclick = function () { arcCsv(rows); };
    P.$('arWord').onclick = function () { arcWord(arc, pendingArc, sizeMB); };
    var bb = P.$('arBatch');
    if (bb) bb.onclick = function () { batchArchive(pendingArc); };
  }

  /* ==========================================================
   * 交付物详情抽屉
   * ======================================================== */
  function openItem(d) {
    var body = P.hero({
      title: E(d.name), id: d.id,
      meta: [['类型', E(d.type)], ['版本', E(d.version)], ['责任人', E(d.owner)], ['计划交付', d.planDate]],
      right: UI.st('status', d.status) + (overdue(d) ? ' ' + UI.tag('逾期 ' + delayDays(d) + ' 天', 'danger') : '')
    });

    body += UI.sec('交付信息', P.kv([
      ['所属项目', E(d.projectName)],
      ['关联版本', d.releaseId ? E(d.releaseId) : '—'],
      ['计划交付', d.planDate],
      ['实际交付', d.realDate || '—'],
      ['文件大小', E(d.size)],
      ['归档路径', '<code class="tiny">' + E(d.docLink) + '</code>']
    ]));

    body += UI.sec('验收信息', P.kv([
      ['验收方', d.acceptBy ? E(d.acceptBy) : '—'],
      ['验收日期', d.acceptAt || '—'],
      ['验收结论', d.status === '验收不通过' ? '不通过' : (accepted(d) ? '通过' : '未验收')],
      ['结论说明', d.acceptResult ? E(d.acceptResult) : '—'],
      ['归档状态', d.archived ? '已归档' : '未归档']
    ]));

    var steps = ST_FLOW.map(function (s) {
      var idx = ST_FLOW.indexOf(d.status);
      var mine = ST_FLOW.indexOf(s);
      return {
        time: s,
        title: s,
        tone: d.status === '验收不通过' ? (mine <= 2 ? 'done' : '')
          : (mine < idx ? 'done' : (mine === idx ? 'on' : ''))
      };
    });
    body += UI.sec('交付流转', UI.tline(steps));

    body += UI.sec('跟进建议',
      (overdue(d)
        ? UI.notice('danger', '该交付物已超过计划交付日期 <b>' + delayDays(d) + '</b> 天，需与责任人确认阻塞原因并更新计划。')
        : (d.status === '验收不通过'
          ? UI.notice('warn', '验收未通过：' + E(d.acceptResult || '未记录原因') + '。整改完成后请重新提交验收。')
          : (accepted(d)
            ? UI.notice('done', '该交付物已完成验收' + (d.archived ? '并归档，可作为结项底稿。' : '，建议尽快归档以便审计追溯。'))
            : UI.notice('info', '按计划推进中，距计划交付还有 <b>' + Math.max(0, U.dayDiff(S.TODAY, d.planDate)) + '</b> 天。')))));

    var h = UI.drawer({
      title: '交付物详情', sub: E(d.id + ' · ' + d.type), body: body, wide: true,
      foot: '<button class="btn" data-close>关闭</button>' +
        (P.ed(MOD) && inAccept(d) ? '<button class="btn-primary" id="dvAcc">登记验收</button>' : '') +
        (P.ed(MOD) && d.status === '已验收' ? '<button class="btn-primary" id="dvArc">归档</button>' : '')
    });
    var a1 = h.el.querySelector('#dvAcc'), a2 = h.el.querySelector('#dvArc');
    if (a1) a1.onclick = function () { h.close(); doAccept(d); };
    if (a2) a2.onclick = function () { h.close(); doArchive(d); };
  }

  /* ==========================================================
   * 验收 / 归档动作
   * ======================================================== */
  function doAccept(d) {
    if (!P.ed(MOD)) { UI.toast('当前角色无编辑权限', 'warn'); return; }
    UI.formModal({
      title: '登记验收结果', wide: true,
      tip: '验收通过后交付物进入「已验收」，可继续归档；验收不通过将退回制作环节，需整改后重新提交。',
      fields: [
        { k: 'ref', label: '交付物', type: 'static', html: '<b>' + E(d.id) + '</b> ' + E(d.name) + ' <span class="muted">' + E(d.version) + '</span>' },
        { k: 'result', label: '验收结论', type: 'radio', req: true, opts: ['通过', '不通过'], val: '通过' },
        /* 验收方是自由文本：客户名 / 内部同事名都行，不预置任何虚构选项 */
        { k: 'acceptBy', label: '验收方', req: true, placeholder: '如：客户方对接人，或内部验收同事的名字' },
        { k: 'acceptAt', label: '验收日期', type: 'date', req: true, val: U.fmtDate(S.TODAY) },
        { k: 'acceptResult', label: '结论说明', type: 'textarea', full: true, rows: 3, placeholder: '通过请写明范围，不通过请写明整改要求' }
      ],
      okText: '提交验收结果',
      onSubmit: function (v, hd) {
        var pass = v.result === '通过';
        S.update('deliverables', d.id, {
          status: pass ? '已验收' : '验收不通过',
          acceptBy: v.acceptBy, acceptAt: v.acceptAt,
          acceptResult: v.acceptResult,
          realDate: pass ? (d.realDate || v.acceptAt) : d.realDate
        });
        hd.close();
        UI.toast('「' + U.ellip(d.name, 12) + '」验收' + (pass ? '通过' : '不通过') + '已登记', pass ? 'ok' : 'warn');
        Shell.route();
      }
    });
  }

  function doArchive(d) {
    if (!P.ed(MOD)) { UI.toast('当前角色无编辑权限', 'warn'); return; }
    UI.confirm('将「<b>' + E(d.name) + '</b>」归入项目归档库，归档后文档进入只读状态。', function () {
      S.update('deliverables', d.id, { status: '已归档', archived: true });
      UI.toast('已归档：' + U.ellip(d.name, 14), 'ok');
      Shell.route();
    }, { title: '归档确认', okText: '确认归档', tip: '原型为内存态，操作会写入工作留痕，刷新页面后还原。' });
  }

  function batchArchive(list) {
    if (!P.ed(MOD)) { UI.toast('当前角色无编辑权限', 'warn'); return; }
    if (!list.length) { UI.toast('没有待归档的交付物', 'warn'); return; }
    UI.confirm('将把 <b>' + list.length + '</b> 项已验收交付物一次性归档。', function () {
      list.forEach(function (d) { S.update('deliverables', d.id, { status: '已归档', archived: true }); });
      UI.toast(list.length + ' 项交付物已归档', 'ok');
      Shell.route();
    }, { title: '批量归档', okText: '确认归档', tip: '原型为内存态，操作会写入工作留痕，刷新页面后还原。' });
  }

  /* ==========================================================
   * 导出
   * ======================================================== */
  function csv(rows) {
    P.csv('交付物清单', rows, [
      { label: '编号', key: 'id' }, { label: '交付物', key: 'name' },
      { label: '类型', key: 'type' }, { label: '项目', key: 'projectName' },
      { label: '版本', key: 'version' }, { label: '责任人', key: 'owner' },
      { label: '计划交付', key: 'planDate' }, { label: '实际交付', key: 'realDate' },
      { label: '状态', key: 'status' }, { label: '验收方', key: 'acceptBy' },
      { label: '验收日期', key: 'acceptAt' }, { label: '验收结论', key: 'acceptResult' },
      { label: '大小', key: 'size' }, { label: '归档路径', key: 'docLink' },
      { label: '是否归档', get: function (r) { return r.archived ? '是' : '否'; } }
    ]);
  }

  function acceptCsv(rows) {
    P.csv('验收记录', rows, [
      { label: '编号', key: 'id' }, { label: '交付物', key: 'name' },
      { label: '类型', key: 'type' }, { label: '版本', key: 'version' },
      { label: '责任人', key: 'owner' }, { label: '验收方', key: 'acceptBy' },
      { label: '验收日期', key: 'acceptAt' }, { label: '实际交付', key: 'realDate' },
      { label: '验收结论', get: function (r) { return r.status === '验收不通过' ? '不通过' : '通过'; } },
      { label: '结论说明', key: 'acceptResult' }
    ]);
  }

  function arcCsv(rows) {
    P.csv('归档索引', rows, [
      { label: '编号', key: 'id' }, { label: '文档名称', key: 'name' },
      { label: '类型', key: 'type' }, { label: '版本', key: 'version' },
      { label: '项目', key: 'projectName' }, { label: '责任人', key: 'owner' },
      { label: '验收方', key: 'acceptBy' }, { label: '归档日期', key: 'acceptAt' },
      { label: '大小', key: 'size' }, { label: '归档路径', key: 'docLink' }
    ]);
  }

  var DV_COLS = [
    { t: '编号', k: 'id' }, { t: '交付物', k: 'name' }, { t: '类型', k: 'type' },
    { t: '版本', k: 'version' }, { t: '责任人', k: 'owner' },
    { t: '计划交付', k: 'planDate' }, { t: '实际交付', get: function (r) { return r.realDate || '—'; } },
    { t: '状态', k: 'status' }
  ];

  function itemsWord(all, od) {
    P.word('交付物清单', '项目交付物清单', [
      { h3: '一、交付概览', kv: [
        ['统计口径', P.scopeText()],
        ['交付物总数', all.length + ' 项'],
        ['已验收', all.filter(accepted).length + ' 项'],
        ['已归档', all.filter(function (d) { return d.archived; }).length + ' 项'],
        ['逾期未交付', od.length + ' 项'],
        ['验收不通过', all.filter(function (d) { return d.status === '验收不通过'; }).length + ' 项']
      ] },
      { h3: '二、交付物明细', table: { cols: DV_COLS, rows: all } },
      { h3: '三、逾期交付物与跟进', list: od.length
        ? od.map(function (d) { return d.id + '「' + d.name + '」计划 ' + d.planDate + '，已逾期 ' + delayDays(d) + ' 天，责任人 ' + d.owner + '，当前状态 ' + d.status + '。'; })
        : ['当前无逾期交付物。'] },
      { h3: '四、按类型统计', table: {
        cols: [{ t: '产物类型', k: 'k' }, { t: '总数', k: 'n' }, { t: '已验收', k: 'a' }, { t: '已归档', k: 'r' }],
        rows: U.uniq(all.map(function (d) { return d.type; })).map(function (k) {
          var g = all.filter(function (d) { return d.type === k; });
          return { k: k, n: g.length, a: g.filter(accepted).length, r: g.filter(function (d) { return d.archived; }).length };
        })
      } }
    ], ['生成日期：' + U.fmtDate(S.TODAY)]);
  }

  function acceptWord(all, pass, fail, waiting, onTime) {
    P.word('交付验收报告', '项目交付验收报告', [
      { h3: '一、验收结论', p:
        '截至 ' + U.fmtDate(S.TODAY) + '，本' + P.scopeText() + '共登记交付物 ' + all.length + ' 项，' +
        '其中已验收 ' + pass.length + ' 项，验收不通过 ' + fail.length + ' 项，待验收 / 验收中 ' + waiting.length + ' 项。' +
        '已验收交付物中准时交付 ' + onTime.length + ' 项，准时交付率 ' + U.pct(onTime.length, pass.length) + '%。' +
        (fail.length ? '验收未通过项需在整改完成后重新提交，未闭环前不计入结项范围。' : '本期无验收退回记录，交付质量稳定。') },
      { h3: '二、验收明细', table: {
        cols: [
          { t: '编号', k: 'id' }, { t: '交付物', k: 'name' }, { t: '类型', k: 'type' },
          { t: '验收方', get: function (r) { return r.acceptBy || '—'; } },
          { t: '验收日期', get: function (r) { return r.acceptAt || '—'; } },
          { t: '结论', get: function (r) { return r.status === '验收不通过' ? '不通过' : '通过'; } },
          { t: '说明', get: function (r) { return r.acceptResult || '—'; } }
        ],
        rows: pass.concat(fail)
      } },
      { h3: '三、验收退回与整改要求', list: fail.length
        ? fail.map(function (d) { return d.id + '「' + d.name + '」由' + (d.acceptBy || '验收方') + '退回：' + (d.acceptResult || '未记录原因') + '，责任人 ' + d.owner + '。'; })
        : ['本期无验收退回记录。'] },
      { h3: '四、待验收队列', table: { cols: DV_COLS, rows: U.sortBy(waiting, 'planDate') } }
    ], ['生成日期：' + U.fmtDate(S.TODAY)]);
  }

  function arcWord(arc, pendingArc, sizeMB) {
    P.word('归档目录', '项目文档归档目录', [
      { h3: '一、归档概览', kv: [
        ['统计口径', P.scopeText()],
        ['已归档文档', arc.length + ' 份'],
        ['待归档', pendingArc.length + ' 份'],
        ['归档体量', sizeMB + ' MB'],
        ['覆盖类型', U.uniq(arc.map(function (d) { return d.type; })).join('、') || '—']
      ] },
      { h3: '二、归档索引', table: {
        cols: [
          { t: '编号', k: 'id' }, { t: '文档名称', k: 'name' }, { t: '类型', k: 'type' },
          { t: '版本', k: 'version' }, { t: '责任人', k: 'owner' },
          { t: '归档日期', get: function (r) { return r.acceptAt || r.planDate; } },
          { t: '归档路径', k: 'docLink' }
        ], rows: arc
      } },
      { h3: '三、待归档清单', list: pendingArc.length
        ? pendingArc.map(function (d) { return d.id + '「' + d.name + '」已于 ' + (d.acceptAt || '—') + ' 验收通过，尚未归档，责任人 ' + d.owner + '。'; })
        : ['已验收交付物已全部完成归档。'] },
      { h3: '四、归档规范说明', list: [
        '归档文档为只读底稿，任何修订均需新建版本并重新走验收流程。',
        '归档路径按「/archive/项目编号/序号」组织，与项目编号一一对应。',
        '结项审计时以本目录为准，未归档的交付物不计入结项范围。'
      ] }
    ], ['生成日期：' + U.fmtDate(S.TODAY)]);
  }

  Shell.page(MOD, {
    render: function (ctx) {
      if (ctx.sub === 'accept') accept(ctx);
      else if (ctx.sub === 'archive') archive(ctx);
      else items(ctx);
    }
  });
})();
