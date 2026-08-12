/* ============================================================
 * 10-dashboard.js  双角色仪表盘首页
 * 同一份数据、同一套组件，按 C.HOME[role] 编排出两套首页。
 * 总监 = 全局驾驶舱；项目经理 = 项目执行工作台。
 * ========================================================== */
(function () {
  'use strict';

  var E = U.esc;

  /* ---------------- 通用小件 ---------------- */
  function banner() {
    var ro = S.roleObj();
    var tags = [], stats = [];
    if (S.isDirector()) {
      var ls = S.linesInScope(), ps = S.projectsInScope();
      var rk = S.risks('line').filter(function (x) { return x.level === '高' && !C.isTerminal(x.status) && x.status !== '已缓解'; });
      tags = [
        '口径：' + (S.curLine() ? S.curLine().name : '全部产品线'),
        '在管项目 ' + ps.length + ' 个',
        '本周 ' + S.weekFocus().length + ' 项关键节点'
      ];
      stats = [
        { v: ls.length, l: '产品线' },
        { v: U.pct(U.sum(ps, function (p) { return p.progress; }), ps.length) + '%', l: '平均进度' },
        { v: rk.length, l: '高危风险' }
      ];
    } else {
      var p = S.curProject() || {};
      var st = S.projectStat(p.id);
      tags = [
        '当前项目：' + (p.name || '—'),
        '项目经理 ' + (p.pm || '—'),
        (p.start || '') + ' ~ ' + (p.end || '')
      ];
      stats = [
        { v: Math.round(st.progress * 100) + '%', l: '项目进度' },
        { v: st.taskOpen, l: '在办任务' },
        { v: st.taskDelay, l: '延期任务' }
      ];
    }
    return '<div class="role-banner">' +
      '<div class="rb-l">' +
      '<div class="rb-hi">' + E(ro.user.name) + '，' + greet() + '　·　' + E(ro.name) + '视角</div>' +
      '<div class="rb-sub">' + E(ro.slogan) + '</div>' +
      '<div style="margin-top:10px">' + tags.map(function (t) {
        return '<span class="rb-tag">' + E(t) + '</span>';
      }).join('') + '</div>' +
      '</div>' +
      '<div class="rb-r">' + stats.map(function (s) {
        return '<div class="rb-stat"><div class="rs-v">' + E(s.v) + '</div><div class="rs-l">' + E(s.l) + '</div></div>';
      }).join('') + '</div></div>';
  }
  function greet() {
    var h = new Date().getHours();
    return h < 6 ? '凌晨好' : (h < 11 ? '早上好' : (h < 14 ? '中午好' : (h < 18 ? '下午好' : '晚上好')));
  }

  function metrics() {
    return UI.grid(6, S.homeMetrics().map(UI.metric).join(''));
  }

  function quickPanel() {
    var q = S.roleObj().quick.map(function (x) { return { key: x.k, label: x.label, ico: x.ico }; });
    return UI.card({
      title: '快捷新建', ico: '＋',
      sub: '仅展示当前角色可用的操作',
      body: UI.quick(q)
    });
  }

  function chartBox(id, h) {
    return '<div id="' + id + '" style="height:' + (h || 240) + 'px"></div>';
  }

  /* ============================================================
   * 总监首页区块
   * ========================================================== */
  var DIR_BLOCKS = {
    /* 各产品线进展对比 */
    lineProgress: function () {
      return UI.card({
        title: '产品线进展对比', ico: '◈',
        sub: '进度 / 需求 / 版本 / 风险',
        extra: '<button class="btn-text" data-go="roadmap/compare">多产品线对比 →</button>',
        body: chartBox('chLineProgress', 250) + '<div id="chLineBars" style="margin-top:6px"></div>',
        cls: 'span2'
      });
    },
    /* 需求流转效率 */
    reqFlow: function () {
      var f = S.reqFlow('line');
      return UI.card({
        title: '需求流转效率', ico: '☰',
        sub: '平均周期 ' + f.avgCycle + ' 天 · 近 30 天上线 ' + f.throughput + ' 个',
        extra: '<button class="btn-text" data-go="requirements/flow">状态流转 →</button>',
        body: chartBox('chReqFunnel', 300) +
          '<div class="flex-b tiny muted" style="margin-top:8px">' +
          '<span>需求总量 <b class="strong">' + f.total + '</b></span>' +
          '<span>已驳回 <b class="strong">' + f.rejected + '</b></span>' +
          '<span>发生过变更 <b class="strong">' + f.changed + '</b></span></div>'
      });
    },
    /* 核心业务指标趋势 */
    bizTrend: function () {
      return UI.card({
        title: '核心经营指标趋势', ico: '◔',
        sub: '近 26 周',
        extra: '<span class="chip-row" id="bizPick">' +
          ['arr', 'dau', 'nps', 'churn'].map(function (k, i) {
            return '<button class="chip' + (i === 0 ? ' on' : '') + '" data-mk="' + k + '">' +
              ({ arr: 'ARR', dau: '活跃用户', nps: 'NPS', churn: '流失率' }[k]) + '</button>';
          }).join('') + '</span>',
        body: chartBox('chBizTrend', 250),
        cls: 'span2'
      });
    },
    /* 本周重点事项 */
    weekFocus: function () {
      var items = S.weekFocus();
      var body = items.length ? '<div class="list">' + items.slice(0, 9).map(function (x) {
        return UI.listItem({
          click: true, data: 'data-go="' + E(x.mod) + '//' + E(x.ref) + '"',
          ico: ({ 版本: '⬢', 里程碑: '◈', 风险: '⚠', 会议: '▤', 待审批: '⇄' })[x.kind] || '·',
          title: UI.tag(x.kind, x.tone) + ' ' + E(U.ellip(x.title, 26)),
          meta: '<span>' + E(x.sub || '') + '</span><span class="dot-sep"></span><span>' + E(x.owner || '') + '</span>',
          right: UI.due(x.date)
        });
      }).join('') + '</div>' : UI.empty('本周暂无关键节点');
      return UI.card({
        title: '本周关注', ico: '◷',
        sub: U.fmtDate(U.weekRange(S.TODAY)[0], 'MM-DD') + ' ~ ' + U.fmtDate(U.weekRange(S.TODAY)[1], 'MM-DD'),
        body: body, flush: true
      });
    },
    /* 最新风险 */
    riskLatest: function () {
      var rk = U.orderBy(
        S.risks('line').filter(function (x) { return ['已缓解', '已关闭'].indexOf(x.status) < 0; }),
        [function (x) { return ({ 高: 0, 中: 1, 低: 2 })[x.level]; }, function (x) { return x.dueAt; }]
      ).slice(0, 7);
      var body = rk.length ? '<div class="list">' + rk.map(function (x) {
        return UI.listItem({
          click: true, data: 'data-go="risks/ledger/' + E(x.id) + '"',
          ico: UI.light(C.TONE.light[x.level], ''),
          title: E(U.ellip(x.title, 28)),
          meta: '<span>' + E(x.lineName) + '</span><span class="dot-sep"></span><span>' + E(x.type) + '</span>' +
            '<span class="dot-sep"></span><span>' + E(x.owner) + '</span>',
          right: UI.st('status', x.status) + (x.escalated ? ' ' + UI.tag('已升级', 'danger') : '')
        });
      }).join('') + '</div>' : UI.empty('当前没有未关闭风险', '', '✓');
      return UI.card({
        title: '风险预警', ico: '⚠',
        sub: '按等级与时限排序',
        extra: '<button class="btn-text" data-go="risks/ledger">全部风险 →</button>',
        body: body, flush: true
      });
    },
    /* 最新决策 */
    decisionLatest: function () {
      var ms = U.sortBy(S.meetings('line'), 'date', true).slice(0, 6);
      var items = [];
      ms.forEach(function (m) {
        (m.decisions || []).slice(0, 2).forEach(function (d) {
          items.push({
            time: m.date, tone: 'plan',
            title: E(U.ellip(d.text, 34)),
            desc: '来自 ' + UI.tag(m.type, C.tone('status', '进行中')) + ' <b>' + E(U.ellip(m.title, 18)) + '</b>',
            meta: '<span>' + E(d.by) + '</span><span class="dot-sep"></span><span>' + E(m.lineName || '') + '</span>',
            data: 'data-go="meetings/list/' + E(m.id) + '"'
          });
        });
      });
      return UI.card({
        title: '最新决策记录', ico: '▤',
        sub: '来自各类评审与例会',
        extra: '<button class="btn-text" data-go="meetings/list">会议纪要 →</button>',
        body: UI.tline(items.slice(0, 8), { emptyMsg: '暂无决策记录' })
      });
    }
  };

  /* ============================================================
   * 项目经理首页区块
   * ========================================================== */
  var PM_BLOCKS = {
    /* 阶段进度 */
    phaseProgress: function () {
      var p = S.curProject() || {};
      return UI.card({
        title: '项目阶段进度', ico: '◫',
        sub: (p.name || '') + ' · ' + (p.start || '') + ' ~ ' + (p.end || ''),
        extra: '<button class="btn-text" data-go="plan/phases">阶段划分 →</button>',
        body: '<div id="chPhase"></div>' + chartBox('chPhaseGantt', 260),
        cls: 'span2'
      });
    },
    /* 本周交付节点 */
    weekDelivery: function () {
      var items = S.weekDelivery();
      var body = items.length ? '<div class="list">' + items.slice(0, 9).map(function (x) {
        return UI.listItem({
          click: true, data: 'data-go="' + E(x.mod) + '//' + E(x.ref) + '"',
          ico: ({ 里程碑: '◈', 交付物: '⬓', 版本: '⬢', 任务: '☑' })[x.kind] || '·',
          title: UI.tag(x.kind, x.tone) + ' ' + E(U.ellip(x.title, 24)),
          meta: '<span>' + E(x.owner || '') + '</span>' + (x.status ? '<span class="dot-sep"></span>' + UI.st('status', x.status) : ''),
          right: UI.due(x.date)
        });
      }).join('') + '</div>' : UI.empty('本周暂无交付节点');
      return UI.card({
        title: '本周交付', ico: '◷',
        sub: U.fmtDate(U.weekRange(S.TODAY)[0], 'MM-DD') + ' ~ ' + U.fmtDate(U.weekRange(S.TODAY)[1], 'MM-DD'),
        body: body, flush: true
      });
    },
    /* 今日待办 */
    todayTodo: function () {
      var td = U.orderBy(S.todos().filter(function (t) { return t.status !== '已完成'; }),
        [function (t) { return t.priority; }, function (t) { return t.due; }]).slice(0, 8);
      var body = td.length ? '<div class="list" id="homeTodo">' + td.map(function (t) {
        return UI.listItem({
          data: 'data-todo="' + E(t.id) + '"',
          ico: '<input type="checkbox" class="ck li-check" data-done="' + E(t.id) + '">',
          title: E(t.title),
          meta: UI.pri(t.priority) + '<span class="dot-sep"></span><span>' + E(t.from) + '</span>',
          right: UI.due(t.due)
        });
      }).join('') + '</div>' : UI.empty('今日待办已清空', '', '✓');
      return UI.card({
        title: '我的待办', ico: '✓',
        sub: '共 ' + S.todos().filter(function (t) { return t.status !== '已完成'; }).length + ' 项未完成',
        extra: '<button class="btn-text" data-create="todo.new">＋ 新增</button>',
        body: body, flush: true
      });
    },
    /* 任务概览 */
    taskBoard: function () {
      var ts = S.tasks();
      var cnt = U.countBy(ts, 'status');
      return UI.card({
        title: '任务分布概览', ico: '☑',
        sub: '共 ' + ts.length + ' 个任务',
        extra: '<button class="btn-text" data-go="tasks/kanban">任务看板 →</button>',
        body: '<div class="grid g2" style="align-items:center">' +
          chartBox('chTaskDonut', 210) + chartBox('chTaskType', 210) + '</div>'
      });
    },
    /* 阻塞事项 */
    blockList: function () {
      var bl = S.tasks().filter(function (t) { return t.status === '已阻塞' || (t.overdue && t.status !== '已完成'); });
      bl = U.sortBy(bl, 'due').slice(0, 8);
      var body = bl.length ? '<div class="list">' + bl.map(function (t) {
        return UI.listItem({
          click: true, data: 'data-go="tasks/list/' + E(t.id) + '"',
          ico: t.status === '已阻塞' ? '⛔' : '⏱',
          title: E(U.ellip(t.title, 26)),
          desc: t.blockReason ? '<span class="tag tag-danger">阻塞</span> ' + E(t.blockReason)
            : '<span class="tag tag-warn">延期 ' + t.delayDays + ' 天</span>',
          meta: UI.owner(t.owner) + '<span class="dot-sep"></span><span>' + E(t.type) + '</span>',
          right: UI.due(t.due)
        });
      }).join('') + '</div>' : UI.empty('当前无阻塞与延期任务', '', '✓');
      return UI.card({
        title: '阻塞与延期', ico: '⛔',
        sub: '需要立即介入',
        extra: '<button class="btn-text" data-go="progress/blocked">阻塞项 →</button>',
        body: body, flush: true
      });
    },
    /* Action Item */
    actionItems: function () {
      var as = S.actions().filter(function (a) { return ['已完成', '已取消'].indexOf(a.status) < 0; });
      as = U.sortBy(as, 'due').slice(0, 8);
      var body = as.length ? '<div class="list">' + as.map(function (a) {
        return UI.listItem({
          click: true, data: 'data-go="meetings/actions/' + E(a.id) + '"',
          ico: '▤',
          title: E(U.ellip(a.content, 28)),
          meta: '<span>来自 ' + E(U.ellip(a.meetingTitle, 14)) + '</span><span class="dot-sep"></span>' + UI.owner(a.owner),
          right: UI.st('status', a.status) + ' ' + UI.due(a.due)
        });
      }).join('') + '</div>' : UI.empty('暂无待跟进 Action Item', '', '✓');
      return UI.card({
        title: '会议 Action Item', ico: '▤',
        sub: '未完成 ' + as.length + ' 项',
        extra: '<button class="btn-text" data-go="meetings/actions">全部跟踪 →</button>',
        body: body, flush: true
      });
    }
  };

  /* ============================================================
   * 图表绘制（DOM 就绪后）
   * ========================================================== */
  function drawDirector() {
    /* 产品线进度对比：组合图（柱=需求量，折线=平均进度） */
    var ls = S.linesInScope();
    var stats = ls.map(function (l) { return S.lineStat(l.id); });
    CH.line('#chLineProgress', {
      height: 250,
      labels: stats.map(function (s) { return s.line.name; }),
      yFmt: function (v) { return v; },
      series: [
        { name: '需求总量', type: 'bar', color: CH.TONE.plan, data: stats.map(function (s) { return s.reqTotal; }) },
        { name: '已上线需求', type: 'bar', color: CH.TONE.done, data: stats.map(function (s) { return s.reqOnline; }) },
        { name: '平均进度(%)', color: CH.TONE.accent, data: stats.map(function (s) { return Math.round(s.progress * 100); }) }
      ],
      onClick: function (si, i) { Shell.go('roadmap', 'compare', ls[i].id); }
    });
    CH.bars('#chLineBars', {
      data: stats.map(function (s) {
        return {
          label: s.line.name, value: Math.round(s.progress * 100),
          text: Math.round(s.progress * 100) + '% · ' + s.running + ' 个在建 · ' + s.riskHigh + ' 高危',
          color: s.riskHigh >= 2 ? CH.TONE.danger : (s.riskHigh ? CH.TONE.warn : CH.TONE.done)
        };
      }),
      max: 100,
      onClick: function (i) { S.setLine(ls[i].id); }
    });

    /* 需求流转漏斗 */
    var f = S.reqFlow('line');
    CH.funnel('#chReqFunnel', {
      height: 300,
      data: f.steps,
      onClick: function (i) { Shell.go('requirements', 'pool', ''); }
    });

    /* 经营指标趋势 */
    drawBiz('arr');
    var pick = document.getElementById('bizPick');
    if (pick) {
      pick.addEventListener('click', function (e) {
        var b = e.target.closest('[data-mk]');
        if (!b) return;
        pick.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('on'); });
        b.classList.add('on');
        drawBiz(b.getAttribute('data-mk'));
      });
    }
  }

  function drawBiz(key) {
    var ls = S.linesInScope();
    var meta = {
      arr: { name: 'ARR（万元）', fmt: function (v) { return U.kmb(v); } },
      dau: { name: '日活用户', fmt: function (v) { return U.kmb(v); } },
      nps: { name: 'NPS', fmt: function (v) { return v; } },
      churn: { name: '流失率(%)', fmt: function (v) { return v; } }
    }[key] || { name: key, fmt: function (v) { return v; } };
    var series = [], labels = [];
    ls.forEach(function (l, i) {
      var m = S.metric(key, l.id);
      if (!m || !m.data) return;
      if (!labels.length) labels = m.data.map(function (d) { return U.fmtDate(d.date, 'MM-DD'); });
      series.push({ name: l.name, color: CH.color(i), data: m.data.map(function (d) { return d.value; }) });
    });
    if (!series.length) {
      var g = S.metric(key, '');
      if (g && g.data) {
        labels = g.data.map(function (d) { return U.fmtDate(d.date, 'MM-DD'); });
        series = [{ name: meta.name, color: CH.TONE.accent, area: true, data: g.data.map(function (d) { return d.value; }) }];
      }
    }
    CH.line('#chBizTrend', {
      height: 250, labels: labels, series: series, xEvery: 4,
      yFmt: meta.fmt, smooth: true,
      onClick: function () { Shell.go('analytics', 'trend'); }
    });
  }

  function drawPM() {
    var pid = S.state.projectId;
    var phs = S.DB.phases.filter(function (x) { return x.projectId === pid; });

    CH.bars('#chPhase', {
      data: phs.map(function (p) {
        return {
          label: p.name, value: Math.round((p.progress || 0) * 100),
          text: Math.round((p.progress || 0) * 100) + '% · ' + (p.status || ''),
          color: p.status === '已完成' ? CH.TONE.done : (p.status === '进行中' ? CH.TONE.doing : CH.TONE.idle)
        };
      }),
      max: 100,
      onClick: function (i) { Shell.go('plan', 'phases', phs[i].id); }
    });

    /* 阶段 + 里程碑甘特 */
    var rows = phs.map(function (p) {
      return {
        id: p.id, name: p.name, type: 'bar', start: p.start, end: p.end,
        progress: Math.round((p.progress || 0) * 100),
        tone: p.status === '已完成' ? 'done' : (p.status === '进行中' ? 'doing' : 'plan'),
        sub: p.status
      };
    });
    S.DB.milestones.filter(function (m) { return m.projectId === pid; }).forEach(function (m) {
      rows.push({
        id: m.id, name: m.name, type: 'mile', start: m.date, end: m.date,
        tone: m.status === '已延期' ? 'danger' : (/已完成/.test(m.status) ? 'done' : 'warn'),
        sub: m.status
      });
    });
    CH.gantt('#chPhaseGantt', {
      rows: rows, height: 260,
      onClick: function (r) { Shell.go('plan', r.type === 'mile' ? 'milestones' : 'phases', r.id); }
    });

    /* 任务状态环 */
    var ts = S.tasks();
    var cs = U.countBy(ts, 'status');
    CH.donut('#chTaskDonut', {
      height: 210,
      inner: 44,
      center: { v: ts.length, l: '任务总数' },
      data: C.DICT.taskStatus.filter(function (s) { return cs[s]; }).map(function (s) {
        return { name: s, value: cs[s], color: CH.TONE[C.tone('status', s)] || CH.TONE.idle };
      }),
      onClick: function (i) { Shell.go('tasks', 'list'); }
    });
    var ct = U.countBy(ts, 'type');
    CH.bar('#chTaskType', {
      height: 210, horizontal: true,
      labels: C.DICT.taskType.filter(function (t) { return ct[t]; }),
      series: [{
        name: '任务数', color: CH.TONE.doing,
        data: C.DICT.taskType.filter(function (t) { return ct[t]; }).map(function (t) { return ct[t]; })
      }],
      onClick: function () { Shell.go('tasks', 'list'); }
    });

    /* 待办勾选 */
    var box = document.getElementById('homeTodo');
    if (box) {
      box.addEventListener('change', function (e) {
        var c = e.target.closest('[data-done]');
        if (!c || !c.checked) return;
        var id = c.getAttribute('data-done');
        var t = S.DB.todos.filter(function (x) { return x.id === id; })[0];
        if (t) { t.status = '已完成'; t.overdue = false; }
        UI.toast('待办已完成');
        S.emit('data');
      });
    }
  }

  /* ============================================================
   * 页面注册
   * ========================================================== */
  /* 空库首页：不摆一屏的 0，直接把上手清单摆出来 */
  function renderFirstRun(ctx) {
    var ro = S.roleObj();
    ctx.el.innerHTML =
      '<div class="role-banner">' +
      '<div class="rb-l">' +
      '<div class="rb-hi">' + E(ro.user.name) + '，' + greet() + '　·　' + E(ro.name) + '视角</div>' +
      '<div class="rb-sub">工作台已经就绪，还差你的第一批数据。</div>' +
      '<div style="margin-top:10px">' +
      '<span class="rb-tag">纯本地运行，不联网</span>' +
      '<span class="rb-tag">录入即自动保存</span>' +
      '<span class="rb-tag">两个角色共用一份数据</span>' +
      '</div></div></div>' +
      UI.notice('info',
        '首页上的每一个数字都是<b>算出来的</b>，不需要手填——把产品线、项目、需求、任务建起来，这里自然就有内容了。' +
        '按下面的清单走一遍，大约 10 分钟。') +
      '<div style="height:var(--sp-4)"></div>' +
      G.setupCard(false) +
      '<div style="height:var(--sp-4)"></div>' +
      UI.grid(2,
        UI.card({
          title: '不知道哪个模块干什么用？', ico: '▤',
          sub: '功能地图：20 个模块各自解决什么问题',
          body: '<div class="gd-tip">每个模块都写清了「这是什么 / 什么时候用 / 第一步做什么」，' +
            '点进去就能直接开始录。不确定的时候翻一下，比自己猜快。</div>',
          foot: '<button class="btn-primary" data-go="guide/map">看功能地图</button>' +
            '<button class="btn" data-go="guide/start">上手引导</button>'
        }) +
        quickPanel()
      );
    G.bindSetup(ctx.el);
  }

  Shell.page('dashboard', {
    render: function (ctx) {
      if (S.isEmpty()) { renderFirstRun(ctx); return; }

      var role = S.role();
      var home = C.HOME[role];
      var BL = role === 'director' ? DIR_BLOCKS : PM_BLOCKS;

      var blocks = (home.blocks || []).map(function (k) {
        return BL[k] ? BL[k]() : '';
      }).join('');

      ctx.el.innerHTML =
        banner() +
        metrics() +
        '<div style="height:var(--sp-4)"></div>' +
        /* 还没走完上手清单时，把它挂在首页顶部；走完自动消失 */
        (G.progress().done < G.progress().total
          ? G.setupCard(true) + '<div style="height:var(--sp-4)"></div>' : '') +
        '<div class="grid g2">' + blocks + '</div>' +
        '<div style="height:var(--sp-4)"></div>' +
        quickPanel();

      G.bindSetup(ctx.el);
      if (role === 'director') drawDirector(); else drawPM();
    }
  });
})();
