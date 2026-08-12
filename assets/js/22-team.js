/* ============================================================
   22-team.js —— 团队管理（产品总监增强模块）
   子页：members 成员概览 / load 负载热力 / efficiency 协同效率
   ============================================================ */
(function () {
  'use strict';

  var E = U.esc, MOD = 'team';
  var DEF_M = { kw: '', dept: '', func: '', load: '' };
  var DEF_E = { kw: '', dept: '', func: '', load: '' };

  var FUNC = {
    director: '产品总监', pm: '项目经理', po: '产品经理', ux: '设计',
    fe: '前端研发', be: '后端研发', qa: '测试', da: '数据分析',
    de: '数据工程', ops: '运维', mkt: '市场', cs: '客户成功', legal: '法务合规'
  };
  function funcName(f) { return FUNC[f] || f; }
  var FUNC_KEYS = Object.keys(FUNC);

  /* 负载分档 */
  function loadBand(p) {
    if (p > 100) return '超载';
    if (p >= 85) return '饱和';
    if (p >= 60) return '正常';
    return '空闲';
  }
  function loadTone(p) {
    if (p > 100) return 'danger';
    if (p >= 85) return 'warn';
    if (p >= 60) return 'done';
    return 'idle';
  }
  var BANDS = ['超载', '饱和', '正常', '空闲'];

  /* 近 6 周（-2 ~ +3），与 seed 的 alloc.weekStart 对齐 */
  function weeks() {
    var base = U.weekRange(S.TODAY)[0], out = [];
    for (var i = -2; i <= 3; i++) out.push(U.fmtDate(U.addDay(base, 7 * i)));
    return out;
  }
  function curWeek() { return U.fmtDate(U.weekRange(S.TODAY)[0]); }
  function weekLabel(ws, i) {
    var t = ws.slice(5).replace('-', '/');
    return i === 2 ? '本周 ' + t : t;
  }

  /* 口径：聚焦产品线时，只看参与该产品线在办项目的成员 */
  function scopedMembers() {
    var ids = S.projectsInScope().map(function (p) { return p.id; });
    var all = S.members();
    if (!S.curLine()) return all.slice();
    return all.filter(function (m) {
      return (m.projects || []).some(function (pid) { return ids.indexOf(pid) >= 0; });
    });
  }
  function allocsOf(mid) {
    return S.DB.allocs.filter(function (a) { return a.memberId === mid; });
  }
  function weekHours(m, ws) {
    return U.sum(allocsOf(m.id).filter(function (a) { return a.weekStart === ws; }), 'hours');
  }
  function projNames(m) {
    return (m.projects || []).map(function (pid) {
      var p = S.projBy(pid); return p ? p.name : pid;
    });
  }
  function onTime(m) {
    var t = m.taskDone + m.taskDelay;
    return t ? Math.round(m.taskDone / t * 100) : 100;
  }

  function deptOpts() { return C.DICT.dept; }
  function funcOpts() {
    return FUNC_KEYS.map(function (k) { return { v: k, t: FUNC[k] }; });
  }

  /* ========================================================
     子页 1：成员概览
     ======================================================== */
  function memberList(ctx) {
    var f = P.flt(MOD, DEF_M);
    var all = scopedMembers();

    var rows = all.filter(function (m) {
      if (f.dept && m.dept !== f.dept) return false;
      if (f.func && m.func !== f.func) return false;
      if (f.load && loadBand(m.loadPct) !== f.load) return false;
      if (f.kw) {
        var s = (m.name + m.title + m.dept + funcName(m.func) + projNames(m).join('')).toLowerCase();
        if (s.indexOf(f.kw.toLowerCase()) < 0) return false;
      }
      return true;
    });

    var depts = U.uniq(all.map(function (m) { return m.dept; }));
    var over = all.filter(function (m) { return m.loadPct > 100; });
    var avgLoad = all.length ? Math.round(U.sum(all, 'loadPct') / all.length) : 0;

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: '团队成员', desc: '参与产品研发交付的全部人员，含所属部门、职能、参与项目与当前负载。',
        acts: '<button class="btn" id="tmWord">导出 Word</button>' +
          '<button class="btn btn-primary" id="tmLoad">查看负载热力</button>'
      }) +
      P.permTip(MOD) +
      P.statCards([
        { label: '团队人数', val: all.length, unit: '人', ico: '◍', sub: P.scopeText() },
        { label: '涉及部门', val: depts.length, unit: '个', ico: '▤', sub: depts.slice(0, 3).join('/') + (depts.length > 3 ? '…' : '') },
        { label: '平均负载', val: avgLoad, unit: '%', ico: '◐', tone: avgLoad > 95 ? 'warn' : 'doing', sub: '按每周 40 小时编制折算' },
        { label: '超载人员', val: over.length, unit: '人', ico: '⚠', tone: over.length ? 'danger' : 'done', sub: over.length ? '负载 > 100%，需要协调' : '暂无超载' }
      ]) + P.gap(4) +
      UI.grid(2,
        UI.card({ title: '部门分布', sub: '点击扇区可筛选该部门成员', ico: '◔', body: P.chart('tmDept', 280) }) +
        UI.card({ title: '职能构成', sub: '按研发交付职能统计人数', ico: '▥', body: P.chart('tmFunc', 280) })
      ) + P.gap(4) +
      UI.card({
        flush: true, title: '成员清单', ico: '◫',
        sub: '共 ' + rows.length + ' 人',
        extra: P.viewBar(MOD),
        body:
          '<div class="toolbar" id="tmFlt">' +
          '<input class="fld grow" type="text" data-f="kw" placeholder="搜索姓名 / 岗位 / 项目…" value="' + E(f.kw) + '">' +
          P.sel('dept', '全部部门', deptOpts(), f.dept) +
          P.sel('func', '全部职能', funcOpts(), f.func) +
          P.sel('load', '全部负载', BANDS, f.load) +
          '<button class="btn-sm" data-reset>重置</button>' +
          '</div>' +
          '<div id="tmTbl"></div>'
      });

    /* 部门环图 */
    var byDept = depts.map(function (d) {
      return { name: d, value: all.filter(function (m) { return m.dept === d; }).length };
    }).sort(function (a, b) { return b.value - a.value; });
    CH.donut('tmDept', {
      data: byDept, height: 250, inner: 58,
      center: { v: all.length, l: '总人数' }, legendSide: true,
      onClick: function (i, d) { P.setFlt(MOD, { dept: d.name }); Shell.route(); }
    });

    /* 职能柱 */
    var byFunc = FUNC_KEYS.map(function (k) {
      return { label: FUNC[k], value: all.filter(function (m) { return m.func === k; }).length, key: k };
    }).filter(function (x) { return x.value; }).sort(function (a, b) { return b.value - a.value; });
    CH.bars('tmFunc', {
      data: byFunc.map(function (x) { return { label: x.label, value: x.value, text: x.value + ' 人' }; }),
      palette: true,
      onClick: function (i) { P.setFlt(MOD, { func: byFunc[i].key }); Shell.route(); }
    });

    var vw = C.viewOf(S.role(), MOD) || {};
    UI.table('#tmTbl', {
      rows: rows,
      sort: { k: vw.sort || 'loadPct', desc: vw.desc === undefined ? true : vw.desc },
      pageSize: 12,
      select: true,
      onRow: function (r) { openMem(r); },
      rowCls: function (r) { return r.loadPct > 100 ? 'row-danger' : (r.taskDelay >= 3 ? 'row-warn' : ''); },
      cols: [
        {
          t: '成员', k: 'name', w: '160px',
          render: function (r) { return UI.cell2(UI.owner(r.name), r.title); }
        },
        { t: '部门', k: 'dept', w: '110px' },
        { t: '职能', k: 'func', w: '96px', render: function (r) { return UI.tag(funcName(r.func)); } },
        {
          t: '参与项目', k: 'projects', w: '190px',
          sortVal: function (r) { return (r.projects || []).length; },
          render: function (r) {
            var ns = projNames(r);
            if (!ns.length) return '<span class="muted">未参与</span>';
            return UI.cell2(ns.length + ' 个项目', U.ellip(ns.join('、'), 22));
          }
        },
        { t: '本周工时', k: 'weekHours', w: '92px', align: 'right', render: function (r) { return r.weekHours + ' h'; } },
        {
          t: '负载', k: 'loadPct', w: '150px',
          render: function (r) {
            return UI.pcell(Math.min(r.loadPct, 130), loadTone(r.loadPct)) +
              (r.loadPct > 100 ? ' <span class="tag tag-danger">超载</span>' : '');
          }
        },
        { t: '在办任务', k: 'taskOpen', w: '84px', align: 'right' },
        {
          t: '延期任务', k: 'taskDelay', w: '84px', align: 'right',
          render: function (r) { return r.taskDelay ? '<b class="c-danger">' + r.taskDelay + '</b>' : '<span class="muted">0</span>'; }
        },
        {
          t: '操作', k: '', w: '150px', sortable: false,
          render: function (r) {
            /* 「你自己」不给删除按钮——点了也是被拦，不如不给，省得每次都要读一遍解释 */
            return '<div class="row-acts"><button class="btn-sm" data-act="view">详情</button>' +
              '<button class="btn-sm" data-act="edit">编辑</button>' +
              (S.isSelf(r) ? '' : '<button class="btn-sm" data-act="del">删除</button>') + '</div>';
          }
        }
      ],
      onAct: function (act, r) {
        if (act === 'view') openMem(r);
        else if (act === 'edit') editMem(r);
        else if (act === 'del') delMem(r);
      },
      bulk: [
        { t: '导出所选', fn: function (picked) { csvMembers(picked); } }
      ]
    });

    P.bindFlt(P.$('tmFlt'), MOD, DEF_M);
    P.bindViews(ctx.el, MOD, DEF_M);

    P.$('tmLoad').onclick = function () { Shell.go(MOD, 'load'); };
    P.$('tmWord').onclick = function () { wordMembers(rows, all); };
  }

  function csvMembers(list) {
    P.csv('团队成员', list, [
      { label: '编号', key: 'id' }, { label: '姓名', key: 'name' },
      { label: '部门', key: 'dept' }, { label: '岗位', key: 'title' },
      { label: '职能', get: function (r) { return funcName(r.func); } },
      { label: '参与项目', get: function (r) { return projNames(r).join('、'); } },
      { label: '本周工时', key: 'weekHours' }, { label: '负载%', key: 'loadPct' },
      { label: '在办任务', key: 'taskOpen' }, { label: '已完成任务', key: 'taskDone' },
      { label: '延期任务', key: 'taskDelay' }, { label: '邮箱', key: 'email' }
    ]);
  }

  /* ============ 成员的改与删 ============
     成员在业务数据里是按「姓名字符串」被引用的（owner / assignee / host …），
     不是按 id。所以这两件事都不是简单的增删改：
       · 改名  → 必须同步改掉所有引用，否则负责人挂在一个不存在的名字上
       · 删人  → 必须先回答「他名下还有多少条记录」，再决定转交还是留着 */

  var COLL_CN = {
    requirements: '需求', tasks: '任务', projects: '项目', releases: '版本',
    risks: '风险', issues: '问题', meetings: '会议', actions: '会议行动项',
    changes: '需求变更', deliverables: '交付物', feedbacks: '用户反馈',
    milestones: '里程碑', phases: '阶段', todos: '待办', reviews: '复盘',
    reports: '报告', roadmap: '规划项', okrs: 'OKR', cross: '协作事项',
    allocs: '工时分配', traces: '留痕', notes: '笔记', metrics: '指标'
  };
  function refText(refs) {
    return Object.keys(refs.byColl).map(function (c) {
      return (COLL_CN[c] || c) + ' ' + refs.byColl[c] + ' 条';
    }).join('、');
  }
  function funcField(val) {
    return {
      k: 'func', label: '职能', type: 'select', req: true, val: val || 'be',
      opts: [
        { v: 'director', t: '产品总监' }, { v: 'pm', t: '项目经理' }, { v: 'po', t: '产品经理' },
        { v: 'ux', t: '设计' }, { v: 'fe', t: '前端' }, { v: 'be', t: '后端' },
        { v: 'qa', t: '测试' }, { v: 'da', t: '数据分析' }, { v: 'de', t: '数据工程' },
        { v: 'ops', t: '运维' }, { v: 'mkt', t: '市场' }, { v: 'cs', t: '客户成功' },
        { v: 'legal', t: '法务合规' }
      ]
    };
  }

  function editMem(m) {
    var self = S.isSelf(m);
    UI.formModal({
      title: '编辑成员 · ' + m.name, wide: true,
      tip: self
        ? '这是「你自己」。改姓名会同时更新顶栏抬头、导出文件的作者，以及所有历史记录里的负责人。'
        : '改姓名会自动同步该成员在需求 / 任务 / 会议等所有记录里的负责人，不会留下孤儿名字。',
      okText: '保存',
      fields: [
        { k: 'name', label: '姓名', type: 'text', req: true, val: m.name },
        { k: 'dept', label: '部门', type: 'text', val: m.dept, placeholder: '如：研发中心' },
        { k: 'title', label: '职位', type: 'text', val: m.title, placeholder: '如：后端工程师' },
        funcField(m.func),
        { k: 'capacity', label: '周可用工时', type: 'number', val: m.capacity || 40, min: 1,
          hint: '用于「资源协调 → 工时负载」计算超载' },
        { k: 'email', label: '邮箱', type: 'text', val: m.email, placeholder: '可留空' }
      ],
      onSubmit: function (d) {
        var nw = String(d.name || '').trim();
        if (!nw) { UI.toast('姓名不能为空', 'err'); return; }
        var dup = S.memBy(nw);
        if (dup && dup.id !== m.id) { UI.toast('已存在同名成员「' + nw + '」', 'err'); return; }

        var old = m.name, renamed = 0;
        var patch = {
          dept: d.dept || '', title: d.title || '', func: d.func,
          capacity: U.num(d.capacity, 40), email: d.email || ''
        };

        if (nw !== old) {
          if (self) {
            /* 走 setOrg 这一条路：它会把 DB.me、成员表里的自己、
               以及所有历史引用一次性改掉，避免三处各改一半。 */
            var o = S.org();
            S.setOrg(o.name, o.bu, nw);
            renamed = 1;
          } else {
            renamed = S.renameActor(old, nw);
            patch.name = nw;
          }
        }
        S.update('members', m.id, patch);
        Shell.route();
        UI.toast(nw !== old
          ? ('已改名为「' + nw + '」' + (renamed ? '，同步更新了 ' + renamed + ' 处引用' : ''))
          : '已保存', 'ok');
      }
    });
  }

  function delMem(m) {
    /* 两条不能删的红线 */
    if (S.isSelf(m)) {
      UI.confirm('「' + m.name + '」是你自己，不能删除。',
        function () { Shell.go('guide', 'start'); },
        { title: '不能删除', okText: '去改我的名字', danger: false,
          tip: '成员表里必须留着你自己——所有「负责人 / 处理人」下拉框都要用它，删掉之后一条数据都建不出来。要改称呼请去「上手与数据 → 上手引导 → 组织与我」。' });
      return;
    }
    if (S.members().length <= 1) {
      UI.confirm('这是成员表里最后一个人，不能删除。', null,
        { title: '不能删除', okText: '知道了', danger: false,
          tip: '成员表空了，所有负责人下拉框都会是空的。' });
      return;
    }

    var refs = S.actorRefs(m.name);

    /* 没人引用他 —— 干净地删掉就行 */
    if (!refs.total) {
      UI.confirm('确定删除成员「' + m.name + '」？',
        function () { S.remove('members', m.id); Shell.route(); UI.toast('已删除成员「' + m.name + '」', 'ok'); },
        { danger: true, okText: '删除', tip: '他名下没有任何记录，删除不会影响其它数据。删除会立刻写入本地存储，无法撤销。' });
      return;
    }

    /* 有引用 —— 先把账摆出来，再让你选怎么处置 */
    var others = S.members().filter(function (x) { return x.id !== m.id; });
    var body =
      UI.notice('warn', '「' + m.name + '」名下还有 <b>' + refs.total + '</b> 处记录：' + refText(refs) +
        '。直接删人，这些记录的负责人就会变成一个查不到的名字。') +
      '<div style="height:14px"></div>' +
      '<div class="form-row"><label class="fl">怎么处理这些记录</label>' +
      '<div style="display:flex;flex-direction:column;gap:10px">' +
      '<label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer">' +
      '<input type="radio" name="dmMode" value="move" checked style="margin-top:3px">' +
      '<span><b>转交给别人</b>（推荐）<br><span class="muted" style="font-size:var(--f-sm)">' +
      '把这 ' + refs.total + ' 处的负责人一次性改成下面选的人，再删除该成员。</span></span></label>' +
      '<label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer">' +
      '<input type="radio" name="dmMode" value="keep" style="margin-top:3px">' +
      '<span><b>保留原名，直接删除</b><br><span class="muted" style="font-size:var(--f-sm)">' +
      '历史记录上仍显示「' + m.name + '」，但他不再出现在任何下拉框里。适合人已离职、历史要留痕的情况。</span></span></label>' +
      '</div></div>' +
      '<div style="height:12px"></div>' +
      '<div class="form-row" id="dmToWrap"><label class="fl">转交给</label>' +
      '<select id="dmTo" class="inp">' +
      others.map(function (x) {
        return '<option value="' + U.esc(x.name) + '">' + U.esc(x.name) +
          (x.title ? ' · ' + U.esc(x.title) : '') + '</option>';
      }).join('') + '</select></div>';

    var h = UI.modal({
      title: '删除成员 · ' + m.name, wide: true, body: body,
      foot: '<button class="btn" data-close>取消</button>' +
        '<button class="btn-danger" data-ok>删除该成员</button>'
    });

    var toWrap = h.el.querySelector('#dmToWrap');
    function syncMode() {
      var mode = h.el.querySelector('input[name="dmMode"]:checked').value;
      toWrap.style.display = mode === 'move' ? '' : 'none';
    }
    [].forEach.call(h.el.querySelectorAll('input[name="dmMode"]'), function (r) {
      r.addEventListener('change', syncMode);
    });
    syncMode();

    h.el.querySelector('[data-ok]').addEventListener('click', function () {
      var mode = h.el.querySelector('input[name="dmMode"]:checked').value;
      var moved = 0;
      if (mode === 'move') {
        var to = h.el.querySelector('#dmTo').value;
        if (!to) { UI.toast('请选择转交对象', 'err'); return; }
        moved = S.renameActor(m.name, to);
        S.remove('members', m.id);
        S.persist();
        UI.toast('已删除「' + m.name + '」，' + moved + ' 处记录转交给「' + to + '」', 'ok');
      } else {
        S.remove('members', m.id);
        UI.toast('已删除「' + m.name + '」，' + refs.total + ' 处历史记录保留原名', 'ok');
      }
      h.close();
      Shell.route();
    });
  }

  /* 成员详情抽屉 */
  function openMem(m) {
    var ws = weeks(), cw = curWeek();
    var als = allocsOf(m.id);
    var ps = projNames(m);

    var body =
      P.hero({
        title: m.name + ' · ' + m.title, id: m.id,
        meta: [['部门', m.dept], ['职能', funcName(m.func)], ['邮箱', m.email]],
        right: UI.pcell(Math.min(m.loadPct, 130), loadTone(m.loadPct))
      }) + P.gap(3) +
      UI.sec('工作负载') +
      P.kv([
        ['当前负载', m.loadPct + '%（' + loadBand(m.loadPct) + '）'],
        ['本周工时', m.weekHours + ' h / 编制 ' + m.capacity + ' h'],
        ['参与项目', ps.length ? ps.join('、') : '未参与'],
        ['冲突提示', m.conflict ? '<span class="tag tag-danger">存在排期冲突</span>' : '<span class="tag tag-done">无冲突</span>']
      ]) + P.gap(3) +
      UI.sec('任务执行') +
      P.kv([
        ['已完成任务', m.taskDone + ' 项'],
        ['在办任务', m.taskOpen + ' 项'],
        ['延期任务', m.taskDelay ? '<b class="c-danger">' + m.taskDelay + ' 项</b>' : '0 项'],
        ['按时完成率', onTime(m) + '%'],
        ['效率系数', m.efficiency + '（1.0 为团队基准）'],
        ['在职天数', m.onlineDays + ' 天']
      ]) + P.gap(3) +
      UI.sec('近 6 周工时投入') +
      '<div id="mmWk"></div>';

    UI.drawer({
      title: '成员详情', wide: true, body: body,
      foot: '<button class="btn" data-mm-edit>编辑</button>' +
        (S.isSelf(m) ? '' : '<button class="btn-danger" data-mm-del>删除成员</button>'),
      onOpen: function (h) {
        var eb = h.el.querySelector('[data-mm-edit]');
        if (eb) eb.addEventListener('click', function () { h.close(); editMem(m); });
        var db = h.el.querySelector('[data-mm-del]');
        if (db) db.addEventListener('click', function () { h.close(); delMem(m); });
        CH.bars(h.el.querySelector('#mmWk'), {
          data: ws.map(function (w, i) {
            var v = U.sum(als.filter(function (a) { return a.weekStart === w; }), 'hours');
            return {
              label: weekLabel(w, i), value: v, target: 40,
              color: v > 40 ? CH.TONE.danger : (w === cw ? CH.TONE.accent : CH.TONE.doing),
              text: v + ' h'
            };
          }),
          max: Math.max(48, U.max(als.map(function (a) { return a.hours; })) * 1.2)
        });
      }
    });
  }

  function wordMembers(rows, all) {
    var depts = U.uniq(all.map(function (m) { return m.dept; }));
    var over = all.filter(function (m) { return m.loadPct > 100; });
    P.word('团队成员概览', '团队成员概览', [
      {
        h: '总体情况',
        kv: [
          ['数据口径', P.scopeText()],
          ['团队人数', all.length + ' 人'],
          ['涉及部门', depts.length + ' 个（' + depts.join('、') + '）'],
          ['平均负载', (all.length ? Math.round(U.sum(all, 'loadPct') / all.length) : 0) + '%'],
          ['超载人员', over.length + ' 人']
        ]
      },
      {
        h: '成员明细',
        table: P.wTable(
          [{ t: '姓名', k: 'name' }, { t: '部门', k: 'dept' }, { t: '岗位', k: 'title' },
          { t: '职能', get: function (r) { return funcName(r.func); } },
          { t: '参与项目', get: function (r) { return String(projNames(r).length); } },
          { t: '本周工时', get: function (r) { return r.weekHours + ' h'; } },
          { t: '负载', get: function (r) { return r.loadPct + '%'; } },
          { t: '在办/延期', get: function (r) { return r.taskOpen + ' / ' + r.taskDelay; } }],
          rows
        )
      },
      over.length ? {
        h: '超载人员与协调建议',
        list: over.map(function (m) {
          return m.name + '（' + m.dept + '·' + m.title + '）当前负载 ' + m.loadPct + '%，参与 ' +
            projNames(m).length + ' 个项目，建议减少并行项目或增派支援。';
        })
      } : null
    ]);
  }

  /* ========================================================
     子页 2：负载热力
     ======================================================== */
  function loadView(ctx) {
    var all = scopedMembers(), ws = weeks(), cw = curWeek();
    var f = P.flt(MOD, DEF_M);
    var list = all.filter(function (m) {
      if (f.dept && m.dept !== f.dept) return false;
      if (f.load && loadBand(m.loadPct) !== f.load) return false;
      return true;
    }).sort(function (a, b) { return b.loadPct - a.loadPct; });

    var totalH = U.sum(all, 'weekHours');
    var over = all.filter(function (m) { return m.loadPct > 100; });
    var idle = all.filter(function (m) { return m.loadPct < 60; });
    var avg = all.length ? Math.round(U.sum(all, 'loadPct') / all.length) : 0;

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: '人员负载热力', desc: '按周查看每位成员的工时投入，识别超载与闲置，为跨项目资源调配提供依据。',
        acts: '<button class="btn" id="ldCsv">导出 CSV</button>' +
          '<button class="btn" id="ldWord">导出 Word</button>'
      }) +
      P.permTip(MOD) +
      P.statCards([
        { label: '本周总投入', val: totalH, unit: 'h', ico: '◷', sub: all.length + ' 人 · 编制 ' + all.length * 40 + ' h' },
        { label: '平均负载', val: avg, unit: '%', ico: '◐', tone: avg > 95 ? 'warn' : 'doing', sub: '整体产能利用率' },
        { label: '超载人员', val: over.length, unit: '人', ico: '⚠', tone: over.length ? 'danger' : 'done', sub: over.length ? '建议优先协调' : '负载健康' },
        { label: '可支援人员', val: idle.length, unit: '人', ico: '◎', tone: 'plan', sub: '负载低于 60%，可承接新任务' }
      ]) + P.gap(4) +
      UI.card({
        title: '成员 × 周次 工时热力', ico: '▦',
        sub: '颜色越深投入越多，超过 40h 视为超编；点击格子查看该成员详情',
        extra:
          '<div class="toolbar tight" id="ldFlt">' +
          P.sel('dept', '全部部门', deptOpts(), f.dept) +
          P.sel('load', '全部负载', BANDS, f.load) +
          '<button class="btn-sm" data-reset>重置</button>' +
          '</div>',
        body: P.chart('ldHeat')
      }) + P.gap(4) +
      UI.grid(2,
        UI.card({ title: '部门本周投入 vs 编制', sub: '柱高为实际投入工时，虚线为编制容量', ico: '▥', body: P.chart('ldDept', 300) }) +
        UI.card({ title: '负载分档人数', sub: '超载 / 饱和 / 正常 / 空闲', ico: '◔', body: P.chart('ldBand', 300) })
      ) + P.gap(4) +
      UI.card({
        flush: true, title: '需要协调的人员', ico: '⚠',
        sub: '负载超过 100% 或存在排期冲突',
        body: '<div id="ldTbl"></div>'
      });

    /* 热力：行=成员，列=周 */
    if (list.length) {
      CH.heat('ldHeat', {
        rows: list.map(function (m) { return m.name; }),
        cols: ws.map(function (w, i) { return weekLabel(w, i); }),
        matrix: list.map(function (m) {
          return ws.map(function (w) { return weekHours(m, w); });
        }),
        max: 50, labelW: 96, vLabel: '工时（小时）',
        fmt: function (v) { return v ? v + 'h' : ''; },
        level: function (v) {
          if (!v) return 0;
          if (v > 40) return 4;
          if (v >= 32) return 3;
          if (v >= 20) return 2;
          return 1;
        },
        onClick: function (ri) { openMem(list[ri]); }
      });
    } else {
      P.$('ldHeat').innerHTML = UI.empty('当前筛选条件下没有成员');
    }

    /* 部门投入 */
    var depts = U.uniq(all.map(function (m) { return m.dept; }));
    CH.bar('ldDept', {
      labels: depts,
      series: [
        { name: '本周投入', data: depts.map(function (d) { return U.sum(all.filter(function (m) { return m.dept === d; }), 'weekHours'); }), color: CH.TONE.doing },
        { name: '编制容量', data: depts.map(function (d) { return all.filter(function (m) { return m.dept === d; }).length * 40; }), color: CH.TONE.idle }
      ],
      height: 270, legend: true, yFmt: function (v) { return v + 'h'; }
    });

    /* 负载分档 */
    var bandTone = { '超载': CH.TONE.danger, '饱和': CH.TONE.warn, '正常': CH.TONE.done, '空闲': CH.TONE.idle };
    CH.donut('ldBand', {
      data: BANDS.map(function (b) {
        return { name: b, value: all.filter(function (m) { return loadBand(m.loadPct) === b; }).length, color: bandTone[b] };
      }).filter(function (x) { return x.value; }),
      height: 270, inner: 54, center: { v: all.length, l: '总人数' }, legendSide: true,
      onClick: function (i, d) { P.setFlt(MOD, { load: d.name }); Shell.route(); }
    });

    var need = all.filter(function (m) { return m.loadPct > 100 || m.conflict; })
      .sort(function (a, b) { return b.loadPct - a.loadPct; });

    UI.table('#ldTbl', {
      rows: need, pageSize: 10, sort: { k: 'loadPct', desc: true },
      onRow: function (r) { openMem(r); },
      rowCls: function (r) { return r.loadPct > 115 ? 'row-danger' : 'row-warn'; },
      empty: UI.empty('当前口径下没有超载人员，资源分布健康'),
      cols: [
        { t: '成员', k: 'name', w: '150px', render: function (r) { return UI.cell2(UI.owner(r.name), r.title); } },
        { t: '部门', k: 'dept', w: '110px' },
        { t: '本周工时', k: 'weekHours', w: '96px', align: 'right', render: function (r) { return r.weekHours + ' h'; } },
        { t: '负载', k: 'loadPct', w: '160px', render: function (r) { return UI.pcell(Math.min(r.loadPct, 130), loadTone(r.loadPct)); } },
        {
          t: '并行项目', k: 'projects', w: '210px',
          sortVal: function (r) { return (r.projects || []).length; },
          render: function (r) { return UI.cell2((r.projects || []).length + ' 个', U.ellip(projNames(r).join('、'), 24)); }
        },
        {
          t: '超编工时', k: '', w: '96px', align: 'right', sortable: false,
          render: function (r) { return r.weekHours > 40 ? '<b class="c-danger">+' + (r.weekHours - 40) + ' h</b>' : '—'; }
        },
        {
          t: '建议', k: '', sortable: false,
          render: function (r) {
            if ((r.projects || []).length >= 3) return '并行项目过多，建议收敛到 2 个以内';
            if (r.weekHours > 48) return '本周严重超编，建议拆分任务或增派人手';
            return '关注排期冲突，与项目经理确认优先级';
          }
        }
      ]
    });

    P.bindFlt(P.$('ldFlt'), MOD, DEF_M);
    P.$('ldCsv').onclick = function () {
      P.csv('人员负载', all, [
        { label: '姓名', key: 'name' }, { label: '部门', key: 'dept' },
        { label: '本周工时', key: 'weekHours' }, { label: '负载%', key: 'loadPct' },
        { label: '分档', get: function (r) { return loadBand(r.loadPct); } },
        { label: '并行项目', get: function (r) { return projNames(r).join('、'); } }
      ]);
    };
    P.$('ldWord').onclick = function () {
      P.word('人员负载分析', '人员负载分析', [
        {
          h: '总体情况',
          kv: [['数据口径', P.scopeText()], ['统计周', cw + ' 起本周'],
          ['本周总投入', totalH + ' 小时'], ['平均负载', avg + '%'],
          ['超载人员', over.length + ' 人'], ['可支援人员', idle.length + ' 人']]
        },
        {
          h: '部门投入与编制',
          table: P.wTable(
            [{ t: '部门', k: 'd' }, { t: '人数', k: 'n' }, { t: '本周投入', k: 'h' }, { t: '编制容量', k: 'c' }, { t: '利用率', k: 'r' }],
            depts.map(function (d) {
              var ms = all.filter(function (m) { return m.dept === d; });
              var h = U.sum(ms, 'weekHours'), c = ms.length * 40;
              return { d: d, n: ms.length + ' 人', h: h + ' h', c: c + ' h', r: U.pct(h, c) + '%' };
            })
          )
        },
        need.length ? {
          h: '需协调人员',
          table: P.wTable(
            [{ t: '姓名', k: 'name' }, { t: '部门', k: 'dept' },
            { t: '负载', get: function (r) { return r.loadPct + '%'; } },
            { t: '并行项目', get: function (r) { return projNames(r).join('、'); } }],
            need
          )
        } : null,
        idle.length ? {
          h: '可支援人员',
          list: idle.map(function (m) { return m.name + '（' + m.dept + '·' + m.title + '）负载 ' + m.loadPct + '%，本周剩余约 ' + Math.max(0, 40 - m.weekHours) + ' 小时。'; })
        } : null
      ]);
    };
  }

  /* ========================================================
     子页 3：协同效率
     ======================================================== */
  function efficiency(ctx) {
    var all = scopedMembers();
    var f = P.flt(MOD, DEF_E);
    var rows = all.filter(function (m) {
      if (f.dept && m.dept !== f.dept) return false;
      if (f.func && m.func !== f.func) return false;
      if (f.kw && (m.name + m.title + m.dept).toLowerCase().indexOf(f.kw.toLowerCase()) < 0) return false;
      return true;
    });

    var done = U.sum(all, 'taskDone'), open = U.sum(all, 'taskOpen'), delay = U.sum(all, 'taskDelay');
    var eff = all.length ? +(U.sum(all, 'efficiency') / all.length).toFixed(2) : 0;
    var rate = U.pct(done, done + delay);

    var cx = S.cross('line');
    var cxOpen = cx.filter(function (c2) { return ['已解决', '已关闭'].indexOf(c2.status) < 0; });
    var cxOver = cx.filter(function (c2) { return c2.overdue; });

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: '协同效率', desc: '从任务吞吐、按时完成率与跨部门协同响应三个角度衡量团队协作效率。',
        acts: '<button class="btn" id="efWord">导出 Word</button>' +
          '<button class="btn" id="efCross">查看跨部门事项</button>'
      }) +
      P.permTip(MOD) +
      P.statCards([
        { label: '累计完成任务', val: done, unit: '项', ico: '✓', tone: 'done', sub: '在办 ' + open + ' 项' },
        { label: '按时完成率', val: rate, unit: '%', ico: '◑', tone: rate >= 85 ? 'done' : (rate >= 70 ? 'warn' : 'danger'), sub: '延期任务 ' + delay + ' 项' },
        { label: '平均效率系数', val: eff, ico: '◈', tone: eff >= 1 ? 'done' : 'warn', sub: '1.0 为团队基准线' },
        { label: '跨部门未闭环', val: cxOpen.length, unit: '项', ico: '⇄', tone: cxOver.length ? 'danger' : 'plan', sub: '其中逾期 ' + cxOver.length + ' 项' }
      ]) + P.gap(4) +
      UI.grid(2,
        UI.card({ title: '个人效率排行', sub: '效率系数 TOP12，点击查看成员详情', ico: '▤', body: P.chart('efRank', 320) }) +
        UI.card({ title: '部门任务结构', sub: '已完成 / 在办 / 延期 任务数堆叠', ico: '▥', body: P.chart('efDept', 320) })
      ) + P.gap(4) +
      UI.grid(2,
        UI.card({ title: '跨部门协同响应', sub: '各承接部门的事项量与逾期情况', ico: '⇄', body: P.chart('efCx', 300) }) +
        UI.card({ title: '按时完成率分布', sub: '按部门汇总，低于 80% 需要关注', ico: '◔', body: P.chart('efOnTime', 300) })
      ) + P.gap(4) +
      UI.card({
        flush: true, title: '成员效率明细', ico: '◫',
        sub: '共 ' + rows.length + ' 人',
        body:
          '<div class="toolbar" id="efFlt">' +
          '<input class="fld grow" type="text" data-f="kw" placeholder="搜索姓名 / 岗位…" value="' + E(f.kw) + '">' +
          P.sel('dept', '全部部门', deptOpts(), f.dept) +
          P.sel('func', '全部职能', funcOpts(), f.func) +
          '<button class="btn-sm" data-reset>重置</button>' +
          '</div>' +
          '<div id="efTbl"></div>'
      });

    /* 效率排行 */
    var top = all.slice().sort(function (a, b) { return b.efficiency - a.efficiency; }).slice(0, 12);
    CH.bars('efRank', {
      data: top.map(function (m) {
        return {
          label: m.name, value: Math.round(m.efficiency * 100), text: m.efficiency.toFixed(2),
          color: m.efficiency >= 1 ? CH.TONE.done : (m.efficiency >= 0.85 ? CH.TONE.doing : CH.TONE.warn),
          target: 100
        };
      }),
      max: 120,
      onClick: function (i) { openMem(top[i]); }
    });

    /* 部门任务结构 */
    var depts = U.uniq(all.map(function (m) { return m.dept; }));
    function deptSum(d, k) { return U.sum(all.filter(function (m) { return m.dept === d; }), k); }
    CH.bar('efDept', {
      labels: depts,
      series: [
        { name: '已完成', data: depts.map(function (d) { return deptSum(d, 'taskDone'); }), color: CH.TONE.done },
        { name: '在办', data: depts.map(function (d) { return deptSum(d, 'taskOpen'); }), color: CH.TONE.doing },
        { name: '延期', data: depts.map(function (d) { return deptSum(d, 'taskDelay'); }), color: CH.TONE.danger }
      ],
      stack: true, height: 290, legend: true
    });

    /* 跨部门协同 */
    var toDepts = U.uniq(cx.map(function (c2) { return c2.toDept; }));
    CH.bar('efCx', {
      labels: toDepts,
      series: [
        { name: '已闭环', data: toDepts.map(function (d) { return cx.filter(function (c2) { return c2.toDept === d && ['已解决', '已关闭'].indexOf(c2.status) >= 0; }).length; }), color: CH.TONE.done },
        { name: '处理中', data: toDepts.map(function (d) { return cx.filter(function (c2) { return c2.toDept === d && c2.status === '处理中'; }).length; }), color: CH.TONE.doing },
        { name: '待处理', data: toDepts.map(function (d) { return cx.filter(function (c2) { return c2.toDept === d && c2.status === '待处理'; }).length; }), color: CH.TONE.warn }
      ],
      stack: true, height: 270, legend: true,
      onClick: function () { if (C.canSee('collab', S.role())) Shell.go('collab', 'cross'); }
    });

    /* 部门按时完成率 */
    CH.bars('efOnTime', {
      data: depts.map(function (d) {
        var ms = all.filter(function (m) { return m.dept === d; });
        var dn = U.sum(ms, 'taskDone'), dl = U.sum(ms, 'taskDelay');
        var v = U.pct(dn, dn + dl);
        return { label: d, value: v, text: v + '%', color: v >= 85 ? CH.TONE.done : (v >= 75 ? CH.TONE.warn : CH.TONE.danger), target: 85 };
      }).sort(function (a, b) { return b.value - a.value; }),
      max: 100
    });

    UI.table('#efTbl', {
      rows: rows, pageSize: 12, sort: { k: 'efficiency', desc: true },
      onRow: function (r) { openMem(r); },
      rowCls: function (r) { return onTime(r) < 70 ? 'row-warn' : ''; },
      cols: [
        { t: '成员', k: 'name', w: '150px', render: function (r) { return UI.cell2(UI.owner(r.name), r.title); } },
        { t: '部门', k: 'dept', w: '110px' },
        { t: '职能', k: 'func', w: '96px', render: function (r) { return UI.tag(funcName(r.func)); } },
        { t: '已完成', k: 'taskDone', w: '82px', align: 'right' },
        { t: '在办', k: 'taskOpen', w: '72px', align: 'right' },
        {
          t: '延期', k: 'taskDelay', w: '72px', align: 'right',
          render: function (r) { return r.taskDelay ? '<b class="c-danger">' + r.taskDelay + '</b>' : '<span class="muted">0</span>'; }
        },
        {
          t: '按时完成率', k: 'onTime', w: '150px',
          sortVal: function (r) { return onTime(r); },
          render: function (r) { var v = onTime(r); return UI.pcell(v, v >= 85 ? 'done' : (v >= 70 ? 'warn' : 'danger')); }
        },
        {
          t: '效率系数', k: 'efficiency', w: '100px', align: 'right',
          render: function (r) {
            return '<b class="' + (r.efficiency >= 1 ? 'c-done' : (r.efficiency >= 0.85 ? '' : 'c-warn')) + '">' + r.efficiency.toFixed(2) + '</b>';
          }
        },
        { t: '负载', k: 'loadPct', w: '80px', align: 'right', render: function (r) { return r.loadPct + '%'; } }
      ]
    });

    P.bindFlt(P.$('efFlt'), MOD, DEF_E);
    P.$('efCross').onclick = function () {
      if (C.canSee('collab', S.role())) Shell.go('collab', 'cross');
      else UI.toast('当前角色无权查看协同模块', 'warn');
    };
    P.$('efWord').onclick = function () {
      P.word('团队协同效率', '团队协同效率分析', [
        {
          h: '总体结论',
          kv: [['数据口径', P.scopeText()], ['统计人数', all.length + ' 人'],
          ['累计完成任务', done + ' 项'], ['在办任务', open + ' 项'],
          ['延期任务', delay + ' 项'], ['按时完成率', rate + '%'],
          ['平均效率系数', eff], ['跨部门未闭环', cxOpen.length + ' 项（逾期 ' + cxOver.length + ' 项）']]
        },
        {
          h: '部门效率汇总',
          table: P.wTable(
            [{ t: '部门', k: 'd' }, { t: '人数', k: 'n' }, { t: '已完成', k: 'done' },
            { t: '在办', k: 'open' }, { t: '延期', k: 'delay' }, { t: '按时完成率', k: 'rate' }],
            depts.map(function (d) {
              var ms = all.filter(function (m) { return m.dept === d; });
              var dn = U.sum(ms, 'taskDone'), dl = U.sum(ms, 'taskDelay');
              return {
                d: d, n: ms.length + ' 人', done: dn, open: U.sum(ms, 'taskOpen'),
                delay: dl, rate: U.pct(dn, dn + dl) + '%'
              };
            })
          )
        },
        {
          h: '效率靠前成员',
          table: P.wTable(
            [{ t: '姓名', k: 'name' }, { t: '部门', k: 'dept' },
            { t: '效率系数', get: function (r) { return r.efficiency.toFixed(2); } },
            { t: '已完成', k: 'taskDone' },
            { t: '按时完成率', get: function (r) { return onTime(r) + '%'; } }],
            top.slice(0, 8)
          )
        },
        {
          h: '需要关注的协同问题',
          list: cxOver.length
            ? cxOver.map(function (c2) {
              return '【' + c2.toDept + '】' + c2.title + '（' + c2.projectName + '）应于 ' + c2.dueAt + ' 完成，当前状态：' + c2.status + '。';
            })
            : ['当前口径下跨部门事项均在期限内，无逾期。']
        }
      ]);
    };
  }

  /* ======================================================== */
  Shell.page(MOD, {
    render: function (ctx) {
      if (ctx.sub === 'load') loadView(ctx);
      else if (ctx.sub === 'efficiency') efficiency(ctx);
      else memberList(ctx);
    }
  });
})();
