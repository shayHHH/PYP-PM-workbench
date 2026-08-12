/* ============================================================
 * 18-todos.js  待办中心
 * 子页：mine  我的待办（优先级 / 截止 / 快速新增 / 一键完成）
 *       notes 个人笔记与提醒
 * 待办按角色隔离：总监与项目经理各自持有自己的待办清单
 * 总监默认按优先级排序，PM 默认按截止时间排序
 * ========================================================== */
(function () {
  'use strict';
  var E = U.esc, MOD = 'todos';

  var DEF_T = { kw: '', status: '', priority: '', from: '', open: '' };
  var CLOSED = ['已完成', '已取消'];
  var FROMS = ['系统提醒', '会议 Action', '手动创建', '风险升级'];
  var REF_LABEL = {
    release: '版本', risk: '风险', meeting: '会议', requirement: '需求',
    task: '任务', delivery: '交付物'
  };

  function isOpen(t) { return CLOSED.indexOf(t.status) < 0; }
  function view() { return C.viewOf(S.role(), MOD); }
  function notes() { return S.DB.notes; }

  function filtered(f) {
    return S.todos().filter(function (t) {
      if (f.kw && !U.matchAny(t, ['title', 'id', 'note', 'from'], f.kw)) return false;
      if (f.status && t.status !== f.status) return false;
      if (f.priority && t.priority !== f.priority) return false;
      if (f.from && t.from !== f.from) return false;
      if (f.open === 'open' && !isOpen(t)) return false;
      if (f.open === 'overdue' && !(isOpen(t) && U.daysLeft(t.due) < 0)) return false;
      if (f.open === 'today' && U.daysLeft(t.due) !== 0) return false;
      return true;
    });
  }

  /* ============================================================
   * 子页 1：我的待办
   * ========================================================== */
  function mine(ctx) {
    var f = P.flt(MOD, DEF_T);
    var all = S.todos();
    var rows = filtered(f);
    var open = all.filter(isOpen);
    var overdue = open.filter(function (t) { return U.daysLeft(t.due) < 0; });
    var today = open.filter(function (t) { return U.daysLeft(t.due) === 0; });
    var done = all.filter(function (t) { return t.status === '已完成'; });

    var v = view();
    var sortKey = v.sort === 'priority' ? 'priority' : 'due';

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: '我的待办',
        desc: '汇总系统提醒、会议 Action、风险升级与手动创建的事项，按角色隔离　·　' +
          S.roleObj().user.name + '（' + S.roleObj().name + '）　·　共 ' + all.length +
          ' 项，未完成 ' + open.length + ' 项',
        acts: UI.exportMenu({ word: true }) + '　<button class="btn-primary" data-create="todo.new">＋ 新建待办</button>'
      }) +
      P.statCards([
        { label: '未完成待办', val: open.length, unit: '项', ico: '✓', tone: 'doing', sub: '共登记 ' + all.length + ' 项', mod: MOD, key: 'mine' },
        { label: '今日到期', val: today.length, unit: '项', ico: '◷', tone: 'warn', sub: today.length ? '请优先处理' : '今日无到期事项' },
        { label: '已逾期', val: overdue.length, unit: '项', ico: '⚠', tone: 'danger', sub: overdue.length ? '最久逾期 ' + Math.max.apply(null, overdue.map(function (t) { return -U.daysLeft(t.due); })) + ' 天' : '无逾期' },
        { label: '完成率', val: U.pct(done.length, all.length), unit: '%', ico: '◔', tone: 'done', sub: '已完成 ' + done.length + ' 项' }
      ]) + P.gap(4) +
      UI.grid(2,
        UI.card({
          title: '快速新增', sub: '回车即可加入待办清单，默认 P1 / 3 天后到期', ico: '＋',
          body:
            '<div class="toolbar" style="margin:0">' +
            '<input class="fld fld-search" id="qaTitle" placeholder="要做什么？例如：确认灰度放量比例" style="flex:1">' +
            P.sel('__qp', '', C.DICT.priority, 'P1', 'w-xs') +
            '<input class="fld" type="date" id="qaDue" value="' + E(U.fmtDate(U.addDay(S.TODAY, 3))) + '" style="width:150px">' +
            '<button class="btn-primary" id="qaAdd">加入待办</button>' +
            '</div>' +
            '<div class="muted tiny" style="margin-top:var(--sp-2)">' +
            '待办按角色分开存放：总监视角和项目经理视角各有一份，互不干扰。加进来就自动保存。</div>'
        }) +
        UI.card({ title: '优先级与截止分布', sub: '未完成待办按优先级 × 时限', ico: '◍', body: P.chart('tdDist', 200) })
      ) + P.gap(4) +
      UI.card({
        flush: true,
        extra: '<span class="muted tiny">' + E(v.note || '') + '</span>',
        body: '<div class="toolbar" id="tdFlt">' +
          '<input class="fld fld-search" data-f="kw" placeholder="搜索待办内容 / 备注" value="' + E(f.kw) + '">' +
          P.sel('priority', '全部优先级', C.DICT.priority, f.priority) +
          P.sel('status', '全部状态', ['待开始', '进行中', '已完成', '已取消'], f.status) +
          P.sel('from', '全部来源', FROMS, f.from) +
          P.sel('open', '全部时限', [
            { v: 'open', t: '仅未完成' }, { v: 'today', t: '今日到期' }, { v: 'overdue', t: '已逾期' }
          ], f.open) +
          '<span class="grow"></span>' + P.viewBar(MOD) +
          '<button class="btn btn-sm" data-reset>重置</button>' +
          '</div><div id="tdTbl"></div>'
      });

    /* ---- 分布图 ---- */
    var BUCKET = ['已逾期', '今天', '3 天内', '7 天内', '更远'];
    function bucket(t) {
      var d = U.daysLeft(t.due);
      if (d < 0) return 0;
      if (d === 0) return 1;
      if (d <= 3) return 2;
      if (d <= 7) return 3;
      return 4;
    }
    var pri = C.DICT.priority;
    var matrix = pri.map(function (p) {
      return BUCKET.map(function (_, bi) {
        return open.filter(function (t) { return t.priority === p && bucket(t) === bi; }).length;
      });
    });
    if (open.length) {
      CH.heat('tdDist', {
        rows: pri, cols: BUCKET, matrix: matrix, labelW: 52, vLabel: '待办数',
        fmt: function (n) { return n ? String(n) : ''; },
        onClick: function (r, c) {
          P.setFlt(MOD, Object.assign({}, P.flt(MOD, DEF_T), {
            priority: pri[r], open: c === 0 ? 'overdue' : (c === 1 ? 'today' : 'open')
          }));
          Shell.route();
        }
      });
    } else P.$('tdDist').innerHTML = UI.empty('全部待办均已完成', '', '✓');

    /* ---- 表格 ---- */
    var cs = [
      { k: 'priority', t: '优先级', w: '86px', render: function (r) { return UI.pri(r.priority); }, sortVal: function (r) { return C.DICT.priority.indexOf(r.priority); } },
      {
        k: 'title', t: '待办事项',
        render: function (r) {
          var doneCls = r.status === '已完成' ? ' style="text-decoration:line-through;color:var(--t-3)"' : '';
          return UI.cell2('<span' + doneCls + '>' + E(r.title) + '</span>',
            (r.remind ? '<span class="tag tag-plain">🔔 已设提醒</span> ' : '') + E(r.note || ''));
        }
      },
      {
        k: 'from', t: '来源', w: '132px',
        render: function (r) {
          return UI.cell2(UI.tag(r.from, r.from === '风险升级' ? 'danger' : (r.from === '手动创建' ? 'plain' : 'plan')),
            r.refType ? (REF_LABEL[r.refType] || '') + '相关' : '');
        }
      },
      {
        k: 'due', t: '截止时间', w: '150px',
        render: function (r) {
          return UI.cell2(E(r.due), isOpen(r) ? UI.due(r.due) : '<span class="muted tiny">已闭环</span>');
        }
      },
      { k: 'status', t: '状态', w: '92px', render: function (r) { return UI.tag(r.status, C.tone('status', r.status)); } },
      {
        k: '', t: '操作', w: '150px', sortable: false, align: 'right',
        render: function (r) {
          return '<div class="row-acts">' +
            (isOpen(r) ? '<button data-act="done">完成</button>' : '<button data-act="redo">重开</button>') +
            '<button data-act="edit">编辑</button>' +
            '<button data-act="del">删除</button></div>';
        }
      }
    ];

    var tb = UI.table('#tdTbl', {
      cols: cs,
      rows: U.sortBy(rows, sortKey, !!v.desc),
      pageSize: 12,
      sort: { k: sortKey, desc: !!v.desc },
      select: true,
      rowCls: function (r) {
        if (!isOpen(r)) return 'row-done';
        if (U.daysLeft(r.due) < 0) return 'row-danger';
        if (U.daysLeft(r.due) === 0) return 'row-warn';
        return '';
      },
      empty: '当前筛选条件下没有待办事项',
      emptyAct: '<button class="btn" data-reset>重置筛选</button>',
      bulk: [
        {
          t: '批量标记完成', cls: 'btn-primary',
          fn: function (picked, clear) {
            picked.forEach(function (r) { S.update('todos', r.id, { status: '已完成', overdue: false }); });
            clear(); Shell.route();
            UI.toast('已完成 ' + picked.length + ' 项待办', 'ok');
          }
        },
        {
          t: '批量导出', fn: function (picked) { exportCsv(picked); }
        }
      ],
      onAct: function (act, r) {
        if (act === 'done') { S.update('todos', r.id, { status: '已完成', overdue: false }); Shell.route(); UI.toast('「' + U.ellip(r.title, 14) + '」已完成', 'ok'); }
        else if (act === 'redo') { S.update('todos', r.id, { status: '进行中', overdue: U.daysLeft(r.due) < 0 }); Shell.route(); UI.toast('已重新打开'); }
        else if (act === 'edit') editTodo(r);
        else if (act === 'del') {
          UI.confirm('确定删除待办「' + U.ellip(r.title, 18) + '」？', function () {
            S.remove('todos', r.id); Shell.route(); UI.toast('已删除');
          }, { danger: true, okText: '删除', tip: '删除会立刻写入本地存储，无法撤销。' });
        }
      },
      onRow: function (r) { editTodo(r); }
    });

    /* ---- 快速新增 ---- */
    var qi = P.$('qaTitle');
    function quickAdd() {
      var t = (qi.value || '').trim();
      if (!t) { UI.toast('请先填写待办内容', 'warn'); qi.focus(); return; }
      var pSel = ctx.el.querySelector('[data-f="__qp"]');
      S.add('todos', {
        id: U.uid('TD'), title: t, role: S.role(),
        priority: (pSel && pSel.value) || 'P1',
        due: P.$('qaDue').value || U.fmtDate(U.addDay(S.TODAY, 3)),
        status: '待开始', overdue: false, from: '手动创建',
        refType: '', refId: '', note: '', remind: false, owner: S.roleObj().user.name
      });
      qi.value = '';
      Shell.route();
      UI.toast('已加入待办清单', 'ok');
    }
    P.$('qaAdd').addEventListener('click', quickAdd);
    qi.addEventListener('keydown', function (e) { if (e.key === 'Enter') quickAdd(); });

    var flt = P.$('tdFlt');
    P.bindFlt(flt, MOD, DEF_T, function () { Shell.route(); });
    P.bindViews(flt, MOD, DEF_T);

    UI.bindExport(ctx.el, {
      csv: function () { exportCsv(rows); },
      word: function () { wordTodos(all, open, overdue); }
    });

    /* 深链：#/todos/mine/TD01 */
    if (ctx.id) {
      var hit = all.filter(function (t) { return t.id === ctx.id; })[0];
      if (hit) editTodo(hit);
    }
  }

  function exportCsv(rows) {
    P.csv('我的待办', rows, [
      { label: '编号', key: 'id' }, { label: '优先级', key: 'priority' },
      { label: '待办事项', key: 'title' }, { label: '来源', key: 'from' },
      { label: '截止时间', key: 'due' }, { label: '状态', key: 'status' },
      { label: '负责人', key: 'owner' }, { label: '备注', key: 'note' }
    ]);
  }

  function wordTodos(all, open, overdue) {
    P.word('待办清单', S.roleObj().name + '待办清单', [
      {
        h: '一、待办概览',
        p: '当前共有待办 ' + all.length + ' 项，未完成 ' + open.length + ' 项，其中已逾期 ' + overdue.length +
          ' 项，完成率 ' + U.pctStr(all.filter(function (t) { return t.status === '已完成'; }).length, all.length) + '。'
      },
      {
        h: '二、待处理事项（按优先级）',
        table: {
          cols: [
            { t: '优先级', k: 'priority' }, { t: '待办事项', k: 'title' },
            { t: '来源', k: 'from' }, { t: '截止时间', k: 'due' },
            { t: '状态', k: 'status' },
            { t: '时限', get: function (r) { return U.dueText(r.due); } }
          ],
          rows: U.sortBy(open, 'priority')
        }
      },
      overdue.length ? {
        h: '三、逾期事项（需说明原因）',
        table: {
          cols: [{ t: '待办事项', k: 'title' }, { t: '截止时间', k: 'due' },
          { t: '逾期天数', get: function (r) { return -U.daysLeft(r.due) + ' 天'; } }],
          rows: overdue
        }
      } : { h: '三、逾期事项', p: '当前没有逾期待办。' },
      {
        h: '四、已闭环事项',
        table: {
          cols: [{ t: '待办事项', k: 'title' }, { t: '截止时间', k: 'due' }, { t: '状态', k: 'status' }],
          rows: all.filter(function (t) { return !isOpen(t); })
        }
      }
    ]);
    UI.toast('待办清单已导出为 Word', 'ok');
  }

  function editTodo(r) {
    UI.formModal({
      title: '编辑待办 · ' + r.id,
      fields: [
        { k: 'title', label: '待办事项', req: true, full: true, val: r.title },
        { k: 'priority', label: '优先级', type: 'select', opts: C.DICT.priority, val: r.priority, req: true },
        { k: 'status', label: '状态', type: 'select', opts: ['待开始', '进行中', '已完成', '已取消'], val: r.status, req: true },
        { k: 'due', label: '截止时间', type: 'date', val: r.due, req: true },
        { k: 'from', label: '来源', type: 'select', opts: FROMS, val: r.from, req: true },
        {
          k: 'remind', label: '到期提醒', type: 'checkbox', opts: ['开启到期提醒'],
          val: r.remind ? ['开启到期提醒'] : [], hint: '开启后会出现在「个人笔记与提醒」的到期提醒栏'
        },
        { k: 'note', label: '备注', type: 'textarea', full: true, rows: 3, val: r.note, placeholder: '补充上下文、关联对象或处理思路' }
      ],
      onSubmit: function (d, h) {
        d.overdue = CLOSED.indexOf(d.status) < 0 && U.daysLeft(d.due) < 0;
        d.remind = (d.remind || []).length > 0;
        S.update('todos', r.id, d);
        h.close(); Shell.route();
        UI.toast('待办已更新', 'ok');
      }
    });
  }

  /* ============================================================
   * 子页 2：个人笔记与提醒
   * ========================================================== */
  function noteList(ctx) {
    var kw = S.pref(MOD, 'noteKw', '');
    var tag = S.pref(MOD, 'noteTag', '');
    var all = notes();
    var allTags = U.uniq([].concat.apply([], all.map(function (n) { return n.tags || []; })));
    var rows = all.filter(function (n) {
      if (kw && !U.matchAny(n, ['title', 'content'], kw)) return false;
      if (tag && (n.tags || []).indexOf(tag) < 0) return false;
      return true;
    }).sort(function (a, b) { return a.updateAt < b.updateAt ? 1 : -1; });

    var remind = S.todos().filter(function (t) { return t.remind && isOpen(t); })
      .sort(function (a, b) { return a.due < b.due ? -1 : 1; });

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: '个人笔记与提醒',
        desc: '不进入正式流程的思考、待确认清单与到期提醒，仅本人可见　·　共 ' + all.length + ' 篇笔记',
        acts: UI.exportMenu({ word: true }) + '　<button class="btn-primary" id="ntNew">＋ 新建笔记</button>'
      }) +
      UI.grid(2,
        UI.card({
          flush: true, title: '笔记列表', ico: '✎',
          sub: '按更新时间倒序',
          body: '<div class="toolbar" style="margin:0">' +
            '<input class="fld fld-search" id="ntKw" placeholder="搜索笔记标题 / 正文" value="' + E(kw) + '" style="flex:1">' +
            '<button class="btn btn-sm" id="ntReset">重置</button></div>' +
            (allTags.length ? UI.chips(
              [{ key: '', label: '全部标签', n: all.length }].concat(allTags.map(function (t) {
                return { key: t, label: t, n: all.filter(function (n) { return (n.tags || []).indexOf(t) >= 0; }).length };
              })), tag, 'ntTag') : '') +
            '<div id="ntList" style="padding:0 var(--sp-4) var(--sp-4)"></div>'
        }) +
        UI.card({
          title: '到期提醒', ico: '🔔',
          sub: '已开启提醒且未完成的待办，按截止时间升序',
          body: remind.length
            ? remind.map(function (t) {
              var d = U.daysLeft(t.due);
              return UI.listItem({
                ico: UI.pri(t.priority), title: E(t.title),
                desc: E(t.from) + ' · 截止 ' + E(t.due),
                right: UI.due(t.due), click: true,
                data: ' data-todo="' + E(t.id) + '"'
              });
            }).join('')
            : UI.empty('暂无开启提醒的待办', '<button class="btn" data-go="todos/mine">去待办清单设置</button>', '🔔')
        })
      );

    paintNotes(rows);

    var kwEl = P.$('ntKw');
    kwEl.addEventListener('input', U.debounce(function () {
      S.setPref(MOD, 'noteKw', kwEl.value); Shell.route();
    }, 250));
    P.$('ntReset').addEventListener('click', function () {
      S.setPref(MOD, 'noteKw', ''); S.setPref(MOD, 'noteTag', ''); Shell.route();
    });
    ctx.el.querySelectorAll('[data-chip="ntTag"]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-v');
        S.setPref(MOD, 'noteTag', tag === v ? '' : v);
        Shell.route();
      });
    });
    P.$('ntNew').addEventListener('click', function () { editNote(null, allTags); });
    ctx.el.querySelectorAll('[data-todo]').forEach(function (n) {
      n.addEventListener('click', function () { Shell.go(MOD, 'mine', n.getAttribute('data-todo')); });
    });

    UI.bindExport(ctx.el, {
      csv: function () {
        P.csv('个人笔记', rows, [
          { label: '编号', key: 'id' }, { label: '标题', key: 'title' },
          { label: '标签', get: function (r) { return (r.tags || []).join('/'); } },
          { label: '更新时间', key: 'updateAt' }, { label: '正文', key: 'content' }
        ]);
      },
      word: function () {
        P.word('个人笔记', S.roleObj().user.name + ' 的工作笔记',
          [{ h: '笔记概览', p: '共 ' + rows.length + ' 篇笔记，标签：' + (allTags.join('、') || '无') + '。' }]
            .concat(rows.map(function (n) {
              return {
                h: n.title,
                p: '更新时间：' + n.updateAt + '　|　标签：' + ((n.tags || []).join('、') || '无'),
                html: '<p>' + E(n.content).replace(/\n/g, '<br>') + '</p>'
              };
            })));
        UI.toast('笔记已导出为 Word', 'ok');
      }
    });
  }

  function paintNotes(rows) {
    var el = P.$('ntList');
    if (!el) return;
    if (!rows.length) { el.innerHTML = UI.empty('没有匹配的笔记'); return; }
    el.innerHTML = rows.map(function (n) {
      return UI.listItem({
        ico: '✎', title: E(n.title),
        desc: E(U.ellip((n.content || '').replace(/\n/g, ' '), 60)),
        meta: '<span>更新于 ' + E(n.updateAt) + '</span>' +
          (n.tags || []).map(function (t) { return UI.tag(t, 'plain'); }).join(''),
        right: '<span class="muted tiny">查看</span>',
        click: true, data: ' data-note="' + E(n.id) + '"'
      });
    }).join('');
    el.querySelectorAll('[data-note]').forEach(function (n) {
      n.addEventListener('click', function () {
        var note = notes().filter(function (x) { return x.id === n.getAttribute('data-note'); })[0];
        if (note) openNote(note);
      });
    });
  }

  function openNote(n) {
    var allTags = U.uniq([].concat.apply([], notes().map(function (x) { return x.tags || []; })));
    UI.drawer({
      title: n.title,
      sub: '更新于 ' + n.updateAt + '　·　' + ((n.tags || []).join(' / ') || '无标签'),
      body: UI.sec('笔记正文', '<div class="rich">' + E(n.content) + '</div>') +
        UI.sec('标签', (n.tags || []).length
          ? (n.tags || []).map(function (t) { return UI.tag(t, 'plain'); }).join(' ')
          : '<span class="muted">未设置标签</span>'),
      foot: '<button class="btn" data-close>关闭</button>' +
        '<button class="btn" data-del-note>删除</button>' +
        '<button class="btn-primary" data-edit-note>编辑笔记</button>',
      onOpen: function (h) {
        h.el.querySelector('[data-close]').addEventListener('click', h.close);
        h.el.querySelector('[data-edit-note]').addEventListener('click', function () { h.close(); editNote(n, allTags); });
        h.el.querySelector('[data-del-note]').addEventListener('click', function () {
          UI.confirm('确定删除笔记「' + U.ellip(n.title, 16) + '」？', function () {
            S.remove('notes', n.id); h.close(); Shell.route(); UI.toast('笔记已删除');
          }, { danger: true, okText: '删除' });
        });
      }
    });
  }

  function editNote(n, allTags) {
    UI.formModal({
      title: n ? '编辑笔记' : '新建笔记', wide: true,
      fields: [
        { k: 'title', label: '标题', req: true, full: true, val: n ? n.title : '', placeholder: '如：Q4 规划思考' },
        {
          k: 'tags', label: '标签', full: true, val: n ? (n.tags || []).join('，') : '',
          hint: '多个标签用逗号分隔' + (allTags && allTags.length ? '，已有：' + allTags.join('、') : '')
        },
        { k: 'content', label: '正文', type: 'textarea', full: true, rows: 10, req: true, val: n ? n.content : '', placeholder: '支持换行，可用于记录待确认清单、复盘结论、客户口径等' }
      ],
      onSubmit: function (d, h) {
        d.tags = (d.tags || '').split(/[，,、\s]+/).filter(Boolean);
        d.updateAt = U.fmtDate(new Date());
        if (n) S.update('notes', n.id, d);
        else { d.id = U.uid('NT'); S.add('notes', d); }
        h.close(); Shell.route();
        UI.toast(n ? '笔记已更新' : '笔记已创建', 'ok');
      }
    });
  }

  /* ============================================================ */
  Shell.page(MOD, {
    render: function (ctx) {
      if (ctx.sub === 'notes') noteList(ctx);
      else mine(ctx);
    }
  });
})();
