/* ============================================================
 * 14-collab.js  项目协同
 * 子页：board 协同看板 / cross 跨部门事项 / stream 协同动态
 * 总监：多项目横向协同视角；PM：本项目协同与卡点视角
 * ========================================================== */
(function () {
  'use strict';
  var E = U.esc, MOD = 'collab';

  var DEF_CROSS = { kw: '', status: '', dept: '', priority: '', owner: '' };

  function ed() { return P.ed(MOD); }

  /* ============================================================
   * 子页 1：协同看板
   * ========================================================== */
  function board(ctx) {
    var projects = S.projectsInScope();
    var cs = S.cross();
    var cols = C.DICT.projStatus.map(function (s) {
      return { key: s, name: s, tone: C.tone('status', s) };
    });

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: '协同看板',
        desc: '以项目为单位的横向协同视图　·　' + P.scopeText() + '　·　拖动卡片可调整项目状态',
        acts: UI.exportMenu({ word: true })
      }) +
      P.permTip(MOD) +
      P.statCards([
        { label: '在管项目', val: projects.length, unit: '个', ico: '◧', tone: 'doing', sub: '进行中 ' + projects.filter(function (p) { return p.status === '进行中'; }).length + ' 个' },
        { label: '待发布项目', val: projects.filter(function (p) { return p.status === '待发布'; }).length, unit: '个', ico: '⏱', tone: 'warn', sub: '需协调灰度与发布窗口' },
        { label: '风险项目', val: projects.filter(function (p) { return p.status === '风险中' || p.health === '高'; }).length, unit: '个', ico: '⚠', tone: 'danger', sub: '健康度为高风险的项目' },
        { label: '待办协同事项', val: cs.filter(function (c) { return ['已解决', '已关闭'].indexOf(c.status) < 0; }).length, unit: '项', ico: '⇌', tone: 'plan', sub: '逾期 ' + cs.filter(function (c) { return c.overdue; }).length + ' 项' }
      ]) + P.gap(4) +
      UI.card({
        title: '项目协同看板', sub: '按项目状态分列；点击卡片查看协同详情', ico: '▦', flush: true,
        extra: '<span class="muted tiny">' + (ed() ? '可拖动卡片改变状态' : '当前角色只读') + '</span>',
        body: '<div id="cbKan" style="padding:var(--sp-3)"></div>'
      }) + P.gap(4) +
      UI.grid(2,
        UI.card({ title: '协同事项按部门分布', sub: '各协作部门的在途事项数量', ico: '◍', body: P.chart('cbDept', 260) }) +
        UI.card({ title: '协同健康度', sub: '各项目未闭环协同事项与逾期数', ico: '▤', body: P.chart('cbHealth') })
      );

    var kan = UI.kanban('#cbKan', {
      cols: cols, rows: projects, groupKey: 'status', max: 20,
      card: function (p) {
        var open = cs.filter(function (c) { return c.projectId === p.id && ['已解决', '已关闭'].indexOf(c.status) < 0; });
        return '<div class="kcard-t">' + E(p.name) + '</div>' +
          '<div class="kcard-m">' + UI.tag(p.lineName, 'plain') + UI.light(C.tone('light', p.health), '风险' + p.health) + '</div>' +
          UI.pbar(Math.round(p.progress * 100), UI.ptone(p.progress * 100, p.health === '高')) +
          '<div class="kcard-f">' + UI.owner(p.pm) +
          '<span class="muted tiny">协同 ' + open.length + ' 项' + (open.filter(function (c) { return c.overdue; }).length ? ' · 逾期 ' + open.filter(function (c) { return c.overdue; }).length : '') + '</span></div>';
      },
      onCard: function (p) { openProject(p); },
      onMove: ed() ? function (p, to) {
        S.update('projects', p.id, { status: to });
        UI.toast('「' + p.name + '」状态已调整为 ' + to, 'ok');
        Shell.route();
      } : null
    });

    var byDept = U.countBy(cs.filter(function (c) { return ['已解决', '已关闭'].indexOf(c.status) < 0; }), 'toDept');
    var deptRows = Object.keys(byDept).map(function (k) { return { name: k, value: byDept[k] }; })
      .sort(function (a, b) { return b.value - a.value; });
    if (deptRows.length) {
      CH.donut('cbDept', {
        data: deptRows, height: 260, center: { v: U.sum(deptRows, 'value'), l: '在途事项' },
        onClick: function (i, d) {
          P.setFlt(MOD, Object.assign({}, P.flt(MOD, DEF_CROSS), { dept: d.name }));
          Shell.go(MOD, 'cross');
        }
      });
    } else {
      P.$('cbDept').innerHTML = UI.empty('当前口径下没有未闭环的跨部门事项');
    }

    CH.bars('cbHealth', {
      data: projects.map(function (p) {
        var open = cs.filter(function (c) { return c.projectId === p.id && ['已解决', '已关闭'].indexOf(c.status) < 0; });
        var od = open.filter(function (c) { return c.overdue; }).length;
        return {
          label: p.name, value: open.length,
          color: od ? CH.TONE.danger : (open.length > 2 ? CH.TONE.warn : CH.TONE.done),
          text: open.length + ' 项' + (od ? '（逾期 ' + od + '）' : '')
        };
      }),
      onClick: function (i) { openProject(projects[i]); }
    });

    UI.bindExport(ctx.el, {
      csv: function () {
        P.csv('项目协同看板', projects, [
          { label: '项目编号', key: 'id' }, { label: '项目名称', key: 'name' },
          { label: '产品线', key: 'lineName' }, { label: '状态', key: 'status' },
          { label: '项目经理', key: 'pm' }, { label: '健康度', key: 'health' },
          { label: '进度(%)', get: function (p) { return Math.round(p.progress * 100); } },
          { label: '计划周期', get: function (p) { return p.start + ' ~ ' + p.end; } }
        ]);
      },
      word: function () {
        P.word('项目协同看板', '项目协同看板报告', [
          { h: '一、项目总览', p: '统计口径：' + P.scopeText() + '，共 ' + projects.length + ' 个项目。' },
          {
            table: {
              cols: [
                { t: '项目', k: 'name' }, { t: '产品线', k: 'lineName' }, { t: '状态', k: 'status' },
                { t: '项目经理', k: 'pm' }, { t: '健康度', k: 'health' },
                { t: '进度', get: function (p) { return Math.round(p.progress * 100) + '%'; } },
                { t: '未闭环协同', get: function (p) { return cs.filter(function (c) { return c.projectId === p.id && ['已解决', '已关闭'].indexOf(c.status) < 0; }).length + ' 项'; } }
              ], rows: projects
            }
          },
          {
            h: '二、需要重点协调的项目',
            list: projects.filter(function (p) { return p.health === '高' || p.status === '风险中'; })
              .map(function (p) { return p.name + '（' + p.pm + '）：状态 ' + p.status + '，健康度 ' + p.health + '，进度 ' + Math.round(p.progress * 100) + '%。'; })
          }
        ]);
      }
    });
    return kan;
  }

  function openProject(p) {
    var cs = S.cross('all').filter(function (c) { return c.projectId === p.id; });
    var rk = S.risks('all').filter(function (x) { return x.projectId === p.id && ['已缓解', '已关闭'].indexOf(x.status) < 0; });
    var st = S.projectStat(p.id);
    UI.drawer({
      wide: true,
      title: E(p.name), sub: p.lineName + ' · ' + p.status + ' · 项目经理 ' + p.pm,
      body:
        UI.sec('项目概要', UI.dl([
          ['项目编号', p.id], ['所属产品线', p.lineName],
          ['项目状态', UI.st('status', p.status)], ['健康度', UI.light(C.tone('light', p.health), p.health + '风险')],
          ['项目经理', p.pm], ['业务发起人', p.sponsor],
          ['计划周期', p.start + ' ~ ' + p.end], ['整体进度', UI.pbar(Math.round(p.progress * 100))],
          ['成员规模', p.members + ' 人'], ['标杆客户', p.customer],
          ['预算 / 已用', p.budget + ' 万 / ' + p.used + ' 万'],
          ['任务情况', st.taskDone + '/' + st.taskTotal + ' 完成，延期 ' + st.taskDelay + '，阻塞 ' + st.taskBlocked]
        ], 'dl-2col')) +
        UI.sec('项目说明', '<div class="rich">' + E(p.desc) + '</div>') +
        UI.sec('跨部门协同事项（' + cs.length + '）',
          cs.length ? cs.map(function (c) {
            return UI.listItem({
              ico: '⇌', title: E(c.title),
              desc: c.fromDept + ' → ' + c.toDept + ' · 负责人 ' + c.owner,
              meta: '期望完成 ' + c.dueAt,
              right: UI.st('status', c.status) + (c.overdue ? UI.tag('逾期', 'danger') : '')
            });
          }).join('') : UI.empty('该项目暂无跨部门协同事项')) +
        UI.sec('未闭环风险（' + rk.length + '）',
          rk.length ? rk.map(function (x) {
            return UI.listItem({
              ico: '⚠', title: E(x.title), desc: x.type + ' · 负责人 ' + x.owner,
              right: UI.light(C.tone('light', x.level), x.level + '风险') + UI.st('status', x.status)
            });
          }).join('') : UI.empty('该项目暂无未闭环风险')),
      foot: '<div class="left"><button class="btn" data-go-risk>查看风险台账</button></div>' +
        '<button class="btn" data-close>关闭</button>',
      onOpen: function (d) {
        var b = d.el.querySelector('[data-go-risk]');
        if (b) b.addEventListener('click', function () { d.close(); Shell.go('risks', 'ledger'); });
      }
    });
  }

  /* ============================================================
   * 子页 2：跨部门事项
   * ========================================================== */
  function crossList(f) {
    return S.cross().filter(function (c) {
      if (f.kw && !U.matchAny(c, ['title', 'id', 'owner', 'toDept', 'projectName'], f.kw)) return false;
      if (f.status && c.status !== f.status) return false;
      if (f.dept && c.toDept !== f.dept) return false;
      if (f.priority && c.priority !== f.priority) return false;
      if (f.owner && c.owner !== f.owner) return false;
      return true;
    });
  }

  function crossPage(ctx) {
    var f = P.flt(MOD, DEF_CROSS);
    var all = S.cross();
    var rows = crossList(f);

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: '跨部门事项',
        desc: '产品研发与其他部门之间的协同请求台账　·　共 ' + all.length + ' 项，命中 ' + rows.length + ' 项',
        acts: UI.exportMenu({ word: true }) + '　' +
          (ed() ? '<button class="btn-primary" data-new-cross>＋ 发起协同</button>'
            : '<button class="btn" disabled title="当前角色无编辑权限">＋ 发起协同</button>')
      }) +
      P.permTip(MOD) +
      P.statCards([
        { label: '在途事项', val: all.filter(function (c) { return ['已解决', '已关闭'].indexOf(c.status) < 0; }).length, unit: '项', ico: '⇌', tone: 'doing', sub: '待处理 ' + all.filter(function (c) { return c.status === '待处理'; }).length + ' 项' },
        { label: '逾期未闭环', val: all.filter(function (c) { return c.overdue; }).length, unit: '项', ico: '⚠', tone: 'danger', sub: '需升级到周会跟进' },
        { label: '已闭环', val: all.filter(function (c) { return ['已解决', '已关闭'].indexOf(c.status) >= 0; }).length, unit: '项', ico: '✓', tone: 'done', sub: '闭环率 ' + U.pctStr(all.filter(function (c) { return ['已解决', '已关闭'].indexOf(c.status) >= 0; }).length, all.length) },
        { label: '涉及部门', val: U.uniq(all.map(function (c) { return c.toDept; })).length, unit: '个', ico: '◍', tone: 'plan', sub: '最多：' + topDept(all) }
      ]) + P.gap(4) +
      UI.card({
        flush: true,
        body: '<div class="toolbar" id="cxFlt">' +
          '<input class="fld fld-search" data-f="kw" placeholder="搜索事项 / 编号 / 负责人" value="' + E(f.kw) + '">' +
          P.sel('status', '全部状态', ['待处理', '处理中', '已解决', '已关闭'], f.status) +
          P.sel('dept', '全部协作部门', C.DICT.dept, f.dept) +
          P.sel('priority', '全部优先级', C.DICT.priority, f.priority) +
          P.sel('owner', '全部负责人', P.memberNames(), f.owner) +
          '<span class="grow"></span>' + P.viewBar(MOD) +
          '<button class="btn btn-sm" data-reset>重置</button>' +
          '</div><div id="cxTbl"></div>'
      });

    var tb = UI.table('#cxTbl', {
      cols: [
        { k: 'id', t: '编号', w: '78px', render: function (r) { return UI.idCell(r.id); } },
        { k: 'title', t: '协同事项', render: function (r) { return UI.cell2(E(r.title), r.projectName); } },
        { k: 'toDept', t: '协作部门', w: '136px', render: function (r) { return '<span class="muted tiny">' + E(r.fromDept) + ' →</span> ' + UI.tag(r.toDept, 'plain'); } },
        { k: 'priority', t: '优先级', w: '80px', render: function (r) { return UI.pri(r.priority); } },
        { k: 'status', t: '状态', w: '86px', render: function (r) { return UI.st('status', r.status); } },
        { k: 'owner', t: '对接人', w: '112px', render: function (r) { return UI.owner(r.owner); } },
        {
          k: 'dueAt', t: '期望完成', w: '124px',
          render: function (r) {
            if (['已解决', '已关闭'].indexOf(r.status) >= 0) return '<span class="muted">' + E(r.dueAt) + '</span>';
            return UI.due(r.dueAt);
          }
        },
        {
          k: '', t: '操作', w: '104px', sortable: false, align: 'right',
          render: function () {
            return '<div class="row-acts"><button data-act="open">详情</button>' +
              (ed() ? '<button data-act="edit">处理</button>' : '') + '</div>';
          }
        }
      ],
      rows: rows, pageSize: 12, select: true, index: true,
      rowCls: function (r) { return r.overdue ? 'row-danger' : ''; },
      empty: '没有匹配的协同事项',
      onRow: function (r) { openCross(r); },
      onAct: function (act, r) { act === 'edit' ? editCross(r) : openCross(r); },
      bulk: ed() ? [
        {
          t: '批量标记已解决', cls: 'btn-primary', fn: function (picked, clear) {
            UI.confirm('确认将选中的 ' + picked.length + ' 项协同事项标记为「已解决」？', function () {
              picked.forEach(function (r) { S.update('cross', r.id, { status: '已解决', overdue: false, result: '已支持到位' }); });
              clear(); Shell.route();
              UI.toast(picked.length + ' 项事项已标记为已解决', 'ok');
            }, { title: '批量处理协同事项' });
          }
        },
        { t: '批量导出所选', fn: function (picked) { exportCross('跨部门事项_所选', picked); } }
      ] : [
        { t: '批量导出所选', fn: function (picked) { exportCross('跨部门事项_所选', picked); } }
      ]
    });

    var box = P.$('cxFlt');
    P.bindFlt(box, MOD, DEF_CROSS, function (nf) { tb.setRows(crossList(nf)); });
    P.bindViews(box, MOD, DEF_CROSS);
    var nb = ctx.el.querySelector('[data-new-cross]');
    if (nb) nb.addEventListener('click', function () { editCross(null); });

    UI.bindExport(ctx.el, {
      csv: function () { exportCross('跨部门事项', rows); },
      word: function () {
        var open = rows.filter(function (c) { return ['已解决', '已关闭'].indexOf(c.status) < 0; });
        P.word('跨部门协同事项', '跨部门协同事项台账', [
          { h: '一、总体情况', p: '统计口径：' + P.scopeText() + '；共 ' + rows.length + ' 项，其中未闭环 ' + open.length + ' 项，逾期 ' + rows.filter(function (c) { return c.overdue; }).length + ' 项。' },
          {
            h: '二、未闭环事项清单',
            table: {
              cols: [
                { t: '编号', k: 'id' }, { t: '事项', k: 'title' }, { t: '项目', k: 'projectName' },
                { t: '协作部门', k: 'toDept' }, { t: '优先级', k: 'priority' },
                { t: '状态', k: 'status' }, { t: '对接人', k: 'owner' }, { t: '期望完成', k: 'dueAt' }
              ], rows: open
            }
          },
          {
            h: '三、需升级处理的事项',
            list: rows.filter(function (c) { return c.overdue; })
              .map(function (c) { return '【' + c.id + '】' + c.title + '（' + c.toDept + '，对接人 ' + c.owner + '），期望完成 ' + c.dueAt + '，已逾期。'; })
          }
        ]);
      }
    });
  }

  function topDept(list) {
    var m = U.countBy(list, 'toDept');
    var ks = Object.keys(m);
    if (!ks.length) return '—';
    ks.sort(function (a, b) { return m[b] - m[a]; });
    return ks[0] + '（' + m[ks[0]] + '）';
  }

  function exportCross(name, list) {
    P.csv(name, list, [
      { label: '编号', key: 'id' }, { label: '事项', key: 'title' },
      { label: '项目', key: 'projectName' }, { label: '发起部门', key: 'fromDept' },
      { label: '协作部门', key: 'toDept' }, { label: '优先级', key: 'priority' },
      { label: '状态', key: 'status' }, { label: '对接人', key: 'owner' },
      { label: '发起日期', key: 'requestAt' }, { label: '期望完成', key: 'dueAt' },
      { label: '是否逾期', get: function (r) { return r.overdue ? '是' : '否'; } },
      { label: '处理结果', key: 'result' }
    ]);
  }

  function openCross(c) {
    UI.drawer({
      title: E(c.title), sub: c.id + ' · ' + c.fromDept + ' → ' + c.toDept,
      body:
        UI.sec('事项详情', UI.dl([
          ['所属项目', c.projectName], ['优先级', UI.pri(c.priority)],
          ['当前状态', UI.st('status', c.status)], ['是否逾期', c.overdue ? UI.tag('已逾期', 'danger') : UI.tag('正常', 'done')],
          ['发起人', c.requester], ['对接人', UI.owner(c.owner)],
          ['发起日期', c.requestAt], ['期望完成', c.dueAt],
          ['处理结果', c.result || '—']
        ], 'dl-2col')) +
        UI.sec('协同建议', '<div class="rich">' +
          (c.overdue
            ? '该事项已超过期望完成时间，建议在最近一次项目周会上升级，明确新的承诺时间与责任人。'
            : (['已解决', '已关闭'].indexOf(c.status) >= 0
              ? '事项已闭环，可作为后续同类协同的参考案例归档。'
              : '事项在正常推进中，建议在期望完成日前 2 天做一次进度确认。')) + '</div>'),
      foot: '<button class="btn" data-close>关闭</button>' +
        (ed() ? '<button class="btn-primary" data-edit>处理事项</button>' : ''),
      onOpen: function (d) {
        var b = d.el.querySelector('[data-edit]');
        if (b) b.addEventListener('click', function () { d.close(); editCross(c); });
      }
    });
  }

  function editCross(c) {
    var isNew = !c;
    UI.formModal({
      title: isNew ? '发起跨部门协同' : '处理协同事项 · ' + c.id,
      wide: true,
      tip: isNew ? '发起后会进入协同台账，并计入对应部门的在途事项统计。' : '',
      fields: [
        { k: 'title', label: '协同事项', req: true, placeholder: '如：申请测试环境扩容', val: c ? c.title : '' },
        { k: 'projectId', label: '所属项目', type: 'select', req: true, opts: P.projOpts(), val: c ? c.projectId : (S.curProject() || {}).id },
        { k: 'toDept', label: '协作部门', type: 'select', req: true, opts: C.DICT.dept.filter(function (d) { return d !== '产品部'; }), val: c ? c.toDept : '' },
        { k: 'priority', label: '优先级', type: 'select', req: true, opts: C.DICT.priority, val: c ? c.priority : 'P2' },
        { k: 'status', label: '状态', type: 'select', req: true, opts: ['待处理', '处理中', '已解决', '已关闭'], val: c ? c.status : '待处理' },
        { k: 'owner', label: '对接人', type: 'select', req: true, opts: P.memberNames(), val: c ? c.owner : '' },
        { k: 'dueAt', label: '期望完成', type: 'date', req: true, val: c ? c.dueAt : U.fmtDate(U.addDay(S.TODAY, 7)) },
        { k: 'result', label: '处理结果', type: 'textarea', full: true, placeholder: '闭环时填写，如：已支持到位 / 已提供替代方案', val: c ? c.result : '' }
      ],
      onSubmit: function (d) {
        var proj = S.projBy(d.projectId) || {};
        var patch = {
          title: d.title, projectId: d.projectId, projectName: proj.name || '',
          toDept: d.toDept, priority: d.priority, status: d.status, owner: d.owner,
          dueAt: d.dueAt, result: d.result,
          overdue: U.dayDiff(d.dueAt, S.TODAY) > 0 && ['已解决', '已关闭'].indexOf(d.status) < 0
        };
        if (isNew) {
          S.add('cross', Object.assign({
            id: U.uid('CX'), fromDept: '产品部', requester: S.roleObj().user.name,
            requestAt: U.fmtDate(S.TODAY)
          }, patch));
          UI.toast('协同事项已发起', 'ok');
        } else {
          S.update('cross', c.id, patch);
          UI.toast('协同事项已更新', 'ok');
        }
        Shell.route();
      }
    });
  }

  /* ============================================================
   * 子页 3：协同动态
   * ========================================================== */
  function stream(ctx) {
    var f = P.flt(MOD, { type: '', actor: '' });
    var traces = S.traces();
    var items = traces.filter(function (t) {
      if (f.type && t.type !== f.type) return false;
      if (f.actor && t.actor !== f.actor) return false;
      return true;
    }).sort(function (a, b) { return a.time < b.time ? 1 : -1; }).slice(0, 60);

    var byType = U.countBy(traces, 'type');
    var typeRows = C.DICT.traceType.filter(function (t) { return byType[t]; })
      .map(function (t) { return { name: t, value: byType[t] }; });
    var actors = U.countBy(traces, 'actor');
    var actorRows = Object.keys(actors).map(function (k) { return { name: k, value: actors[k] }; })
      .sort(function (a, b) { return b.value - a.value; }).slice(0, 8);

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: '协同动态',
        desc: '汇聚需求、版本、任务、风险、会议等全部协同动作　·　' + P.scopeText() + '　·　最近 ' + items.length + ' 条',
        acts: UI.exportMenu({ word: true })
      }) +
      P.permTip(MOD) +
      '<div class="toolbar" id="stFlt" style="border:1px solid var(--c-border);border-radius:var(--radius-lg)">' +
      '<span class="muted tiny">动态类型</span>' + P.sel('type', '全部类型', C.DICT.traceType, f.type) +
      '<span class="muted tiny">操作人</span>' + P.sel('actor', '全部成员', P.memberNames(), f.actor) +
      '<span class="grow"></span><button class="btn btn-sm" data-reset>重置</button>' +
      '</div>' + P.gap(4) +
      UI.grid(2,
        UI.card({ title: '动态类型分布', sub: '反映当前阶段协同重心', ico: '◍', body: P.chart('stDonut', 250) }) +
        UI.card({ title: '活跃协同成员 TOP8', sub: '按动作条数统计', ico: '▤', body: P.chart('stActor') })
      ) + P.gap(4) +
      UI.card({
        title: '协同动态流', sub: '按日期倒序分组；点击条目跳转到对应对象', ico: '⇌',
        body: '<div id="stLine"></div>'
      });

    if (typeRows.length) {
      CH.donut('stDonut', {
        data: typeRows.map(function (r) { return { name: r.name, value: r.value }; }),
        height: 250, center: { v: traces.length, l: '动态总数' },
        onClick: function (i, d) {
          P.setFlt(MOD, Object.assign({}, f, { type: d.name }));
          Shell.route();
        }
      });
    } else {
      P.$('stDonut').innerHTML = UI.empty('暂无协同动态');
    }

    CH.bars('stActor', {
      data: actorRows.map(function (r) { return { label: r.name, value: r.value }; }),
      palette: true,
      onClick: function (i) {
        P.setFlt(MOD, Object.assign({}, f, { actor: actorRows[i].name }));
        Shell.route();
      }
    });

    P.$('stLine').innerHTML = items.length ? UI.tline(items.map(function (t) {
      var g = refGo(t);
      return {
        time: t.time,
        tone: g ? 'clickable' : '',
        title: UI.tag(t.type, C.tone('traceType', t.type)) + ' ' + E(t.title),
        desc: E(t.desc),
        meta: '<span>' + E(t.actor) + '</span><span>' + E(t.projectName || t.lineName || '—') + '</span>' +
          (g ? '<span class="muted tiny">点击查看对象</span>' : ''),
        data: g
      };
    }), { groupByDate: true, emptyMsg: '暂无协同动态' }) : UI.empty('当前筛选条件下没有协同动态');

    P.bindFlt(P.$('stFlt'), MOD, { type: '', actor: '' }, function () { Shell.route(); });

    UI.bindExport(ctx.el, {
      csv: function () {
        P.csv('协同动态', items, [
          { label: '时间', key: 'time' }, { label: '类型', key: 'type' },
          { label: '内容', key: 'title' }, { label: '说明', key: 'desc' },
          { label: '操作人', key: 'actor' }, { label: '项目', key: 'projectName' },
          { label: '产品线', key: 'lineName' }
        ]);
      },
      word: function () {
        P.word('协同动态', '协同动态汇总', [
          { h: '一、动态概览', p: '统计口径：' + P.scopeText() + '；累计动态 ' + traces.length + ' 条，本次导出 ' + items.length + ' 条。' },
          { h: '二、类型分布', table: { cols: [{ t: '动态类型', k: 'name' }, { t: '条数', k: 'value' }], rows: typeRows } },
          {
            h: '三、动态明细',
            table: {
              cols: [
                { t: '时间', k: 'time' }, { t: '类型', k: 'type' },
                { t: '内容', k: 'title' }, { t: '操作人', k: 'actor' }, { t: '项目', k: 'projectName' }
              ], rows: items
            }
          }
        ]);
      }
    });
  }

  /* 留痕对象 -> 可跳转的 data-go */
  var REF_MOD = {
    requirement: ['requirements', 'pool'], release: ['releases', 'plan'],
    task: ['tasks', 'list'], risk: ['risks', 'ledger'], meeting: ['meetings', 'list'],
    change: ['changes', 'list'], deliverable: ['delivery', 'items'], roadmap: ['roadmap', 'map']
  };
  function refGo(t) {
    var m = REF_MOD[t.refType];
    if (!m || !t.refId || !C.canSee(m[0], S.role())) return '';
    return ' data-go="' + E(m[0] + '/' + m[1] + '/' + t.refId) + '"';
  }

  /* ============================================================ */
  Shell.page(MOD, {
    render: function (ctx) {
      if (ctx.sub === 'cross') crossPage(ctx);
      else if (ctx.sub === 'stream') stream(ctx);
      else board(ctx);
    }
  });
})();
