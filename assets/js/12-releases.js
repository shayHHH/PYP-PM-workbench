/* ============================================================
 * 12-releases.js  版本管理
 * 版本计划 / 发布时间线 / 版本对比 / 版本复盘
 * 总监关注节奏与范围（跨产品线），PM 关注进度与阻塞（本项目）。
 * ========================================================== */
(function () {
  'use strict';
  var E = U.esc, MOD = 'releases';

  var DEF = { kw: '', status: '', type: '', risk: '', line: '', owner: '' };

  function pass(r, f) {
    if (f.kw && !(U.match(r.name, f.kw) || U.match(r.id, f.kw) || U.match(r.owner, f.kw) || U.match(r.scope, f.kw))) return false;
    if (f.status && r.status !== f.status) return false;
    if (f.type && r.type !== f.type) return false;
    if (f.risk && r.risk !== f.risk) return false;
    if (f.line && r.lineId !== f.line) return false;
    if (f.owner && r.owner !== f.owner) return false;
    return true;
  }
  function list(f) { return S.rels().filter(function (r) { return pass(r, f); }); }

  function reqsOf(rel) {
    return S.reqs('all').filter(function (q) { return q.releaseId === rel.id; });
  }
  function delayOf(rel) {
    if (rel.realDate) return U.dayDiff(rel.planDate, rel.realDate);
    if (['已发布', '已回滚'].indexOf(rel.status) >= 0) return 0;
    var left = U.daysLeft(rel.planDate);
    return left < 0 ? -left : 0;
  }
  function onTimeText(rel) {
    if (!rel.realDate) return '<span class="muted">未发布</span>';
    var d = U.dayDiff(rel.planDate, rel.realDate);
    if (d <= 0) return UI.tag('按期', 'done');
    return UI.tag('延期 ' + d + ' 天', d > 7 ? 'danger' : 'warn');
  }
  function relTone(rel) {
    if (rel.status === '已回滚') return 'danger';
    if (rel.status === '已发布') return 'done';
    if (rel.status === '待发布') return 'warn';
    if (rel.status === '规划中' || rel.status === '需求冻结') return 'plan';
    return 'doing';
  }

  /* ============ 详情抽屉 ============ */
  function open(rel) {
    var qs = reqsOf(rel);
    var canEd = P.ed(MOD);

    var nodes = [
      ['开发启动', rel.devStart], ['需求冻结', rel.freezeDate], ['提测', rel.testDate],
      ['计划上线', rel.planDate], ['实际上线', rel.realDate]
    ];

    var body =
      UI.sec('版本概要', UI.dl([
        ['版本编号', UI.idCell(rel.id)],
        ['版本类型', UI.tag(rel.type, C.tone('relType', rel.type))],
        ['当前状态', UI.st('status', rel.status)],
        ['所属产品线', E(rel.lineName)],
        ['关联项目', E(rel.projectName)],
        ['发布负责人', UI.owner(rel.owner)],
        ['产品负责人', UI.owner(rel.po)],
        ['风险等级', UI.light(C.tone('light', rel.risk), rel.risk + '风险')],
        ['需求数量', qs.length + ' 条'],
        ['缺陷数量', rel.bugCount + ' 个'],
        ['阻塞事项', rel.blockCount ? UI.tag(rel.blockCount + ' 项', 'danger') : '无'],
        ['按期情况', onTimeText(rel)]
      ], 'dl-2col')) +

      UI.sec('推进进度',
        '<div style="margin-bottom:10px">' + UI.pbar(Math.round(rel.progress * 100), UI.ptone(rel.progress * 100, rel.status === '已回滚'), true) +
        '<div class="flex-b tiny muted" style="margin-top:5px"><span>' + Math.round(rel.progress * 100) + '% 完成</span>' +
        '<span>' + (rel.realDate ? '已于 ' + E(rel.realDate) + ' 发布' : '距计划上线 ' + U.dueText(rel.planDate)) + '</span></div></div>' +
        '<div class="flow">' + nodes.map(function (n) {
          var done = n[1] && U.daysLeft(n[1]) <= 0;
          return '<div class="flow-step' + (n[0] === '计划上线' && !rel.realDate ? ' hot' : '') + '" style="min-width:88px;padding:8px 6px">' +
            '<div class="fs-l">' + (done ? '✓ ' : '') + E(n[0]) + '</div>' +
            '<div class="fs-r">' + E(n[1] || '—') + '</div></div>';
        }).join('') + '</div>') +

      UI.sec('版本范围', '<div style="font-size:var(--f-sm);line-height:1.75;color:var(--t-2)">' +
        (rel.scope ? E(rel.scope) : '<span class="muted">尚未定义版本范围</span>') + '</div>') +

      UI.sec('关联需求（' + qs.length + '）', qs.length
        ? '<div class="list">' + qs.slice(0, 20).map(function (q) {
          return UI.listItem({
            click: true, data: ' data-go="requirements/pool/' + E(q.id) + '"',
            ico: UI.pri(q.priority),
            title: E(q.title),
            meta: '<span>' + E(q.id) + '</span><span>' + E(q.type) + '</span><span>' + E(q.owner) + '</span>',
            right: UI.st('status', q.status)
          });
        }).join('') + '</div>' + (qs.length > 20 ? '<div class="muted tiny center" style="padding:8px">仅显示前 20 条，完整清单见需求池</div>' : '')
        : UI.empty('该版本尚未关联需求'));

    var foot = '<div class="left"><button class="btn" data-word>导出版本说明 Word</button></div>' +
      '<button class="btn" data-close>关闭</button>' +
      (canEd ? '<button class="btn-primary" data-edit>编辑版本</button>' : '');

    var d = UI.drawer({
      wide: true,
      title: E(rel.name) + ' ' + UI.tag(rel.type, C.tone('relType', rel.type)),
      sub: '<span>' + E(rel.id) + '</span><span>' + E(rel.lineName) + '</span><span>' + E(rel.projectName) + '</span>' +
        '<span>计划上线 ' + E(rel.planDate) + '</span>',
      body: body, foot: foot
    });

    d.el.querySelector('[data-word]').addEventListener('click', function () {
      P.word('版本说明_' + rel.id, '版本发布说明 · ' + rel.name, [
        {
          h: '一、版本信息', kv: [
            ['版本编号', rel.id], ['版本名称', rel.name], ['版本类型', rel.type], ['当前状态', rel.status],
            ['所属产品线', rel.lineName], ['关联项目', rel.projectName],
            ['发布负责人', rel.owner], ['产品负责人', rel.po],
            ['开发启动', rel.devStart], ['需求冻结', rel.freezeDate], ['提测时间', rel.testDate],
            ['计划上线', rel.planDate], ['实际上线', rel.realDate || '未发布'],
            ['完成度', Math.round(rel.progress * 100) + '%'],
            ['需求数', qs.length], ['缺陷数', rel.bugCount], ['阻塞项', rel.blockCount], ['风险等级', rel.risk]
          ]
        },
        { h: '二、版本范围', p: rel.scope || '（未定义）' },
        {
          h: '三、需求清单', table: {
            cols: [{ t: '编号', k: 'id' }, { t: '需求名称', k: 'title' }, { t: '类型', k: 'type' },
            { t: '优先级', k: 'priority' }, { t: '状态', k: 'status' }, { t: '负责人', k: 'owner' }],
            rows: qs
          }
        },
        {
          h: '四、发布结论',
          p: rel.realDate
            ? ('该版本已于 ' + rel.realDate + ' 发布，相对计划' + (U.dayDiff(rel.planDate, rel.realDate) <= 0 ? '按期完成。' : ('延期 ' + U.dayDiff(rel.planDate, rel.realDate) + ' 天。'))
              + '累计缺陷 ' + rel.bugCount + ' 个。')
            : ('该版本尚未发布，当前状态「' + rel.status + '」，计划上线 ' + rel.planDate + '，' +
              (rel.blockCount ? '存在 ' + rel.blockCount + ' 项阻塞需优先处理。' : '暂无阻塞事项。'))
        }
      ]);
      UI.toast('已导出版本说明', 'ok');
    });

    var eb = d.el.querySelector('[data-edit]');
    if (eb) eb.addEventListener('click', function () { d.close(); edit(rel); });
  }

  /* ============ 编辑 ============ */
  /* limited（PM）可维护进度 / 缺陷 / 阻塞与状态，但版本节奏（窗口日期、类型、归属）由总监决定 */
  function dateField(k, label, val, req) {
    if (P.full(MOD)) return { k: k, label: label, type: 'date', req: !!req, val: val };
    return {
      k: k, label: label, type: 'static', val: val,
      html: '<span>' + E(val || '—') + '</span> <span class="muted tiny">总监排期</span>'
    };
  }
  function edit(rel) {
    var fs = [
      { k: 'name', label: '版本名称', req: true, full: true, val: rel.name },
      P.full(MOD)
        ? { k: 'type', label: '版本类型', type: 'select', req: true, opts: C.DICT.relType, val: rel.type }
        : { k: 'type', label: '版本类型', type: 'static', val: rel.type, html: UI.tag(rel.type, C.tone('relType', rel.type)) },
      { k: 'status', label: '当前状态', type: 'select', req: true, opts: C.DICT.relStatus, val: rel.status },
      P.full(MOD)
        ? { k: 'lineId', label: '所属产品线', type: 'select', req: true, opts: P.lineOpts(), val: rel.lineId }
        : { k: 'lineId', label: '所属产品线', type: 'static', val: rel.lineId, html: E(rel.lineName) },
      P.full(MOD)
        ? { k: 'projectId', label: '关联项目', type: 'select', req: true, opts: P.projOpts(), val: rel.projectId }
        : { k: 'projectId', label: '关联项目', type: 'static', val: rel.projectId, html: E(rel.projectName) },
      { k: 'owner', label: '发布负责人', type: 'select', req: true, opts: P.memberNames(), val: rel.owner },
      { k: 'po', label: '产品负责人', type: 'select', opts: P.memberNames(), val: rel.po },
      dateField('devStart', '开发启动', rel.devStart),
      dateField('freezeDate', '需求冻结', rel.freezeDate),
      dateField('testDate', '提测时间', rel.testDate),
      dateField('planDate', '计划上线', rel.planDate, true),
      { k: 'realDate', label: '实际上线', type: 'date', val: rel.realDate },
      { k: 'risk', label: '风险等级', type: 'select', req: true, opts: C.DICT.riskLevel, val: rel.risk },
      { k: 'progress', label: '完成度 %', type: 'number', min: 0, max: 100, val: Math.round(rel.progress * 100) },
      { k: 'bugCount', label: '缺陷数', type: 'number', min: 0, val: rel.bugCount },
      { k: 'blockCount', label: '阻塞项', type: 'number', min: 0, val: rel.blockCount },
      { k: 'scope', label: '版本范围', type: 'textarea', full: true, rows: 3, val: rel.scope }
    ];
    UI.formModal({
      title: '编辑版本 · ' + rel.id, wide: true, fields: fs,
      tip: S.isPM() ? '项目经理可维护进度、缺陷与阻塞；调整上线窗口需与产品总监确认。' : '版本节奏调整会写入工作留痕。',
      onSubmit: function (d) {
        /* limited 口径下这些字段渲染为 static，不进表单读值，统一回落到原值 */
        var canAll = P.full(MOD);
        var g = function (k) { return canAll ? d[k] : rel[k]; };
        var lineId = g('lineId'), projectId = g('projectId'), planDate = g('planDate');
        var line = S.lineBy(lineId) || {}, prj = S.projBy(projectId) || {};
        S.update('releases', rel.id, {
          name: d.name, type: g('type'), status: d.status,
          lineId: lineId, lineName: line.name || '', projectId: projectId, projectName: prj.name || '',
          owner: d.owner, po: d.po,
          devStart: g('devStart'), freezeDate: g('freezeDate'), testDate: g('testDate'),
          planDate: planDate, realDate: d.realDate, risk: d.risk,
          progress: U.clamp(U.num(d.progress, 0), 0, 100) / 100,
          bugCount: U.num(d.bugCount, 0), blockCount: U.num(d.blockCount, 0),
          delayDays: d.realDate ? U.dayDiff(planDate, d.realDate) : 0,
          scope: d.scope || ''
        });
        UI.toast('版本已更新', 'ok');
        Shell.route();
      }
    });
  }

  /* ============ 子页 1：版本计划 ============ */
  function plan(ctx) {
    var f = P.flt(MOD, DEF), v = C.viewOf(S.role(), MOD), cols = v.cols || [];
    var all = S.rels(), rows = list(f);
    var ot = S.releaseOnTime();

    var cs = [
      { k: 'id', t: '编号', w: '68px', render: function (r) { return UI.idCell(r.id); } },
      {
        k: 'name', t: '版本名称', cls: 'ellip',
        render: function (r) {
          return UI.cell2(E(r.name) + ' ' + UI.tag(r.type, C.tone('relType', r.type)),
            E(r.scope || r.projectName));
        }
      },
      {
        k: 'status', t: '状态', w: '86px',
        render: function (r) { return UI.st('status', r.status); },
        sortVal: function (r) { return C.DICT.relStatus.indexOf(r.status); }
      },
      { k: 'reqCount', t: '需求', w: '62px', align: 'right', render: function (r) { return reqsOf(r).length; } }
    ];
    if (cols.indexOf('line') >= 0) cs.push({ k: 'lineName', t: '产品线', w: '128px' });
    if (cols.indexOf('scope') >= 0) cs.push({
      k: 'scope', t: '版本范围', cls: 'ellip',
      render: function (r) { return r.scope ? '<span class="muted">' + E(U.ellip(r.scope, 24)) + '</span>' : '<span class="muted">—</span>'; }
    });
    if (cols.indexOf('progress') >= 0) cs.push({ k: 'progress', t: '进度', w: '132px', render: function (r) { return P.pctCell(r.progress, r.status === '已回滚'); } });
    if (cols.indexOf('blocked') >= 0) cs.push({
      k: 'blockCount', t: '阻塞/缺陷', w: '104px', align: 'center',
      render: function (r) {
        return (r.blockCount ? UI.tag('阻塞 ' + r.blockCount, 'danger') : '<span class="muted">无阻塞</span>') +
          '<div class="cell-sub">缺陷 ' + r.bugCount + '</div>';
      }
    });
    cs.push({
      k: 'risk', t: '风险', w: '74px', align: 'center',
      render: function (r) { return UI.light(C.tone('light', r.risk)); },
      sortVal: function (r) { return C.DICT.riskLevel.indexOf(r.risk); }
    });
    cs.push({
      k: 'planDate', t: '计划上线', w: '116px',
      render: function (r) {
        if (r.realDate) return '<span class="muted">' + E(r.planDate) + '</span><div class="cell-sub">实际 ' + E(r.realDate) + '</div>';
        return UI.due(r.planDate);
      }
    });
    cs.push({
      k: '', t: '操作', w: '104px', sortable: false, align: 'right',
      render: function () {
        return '<div class="row-acts" style="justify-content:flex-end">' +
          '<button data-act="detail">详情</button>' +
          (P.ed(MOD) ? '<button data-act="edit">编辑</button>' : '') + '</div>';
      }
    });

    var CSV = [
      { label: '编号', key: 'id' }, { label: '版本名称', key: 'name' }, { label: '类型', key: 'type' },
      { label: '状态', key: 'status' }, { label: '产品线', key: 'lineName' }, { label: '项目', key: 'projectName' },
      { label: '负责人', key: 'owner' }, { label: '需求数', get: function (r) { return reqsOf(r).length; } },
      { label: '缺陷数', key: 'bugCount' }, { label: '阻塞项', key: 'blockCount' },
      { label: '完成度', get: function (r) { return Math.round(r.progress * 100) + '%'; } },
      { label: '开发启动', key: 'devStart' }, { label: '需求冻结', key: 'freezeDate' },
      { label: '提测', key: 'testDate' }, { label: '计划上线', key: 'planDate' }, { label: '实际上线', key: 'realDate' },
      { label: '风险', key: 'risk' }, { label: '版本范围', key: 'scope' }
    ];

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: '版本计划',
        desc: '当前口径：' + E(P.scopeText()) + '　·　共 <b>' + rows.length + '</b> 个版本（全量 ' + all.length + '）',
        acts: UI.exportMenu({ word: true }) + '　' + P.createBtn(MOD, 'release.new', '新建版本')
      }) +
      P.permTip(MOD) +
      P.statCards([
        { label: '版本总数', val: all.length, unit: '个', ico: '⬢', sub: '规划中 ' + all.filter(function (r) { return r.status === '规划中'; }).length },
        { label: '待上线', val: all.filter(function (r) { return ['待发布', '测试中'].indexOf(r.status) >= 0; }).length, unit: '个', ico: '⏱', tone: 'warn', sub: '开发中 ' + all.filter(function (r) { return r.status === '开发中'; }).length },
        { label: '已发布', val: all.filter(function (r) { return r.status === '已发布'; }).length, unit: '个', ico: '✓', tone: 'done', sub: '回滚 ' + all.filter(function (r) { return r.status === '已回滚'; }).length + ' 个' },
        { label: '版本按期率', val: ot.rate, unit: '%', ico: '◔', tone: ot.rate >= 85 ? 'done' : (ot.rate >= 70 ? 'warn' : 'danger'), sub: ot.ok + '/' + ot.total + ' 个按期' }
      ]) +
      P.gap(4) +
      UI.card({
        flush: true,
        body: '<div class="toolbar" id="relFlt">' +
          '<input class="fld fld-search" data-f="kw" placeholder="搜索版本名称 / 编号 / 负责人 / 范围" value="' + E(f.kw) + '">' +
          P.sel('status', '全部状态', C.DICT.relStatus, f.status) +
          P.sel('type', '全部类型', C.DICT.relType, f.type) +
          P.sel('risk', '全部风险', C.DICT.riskLevel, f.risk) +
          (S.isDirector() ? P.sel('line', '全部产品线', P.lineOpts(), f.line)
            : P.sel('owner', '全部负责人', P.memberNames(), f.owner)) +
          '<button class="btn-sm" data-reset>重置</button>' +
          '<span class="grow"></span>' + P.viewBar(MOD) +
          '</div><div id="relTbl"></div>'
      });

    var tb = UI.table('#relTbl', {
      cols: cs, rows: rows, pageSize: 12, index: true, select: true,
      sort: { k: 'planDate', desc: !!v.desc },
      rowCls: function (r) {
        if (r.status === '已回滚') return 'row-danger';
        return (!r.realDate && U.daysLeft(r.planDate) < 0) ? 'row-danger' : '';
      },
      footNote: '默认排序：' + (v.note || '—'),
      onRow: open,
      onAct: function (act, r) { act === 'edit' ? edit(r) : open(r); },
      bulk: bulkActions(),
      empty: UI.empty('没有符合筛选条件的版本'),
      onToolbar: function () { }
    });

    var box = document.getElementById('relFlt');
    P.bindFlt(box, MOD, DEF, function (nf) {
      var nr = list(nf);
      tb.setRows(nr);
      var hd = ctx.el.querySelector('.page-desc');
      if (hd) hd.innerHTML = '当前口径：' + E(P.scopeText()) + '　·　共 <b>' + nr.length + '</b> 个版本（全量 ' + all.length + '）';
    });
    P.bindViews(box, MOD, DEF);

    UI.bindExport(ctx.el, {
      csv: function () { U.exportCSV('版本计划', tb.view(), CSV); },
      word: function () { wordPlan(tb.view()); }
    });
  }

  function wordPlan(rows) {
    var ot = S.releaseOnTime();
    P.word('版本计划', '版本计划与节奏报告', [
      {
        h: '一、整体节奏', p: '本次导出共 ' + rows.length + ' 个版本，口径为「' + P.scopeText() + '」。' +
          '已发布版本按期率 ' + ot.rate + '%（' + ot.ok + '/' + ot.total + '）。'
      },
      {
        h: '二、版本清单', table: {
          cols: [
            { t: '编号', k: 'id' }, { t: '版本名称', k: 'name' }, { t: '类型', k: 'type' }, { t: '状态', k: 'status' },
            { t: '产品线', k: 'lineName' }, { t: '负责人', k: 'owner' },
            { t: '需求数', get: function (r) { return reqsOf(r).length; } },
            { t: '完成度', get: function (r) { return Math.round(r.progress * 100) + '%'; } },
            { t: '计划上线', k: 'planDate' }, { t: '实际上线', k: 'realDate' }, { t: '风险', k: 'risk' }
          ], rows: rows
        }
      },
      {
        h: '三、待上线版本关注点',
        list: rows.filter(function (r) { return ['待发布', '测试中', '开发中'].indexOf(r.status) >= 0; })
          .map(function (r) {
            return r.name + '（' + r.status + '）计划 ' + r.planDate + '，完成度 ' + Math.round(r.progress * 100) + '%，' +
              (r.blockCount ? '阻塞 ' + r.blockCount + ' 项，' : '') + '缺陷 ' + r.bugCount + ' 个，风险 ' + r.risk + '。';
          })
      }
    ]);
  }

  function bulkActions() {
    if (!P.ed(MOD)) {
      return [{
        t: '批量导出所选', fn: function (picked, clear) {
          U.exportCSV('版本_所选', picked, [
            { label: '编号', key: 'id' }, { label: '版本名称', key: 'name' },
            { label: '状态', key: 'status' }, { label: '计划上线', key: 'planDate' }
          ]);
          UI.toast('已导出 ' + picked.length + ' 个版本'); clear();
        }
      }];
    }
    return [
      {
        t: '批量调整状态', fn: function (picked, clear) {
          if (!picked.length) return;
          UI.formModal({
            title: '批量调整版本状态（' + picked.length + ' 个）', one: true,
            fields: [{ k: 'status', label: '目标状态', type: 'select', req: true, opts: C.DICT.relStatus, val: '测试中' }],
            onSubmit: function (d) {
              picked.forEach(function (r) { S.update('releases', r.id, { status: d.status }); });
              UI.toast('已更新 ' + picked.length + ' 个版本状态', 'ok'); clear(); Shell.route();
            }
          });
        }
      },
      P.full(MOD) ? {
        t: '批量顺延上线日', fn: function (picked, clear) {
          if (!picked.length) return;
          UI.formModal({
            title: '批量顺延计划上线日（' + picked.length + ' 个）', one: true,
            tip: '顺延会影响下游需求的期望交付时间，请同步在版本复盘中说明原因。',
            fields: [{ k: 'days', label: '顺延天数', type: 'number', req: true, min: 1, val: 7 }],
            onSubmit: function (d) {
              var n = U.num(d.days, 7);
              picked.forEach(function (r) {
                S.update('releases', r.id, { planDate: U.fmtDate(U.addDay(r.planDate, n)) });
              });
              UI.toast('已顺延 ' + n + ' 天', 'ok'); clear(); Shell.route();
            }
          });
        }
      } : null,
      {
        t: '批量导出说明', fn: function (picked, clear) {
          if (!picked.length) return;
          wordPlan(picked); UI.toast('已导出所选版本说明'); clear();
        }
      }
    ].filter(Boolean);
  }

  /* ============ 子页 2：发布时间线 ============ */
  function timeline(ctx) {
    var rows = U.sortBy(S.rels(), 'planDate');
    if (!rows.length) { ctx.el.innerHTML = P.head({ mod: MOD, title: '发布时间线' }) + P.emptyMod(); return; }

    var future = rows.filter(function (r) { return !r.realDate; });
    var past = rows.filter(function (r) { return r.realDate; });

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: '发布时间线',
        desc: '按计划上线日期排布的版本节奏 · ' + E(P.scopeText()) + '　·　已发布 ' + past.length + ' 个，待发布 ' + future.length + ' 个',
        acts: '<button class="btn" data-print>打印时间线</button>'
      }) +
      UI.card({
        title: '版本发布节点', sub: '点击节点查看版本详情',
        extra: '<span class="muted tiny">灰=规划 · 蓝=进行 · 橙=待发布 · 绿=已发布 · 红=回滚</span>',
        body: '<div id="relTL"></div>'
      }) + P.gap(4) +
      UI.grid(2,
        UI.card({
          title: '版本窗口甘特', sub: '开发启动 → 计划上线',
          body: '<div id="relGantt"></div>'
        }) +
        UI.card({
          title: '即将到来的发布', sub: '按计划上线日期升序',
          body: future.length
            ? '<div class="list">' + future.slice(0, 10).map(function (r) {
              return UI.listItem({
                click: true, data: ' data-rel="' + E(r.id) + '"',
                ico: '⬢', icoStyle: 'background:var(--c-bg-2)',
                title: E(r.name) + ' ' + UI.st('status', r.status),
                desc: E(r.lineName) + ' · ' + E(r.projectName) + ' · 负责人 ' + E(r.owner),
                meta: '需求 ' + reqsOf(r).length + ' 条 · 缺陷 ' + r.bugCount + ' 个' + (r.blockCount ? ' · 阻塞 ' + r.blockCount + ' 项' : ''),
                right: UI.due(r.planDate) + '<div class="cell-sub">' + Math.round(r.progress * 100) + '%</div>'
              });
            }).join('') + '</div>'
            : UI.empty('当前口径下没有待发布版本')
        })
      );

    CH.timeline('relTL', {
      items: rows.map(function (r) {
        return { id: r.id, label: r.name, date: r.realDate || r.planDate, tone: relTone(r), sub: r.status + ' · ' + r.lineName };
      }),
      onClick: function (it) { var r = S.relBy(it.id); if (r) open(r); }
    });

    CH.gantt('relGantt', {
      maxH: 360,
      rows: rows.map(function (r) {
        return {
          id: r.id, name: r.name, type: 'bar',
          start: r.devStart, end: r.realDate || r.planDate,
          progress: Math.round(r.progress * 100), tone: relTone(r),
          label: r.status, right: r.lineName
        };
      }),
      legend: [{ name: '已发布', tone: 'done' }, { name: '进行中', tone: 'doing' },
      { name: '待发布', tone: 'warn' }, { name: '规划中', tone: 'plan' }, { name: '已回滚', tone: 'danger' }],
      onClick: function (row) { var r = S.relBy(row.id); if (r) open(r); }
    });

    ctx.el.querySelectorAll('[data-rel]').forEach(function (n) {
      n.addEventListener('click', function () { var r = S.relBy(n.getAttribute('data-rel')); if (r) open(r); });
    });
    var pb = ctx.el.querySelector('[data-print]');
    if (pb) pb.addEventListener('click', function () { U.printPage(); });
  }

  /* ============ 子页 3：版本对比 ============ */
  function compare(ctx) {
    var all = U.sortBy(S.rels(), 'planDate', true);
    if (all.length < 2) { ctx.el.innerHTML = P.head({ mod: MOD, title: '版本对比' }) + P.emptyMod('当前口径下版本不足 2 个，无法对比'); return; }

    var picked = S.pref(MOD, 'cmp', null);
    if (!picked || !picked.length || picked.some(function (id) { return !S.relBy(id); })) {
      picked = all.slice(0, Math.min(3, all.length)).map(function (r) { return r.id; });
    }
    var sel = picked.map(function (id) { return S.relBy(id); }).filter(Boolean);

    var METRIC = [
      { t: '需求数量', get: function (r) { return reqsOf(r).length; }, unit: '条' },
      { t: '已上线需求', get: function (r) { return reqsOf(r).filter(function (q) { return q.status === '已上线'; }).length; }, unit: '条' },
      { t: '缺陷数量', get: function (r) { return r.bugCount; }, unit: '个', bad: true },
      { t: '阻塞事项', get: function (r) { return r.blockCount; }, unit: '项', bad: true },
      { t: '延期天数', get: function (r) { return delayOf(r); }, unit: '天', bad: true },
      { t: '研发周期', get: function (r) { return U.dayDiff(r.devStart, r.realDate || r.planDate); }, unit: '天' },
      { t: '完成度', get: function (r) { return Math.round(r.progress * 100); }, unit: '%' }
    ];

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: '版本对比',
        desc: '选择 2~3 个版本，横向比较范围、质量与节奏表现',
        acts: UI.exportMenu({ word: true, csv: false })
      }) +
      UI.card({
        flush: true,
        body: '<div class="toolbar" id="cmpBar">' +
          '<span class="muted tiny">对比版本：</span>' +
          [0, 1, 2].map(function (i) {
            return P.sel('c' + i, i < 2 ? '（必选）' : '（可选）', P.opts(all, 'id', 'name'), picked[i] || '');
          }).join('') +
          '<button class="btn-sm" data-cmp-reset>重置为最近三个版本</button></div>'
      }) + P.gap(4) +
      UI.grid(sel.length > 2 ? 3 : 2, sel.map(function (r) {
        return UI.card({
          title: r.name, sub: r.lineName,
          extra: UI.st('status', r.status),
          body: UI.dl([
            ['版本类型', UI.tag(r.type, C.tone('relType', r.type))],
            ['计划上线', E(r.planDate)],
            ['实际上线', r.realDate ? E(r.realDate) : '<span class="muted">未发布</span>'],
            ['按期情况', onTimeText(r)],
            ['负责人', UI.owner(r.owner)],
            ['完成度', UI.pcell(Math.round(r.progress * 100))]
          ])
        });
      }).join('')) + P.gap(4) +
      UI.grid(2,
        UI.card({ title: '关键指标对比', body: '<div id="cmpBar1"></div>' }) +
        UI.card({ title: '需求状态构成', sub: '各版本需求当前所处状态', body: '<div id="cmpBar2"></div>' })
      ) + P.gap(4) +
      UI.card({
        title: '指标明细', flush: true,
        body: '<div class="tbl-wrap"><table class="tbl"><thead><tr><th style="width:160px">指标</th>' +
          sel.map(function (r) { return '<th>' + E(r.name) + '</th>'; }).join('') + '</tr></thead><tbody>' +
          METRIC.map(function (m) {
            var vals = sel.map(m.get);
            var best = m.bad ? Math.min.apply(null, vals) : Math.max.apply(null, vals);
            return '<tr><td><b>' + E(m.t) + '</b></td>' + vals.map(function (v) {
              return '<td>' + v + ' <span class="muted tiny">' + E(m.unit) + '</span>' +
                (v === best && vals.length > 1 ? ' ' + UI.tag(m.bad ? '最优' : '最高', 'done') : '') + '</td>';
            }).join('') + '</tr>';
          }).join('') +
          '<tr><td><b>版本范围</b></td>' + sel.map(function (r) {
            return '<td class="tiny muted">' + E(r.scope || '—') + '</td>';
          }).join('') + '</tr></tbody></table></div>'
      });

    CH.bar('cmpBar1', {
      labels: ['需求数', '缺陷数', '阻塞项', '延期天数'],
      series: sel.map(function (r) {
        return { name: r.name, data: [reqsOf(r).length, r.bugCount, r.blockCount, delayOf(r)] };
      }),
      height: 250
    });

    var STS = ['已上线', '待发布', '测试中', '开发中', '设计中', '排期中'];
    CH.bar('cmpBar2', {
      labels: sel.map(function (r) { return r.name; }),
      stack: true, height: 250,
      series: STS.map(function (s) {
        return { name: s, data: sel.map(function (r) { return reqsOf(r).filter(function (q) { return q.status === s; }).length; }) };
      })
    });

    var bar = document.getElementById('cmpBar');
    bar.querySelectorAll('[data-f]').forEach(function (n) {
      n.addEventListener('change', function () {
        var next = [0, 1, 2].map(function (i) {
          var el = bar.querySelector('[data-f="c' + i + '"]');
          return el ? el.value : '';
        }).filter(Boolean);
        next = U.uniq(next);
        if (next.length < 2) { UI.toast('至少选择 2 个版本进行对比', 'warn'); return; }
        S.setPref(MOD, 'cmp', next);
        Shell.route();
      });
    });
    bar.querySelector('[data-cmp-reset]').addEventListener('click', function () {
      S.setPref(MOD, 'cmp', null);
      Shell.route();
    });

    UI.bindExport(ctx.el, {
      csv: function () { },
      word: function () {
        P.word('版本对比', '版本对比分析报告', [
          { h: '一、对比范围', p: '本次对比版本：' + sel.map(function (r) { return r.name; }).join('、') + '。口径「' + P.scopeText() + '」。' },
          {
            h: '二、关键指标', table: {
              cols: [{ t: '指标', get: function (x) { return x[0]; } }].concat(sel.map(function (r, i) {
                return { t: r.name, get: function (x) { return x[i + 1]; } };
              })),
              rows: METRIC.map(function (m) { return [m.t + '（' + m.unit + '）'].concat(sel.map(m.get)); })
            }
          },
          {
            h: '三、版本范围',
            table: {
              cols: [{ t: '版本', k: 'name' }, { t: '状态', k: 'status' }, { t: '计划上线', k: 'planDate' },
              { t: '实际上线', k: 'realDate' }, { t: '范围', k: 'scope' }],
              rows: sel
            }
          }
        ]);
      }
    });
  }

  /* ============ 子页 4：版本复盘 ============ */
  function retro(ctx) {
    var done = S.rels().filter(function (r) { return r.realDate; });
    if (!done.length) { ctx.el.innerHTML = P.head({ mod: MOD, title: '版本复盘' }) + P.emptyMod('当前口径下还没有已发布版本可复盘'); return; }

    var sorted = U.sortBy(done, 'realDate', true);
    var onTime = done.filter(function (r) { return U.dayDiff(r.planDate, r.realDate) <= 0; });
    var avgDelay = U.avg(done, function (r) { return Math.max(0, U.dayDiff(r.planDate, r.realDate)); });
    var avgCycle = U.avg(done, function (r) { return U.dayDiff(r.devStart, r.realDate); });
    var rollback = done.filter(function (r) { return r.status === '已回滚'; });

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: '版本复盘',
        desc: '已发布版本的按期表现、质量与节奏复盘 · ' + E(P.scopeText()),
        acts: UI.exportMenu({ word: true })
      }) +
      P.statCards([
        { label: '已发布版本', val: done.length, unit: '个', ico: '⬢', sub: '回滚 ' + rollback.length + ' 个' },
        { label: '按期发布率', val: U.pct(onTime.length, done.length), unit: '%', ico: '◔', tone: U.pct(onTime.length, done.length) >= 85 ? 'done' : 'warn', sub: onTime.length + '/' + done.length + ' 个按期' },
        { label: '平均延期', val: avgDelay.toFixed(1), unit: '天', ico: '⏱', tone: avgDelay > 5 ? 'danger' : (avgDelay > 2 ? 'warn' : 'done'), sub: '延期版本 ' + (done.length - onTime.length) + ' 个' },
        { label: '平均研发周期', val: Math.round(avgCycle), unit: '天', ico: '▤', sub: '开发启动 → 实际上线' }
      ]) + P.gap(4) +
      UI.grid(2,
        UI.card({ title: '各版本延期天数', sub: '0 表示按期或提前', body: '<div id="retroDelay"></div>' }) +
        UI.card({ title: '缺陷数 vs 需求数', sub: '衡量版本规模与质量', body: '<div id="retroQ"></div>' })
      ) + P.gap(4) +
      UI.card({
        title: '按产品线的发布表现', flush: true,
        body: '<div id="retroLine"></div>'
      }) + P.gap(4) +
      UI.card({
        title: '版本复盘清单', sub: '点击查看版本详情', flush: true,
        body: '<div id="retroTbl"></div>'
      });

    CH.bar('retroDelay', {
      labels: sorted.map(function (r) { return r.name.split(' ')[0]; }),
      series: [{
        name: '延期天数',
        data: sorted.map(function (r) { return Math.max(0, U.dayDiff(r.planDate, r.realDate)); })
      }],
      height: 240, valueLabel: true,
      onClick: function (i) { open(sorted[i]); }
    });

    CH.bar('retroQ', {
      labels: sorted.map(function (r) { return r.name.split(' ')[0]; }),
      series: [
        { name: '需求数', data: sorted.map(function (r) { return reqsOf(r).length; }) },
        { name: '缺陷数', data: sorted.map(function (r) { return r.bugCount; }), color: '#dc2626' }
      ],
      height: 240
    });

    var lines = S.linesInScope();
    CH.bars('retroLine', {
      data: lines.map(function (l) {
        var rs = done.filter(function (r) { return r.lineId === l.id; });
        var ok = rs.filter(function (r) { return U.dayDiff(r.planDate, r.realDate) <= 0; }).length;
        return {
          label: l.name, value: U.pct(ok, rs.length),
          text: U.pct(ok, rs.length) + '%（' + ok + '/' + rs.length + '）',
          color: U.pct(ok, rs.length) >= 85 ? '#16a34a' : (U.pct(ok, rs.length) >= 60 ? '#d97706' : '#dc2626')
        };
      }).filter(function (d) { return d.text.indexOf('/0') < 0; }),
      max: 100
    });

    UI.table('#retroTbl', {
      rows: sorted, pageSize: 10, index: true,
      cols: [
        { k: 'name', t: '版本', cls: 'ellip', render: function (r) { return UI.cell2(E(r.name), E(r.lineName) + ' · ' + E(r.type)); } },
        { k: 'status', t: '状态', w: '82px', render: function (r) { return UI.st('status', r.status); } },
        { k: 'planDate', t: '计划上线', w: '106px' },
        { k: 'realDate', t: '实际上线', w: '106px' },
        {
          k: 'delay', t: '按期情况', w: '116px', align: 'center',
          render: onTimeText, sortVal: function (r) { return U.dayDiff(r.planDate, r.realDate); }
        },
        { k: 'reqCount', t: '需求数', w: '76px', align: 'right', render: function (r) { return reqsOf(r).length; } },
        { k: 'bugCount', t: '缺陷数', w: '76px', align: 'right' },
        {
          k: 'cycle', t: '研发周期', w: '92px', align: 'right',
          render: function (r) { return U.dayDiff(r.devStart, r.realDate) + ' 天'; },
          sortVal: function (r) { return U.dayDiff(r.devStart, r.realDate); }
        },
        { k: 'owner', t: '负责人', w: '104px', render: function (r) { return UI.owner(r.owner); } }
      ],
      sort: { k: 'realDate', desc: true },
      rowCls: function (r) { return r.status === '已回滚' ? 'row-danger' : ''; },
      onRow: open,
      footNote: '按实际上线时间倒序'
    });

    UI.bindExport(ctx.el, {
      csv: function () {
        U.exportCSV('版本复盘', sorted, [
          { label: '版本', key: 'name' }, { label: '产品线', key: 'lineName' }, { label: '类型', key: 'type' },
          { label: '状态', key: 'status' }, { label: '计划上线', key: 'planDate' }, { label: '实际上线', key: 'realDate' },
          { label: '延期天数', get: function (r) { return Math.max(0, U.dayDiff(r.planDate, r.realDate)); } },
          { label: '需求数', get: function (r) { return reqsOf(r).length; } },
          { label: '缺陷数', key: 'bugCount' },
          { label: '研发周期', get: function (r) { return U.dayDiff(r.devStart, r.realDate); } },
          { label: '负责人', key: 'owner' }
        ]);
      },
      word: function () {
        P.word('版本复盘', '版本发布复盘报告', [
          {
            h: '一、总体表现', kv: [
              ['已发布版本', done.length + ' 个'],
              ['按期发布率', U.pct(onTime.length, done.length) + '%'],
              ['平均延期', avgDelay.toFixed(1) + ' 天'],
              ['平均研发周期', Math.round(avgCycle) + ' 天'],
              ['回滚版本', rollback.length + ' 个'],
              ['统计口径', P.scopeText()]
            ]
          },
          {
            h: '二、版本明细', table: {
              cols: [
                { t: '版本', k: 'name' }, { t: '产品线', k: 'lineName' }, { t: '类型', k: 'type' },
                { t: '计划上线', k: 'planDate' }, { t: '实际上线', k: 'realDate' },
                { t: '延期(天)', get: function (r) { return Math.max(0, U.dayDiff(r.planDate, r.realDate)); } },
                { t: '需求数', get: function (r) { return reqsOf(r).length; } },
                { t: '缺陷数', k: 'bugCount' }, { t: '负责人', k: 'owner' }
              ], rows: sorted
            }
          },
          {
            h: '三、问题与改进建议',
            list: [
              avgDelay > 3 ? '平均延期 ' + avgDelay.toFixed(1) + ' 天，建议在需求冻结环节收紧范围变更。' : '整体节奏稳定，平均延期控制在 3 天以内。',
              rollback.length ? '存在 ' + rollback.length + ' 个回滚版本，需在发布前补强灰度与回归验证。' : '本期无回滚版本，发布质量可控。',
              '建议将缺陷数 / 需求数比值纳入版本准入门槛，超过阈值的版本延后发布。'
            ]
          }
        ]);
      }
    });
  }

  /* ============ 注册 ============ */
  Shell.page(MOD, {
    render: function (ctx) {
      if (ctx.sub === 'timeline') timeline(ctx);
      else if (ctx.sub === 'compare') compare(ctx);
      else if (ctx.sub === 'retro') retro(ctx);
      else plan(ctx);
      if (ctx.id) { var r = S.relBy(ctx.id); if (r) open(r); }
    }
  });
})();
