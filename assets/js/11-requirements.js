/* ============================================================
 * 11-requirements.js  需求管理
 * 需求池 / 优先级管理 / 状态流转 / PRD 归档
 * 两个角色看同一份需求数据，差别在：口径（产品线 vs 单项目）、
 * 默认排序与可见列、以及能否直接改优先级与状态。
 * ========================================================== */
(function () {
  'use strict';
  var E = U.esc, MOD = 'requirements';

  var DEF = { kw: '', status: '', type: '', source: '', pri: '', line: '', release: '', tag: '' };

  function pass(r, f) {
    if (f.kw && !(U.match(r.title, f.kw) || U.match(r.id, f.kw) || U.match(r.owner, f.kw) ||
      U.match((r.tags || []).join(' '), f.kw) || U.match(r.proposer, f.kw))) return false;
    if (f.status && r.status !== f.status) return false;
    if (f.type && r.type !== f.type) return false;
    if (f.source && r.source !== f.source) return false;
    if (f.pri && r.priority !== f.pri) return false;
    if (f.line && r.lineId !== f.line) return false;
    if (f.release && r.releaseId !== f.release) return false;
    if (f.tag && (r.tags || []).indexOf(f.tag) < 0) return false;
    return true;
  }
  function list(f) { return S.reqs().filter(function (r) { return pass(r, f); }); }

  /* ============ 详情抽屉 ============ */
  function open(r) {
    var canEd = P.ed(MOD);
    var rel = r.releaseId ? S.relBy(r.releaseId) : null;

    var body =
      UI.sec('基础信息', UI.dl([
        ['需求编号', UI.idCell(r.id)],
        ['当前状态', UI.st('status', r.status)],
        ['需求类型', UI.tag(r.type, C.tone('reqType', r.type))],
        ['优先级', UI.pri(r.priority)],
        ['所属产品线', E(r.lineName)],
        ['关联项目', E(r.projectName)],
        ['目标版本', rel ? '<span class="link" data-go="releases/plan/' + E(rel.id) + '">' + E(rel.name) + '</span>' : '<span class="muted">未排期</span>'],
        ['需求来源', E(r.source)],
        ['提出人', E(r.proposer)],
        ['产品负责人', UI.owner(r.owner)],
        ['业务价值', '<b>' + r.value + '</b> / 10'],
        ['投入人日', r.effort + ' 人日'],
        ['投入产出比', '<b>' + r.roi + '</b>'],
        ['创建时间', E(r.createAt)],
        ['评审时间', E(r.reviewAt)],
        ['上线时间', E(r.onlineAt)],
        ['期望交付', UI.due(r.due)],
        ['流转周期', r.status === '已上线' ? r.cycleDays + ' 天' : '<span class="muted">进行中</span>'],
        ['变更次数', r.changeCount ? UI.tag(r.changeCount + ' 次', 'warn') : '0 次'],
        ['标签', (r.tags || []).map(function (t) { return UI.tag(t, 'plain'); }).join(' ')]
      ], 'dl-2col')) +

      UI.sec('推进进度', '<div style="margin-bottom:10px">' + UI.pbar(Math.round(r.progress * 100), UI.ptone(r.progress * 100), true) +
        '<div class="flex-b tiny muted" style="margin-top:5px"><span>' + Math.round(r.progress * 100) + '% 完成</span>' +
        '<span>PRD ' + (r.prdVer ? E(r.prdVer) : '未创建') + (r.prdArchived ? ' · 已归档' : ' · 未归档') + '</span></div></div>' +
        flowStrip(r.status)) +

      UI.sec('需求描述', '<div style="font-size:var(--f-sm);line-height:1.75;color:var(--t-2)">' + E(r.desc) + '</div>') +

      UI.sec('验收标准', '<div class="list">' + (r.acceptance || []).map(function (a, i) {
        return UI.listItem({ ico: String(i + 1), title: E(a) });
      }).join('') + '</div>');

    var foot = '<div class="left">' +
      '<button class="btn" data-word>导出该需求 Word</button></div>' +
      '<button class="btn" data-close>关闭</button>' +
      (canEd ? '<button class="btn-primary" data-edit>编辑需求</button>'
        : '<button class="btn" data-change>提交需求变更</button>');

    var d = UI.drawer({
      wide: true,
      title: E(r.title) + ' ' + UI.pri(r.priority),
      sub: '<span>' + E(r.id) + '</span><span>' + E(r.lineName) + '</span><span>' + E(r.projectName) + '</span>' +
        '<span>负责人 ' + E(r.owner) + '</span>',
      body: body, foot: foot
    });

    d.el.querySelector('[data-word]').addEventListener('click', function () {
      P.word('需求_' + r.id, '需求说明书 · ' + r.title, [
        {
          h: '一、需求概要', kv: [
            ['需求编号', r.id], ['需求名称', r.title], ['需求类型', r.type], ['优先级', r.priority],
            ['所属产品线', r.lineName], ['关联项目', r.projectName], ['目标版本', r.releaseName || '未排期'],
            ['需求来源', r.source], ['提出人', r.proposer], ['产品负责人', r.owner],
            ['当前状态', r.status], ['期望交付', r.due], ['业务价值', r.value + ' / 10'],
            ['投入人日', r.effort], ['ROI', r.roi], ['变更次数', r.changeCount]
          ]
        },
        { h: '二、需求描述', p: r.desc },
        { h: '三、验收标准', list: r.acceptance },
        { h: '四、推进情况', p: '当前状态「' + r.status + '」，完成度 ' + Math.round(r.progress * 100) + '%，PRD 版本 ' + (r.prdVer || '未创建') + '，' + (r.prdArchived ? '已归档。' : '尚未归档。') }
      ]);
      UI.toast('已导出需求 Word 文档', 'ok');
    });

    var eb = d.el.querySelector('[data-edit]');
    if (eb) eb.addEventListener('click', function () { d.close(); edit(r); });
    var cb = d.el.querySelector('[data-change]');
    if (cb) cb.addEventListener('click', function () {
      d.close();
      if (C.canSee('changes', S.role())) Shell.create('change.new');
      else UI.toast('请联系产品总监调整', 'warn');
    });
  }

  /* 状态流转小条 */
  function flowStrip(cur) {
    var steps = ['待评审', '已评审', '排期中', '设计中', '开发中', '测试中', '待发布', '已上线'];
    var i = steps.indexOf(cur);
    if (i < 0) return UI.notice('warn', '该需求当前处于「' + E(cur) + '」，已脱离主流转链路。');
    return '<div class="flow">' + steps.map(function (s, k) {
      return '<div class="flow-step' + (k === i ? ' hot' : '') + '" style="min-width:70px;padding-top:8px;padding-bottom:8px">' +
        '<div class="fs-l">' + (k < i ? '✓ ' : (k === i ? '● ' : '')) + E(s) + '</div></div>';
    }).join('') + '</div>';
  }

  /* ============ 新建 / 编辑 ============ */
  /* limited（PM）不可直接改优先级，也不可直接把需求关闭 / 驳回 —— 见 C.PERM_NOTE['requirements.pm'] */
  var LOCKED_ST = ['已关闭', '已驳回'];
  /* cur：若需求已处于受限状态，仍需保留该选项，否则保存时会被静默改写 */
  function stOpts(cur) {
    if (P.full(MOD)) return C.DICT.reqStatus;
    return C.DICT.reqStatus.filter(function (s) { return LOCKED_ST.indexOf(s) < 0 || s === cur; });
  }
  function fields(r) {
    r = r || {};
    var pv = r.priority || 'P2';
    return [
      { k: 'title', label: '需求名称', req: true, full: true, val: r.title, placeholder: '一句话说清要解决什么问题' },
      { k: 'type', label: '需求类型', type: 'select', req: true, opts: C.DICT.reqType, val: r.type || '新功能' },
      { k: 'source', label: '需求来源', type: 'select', req: true, opts: C.DICT.reqSource, val: r.source || '内部规划' },
      P.full(MOD)
        ? { k: 'priority', label: '优先级', type: 'select', req: true, opts: C.DICT.priority, val: pv }
        : {
          k: 'priority', label: '优先级', type: 'static', val: pv,
          hint: '由产品总监决策',
          html: UI.pri(pv) + ' <span class="muted tiny">如需调整请提交「需求变更」走审批</span>'
        },
      {
        k: 'status', label: '当前状态', type: 'select', req: true, opts: stOpts(r.status), val: r.status || '待评审',
        hint: P.full(MOD) ? '' : '关闭 / 驳回需走变更审批'
      },
      { k: 'lineId', label: '所属产品线', type: 'select', req: true, opts: P.lineOpts(), val: r.lineId || S.state.lineId || (S.linesInScope()[0] || {}).id },
      { k: 'projectId', label: '关联项目', type: 'select', opts: P.projOpts(), val: r.projectId || S.state.projectId },
      { k: 'releaseId', label: '目标版本', type: 'select', opts: P.relOpts(), val: r.releaseId, emptyText: '（暂不排期）' },
      { k: 'owner', label: '产品负责人', type: 'select', req: true, opts: P.memberNames(), val: r.owner || '林知微' },
      { k: 'proposer', label: '提出人', val: r.proposer || S.roleObj().user.name },
      { k: 'value', label: '业务价值', type: 'number', min: 1, max: 10, val: r.value || 6, hint: '1~10' },
      { k: 'effort', label: '投入人日', type: 'number', min: 1, val: r.effort || 10 },
      { k: 'due', label: '期望交付', type: 'date', req: true, val: r.due || U.fmtDate(U.addDay(new Date(), 30)) },
      { k: 'desc', label: '需求描述', type: 'textarea', full: true, rows: 3, val: r.desc },
      { k: 'acceptance', label: '验收标准', type: 'textarea', full: true, rows: 3, val: (r.acceptance || []).join('\n'), hint: '每行一条' }
    ];
  }
  function pack(d, base) {
    var line = S.lineBy(d.lineId) || {}, prj = S.projBy(d.projectId) || {}, rel = d.releaseId ? S.relBy(d.releaseId) : null;
    /* 优先级在 limited 口径下渲染为 static，不进表单读值，需回落到原值 */
    var pri = d.priority || (base && base.priority) || 'P2';
    return {
      title: d.title, type: d.type, source: d.source, priority: pri, status: d.status,
      lineId: d.lineId, lineName: line.name || '', projectId: d.projectId, projectName: prj.name || '',
      releaseId: d.releaseId || '', releaseName: rel ? rel.name : '',
      owner: d.owner, proposer: d.proposer, value: U.num(d.value, 6), effort: U.num(d.effort, 10),
      roi: +(U.num(d.value, 6) * 10 / Math.max(U.num(d.effort, 10), 1)).toFixed(1),
      due: d.due, desc: d.desc || '',
      acceptance: (d.acceptance || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean)
    };
  }
  function edit(r) {
    var fs = fields(r);
    UI.formModal({
      title: '编辑需求 · ' + r.id, wide: true, fields: fs,
      tip: '修改会写入工作留痕，可在「工作留痕」模块追溯。',
      onSubmit: function (d) {
        S.update('requirements', r.id, pack(d, r));
        UI.toast('需求已更新', 'ok');
        Shell.route();
      }
    });
  }

  /* ============ 子页 1：需求池 ============ */
  function pool(ctx) {
    var f = P.flt(MOD, DEF), v = C.viewOf(S.role(), MOD), cols = v.cols || [];
    var rows = list(f);

    var cs = [
      { k: 'id', t: '编号', w: '86px', render: function (r) { return UI.idCell(r.id); } },
      {
        k: 'title', t: '需求名称', cls: 'ellip',
        render: function (r) {
          return UI.cell2(E(r.title) + (r.changeCount ? ' ' + UI.tag('变更' + r.changeCount, 'warn') : ''),
            E(r.type) + ' · 来源 ' + E(r.source) + (r.tags && r.tags.length ? ' · ' + E(r.tags.join('/')) : ''));
        }
      },
      {
        k: 'priority', t: '优先级', w: '76px', align: 'center',
        render: function (r) { return UI.pri(r.priority); },
        sortVal: function (r) { return C.DICT.priority.indexOf(r.priority); }
      },
      {
        k: 'status', t: '状态', w: '86px',
        render: function (r) { return UI.st('status', r.status); },
        sortVal: function (r) { return C.DICT.reqStatus.indexOf(r.status); }
      }
    ];
    if (cols.indexOf('line') >= 0) cs.push({ k: 'lineName', t: '产品线', w: '128px' });
    if (cols.indexOf('release') >= 0) cs.push({
      k: 'releaseName', t: '目标版本', w: '136px',
      render: function (r) { return r.releaseName ? E(r.releaseName) : '<span class="tag tag-idle">未排期</span>'; }
    });
    if (cols.indexOf('value') >= 0) cs.push({ k: 'value', t: '业务价值', w: '84px', align: 'right', render: function (r) { return '<b>' + r.value + '</b><span class="muted tiny">/10</span>'; } });
    if (cols.indexOf('roi') >= 0) cs.push({ k: 'roi', t: 'ROI', w: '70px', align: 'right', render: function (r) { return '<b>' + r.roi + '</b>'; } });
    if (cols.indexOf('owner') >= 0) cs.push({ k: 'owner', t: '负责人', w: '108px', render: function (r) { return UI.owner(r.owner); } });
    if (cols.indexOf('progress') >= 0) cs.push({ k: 'progress', t: '进度', w: '130px', render: function (r) { return P.pctCell(r.progress); } });
    cs.push({ k: 'due', t: '期望交付', w: '112px', render: function (r) { return C.isTerminal(r.status) ? '<span class="muted">' + E(r.due) + '</span>' : UI.due(r.due); } });
    cs.push({
      k: '', t: '操作', w: '112px', sortable: false, align: 'right',
      render: function () {
        return '<div class="row-acts" style="justify-content:flex-end">' +
          '<button data-act="detail">详情</button>' +
          (P.ed(MOD) ? '<button data-act="edit">编辑</button>' : '<button data-act="change">变更</button>') +
          '</div>';
      }
    });

    var CSV = [
      { label: '编号', key: 'id' }, { label: '需求名称', key: 'title' }, { label: '类型', key: 'type' },
      { label: '来源', key: 'source' }, { label: '优先级', key: 'priority' }, { label: '状态', key: 'status' },
      { label: '产品线', key: 'lineName' }, { label: '项目', key: 'projectName' }, { label: '目标版本', key: 'releaseName' },
      { label: '负责人', key: 'owner' }, { label: '提出人', key: 'proposer' },
      { label: '业务价值', key: 'value' }, { label: '投入人日', key: 'effort' }, { label: 'ROI', key: 'roi' },
      { label: '完成度', get: function (r) { return Math.round(r.progress * 100) + '%'; } },
      { label: '期望交付', key: 'due' }, { label: '创建时间', key: 'createAt' }, { label: '变更次数', key: 'changeCount' }
    ];

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: '需求池',
        desc: '当前口径：' + E(P.scopeText()) + '　·　共 <b>' + rows.length + '</b> 条需求（全量 ' + S.reqs().length + '）',
        acts: UI.exportMenu({ word: true }) + '　' + P.createBtn(MOD, 'req.new', '新建需求')
      }) +
      P.permTip(MOD) +
      UI.card({
        flush: true,
        body: '<div class="toolbar" id="reqFlt">' +
          '<input class="fld fld-search" data-f="kw" placeholder="搜索需求名称 / 编号 / 负责人 / 标签" value="' + E(f.kw) + '">' +
          P.sel('status', '全部状态', C.DICT.reqStatus, f.status) +
          P.sel('type', '全部类型', C.DICT.reqType, f.type) +
          P.sel('pri', '全部优先级', C.DICT.priority, f.pri) +
          P.sel('source', '全部来源', C.DICT.reqSource, f.source) +
          (S.isDirector() ? P.sel('line', '全部产品线', P.lineOpts(), f.line)
            : P.sel('release', '全部版本', P.relOpts(), f.release)) +
          '<button class="btn-sm" data-reset>重置</button>' +
          '<span class="grow"></span>' + P.viewBar(MOD) +
          '</div>' +
          '<div id="reqTbl"></div>'
      });

    var tb = UI.table('#reqTbl', {
      cols: cs, rows: rows, pageSize: 12, index: true, select: true,
      sort: { k: v.sort === 'value' ? 'value' : (v.sort === 'due' ? 'due' : 'priority'), desc: !!v.desc },
      rowCls: function (r) { return (!C.isTerminal(r.status) && U.daysLeft(r.due) < 0) ? 'row-danger' : ''; },
      footNote: '默认排序：' + (v.note || '—'),
      onRow: open,
      onAct: function (act, r) {
        if (act === 'detail') open(r);
        else if (act === 'edit') edit(r);
        else if (act === 'change') Shell.create('change.new');
      },
      bulk: bulkActions(),
      empty: UI.empty('没有符合筛选条件的需求', '<button class="btn" data-reset2>清空筛选条件</button>'),
      onToolbar: function (el) {
        var b = el.querySelector('[data-reset2]');
        if (b) b.addEventListener('click', function () { P.setFlt(MOD, Object.assign({}, DEF)); Shell.route(); });
      }
    });

    var fltBox = document.getElementById('reqFlt');
    P.bindFlt(fltBox, MOD, DEF, function (nf) {
      tb.setRows(list(nf));
      var hd = ctx.el.querySelector('.page-desc');
      if (hd) hd.innerHTML = '当前口径：' + E(P.scopeText()) + '　·　共 <b>' + list(nf).length + '</b> 条需求（全量 ' + S.reqs().length + '）';
    });
    P.bindViews(fltBox, MOD, DEF);

    UI.bindExport(ctx.el, {
      csv: function () { U.exportCSV('需求池', tb.view(), CSV); },
      word: function () {
        var byStatus = U.countBy(tb.view(), 'status');
        P.word('需求池报告', '需求池汇总报告', [
          { h: '一、总体情况', p: '本次导出共 ' + tb.view().length + ' 条需求，口径为「' + P.scopeText() + '」。' },
          {
            h: '二、状态分布', table: {
              cols: [{ t: '状态', get: function (r) { return r[0]; } }, { t: '数量', get: function (r) { return r[1]; } }],
              rows: C.DICT.reqStatus.map(function (s) { return [s, byStatus[s] || 0]; }).filter(function (r) { return r[1]; })
            }
          },
          {
            h: '三、需求明细', table: {
              cols: [
                { t: '编号', k: 'id' }, { t: '需求名称', k: 'title' }, { t: '类型', k: 'type' },
                { t: '优先级', k: 'priority' }, { t: '状态', k: 'status' }, { t: '目标版本', k: 'releaseName' },
                { t: '负责人', k: 'owner' }, { t: '价值', k: 'value' }, { t: 'ROI', k: 'roi' }, { t: '期望交付', k: 'due' }
              ],
              rows: tb.view()
            }
          }
        ]);
      }
    });
  }

  function bulkActions() {
    if (!P.ed(MOD)) {
      return [{
        t: '批量导出所选', cls: '', fn: function (picked, clear) {
          U.exportCSV('需求_所选', picked, [
            { label: '编号', key: 'id' }, { label: '需求名称', key: 'title' },
            { label: '状态', key: 'status' }, { label: '优先级', key: 'priority' }, { label: '负责人', key: 'owner' }
          ]);
          UI.toast('已导出 ' + picked.length + ' 条需求');
          clear();
        }
      }, {
        t: '批量提交变更申请', cls: '', fn: function (picked) {
          UI.toast('已为 ' + picked.length + ' 条需求生成变更草稿（需总监审批）', 'info');
        }
      }];
    }
    if (!P.full(MOD)) {
      /* limited：可推进状态与导出，改优先级 / 指派版本需走变更审批 */
      return [
        {
          t: '批量流转状态', fn: function (picked, clear) {
            if (!picked.length) return;
            UI.formModal({
              title: '批量流转状态（' + picked.length + ' 条）', one: true,
              tip: '关闭 / 驳回需求需通过「需求变更」走审批，此处不提供。',
              fields: [{ k: 'status', label: '目标状态', type: 'select', req: true, opts: stOpts(), val: '已评审' }],
              onSubmit: function (d) {
                picked.forEach(function (r) { S.update('requirements', r.id, { status: d.status }); });
                UI.toast('已流转 ' + picked.length + ' 条需求', 'ok');
                clear(); Shell.route();
              }
            });
          }
        },
        {
          t: '批量提交变更申请', fn: function (picked, clear) {
            if (!picked.length) return;
            if (C.canSee('changes', S.role())) {
              UI.toast('已为 ' + picked.length + ' 条需求生成变更草稿，请在「需求变更」中补充影响评估后提交', 'info', 3200);
              clear(); Shell.go('changes', 'list');
            } else {
              UI.toast('已为 ' + picked.length + ' 条需求生成变更草稿（需总监审批）', 'info');
              clear();
            }
          }
        },
        {
          t: '批量导出', fn: function (picked, clear) {
            U.exportCSV('需求_所选', picked, [
              { label: '编号', key: 'id' }, { label: '需求名称', key: 'title' }, { label: '状态', key: 'status' },
              { label: '优先级', key: 'priority' }, { label: '价值', key: 'value' }, { label: 'ROI', key: 'roi' }
            ]);
            clear();
          }
        }
      ];
    }
    return [
      {
        t: '批量调整优先级', fn: function (picked, clear) {
          if (!picked.length) return;
          UI.formModal({
            title: '批量调整优先级（' + picked.length + ' 条）', one: true,
            fields: [{ k: 'priority', label: '目标优先级', type: 'select', req: true, opts: C.DICT.priority, val: 'P1' }],
            onSubmit: function (d) {
              picked.forEach(function (r) { S.update('requirements', r.id, { priority: d.priority }); });
              UI.toast('已调整 ' + picked.length + ' 条需求优先级', 'ok');
              clear();
            }
          });
        }
      },
      {
        t: '批量指派版本', fn: function (picked, clear) {
          if (!picked.length) return;
          UI.formModal({
            title: '批量指派目标版本（' + picked.length + ' 条）', one: true,
            fields: [{ k: 'releaseId', label: '目标版本', type: 'select', req: true, opts: P.relOpts() }],
            onSubmit: function (d) {
              var rel = S.relBy(d.releaseId);
              picked.forEach(function (r) { S.update('requirements', r.id, { releaseId: rel.id, releaseName: rel.name }); });
              UI.toast('已指派到 ' + rel.name, 'ok');
              clear();
            }
          });
        }
      },
      {
        t: '批量流转状态', fn: function (picked, clear) {
          if (!picked.length) return;
          UI.formModal({
            title: '批量流转状态（' + picked.length + ' 条）', one: true,
            fields: [{ k: 'status', label: '目标状态', type: 'select', req: true, opts: C.DICT.reqStatus, val: '已评审' }],
            onSubmit: function (d) {
              picked.forEach(function (r) { S.update('requirements', r.id, { status: d.status }); });
              UI.toast('已流转 ' + picked.length + ' 条需求', 'ok');
              clear();
            }
          });
        }
      },
      {
        t: '批量导出', fn: function (picked, clear) {
          U.exportCSV('需求_所选', picked, [
            { label: '编号', key: 'id' }, { label: '需求名称', key: 'title' }, { label: '状态', key: 'status' },
            { label: '优先级', key: 'priority' }, { label: '价值', key: 'value' }, { label: 'ROI', key: 'roi' }
          ]);
          clear();
        }
      },
      {
        t: '批量关闭', cls: 'btn-danger', fn: function (picked, clear) {
          UI.confirm('确认关闭选中的 <b>' + picked.length + '</b> 条需求？', function () {
            picked.forEach(function (r) { S.update('requirements', r.id, { status: '已关闭' }); });
            UI.toast('已关闭 ' + picked.length + ' 条需求', 'ok');
            clear();
          }, { danger: true, okText: '确认关闭', tip: '关闭后需求不再进入排期，可在状态筛选中查看。' });
        }
      }
    ];
  }

  /* ============ 子页 2：优先级管理 ============ */
  function priority(ctx) {
    var rows = S.reqs().filter(function (r) { return !C.isTerminal(r.status) || r.status === '已上线'; });
    var open = rows.filter(function (r) { return !C.isTerminal(r.status); });
    var maxE = Math.max(45, U.sum(open, function (r) { return 0; }) || 0);
    open.forEach(function (r) { if (r.effort > maxE) maxE = r.effort; });

    var byPri = C.DICT.priority.map(function (p) {
      return { name: p, value: S.reqs().filter(function (r) { return r.priority === p; }).length };
    });

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: '优先级管理',
        desc: '以「业务价值 × 投入成本」定位需求排序，右上角为高价值低成本的优先交付区。',
        acts: UI.exportMenu({ word: false, print: true })
      }) +
      P.permTip(MOD) +
      '<div class="grid g3">' +
      UI.card({
        title: '价值 - 成本四象限', ico: '◔', style: 'grid-column:span 2',
        sub: '气泡大小 = ROI，点击查看需求详情',
        extra: '<span class="muted tiny">仅统计未终态的 ' + open.length + ' 条需求</span>',
        body: quadHTML(open, maxE)
      }) +
      UI.card({
        title: '优先级分布', ico: '▤',
        body: P.chart('priDonut')
      }) +
      '</div>' + P.gap(4) +
      '<div class="grid g2">' +
      UI.card({ title: 'ROI 排行 Top 12', ico: '↗', sub: '价值 ×10 / 投入人日', body: P.chart('roiBars') }) +
      UI.card({
        title: '优先级 × 状态 分布', ico: '▦',
        body: P.chart('priHeat')
      }) +
      '</div>';

    CH.donut(P.$('priDonut'), {
      data: byPri.map(function (p, i) {
        return { name: p.name, value: p.value, color: ['#dc2626', '#ea580c', '#2563eb', '#94a3b8'][i] };
      }),
      height: 240, inner: 0.62,
      center: { v: S.reqs().length, l: '需求总数' },
      onClick: function (i, d) {
        var f = P.flt(MOD, DEF); f.pri = d.name; P.setFlt(MOD, f);
        Shell.go(MOD, 'pool');
      }
    });

    var top = U.sortBy(open, 'roi').reverse().slice(0, 12);
    CH.bars(P.$('roiBars'), {
      data: top.map(function (r) {
        return { label: U.ellip(r.title, 12), value: r.roi, text: r.roi + '（' + r.priority + '）', color: CH.TONE[C.tone('status', r.status)] };
      }),
      fmt: function (v) { return v; },
      onClick: function (i) { open2(top[i]); }
    });

    var st8 = ['待评审', '已评审', '排期中', '设计中', '开发中', '测试中', '待发布', '已上线'];
    CH.heat(P.$('priHeat'), {
      rows: C.DICT.priority, cols: st8,
      matrix: C.DICT.priority.map(function (p) {
        return st8.map(function (s) {
          return S.reqs().filter(function (r) { return r.priority === p && r.status === s; }).length;
        });
      }),
      labelW: 44,
      fmt: function (v) { return v || ''; },
      onClick: function (ri, ci) {
        var f = P.flt(MOD, DEF); f.pri = C.DICT.priority[ri]; f.status = st8[ci]; P.setFlt(MOD, f);
        Shell.go(MOD, 'pool');
      }
    });

    ctx.el.querySelectorAll('.quad-dot').forEach(function (n) {
      var r = S.reqBy(n.getAttribute('data-id'));
      if (!r) return;
      CH.bindTip(n, function () {
        return '<b>' + E(r.title) + '</b><br>' +
          CH.tipRow(CH.TONE.accent, '业务价值', r.value + ' / 10') +
          CH.tipRow(CH.TONE.warn, '投入人日', r.effort + ' 人日') +
          CH.tipRow(CH.TONE.done, 'ROI', r.roi) +
          CH.tipRow('#94a3b8', '状态', r.priority + ' · ' + r.status);
      }, function () { open2(r); });
    });

    UI.bindExport(ctx.el, {
      csv: function () {
        U.exportCSV('需求优先级', U.sortBy(open, 'roi').reverse(), [
          { label: '编号', key: 'id' }, { label: '需求名称', key: 'title' }, { label: '优先级', key: 'priority' },
          { label: '业务价值', key: 'value' }, { label: '投入人日', key: 'effort' }, { label: 'ROI', key: 'roi' },
          { label: '状态', key: 'status' }, { label: '产品线', key: 'lineName' }
        ]);
      }
    });
  }
  function open2(r) { open(r); }

  function quadHTML(rows, maxE) {
    var maxRoi = Math.max.apply(null, rows.map(function (r) { return r.roi; }).concat([1]));
    var h = '<div class="quad">' +
      '<div class="quad-z tl">优先交付<small>高价值 · 低成本</small></div>' +
      '<div class="quad-z tr">重点攻坚<small>高价值 · 高成本</small></div>' +
      '<div class="quad-z bl">顺手优化<small>低价值 · 低成本</small></div>' +
      '<div class="quad-z br">谨慎投入<small>低价值 · 高成本</small></div>' +
      '<div class="quad-mid h"></div><div class="quad-mid v"></div>' +
      '<div class="quad-ax y">业务价值</div><div class="quad-ax x">投入成本（人日）</div>' +
      '<div class="quad-ax y0">1</div><div class="quad-ax y1">10</div>' +
      '<div class="quad-ax x0">0</div><div class="quad-ax x1">' + maxE + '</div>';
    rows.forEach(function (r) {
      var x = U.clamp(r.effort / maxE * 100, 2, 98);
      var y = U.clamp(100 - (r.value / 10) * 100, 2, 98);
      var sz = 9 + Math.round(r.roi / maxRoi * 15);
      h += '<div class="quad-dot" data-id="' + E(r.id) + '" style="left:' + x.toFixed(1) + '%;top:' + y.toFixed(1) + '%;' +
        'width:' + sz + 'px;height:' + sz + 'px;background:' +
        (CH.TONE[C.tone('status', r.status)] || '#94a3b8') + ';opacity:.85"></div>';
    });
    return h + '</div>' +
      '<div class="pbar-legend" style="justify-content:center">' +
      ['待评审', '排期中', '开发中', '测试中', '待发布'].map(function (s) {
        return '<span><i style="background:' + CH.TONE[C.tone('status', s)] + '"></i>' + s + '</span>';
      }).join('') + '</div>';
  }

  /* ============ 子页 3：状态流转 ============ */
  function flow(ctx) {
    var fl = S.reqFlow();
    var qs = S.reqs();
    var hot = 0, hv = -1;
    fl.steps.forEach(function (s, i) { if (i < 7 && s.value > hv) { hv = s.value; hot = i; } });

    /* 各状态平均停留天数（用 cycleDays 按阶段权重估算，稳定可复现） */
    var stayW = { '待评审': .12, '已评审': .08, '排期中': .1, '设计中': .16, '开发中': .3, '测试中': .16, '待发布': .08 };
    var stayRows = Object.keys(stayW).map(function (k) {
      var g = qs.filter(function (q) { return q.status === k; });
      return { label: k, value: Math.round(fl.avgCycle * stayW[k]), text: Math.round(fl.avgCycle * stayW[k]) + ' 天 / ' + g.length + ' 条' };
    });

    /* 按类型的平均周期 */
    var cyc = C.DICT.reqType.map(function (t) {
      var g = qs.filter(function (q) { return q.type === t && q.status === '已上线'; });
      return { label: t, value: Math.round(U.avg(g, 'cycleDays')), text: g.length ? Math.round(U.avg(g, 'cycleDays')) + ' 天' : '—' };
    });

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: '需求状态流转',
        desc: '8 段主流程漏斗 + 停留分析，用来发现「卡在哪一环」。',
        acts: UI.exportMenu({ word: true })
      }) +
      P.permTip(MOD) +
      UI.grid(4, [
        UI.metric({ label: '需求总量', val: fl.total, unit: '条', ico: '☰' }),
        UI.metric({ label: '平均流转周期', val: fl.avgCycle, unit: '天', ico: '⏱', tone: fl.avgCycle > 40 ? 'warn' : 'done', sub: '从提出到上线' }),
        UI.metric({ label: '近 30 天上线', val: fl.throughput, unit: '条', ico: '↗', tone: 'done', sub: '需求吞吐量' }),
        UI.metric({ label: '驳回 / 变更', val: fl.rejected + ' / ' + fl.changed, ico: '⇄', tone: 'warn', sub: '驳回条数 / 发生变更条数' })
      ].join('')) + P.gap(4) +
      UI.card({
        title: '需求状态流转漏斗', ico: '▽', sub: '点击任一环节下钻到需求池',
        extra: '<span class="tag tag-warn">当前最大积压：' + E(fl.steps[hot].name) + '（' + hv + ' 条）</span>',
        body: P.chart('reqFlowChart')
      }) + P.gap(4) +
      '<div class="grid g2">' +
      UI.card({ title: '各环节平均停留时长', ico: '⏱', sub: '基于平均流转周期分摊估算', body: P.chart('stayBars') }) +
      UI.card({ title: '各类型需求平均交付周期', ico: '◑', sub: '仅统计已上线需求', body: P.chart('cycBars') }) +
      '</div>' + P.gap(4) +
      UI.card({
        title: '各产品线需求流转对比', ico: '▦', flush: true,
        body: '<div id="lineFlowTbl"></div>'
      });

    CH.flow(P.$('reqFlowChart'), {
      steps: fl.steps.map(function (s, i) {
        return {
          name: s.name, value: s.value, key: s.name,
          /* CH.flow 内部会 toFixed 并自行补 %，这里必须给数字，不能拼成字符串 */
          rate: i === 0 ? undefined : U.pct(s.value, fl.steps[i - 1].value)
        };
      }),
      hot: hot,
      onClick: function (i, s) {
        var f = P.flt(MOD, DEF); f.status = s.name; P.setFlt(MOD, f);
        Shell.go(MOD, 'pool');
      }
    });
    CH.bars(P.$('stayBars'), { data: stayRows, palette: true });
    CH.bars(P.$('cycBars'), { data: cyc, palette: true });

    var lines = S.linesInScope();
    UI.table('#lineFlowTbl', {
      pageSize: 0, compact: true,
      cols: [
        { k: 'name', t: '产品线', w: '160px', render: function (r) { return '<b>' + E(r.name) + '</b>'; } },
        { k: 'total', t: '需求总数', align: 'right', w: '90px' },
        { k: 'pending', t: '待评审', align: 'right', w: '80px' },
        { k: 'doing', t: '进行中', align: 'right', w: '80px' },
        { k: 'online', t: '已上线', align: 'right', w: '80px' },
        { k: 'rejected', t: '已驳回', align: 'right', w: '80px' },
        {
          k: 'rate', t: '上线转化率', w: '160px',
          render: function (r) { return UI.pcell(r.rate, r.rate >= 50 ? 'done' : (r.rate >= 30 ? 'doing' : 'warn')); }
        },
        { k: 'cyc', t: '平均周期', align: 'right', w: '90px', render: function (r) { return r.cyc + ' 天'; } }
      ],
      rows: lines.map(function (l) {
        var g = qs.filter(function (q) { return q.lineId === l.id; });
        var on = g.filter(function (q) { return q.status === '已上线'; });
        return {
          id: l.id, name: l.name, total: g.length,
          pending: g.filter(function (q) { return q.status === '待评审'; }).length,
          doing: g.filter(function (q) { return ['设计中', '开发中', '测试中', '待发布'].indexOf(q.status) >= 0; }).length,
          online: on.length,
          rejected: g.filter(function (q) { return q.status === '已驳回'; }).length,
          rate: U.pct(on.length, g.length),
          cyc: Math.round(U.avg(on, 'cycleDays'))
        };
      }),
      onRow: function (r) { S.setLine(r.id); UI.toast('已切换到产品线 ' + r.name); }
    });

    UI.bindExport(ctx.el, {
      csv: function () {
        U.exportCSV('需求流转', fl.steps, [
          { label: '状态', key: 'name' }, { label: '数量', key: 'value' }
        ]);
      },
      word: function () {
        P.word('需求流转分析', '需求状态流转分析报告', [
          { h: '一、总体指标', kv: [['需求总量', fl.total], ['平均流转周期', fl.avgCycle + ' 天'], ['近 30 天上线', fl.throughput + ' 条'], ['驳回条数', fl.rejected], ['发生变更条数', fl.changed]] },
          { h: '二、各环节存量', table: { cols: [{ t: '环节', k: 'name' }, { t: '当前存量', k: 'value' }], rows: fl.steps } },
          { h: '三、瓶颈判断', p: '当前存量最大的环节为「' + fl.steps[hot].name + '」，共 ' + hv + ' 条需求停留，建议优先排查该环节的资源与依赖。' },
          { h: '四、各环节平均停留时长', table: { cols: [{ t: '环节', k: 'label' }, { t: '平均停留', get: function (r) { return r.value + ' 天'; } }], rows: stayRows } }
        ]);
      }
    });
  }

  /* ============ 子页 4：PRD 归档 ============ */
  function prd(ctx) {
    var f = P.flt(MOD, DEF);
    var all = S.reqs().filter(function (r) { return r.prdVer; });
    var rows = all.filter(function (r) { return pass(r, { kw: f.kw, status: f.status, type: f.type, line: f.line }); });
    var arch = all.filter(function (r) { return r.prdArchived; });

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: 'PRD 归档',
        desc: '已创建 PRD 的需求共 <b>' + all.length + '</b> 条，其中 <b>' + arch.length + '</b> 条已归档。',
        acts: UI.exportMenu({ word: true })
      }) +
      P.permTip(MOD) +
      UI.grid(4, [
        UI.metric({ label: 'PRD 总数', val: all.length, unit: '份', ico: '▤' }),
        UI.metric({ label: '已归档', val: arch.length, unit: '份', ico: '✓', tone: 'done', sub: '归档率 ' + U.pctStr(arch.length, all.length) }),
        UI.metric({ label: '待归档', val: all.length - arch.length, unit: '份', ico: '◷', tone: 'warn', sub: '上线后仍需补归档' }),
        UI.metric({ label: '涉及变更', val: all.filter(function (r) { return r.changeCount > 0; }).length, unit: '份', ico: '⇄', tone: 'warn', sub: '需同步更新 PRD 版本' })
      ].join('')) + P.gap(4) +
      UI.card({
        flush: true, title: 'PRD 文档清单', ico: '▤',
        extra: '<span class="muted tiny">点击行查看需求详情</span>',
        body: '<div class="toolbar" id="prdFlt">' +
          '<input class="fld fld-search" data-f="kw" placeholder="搜索需求名称 / 编号" value="' + E(f.kw) + '">' +
          P.sel('status', '全部状态', C.DICT.reqStatus, f.status) +
          P.sel('type', '全部类型', C.DICT.reqType, f.type) +
          (S.isDirector() ? P.sel('line', '全部产品线', P.lineOpts(), f.line) : '') +
          '<button class="btn-sm" data-reset>重置</button></div>' +
          '<div id="prdTbl"></div>'
      });

    var tb = UI.table('#prdTbl', {
      pageSize: 14, index: true,
      cols: [
        { k: 'id', t: '需求编号', w: '92px', render: function (r) { return UI.idCell(r.id); } },
        { k: 'title', t: 'PRD 名称', cls: 'ellip', render: function (r) { return UI.cell2('《' + E(r.title) + '》PRD', E(r.lineName) + ' · ' + E(r.projectName)); } },
        { k: 'prdVer', t: '版本号', w: '80px', render: function (r) { return UI.tag(r.prdVer, 'accent'); } },
        { k: 'status', t: '需求状态', w: '86px', render: function (r) { return UI.st('status', r.status); } },
        { k: 'releaseName', t: '目标版本', w: '132px' },
        { k: 'owner', t: '作者', w: '104px', render: function (r) { return UI.owner(r.owner); } },
        { k: 'changeCount', t: '变更', w: '64px', align: 'center', render: function (r) { return r.changeCount ? UI.tag(r.changeCount, 'warn') : '<span class="muted">0</span>'; } },
        { k: 'reviewAt', t: '评审时间', w: '104px' },
        {
          k: 'prdArchived', t: '归档状态', w: '96px',
          render: function (r) { return r.prdArchived ? UI.tag('已归档', 'done') : UI.tag('未归档', 'idle'); },
          sortVal: function (r) { return r.prdArchived ? 1 : 0; }
        },
        {
          k: '', t: '操作', w: '116px', sortable: false, align: 'right',
          render: function (r) {
            return '<div class="row-acts" style="justify-content:flex-end"><button data-act="view">查看</button>' +
              '<button data-act="doc">下载 Word</button>' +
              (P.ed(MOD) && !r.prdArchived ? '<button data-act="arch">归档</button>' : '') + '</div>';
          }
        }
      ],
      rows: rows,
      onRow: open,
      onAct: function (act, r) {
        if (act === 'view') open(r);
        else if (act === 'doc') {
          P.word('PRD_' + r.id, '《' + r.title + '》产品需求文档 ' + r.prdVer, [
            { h: '一、文档信息', kv: [['需求编号', r.id], ['PRD 版本', r.prdVer], ['作者', r.owner], ['所属产品线', r.lineName], ['目标版本', r.releaseName || '未排期'], ['评审时间', r.reviewAt], ['归档状态', r.prdArchived ? '已归档' : '未归档']] },
            { h: '二、背景与目标', p: r.desc },
            { h: '三、验收标准', list: r.acceptance },
            { h: '四、变更记录', p: r.changeCount ? '该需求累计发生 ' + r.changeCount + ' 次变更，详见「需求变更」模块。' : '暂无变更记录。' }
          ]);
          UI.toast('已导出 PRD 文档', 'ok');
        } else if (act === 'arch') {
          S.update('requirements', r.id, { prdArchived: true });
          Shell.route();
          UI.toast('PRD 已归档', 'ok');
        }
      },
      empty: UI.empty('没有符合条件的 PRD 文档')
    });

    P.bindFlt(document.getElementById('prdFlt'), MOD, DEF, function (nf) {
      tb.setRows(all.filter(function (r) { return pass(r, { kw: nf.kw, status: nf.status, type: nf.type, line: nf.line }); }));
    });

    UI.bindExport(ctx.el, {
      csv: function () {
        U.exportCSV('PRD归档', tb.view(), [
          { label: '需求编号', key: 'id' }, { label: 'PRD 名称', key: 'title' }, { label: '版本', key: 'prdVer' },
          { label: '需求状态', key: 'status' }, { label: '目标版本', key: 'releaseName' }, { label: '作者', key: 'owner' },
          { label: '归档', get: function (r) { return r.prdArchived ? '已归档' : '未归档'; } }
        ]);
      },
      word: function () {
        P.word('PRD归档清单', 'PRD 文档归档清单', [
          { h: '一、归档概况', p: '共 ' + all.length + ' 份 PRD，已归档 ' + arch.length + ' 份，归档率 ' + U.pctStr(arch.length, all.length) + '。' },
          {
            h: '二、文档清单', table: {
              cols: [{ t: '需求编号', k: 'id' }, { t: 'PRD 名称', k: 'title' }, { t: '版本', k: 'prdVer' },
              { t: '需求状态', k: 'status' }, { t: '作者', k: 'owner' },
              { t: '归档', get: function (r) { return r.prdArchived ? '已归档' : '未归档'; } }],
              rows: tb.view()
            }
          }
        ]);
      }
    });
  }

  /* ============ 注册 ============ */
  Shell.page(MOD, {
    render: function (ctx) {
      if (ctx.sub === 'priority') priority(ctx);
      else if (ctx.sub === 'flow') flow(ctx);
      else if (ctx.sub === 'prd') prd(ctx);
      else pool(ctx);
      if (ctx.id) {
        var r = S.reqBy(ctx.id);
        if (r) open(r);
      }
    }
  });
})();
