/* ============================================================
 * 20-roadmap.js  产品规划（产品总监专属）
 * 子页：lines   产品线管理
 *       map     路线图（季度泳道）
 *       okr     年度/季度规划（OKR 目标映射）
 *       compare 多产品线对比
 * ========================================================== */
(function () {
  'use strict';
  var E = U.esc, MOD = 'roadmap';

  var CUR_Q = '2026Q3';
  var DEF_M = { kw: '', status: '', type: '', line: '', priority: '' };

  function ed() { return P.ed(MOD); }
  function items() { return S.roadmap(); }
  function lines() { return S.linesInScope(); }

  /* ============ 产品线的改与删 ============
     产品线用 lineId 关联，但 lineName 被复制进了近十个集合。
     所以改名不是改一条记录，删线也不是删一条记录——两件事都要先算清账。 */

  var LINE_COLL_CN = {
    projects: '项目', requirements: '需求', releases: '版本', roadmap: '规划项',
    okrs: 'OKR', feedbacks: '用户反馈', reviews: '经营复盘', reports: '报告',
    metrics: '指标数据', risks: '风险', meetings: '会议', tasks: '任务',
    changes: '需求变更', deliverables: '交付物', funnel: '漏斗', retention: '留存',
    traces: '工作留痕', todos: '待办', notes: '笔记', issues: '问题',
    cross: '协作事项', actions: '会议行动项', phases: '阶段', milestones: '里程碑',
    allocs: '工时分配', notices: '提醒'
  };
  function childText(ch) {
    return Object.keys(ch.byColl).map(function (c) {
      return (LINE_COLL_CN[c] || c) + ' ' + ch.byColl[c] + ' 条';
    }).join('、');
  }

  function editLine(l) {
    if (!l) return;
    UI.formModal({
      title: '编辑产品线 · ' + l.name, wide: true,
      tip: '改名字会同步更新需求 / 项目 / 版本 / 规划等所有记录里显示的产品线名称，不会出现一半新一半旧。',
      okText: '保存',
      fields: [
        { k: 'name', label: '产品线名称', type: 'text', req: true, val: l.name },
        { k: 'code', label: '英文代号', type: 'text', val: l.code, hint: '用于图表与导出时的简称，可留空' },
        { k: 'owner', label: '产品负责人', type: 'select', req: true, opts: S.members().map(function (m) { return m.name; }), val: l.owner },
        { k: 'pm', label: '项目负责人', type: 'select', opts: S.members().map(function (m) { return m.name; }), val: l.pm, emptyText: '（暂未指定）' },
        { k: 'stage', label: '所处阶段', type: 'select', req: true, opts: ['探索期', '成长期', '成熟期', '衰退期'], val: l.stage },
        { k: 'started', label: '启动时间', type: 'text', val: l.started, placeholder: 'YYYY-MM' },
        { k: 'headcount', label: '投入人数', type: 'number', val: l.headcount, min: 0 },
        { k: 'budget', label: '年度预算（万元）', type: 'number', val: l.budget, min: 0 },
        { k: 'used', label: '已使用预算（万元）', type: 'number', val: l.used, min: 0 },
        /* 健康度是算出来的（S.lineStat 按未闭环风险推导），不是填出来的。
           这里原本是个可编辑的下拉框，但全站没有任何地方读产品线记录上的 health，
           卡片显示的一直是计算值——所以改了看不到变化，是个只写不读的死字段。
           现在改成只读展示，并把规则和"怎么让它变绿"说清楚。 */
        {
          k: 'health', label: '健康度（风险等级）', type: 'static', help: 'lineHealth',
          html: (function () {
            var st = S.lineStat(l.id);
            return UI.light(C.tone('light', st.health), st.health + '风险') +
              '<span class="muted" style="margin-left:8px">自动计算 · 当前未闭环风险 ' + st.riskOpen +
              ' 项（高危 ' + st.riskHigh + ' 项）</span>';
          })()
        },
        { k: 'goal', label: '年度目标', type: 'textarea', full: true, rows: 2, val: l.goal, placeholder: '一句可量化的目标' },
        { k: 'desc', label: '产品线简介', type: 'textarea', full: true, rows: 3, val: l.desc, placeholder: '面向谁、解决什么问题、覆盖哪些能力' }
      ],
      onSubmit: function (d) {
        var nw = String(d.name || '').trim();
        if (!nw) { UI.toast('产品线名称不能为空', 'err'); return; }
        var dup = S.DB.lines.filter(function (x) { return x.name === nw && x.id !== l.id; })[0];
        if (dup) { UI.toast('已存在同名产品线「' + nw + '」', 'err'); return; }

        var synced = (nw !== l.name) ? S.renameLine(l.id, nw) : 0;
        S.update('lines', l.id, {
          name: nw, code: d.code || '', owner: d.owner, pm: d.pm || d.owner,
          stage: d.stage, started: d.started || l.started,
          headcount: U.num(d.headcount, 0), budget: U.num(d.budget, 0), used: U.num(d.used, 0),
          /* 不写 health：它由 S.lineStat 按风险实时算，存一份只会变成第二真相源 */
          goal: d.goal || '', desc: d.desc || ''
        });
        Shell.route();
        UI.toast(synced ? ('已保存，同步更新了 ' + synced + ' 处引用') : '已保存', 'ok');
      }
    });
  }

  function delLine(l) {
    if (!l) return;
    var ch = S.lineChildren(l.id);
    var others = S.DB.lines.filter(function (x) { return x.id !== l.id; });

    /* 空线 —— 直接删 */
    if (!ch.total) {
      UI.confirm('确定删除产品线「' + l.name + '」？',
        function () {
          S.remove('lines', l.id);
          if (S.state.lineId === l.id) S.setLine('');
          Shell.route();
          UI.toast('已删除产品线「' + l.name + '」', 'ok');
        },
        { danger: true, okText: '删除', tip: '这条线底下没有任何内容，删除不影响其它数据。删除会立刻写入本地存储，无法撤销。' });
      return;
    }

    /* 有内容 —— 先摆账，再选出口。没有别的线可迁时，只剩「一起删」这一条路。 */
    var canMove = others.length > 0;
    var body =
      UI.notice('warn', '「' + l.name + '」底下挂着 <b>' + ch.total + '</b> 条内容：' + childText(ch) +
        '。产品线是最外层的容器，直接删掉它，这些内容就会失去归属，在按产品线过滤的页面上再也看不到。') +
      '<div style="height:14px"></div>' +
      '<div class="form-row"><label class="fl">这些内容怎么办</label>' +
      '<div style="display:flex;flex-direction:column;gap:10px">' +
      (canMove
        ? '<label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer">' +
          '<input type="radio" name="dlMode" value="move" checked style="margin-top:3px">' +
          '<span><b>迁移到另一条产品线</b>（推荐）<br><span class="muted" style="font-size:var(--f-sm)">' +
          '把这 ' + ch.total + ' 条内容改挂到下面选的线，再删除本线。数据一条不丢。</span></span></label>'
        : '') +
      '<label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer">' +
      '<input type="radio" name="dlMode" value="drop"' + (canMove ? '' : ' checked') + ' style="margin-top:3px">' +
      '<span><b style="color:var(--c-danger)">连同内容一起删除</b><br><span class="muted" style="font-size:var(--f-sm)">' +
      '这 ' + ch.total + ' 条内容会被<b>一并永久删除</b>，不可撤销。只有确认它们是废弃数据时才选这个。</span></span></label>' +
      '</div></div>' +
      (canMove
        ? '<div style="height:12px"></div><div class="form-row" id="dlToWrap"><label class="fl">迁移到</label>' +
          '<select id="dlTo" class="inp">' + others.map(function (x) {
            return '<option value="' + E(x.id) + '">' + E(x.name) + '</option>';
          }).join('') + '</select></div>'
        : '');

    var h = UI.modal({
      title: '删除产品线 · ' + l.name, wide: true, body: body,
      foot: '<button class="btn" data-close>取消</button>' +
        '<button class="btn-danger" data-ok>删除该产品线</button>'
    });

    function mode() { return h.el.querySelector('input[name="dlMode"]:checked').value; }
    var toWrap = h.el.querySelector('#dlToWrap');
    if (toWrap) {
      h.el.querySelectorAll('input[name="dlMode"]').forEach(function (r) {
        r.addEventListener('change', function () { toWrap.style.display = mode() === 'move' ? '' : 'none'; });
      });
    }

    h.el.querySelector('[data-ok]').addEventListener('click', function () {
      var m = mode();
      if (m === 'move') {
        var toId = h.el.querySelector('#dlTo').value;
        if (!toId) { UI.toast('请选择迁移目标', 'err'); return; }
        var n = S.moveLineChildren(l.id, toId);
        S.remove('lines', l.id);
        if (S.state.lineId === l.id) S.setLine(toId);
        S.persist();
        h.close(); Shell.route();
        UI.toast('已删除「' + l.name + '」，' + n + ' 条内容迁至「' + (S.lineBy(toId) || {}).name + '」', 'ok');
        return;
      }
      /* 级联删除是这个工具里破坏性最强的动作，必须再确认一次 */
      h.close();
      UI.confirm('真的要连同 ' + ch.total + ' 条内容一起删除「' + l.name + '」吗？',
        function () {
          var n = S.dropLineChildren(l.id);
          S.remove('lines', l.id);
          if (S.state.lineId === l.id) S.setLine('');
          S.persist();
          Shell.route();
          UI.toast('已删除产品线「' + l.name + '」及其 ' + n + ' 条内容', 'ok');
        },
        { danger: true, okText: '确认全部删除',
          tip: '将永久删除：' + childText(ch) + '。此操作立刻写入本地存储，无法撤销。建议先到「上手与数据 → 数据管理」导出一份 JSON 备份。' });
    });
  }

  /* ============================================================
   * 子页 1：产品线管理
   * ========================================================== */
  function lineList(ctx) {
    var ls = lines();
    var stats = ls.map(function (l) {
      var st = S.lineStat(l.id);
      var rms = S.DB.roadmap.filter(function (r) { return r.lineId === l.id; });
      return {
        id: l.id, name: l.name, code: l.code, stage: l.stage, owner: l.owner, pm: l.pm,
        started: l.started, desc: l.desc, goal: l.goal,
        budget: l.budget, used: l.used, headcount: l.headcount,
        useRate: U.pct(l.used, l.budget),
        projects: st.projects, running: st.running, progress: st.progress,
        reqTotal: st.reqTotal, reqOnline: st.reqOnline,
        relPending: st.relPending, riskOpen: st.riskOpen, riskHigh: st.riskHigh,
        health: st.health,
        rmTotal: rms.length,
        rmDone: rms.filter(function (r) { return r.status === '已完成'; }).length,
        rmRisk: rms.filter(function (r) { return r.status === '风险中'; }).length
      };
    });

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: '产品线管理',
        desc: '产品线是总监视角的第一口径：一条线 = 一组项目 + 一条路线图 + 一套经营目标　·　共 ' + ls.length + ' 条产品线',
        acts: UI.exportMenu({ word: true }) + '　' + P.createBtn(MOD, 'roadmap.new', '新建规划项')
      }) +
      P.permTip(MOD) +
      P.statCards([
        { label: '产品线数', val: ls.length, unit: '条', ico: '◈', tone: 'doing', sub: '在营产品线' },
        { label: '在办项目', val: U.sum(stats, 'running'), unit: '个', ico: '◫', tone: 'plan', sub: '合计 ' + U.sum(stats, 'projects') + ' 个项目' },
        { label: '预算使用率', val: U.pct(U.sum(stats, 'used'), U.sum(stats, 'budget')), unit: '%', ico: '◐', tone: 'warn', sub: '已用 ' + U.fmtNum(U.sum(stats, 'used')) + ' / ' + U.fmtNum(U.sum(stats, 'budget')) + ' 万' },
        { label: '高危风险线', val: stats.filter(function (s) { return s.health === '高'; }).length, unit: '条', ico: '⚠', tone: 'danger', sub: '需在经营例会上专项过' }
      ]) + P.gap(4) +
      UI.grid(2,
        stats.map(function (s) {
          return UI.card({
            title: s.name, ico: '◈',
            sub: s.code + ' · ' + s.stage + ' · ' + s.started + ' 立项',
            extra: UI.light(C.tone('light', s.health), s.health + '风险'),
            body:
              '<div class="muted" style="font-size:var(--f-sm);line-height:1.7;margin-bottom:var(--sp-3)">' + E(s.desc) + '</div>' +
              UI.notice('info', '<b>年度目标：</b>' + E(s.goal)) +
              '<div style="margin-top:var(--sp-3)">' + UI.pbar(Math.round(s.progress * 100), UI.ptone(s.progress * 100, s.health === '高'), true) + '</div>' +
              P.kv([
                ['负责人', UI.owner(s.owner) + ' <span class="muted tiny">总监</span>'],
                ['产品负责人', UI.owner(s.pm)],
                ['项目', s.running + ' 在办 / ' + s.projects + ' 总数'],
                ['需求', s.reqOnline + ' 上线 / ' + s.reqTotal + ' 总数'],
                ['规划项', s.rmDone + ' 完成 / ' + s.rmTotal + ' 总数' + (s.rmRisk ? ' <span class="tag tag-danger">' + s.rmRisk + ' 风险中</span>' : '')],
                ['待发布版本', s.relPending + ' 个'],
                ['未闭环风险', s.riskOpen + ' 项' + (s.riskHigh ? '（高 ' + s.riskHigh + '）' : '')],
                ['编制 / 预算', s.headcount + ' 人 · ' + U.fmtNum(s.used) + '/' + U.fmtNum(s.budget) + ' 万（' + s.useRate + '%）']
              ]),
            foot: '<button class="btn btn-sm" data-line="' + E(s.id) + '">聚焦此产品线</button>' +
              '<button class="btn btn-sm" data-rm="' + E(s.id) + '">看路线图</button>' +
              '<button class="btn btn-sm" data-okr="' + E(s.id) + '">看目标</button>' +
              '<span style="flex:1"></span>' +
              '<button class="btn btn-sm" data-edit-line="' + E(s.id) + '">编辑</button>' +
              '<button class="btn btn-sm btn-danger" data-del-line="' + E(s.id) + '">删除</button>'
          });
        }).join('')
      );

    ctx.el.querySelectorAll('[data-edit-line]').forEach(function (b) {
      b.addEventListener('click', function () { editLine(S.lineBy(b.getAttribute('data-edit-line'))); });
    });
    ctx.el.querySelectorAll('[data-del-line]').forEach(function (b) {
      b.addEventListener('click', function () { delLine(S.lineBy(b.getAttribute('data-del-line'))); });
    });
    ctx.el.querySelectorAll('[data-line]').forEach(function (b) {
      b.addEventListener('click', function () {
        S.setLine(b.getAttribute('data-line'));
        UI.toast('已切换口径到该产品线');
        Shell.route();
      });
    });
    ctx.el.querySelectorAll('[data-rm]').forEach(function (b) {
      b.addEventListener('click', function () { S.setLine(b.getAttribute('data-rm')); Shell.go(MOD, 'map'); });
    });
    ctx.el.querySelectorAll('[data-okr]').forEach(function (b) {
      b.addEventListener('click', function () { S.setLine(b.getAttribute('data-okr')); Shell.go(MOD, 'okr'); });
    });

    UI.bindExport(ctx.el, {
      csv: function () {
        P.csv('产品线概览', stats, [
          { label: '产品线', key: 'name' }, { label: '代号', key: 'code' }, { label: '阶段', key: 'stage' },
          { label: '负责人', key: 'owner' }, { label: '产品负责人', key: 'pm' },
          { label: '项目数', key: 'projects' }, { label: '在办', key: 'running' },
          { label: '平均进度', get: function (r) { return Math.round(r.progress * 100) + '%'; } },
          { label: '需求总数', key: 'reqTotal' }, { label: '已上线需求', key: 'reqOnline' },
          { label: '未闭环风险', key: 'riskOpen' }, { label: '健康度', key: 'health' },
          { label: '预算(万)', key: 'budget' }, { label: '已用(万)', key: 'used' }
        ]);
      },
      word: function () {
        P.word('产品线概览', '产品线经营概览', [
          { h: '一、总体情况', p: '当前共管理 ' + ls.length + ' 条产品线，在办项目 ' + U.sum(stats, 'running') + ' 个，预算使用率 ' + U.pct(U.sum(stats, 'used'), U.sum(stats, 'budget')) + '%。' }
        ].concat(stats.map(function (s) {
          return {
            h: s.name + '（' + s.code + '）',
            kv: [
              ['所处阶段', s.stage], ['立项时间', s.started], ['负责人', s.owner + ' / ' + s.pm],
              ['年度目标', s.goal], ['项目情况', s.running + ' 在办 / ' + s.projects + ' 总数'],
              ['平均进度', Math.round(s.progress * 100) + '%'],
              ['需求情况', s.reqOnline + ' 上线 / ' + s.reqTotal + ' 总数'],
              ['规划项', s.rmDone + ' 完成 / ' + s.rmTotal + ' 总数'],
              ['未闭环风险', s.riskOpen + ' 项（高 ' + s.riskHigh + '）'],
              ['健康度', s.health + '风险'],
              ['编制 / 预算', s.headcount + ' 人 · ' + s.used + '/' + s.budget + ' 万'],
              ['产品线定位', s.desc]
            ]
          };
        })));
        UI.toast('产品线概览已导出为 Word', 'ok');
      }
    });
  }

  /* ============================================================
   * 子页 2：路线图（季度泳道）
   * ========================================================== */
  function map(ctx) {
    var f = P.flt(MOD, DEF_M);
    var all = items();
    var rows = all.filter(function (r) {
      if (f.kw && !U.matchAny(r, ['title', 'id', 'owner', 'goal', 'kpi'], f.kw)) return false;
      if (f.status && r.status !== f.status) return false;
      if (f.type && r.type !== f.type) return false;
      if (f.line && r.lineId !== f.line) return false;
      if (f.priority && r.priority !== f.priority) return false;
      return true;
    });
    var qs = S.quarters;
    var ls = lines().filter(function (l) { return !f.line || l.id === f.line; });

    var h = '<div class="roadmap"><div class="rm-head"><div class="rm-lane-h">产品线 \\ 季度</div>';
    qs.forEach(function (q) {
      var n = rows.filter(function (r) { return r.quarter === q; }).length;
      h += '<div class="rm-q' + (q === CUR_Q ? ' cur' : '') + '">' + E(q) +
        '<small>' + n + ' 项' + (q === CUR_Q ? ' · 当前季度' : '') + '</small></div>';
    });
    h += '</div>';
    ls.forEach(function (l) {
      var mine = rows.filter(function (r) { return r.lineId === l.id; });
      h += '<div class="rm-row"><div class="rm-lane"><b>' + E(l.name) + '</b>' +
        '<span>' + E(l.code) + ' · ' + mine.length + ' 项</span></div>';
      qs.forEach(function (q) {
        h += '<div class="rm-cell' + (q === CUR_Q ? ' cur' : '') + '">';
        mine.filter(function (r) { return r.quarter === q; }).forEach(function (r) {
          h += '<div class="rm-item ' + C.tone('status', r.status) + '" data-rm="' + E(r.id) + '">' +
            '<b>' + E(r.title) + '</b>' +
            '<div class="rm-m">' + UI.pri(r.priority) + UI.tag(r.status, C.tone('status', r.status)) +
            '<span>' + E(r.owner) + '</span></div>' +
            '<div style="margin-top:5px">' + UI.pbar(Math.round(r.progress * 100), C.tone('status', r.status)) + '</div>' +
            '</div>';
        });
        h += '</div>';
      });
      h += '</div>';
    });
    h += '</div>';

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: '产品路线图',
        desc: '按产品线 × 季度铺开的规划泳道，点击任一规划项查看目标、KPI 与关联版本　·　共 ' +
          all.length + ' 项，命中 ' + rows.length + ' 项',
        acts: UI.exportMenu({ word: true }) + '　' + P.createBtn(MOD, 'roadmap.new', '新建规划项')
      }) +
      P.permTip(MOD) +
      P.statCards([
        { label: '规划项总数', val: all.length, unit: '项', ico: '◈', tone: 'doing', sub: '横跨 ' + qs.length + ' 个季度' },
        { label: '本季度在推', val: all.filter(function (r) { return r.quarter === CUR_Q; }).length, unit: '项', ico: '▶', tone: 'plan', sub: CUR_Q },
        { label: '风险中', val: all.filter(function (r) { return r.status === '风险中'; }).length, unit: '项', ico: '⚠', tone: 'danger', sub: '需要调整节奏或补资源' },
        { label: '已完成', val: all.filter(function (r) { return r.status === '已完成'; }).length, unit: '项', ico: '✓', tone: 'done', sub: '完成率 ' + U.pctStr(all.filter(function (r) { return r.status === '已完成'; }).length, all.length) }
      ]) + P.gap(4) +
      UI.card({
        flush: true,
        body: '<div class="toolbar" id="rmFlt">' +
          '<input class="fld fld-search" data-f="kw" placeholder="搜索规划项 / 目标 / KPI" value="' + E(f.kw) + '">' +
          P.sel('line', '全部产品线', P.lineOpts(), f.line) +
          P.sel('status', '全部状态', ['规划中', '进行中', '风险中', '已完成'], f.status) +
          P.sel('type', '全部类型', ['战略必做', '客户承诺', '体验优化', '技术投入'], f.type) +
          P.sel('priority', '全部优先级', C.DICT.priority, f.priority) +
          '<span class="grow"></span>' + P.viewBar(MOD) +
          '<button class="btn btn-sm" data-reset>重置</button>' +
          '</div><div style="padding:0 var(--sp-4) var(--sp-4)">' +
          (rows.length ? h : UI.empty('当前筛选条件下没有规划项')) + '</div>'
      });

    var flt = P.$('rmFlt');
    P.bindFlt(flt, MOD, DEF_M, function () { Shell.route(); });
    P.bindViews(flt, MOD, DEF_M);

    ctx.el.querySelectorAll('[data-rm]').forEach(function (n) {
      n.addEventListener('click', function () {
        var r = all.filter(function (x) { return x.id === n.getAttribute('data-rm'); })[0];
        if (r) openRM(r);
      });
    });

    UI.bindExport(ctx.el, {
      csv: function () { csvRM(rows); },
      word: function () { wordRM(rows, qs); }
    });

    if (ctx.id) {
      var hit = all.filter(function (x) { return x.id === ctx.id; })[0];
      if (hit) openRM(hit);
    }
  }

  function csvRM(rows) {
    P.csv('产品路线图', rows, [
      { label: '编号', key: 'id' }, { label: '产品线', key: 'lineName' },
      { label: '规划项', key: 'title' }, { label: '季度', key: 'quarter' },
      { label: '类型', key: 'type' }, { label: '优先级', key: 'priority' },
      { label: '状态', key: 'status' },
      { label: '进度', get: function (r) { return Math.round(r.progress * 100) + '%'; } },
      { label: '负责人', key: 'owner' }, { label: '业务目标', key: 'goal' },
      { label: '衡量指标', key: 'kpi' },
      { label: '投入(人天)', key: 'effort' }, { label: '价值分', key: 'value' }
    ]);
  }

  function wordRM(rows, qs) {
    P.word('产品路线图', '产品路线图', [
      {
        h: '一、路线图概览',
        p: '本路线图共 ' + rows.length + ' 个规划项，覆盖 ' + qs.join('、') + ' 共 ' + qs.length + ' 个季度。' +
          '当前季度（' + CUR_Q + '）在推 ' + rows.filter(function (r) { return r.quarter === CUR_Q; }).length + ' 项。'
      }
    ].concat(qs.map(function (q) {
      var list = rows.filter(function (r) { return r.quarter === q; });
      return {
        h: q + (q === CUR_Q ? '（当前季度）' : '') + '　共 ' + list.length + ' 项',
        table: {
          cols: [
            { t: '产品线', k: 'lineName' }, { t: '规划项', k: 'title' }, { t: '类型', k: 'type' },
            { t: '优先级', k: 'priority' }, { t: '状态', k: 'status' },
            { t: '进度', get: function (r) { return Math.round(r.progress * 100) + '%'; } },
            { t: '负责人', k: 'owner' }, { t: '业务目标', k: 'goal' }, { t: '衡量指标', k: 'kpi' }
          ],
          rows: list
        }
      };
    })));
    UI.toast('路线图已导出为 Word', 'ok');
  }

  function openRM(r) {
    var rels = (r.relatedReleases || []).map(function (id) { return S.relBy(id); }).filter(Boolean);
    UI.drawer({
      wide: true,
      title: r.title,
      sub: r.lineName + '　·　' + r.quarter + '　·　' + r.id,
      body:
        UI.sec('规划要素', P.kv([
          ['所属产品线', E(r.lineName)],
          ['目标季度', UI.tag(r.quarter, r.quarter === CUR_Q ? 'accent' : 'plain')],
          ['规划类型', UI.tag(r.type, r.type === '战略必做' ? 'danger' : (r.type === '客户承诺' ? 'warn' : 'plain'))],
          ['优先级', UI.pri(r.priority)],
          ['当前状态', UI.tag(r.status, C.tone('status', r.status))],
          ['完成进度', UI.pbar(Math.round(r.progress * 100), C.tone('status', r.status), true)],
          ['负责人', UI.owner(r.owner)],
          ['预估投入', r.effort + ' 人天'],
          ['价值评分', r.value + ' / 10'],
          ['投入产出比', (r.value / Math.max(1, r.effort) * 100).toFixed(2) + '（价值分 / 人天 × 100）']
        ])) +
        UI.sec('业务目标', '<div class="rich">' + E(r.goal) + '</div>') +
        UI.sec('衡量指标（KPI）', UI.notice('info', E(r.kpi))) +
        UI.sec('关联版本', rels.length
          ? rels.map(function (x) {
            return UI.listItem({
              ico: '⬢', title: E(x.name), desc: E(x.lineName + ' · 计划 ' + x.planDate),
              right: UI.tag(x.status, C.tone('status', x.status)),
              click: C.canSee('releases', S.role()),
              data: C.canSee('releases', S.role()) ? ' data-jump="releases/plan/' + E(x.id) + '"' : ''
            });
          }).join('')
          : UI.empty('尚未关联版本，规划落地时请回填')),
      foot: '<button class="btn" data-close>关闭</button>' +
        (ed() ? '<button class="btn-primary" data-edit>编辑规划项</button>' : ''),
      onOpen: function (h) {
        h.el.querySelector('[data-close]').addEventListener('click', h.close);
        var eb = h.el.querySelector('[data-edit]');
        if (eb) eb.addEventListener('click', function () { h.close(); editRM(r); });
        h.el.querySelectorAll('[data-jump]').forEach(function (n) {
          n.addEventListener('click', function () {
            var p = n.getAttribute('data-jump').split('/');
            h.close(); Shell.go(p[0], p[1], p[2]);
          });
        });
      }
    });
  }

  function editRM(r) {
    UI.formModal({
      title: '编辑规划项 · ' + r.id, wide: true,
      fields: [
        { k: 'title', label: '规划项名称', req: true, full: true, val: r.title },
        { k: 'quarter', label: '目标季度', type: 'select', opts: S.quarters, val: r.quarter, req: true },
        { k: 'status', label: '状态', type: 'select', opts: ['规划中', '进行中', '风险中', '已完成'], val: r.status, req: true },
        { k: 'type', label: '规划类型', type: 'select', opts: ['战略必做', '客户承诺', '体验优化', '技术投入'], val: r.type, req: true },
        { k: 'priority', label: '优先级', type: 'select', opts: C.DICT.priority, val: r.priority, req: true },
        { k: 'owner', label: '负责人', type: 'select', opts: P.memberNames(), val: r.owner, req: true },
        { k: 'progress', label: '完成进度（%）', type: 'number', min: 0, max: 100, val: Math.round(r.progress * 100), req: true },
        { k: 'value', label: '价值评分（1-10）', type: 'number', min: 1, max: 10, val: r.value, req: true, help: 'valueScore' },
        { k: 'effort', label: '预估投入（人天）', type: 'number', min: 1, val: r.effort, req: true },
        { k: 'goal', label: '业务目标', full: true, val: r.goal, req: true },
        { k: 'kpi', label: '衡量指标', full: true, val: r.kpi, req: true }
      ],
      onSubmit: function (d, h) {
        d.progress = U.clamp(U.num(d.progress, 0), 0, 100) / 100;
        d.value = U.num(d.value, 5);
        d.effort = U.num(d.effort, 20);
        S.update('roadmap', r.id, d);
        h.close(); Shell.route();
        UI.toast('规划项已更新', 'ok');
      }
    });
  }

  /* ============================================================
   * 子页 3：年度 / 季度规划（OKR）
   * ========================================================== */
  function okr(ctx) {
    var all = S.okrs();
    var q = S.pref(MOD, 'okrQ', CUR_Q);
    var rows = all.filter(function (o) { return !q || o.quarter === q; });
    var quarters = U.uniq(all.map(function (o) { return o.quarter; })).sort();

    var done = rows.filter(function (o) { return o.rate >= 100; }).length;
    var risk = rows.filter(function (o) { return o.rate < 60; }).length;

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: '年度 / 季度规划',
        desc: '把产品线目标（Objective）拆成可量化的关键结果（KR），并与路线图规划项相互映射　·　' +
          '当前季度 ' + q + '，共 ' + rows.length + ' 条目标',
        acts: UI.exportMenu({ word: true })
      }) +
      P.permTip(MOD) +
      P.statCards([
        { label: '目标条数', val: rows.length, unit: '条', ico: '◎', tone: 'doing', sub: q + ' 全部产品线' },
        { label: '平均完成率', val: rows.length ? Math.round(U.avg(rows, 'rate')) : 0, unit: '%', ico: '◔', tone: 'plan', sub: '按 KR 实际 / 目标' },
        { label: '已达成', val: done, unit: '条', ico: '✓', tone: 'done', sub: '完成率 ≥ 100%' },
        { label: '亮红灯', val: risk, unit: '条', ico: '⚠', tone: 'danger', sub: '完成率 < 60%，需专项跟进' }
      ]) + P.gap(4) +
      UI.grid(2,
        UI.card({ title: '各产品线目标完成率', sub: '点击柱条可聚焦该产品线', ico: '▤', body: P.chart('okLine', 240) }) +
        UI.card({ title: '目标价值归属', sub: '目标条数按价值类型分布', ico: '◍', body: P.chart('okValue', 240) })
      ) + P.gap(4) +
      UI.card({
        flush: true,
        title: '目标明细', ico: '◎',
        extra: UI.chips(
          [{ key: '', label: '全部季度', n: all.length }].concat(quarters.map(function (x) {
            return { key: x, label: x, n: all.filter(function (o) { return o.quarter === x; }).length };
          })), q, 'okrQ'),
        body: '<div id="okTbl"></div>'
      });

    /* 产品线完成率 */
    var byLine = lines().map(function (l) {
      var mine = rows.filter(function (o) { return o.lineId === l.id; });
      return { id: l.id, name: l.name, rate: mine.length ? Math.round(U.avg(mine, 'rate')) : 0, n: mine.length };
    });
    CH.bar('okLine', {
      labels: byLine.map(function (x) { return x.name; }),
      series: [{ name: '平均完成率(%)', data: byLine.map(function (x) { return x.rate; }), color: CH.TONE.doing }],
      height: 240, yFmt: function (v) { return v + '%'; },
      onClick: function (i) { S.setLine(byLine[i].id); Shell.route(); UI.toast('已聚焦到 ' + byLine[i].name); }
    });

    /* 价值归属 */
    var byVal = U.countBy(rows, 'value');
    var valRows = Object.keys(byVal).map(function (k) { return { name: k, value: byVal[k] }; });
    if (valRows.length) {
      CH.donut('okValue', { data: valRows, height: 240, center: { v: rows.length, l: '目标条数' } });
    } else P.$('okValue').innerHTML = UI.empty('该季度暂无目标');

    UI.table('#okTbl', {
      pageSize: 12,
      cols: [
        { k: 'lineName', t: '产品线', w: '130px' },
        {
          k: 'objective', t: '目标（Objective）',
          render: function (r) { return UI.cell2(E(r.objective), UI.tag(r.value, 'plain') + ' ' + E(r.owner)); }
        },
        { k: 'kr', t: '关键结果（KR）', render: function (r) { return E(r.kr); } },
        { k: 'quarter', t: '季度', w: '92px' },
        {
          k: 'target', t: '目标 / 实际', w: '124px', align: 'right',
          render: function (r) { return UI.cell2('<b>' + r.actual + '</b> / ' + r.target + ' ' + E(r.unit), ''); }
        },
        {
          k: 'rate', t: '完成率', w: '150px',
          render: function (r) { return UI.pcell(Math.min(r.rate, 100), r.rate >= 100 ? 'done' : (r.rate >= 60 ? 'doing' : 'danger')); },
          sortVal: function (r) { return r.rate; }
        },
        { k: 'status', t: '状态', w: '92px', render: function (r) { return UI.tag(r.status, r.status === '已结束' ? 'idle' : (r.status === '进行中' ? 'doing' : 'plan')); } }
      ],
      rows: U.sortBy(rows, 'rate'),
      rowCls: function (r) { return r.rate < 60 ? 'row-danger' : ''; },
      empty: '该季度暂无目标记录'
    });

    ctx.el.querySelectorAll('[data-chip="okrQ"]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-v');
        S.setPref(MOD, 'okrQ', q === v ? '' : v);
        Shell.route();
      });
    });

    UI.bindExport(ctx.el, {
      csv: function () {
        P.csv('目标与关键结果', rows, [
          { label: '编号', key: 'id' }, { label: '产品线', key: 'lineName' }, { label: '季度', key: 'quarter' },
          { label: '目标', key: 'objective' }, { label: '关键结果', key: 'kr' },
          { label: '负责人', key: 'owner' }, { label: '目标值', key: 'target' }, { label: '实际值', key: 'actual' },
          { label: '完成率(%)', key: 'rate' }, { label: '状态', key: 'status' }, { label: '价值归属', key: 'value' }
        ]);
      },
      word: function () {
        P.word('目标与关键结果', (q || '全部季度') + ' 目标与关键结果', [
          {
            h: '一、总体完成情况',
            p: '本期共 ' + rows.length + ' 条目标，平均完成率 ' + (rows.length ? Math.round(U.avg(rows, 'rate')) : 0) +
              '%，已达成 ' + done + ' 条，低于 60% 的红灯目标 ' + risk + ' 条。'
          },
          {
            h: '二、按产品线汇总',
            table: {
              cols: [{ t: '产品线', k: 'name' }, { t: '目标条数', k: 'n' }, { t: '平均完成率(%)', k: 'rate' }],
              rows: byLine
            }
          },
          {
            h: '三、目标明细',
            table: {
              cols: [
                { t: '产品线', k: 'lineName' }, { t: '目标', k: 'objective' }, { t: '关键结果', k: 'kr' },
                { t: '负责人', k: 'owner' },
                { t: '目标/实际', get: function (r) { return r.actual + ' / ' + r.target + ' ' + r.unit; } },
                { t: '完成率', get: function (r) { return r.rate + '%'; } },
                { t: '状态', k: 'status' }
              ],
              rows: U.sortBy(rows, 'rate')
            }
          },
          risk ? {
            h: '四、红灯目标与建议',
            list: rows.filter(function (o) { return o.rate < 60; }).map(function (o) {
              return o.lineName + '「' + o.objective + '」完成率仅 ' + o.rate + '%（' + o.kr + '），建议由 ' + o.owner + ' 在下次经营例会说明差距原因与追赶方案。';
            })
          } : { h: '四、红灯目标与建议', p: '本期无低于 60% 的目标。' }
        ]);
        UI.toast('目标报告已导出为 Word', 'ok');
      }
    });
  }

  /* ============================================================
   * 子页 4：多产品线对比
   * ========================================================== */
  function compare(ctx) {
    var ls = S.DB.lines;
    var stats = ls.map(function (l) {
      var st = S.lineStat(l.id);
      var okrs = S.DB.okrs.filter(function (o) { return o.lineId === l.id && o.quarter === CUR_Q; });
      var fbs = S.DB.feedbacks.filter(function (x) { return x.lineId === l.id; });
      var rms = S.DB.roadmap.filter(function (x) { return x.lineId === l.id; });
      var rels = S.DB.releases.filter(function (x) { return x.lineId === l.id && x.realDate; });
      var onTime = rels.filter(function (x) { return U.dayDiff(x.planDate, x.realDate) <= 0; }).length;
      return {
        id: l.id, name: l.name, code: l.code, stage: l.stage,
        progress: Math.round(st.progress * 100),
        projects: st.projects, reqTotal: st.reqTotal, reqOnline: st.reqOnline,
        reqRate: U.pct(st.reqOnline, st.reqTotal),
        relOnTime: U.pct(onTime, rels.length),
        riskOpen: st.riskOpen, riskHigh: st.riskHigh, health: st.health,
        okrRate: okrs.length ? Math.round(U.avg(okrs, 'rate')) : 0,
        fbOpen: fbs.filter(function (x) { return ['待分类', '待评估'].indexOf(x.status) >= 0; }).length,
        rmRisk: rms.filter(function (x) { return x.status === '风险中'; }).length,
        budget: l.budget, used: l.used, useRate: U.pct(l.used, l.budget),
        headcount: l.headcount
      };
    });

    var DIMS = [
      { k: 'progress', t: '项目平均进度', unit: '%' },
      { k: 'reqRate', t: '需求上线率', unit: '%' },
      { k: 'relOnTime', t: '版本按期率', unit: '%' },
      { k: 'okrRate', t: '本季目标完成率', unit: '%' },
      { k: 'useRate', t: '预算使用率', unit: '%', reverse: true }
    ];

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: '多产品线对比',
        desc: '把 ' + ls.length + ' 条产品线放在同一把尺子上横向比：进度、交付质量、目标达成、资源消耗　·　对比视图始终展示全部产品线',
        acts: UI.exportMenu({ word: true })
      }) +
      P.permTip(MOD) +
      UI.card({
        title: '五维对比', sub: '同一维度下各产品线的横向表现（越长越好，预算使用率除外）', ico: '▤',
        body: UI.grid(2, DIMS.map(function (d, i) {
          return '<div><div class="sec-t" style="margin-bottom:var(--sp-2)">' + E(d.t) + '</div>' +
            P.chart('cmp' + i, 0) + '</div>';
        }).join(''))
      }) + P.gap(4) +
      UI.grid(2,
        UI.card({ title: '规模与投入', sub: '编制人数 vs 预算消耗', ico: '◐', body: P.chart('cmpRes', 260) }) +
        UI.card({ title: '风险与反馈压力', sub: '未闭环风险 / 高风险 / 待处理反馈', ico: '⚠', body: P.chart('cmpRisk', 260) })
      ) + P.gap(4) +
      UI.card({ flush: true, title: '对比明细表', ico: '▦', body: '<div id="cmpTbl"></div>' });

    DIMS.forEach(function (d, i) {
      CH.bars('cmp' + i, {
        data: stats.map(function (s) {
          return {
            label: s.name, value: s[d.k], text: s[d.k] + d.unit,
            color: d.reverse
              ? (s[d.k] > 85 ? CH.TONE.danger : (s[d.k] > 70 ? CH.TONE.warn : CH.TONE.done))
              : (s[d.k] >= 80 ? CH.TONE.done : (s[d.k] >= 60 ? CH.TONE.doing : CH.TONE.danger))
          };
        }),
        max: 100,
        onClick: function (idx) { S.setLine(stats[idx].id); Shell.route(); UI.toast('已聚焦到 ' + stats[idx].name); }
      });
    });

    CH.bar('cmpRes', {
      labels: stats.map(function (s) { return s.name; }), height: 260,
      series: [
        { name: '编制（人）', data: stats.map(function (s) { return s.headcount; }), color: CH.TONE.plan },
        { name: '已用预算（万）', data: stats.map(function (s) { return s.used; }), color: CH.TONE.doing }
      ],
      legend: true
    });

    CH.bar('cmpRisk', {
      labels: stats.map(function (s) { return s.name; }), height: 260, stack: true, legend: true,
      series: [
        { name: '高风险', data: stats.map(function (s) { return s.riskHigh; }), color: CH.TONE.danger },
        { name: '其他未闭环风险', data: stats.map(function (s) { return s.riskOpen - s.riskHigh; }), color: CH.TONE.warn },
        { name: '待处理反馈', data: stats.map(function (s) { return s.fbOpen; }), color: CH.TONE.plan }
      ]
    });

    UI.table('#cmpTbl', {
      pageSize: 0, compact: true,
      cols: [
        {
          k: 'name', t: '产品线', w: '170px',
          render: function (r) { return UI.cell2('<b>' + E(r.name) + '</b>', E(r.code + ' · ' + r.stage)); }
        },
        { k: 'health', t: '健康度', w: '96px', render: function (r) { return UI.light(C.tone('light', r.health), r.health + '风险'); }, sortVal: function (r) { return ['高', '中', '低'].indexOf(r.health); } },
        { k: 'projects', t: '项目', w: '76px', align: 'right' },
        { k: 'progress', t: '平均进度', w: '130px', render: function (r) { return UI.pcell(r.progress, UI.ptone(r.progress, r.health === '高')); } },
        { k: 'reqRate', t: '需求上线率', w: '130px', render: function (r) { return UI.pcell(r.reqRate, r.reqRate >= 60 ? 'done' : 'warn'); } },
        { k: 'relOnTime', t: '版本按期率', w: '130px', render: function (r) { return UI.pcell(r.relOnTime, r.relOnTime >= 80 ? 'done' : 'danger'); } },
        { k: 'okrRate', t: '目标完成率', w: '130px', render: function (r) { return UI.pcell(Math.min(r.okrRate, 100), r.okrRate >= 80 ? 'done' : (r.okrRate >= 60 ? 'doing' : 'danger')); } },
        { k: 'riskOpen', t: '未闭环风险', w: '110px', align: 'right', render: function (r) { return r.riskHigh ? '<b class="tag tag-danger">' + r.riskOpen + '（高 ' + r.riskHigh + '）</b>' : String(r.riskOpen); } },
        { k: 'useRate', t: '预算使用率', w: '130px', render: function (r) { return UI.pcell(r.useRate, r.useRate > 85 ? 'danger' : 'doing'); } }
      ],
      rows: stats,
      onRow: function (r) { S.setLine(r.id); Shell.go(MOD, 'lines'); }
    });

    UI.bindExport(ctx.el, {
      csv: function () {
        P.csv('多产品线对比', stats, [
          { label: '产品线', key: 'name' }, { label: '代号', key: 'code' }, { label: '阶段', key: 'stage' },
          { label: '健康度', key: 'health' }, { label: '项目数', key: 'projects' },
          { label: '平均进度(%)', key: 'progress' }, { label: '需求上线率(%)', key: 'reqRate' },
          { label: '版本按期率(%)', key: 'relOnTime' }, { label: '目标完成率(%)', key: 'okrRate' },
          { label: '未闭环风险', key: 'riskOpen' }, { label: '高风险', key: 'riskHigh' },
          { label: '待处理反馈', key: 'fbOpen' }, { label: '编制', key: 'headcount' },
          { label: '预算(万)', key: 'budget' }, { label: '已用(万)', key: 'used' }, { label: '使用率(%)', key: 'useRate' }
        ]);
      },
      word: function () {
        var best = U.sortBy(stats, 'okrRate', true)[0] || {};
        var worst = U.sortBy(stats, 'okrRate')[0] || {};
        P.word('多产品线对比', '多产品线经营对比报告', [
          {
            h: '一、对比结论',
            p: '本期目标完成率最高的是「' + best.name + '」（' + best.okrRate + '%），最低的是「' + worst.name +
              '」（' + worst.okrRate + '%）。' +
              '风险压力最大的是「' + (U.sortBy(stats, 'riskHigh', true)[0] || {}).name + '」。' +
              '预算消耗最快的是「' + (U.sortBy(stats, 'useRate', true)[0] || {}).name + '」。'
          },
          {
            h: '二、五维对比明细',
            table: {
              cols: [
                { t: '产品线', k: 'name' }, { t: '健康度', k: 'health' },
                { t: '平均进度', get: function (r) { return r.progress + '%'; } },
                { t: '需求上线率', get: function (r) { return r.reqRate + '%'; } },
                { t: '版本按期率', get: function (r) { return r.relOnTime + '%'; } },
                { t: '目标完成率', get: function (r) { return r.okrRate + '%'; } },
                { t: '预算使用率', get: function (r) { return r.useRate + '%'; } }
              ],
              rows: stats
            }
          },
          {
            h: '三、资源与压力',
            table: {
              cols: [
                { t: '产品线', k: 'name' }, { t: '编制', k: 'headcount' },
                { t: '预算(万)', k: 'budget' }, { t: '已用(万)', k: 'used' },
                { t: '未闭环风险', k: 'riskOpen' }, { t: '其中高风险', k: 'riskHigh' },
                { t: '待处理反馈', k: 'fbOpen' }, { t: '风险中规划项', k: 'rmRisk' }
              ],
              rows: stats
            }
          }
        ]);
        UI.toast('对比报告已导出为 Word', 'ok');
      }
    });
  }

  /* ============================================================ */
  Shell.page(MOD, {
    render: function (ctx) {
      if (ctx.sub === 'map') map(ctx);
      else if (ctx.sub === 'okr') okr(ctx);
      else if (ctx.sub === 'compare') compare(ctx);
      else lineList(ctx);
    }
  });
})();
