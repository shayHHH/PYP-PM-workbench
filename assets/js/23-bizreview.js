/* ============================================================
   23-bizreview.js —— 经营复盘（产品总监增强模块）
   子页：list 复盘记录 / goal 目标完成率 / cause 问题归因与改进
   ============================================================ */
(function () {
  'use strict';

  var E = U.esc, MOD = 'bizreview';
  var DEF_L = { kw: '', type: '', status: '', line: '' };
  var CAUSE_TYPES = ['流程', '协同', '资源'];
  var CAUSE_TONE = { '流程': CH.TONE.doing, '协同': CH.TONE.warn, '资源': CH.TONE.danger };
  var ACT_CLOSED = ['已完成', '已关闭'];

  /* 单条目标的完成率（越低越好的指标做反向折算） */
  function goalRate(g) {
    if (g.lowerBetter) {
      if (g.actual <= g.target) return 100;
      if (g.target) return U.pct(g.target, g.actual);
      return Math.max(0, 100 - g.actual * 40);
    }
    return U.pct(g.actual, g.target);
  }
  function rateTone(v) { return v >= 100 ? 'done' : (v >= 85 ? 'doing' : (v >= 70 ? 'warn' : 'danger')); }
  function lineName(r) {
    if (!r.lineId) return '全公司';
    var l = S.lineBy(r.lineId);
    return l ? l.name : r.lineId;
  }

  /* 汇总所有复盘的目标 / 归因 / 改进项 */
  function allGoals(list) {
    var out = [];
    list.forEach(function (r) {
      (r.goals || []).forEach(function (g, i) {
        out.push({
          id: r.id + '-G' + (i + 1), rvId: r.id, rvTitle: r.title, period: r.period,
          line: lineName(r), name: g.name, target: g.target, actual: g.actual,
          unit: g.unit, lowerBetter: !!g.lowerBetter, rate: goalRate(g)
        });
      });
    });
    return out;
  }
  function allCauses(list) {
    var out = [];
    list.forEach(function (r) {
      (r.causes || []).forEach(function (c2, i) {
        out.push({
          id: r.id + '-C' + (i + 1), rvId: r.id, rvTitle: r.title, period: r.period,
          line: lineName(r), issue: c2.issue, cause: c2.cause, type: c2.type
        });
      });
    });
    return out;
  }
  function allActions(list) {
    var out = [];
    list.forEach(function (r) {
      (r.actions || []).forEach(function (a, i) {
        out.push({
          id: r.id + '-A' + (i + 1), rvId: r.id, rvTitle: r.title, period: r.period,
          text: a.text, owner: a.owner, due: a.due, status: a.status,
          overdue: ACT_CLOSED.indexOf(a.status) < 0 && U.daysLeft(a.due) < 0
        });
      });
    });
    return out;
  }

  /* ========================================================
     子页 1：复盘记录
     ======================================================== */
  function reviewList(ctx) {
    var f = P.flt(MOD, DEF_L);
    var all = S.reviews();

    var rows = all.filter(function (r) {
      if (f.type && r.type !== f.type) return false;
      if (f.status && r.status !== f.status) return false;
      if (f.line && r.lineId !== f.line) return false;
      if (f.kw) {
        var s = (r.title + r.period + r.summary + lineName(r)).toLowerCase();
        if (s.indexOf(f.kw.toLowerCase()) < 0) return false;
      }
      return true;
    }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });

    var doneN = all.filter(function (r) { return r.status === '已完成'; }).length;
    var avgRate = all.length ? Math.round(U.avg(all, 'goalRate')) : 0;
    var acts = allActions(all);
    var openActs = acts.filter(function (a) { return ACT_CLOSED.indexOf(a.status) < 0; });

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: '经营复盘', desc: '按月度 / 季度 / 版本 / 专项沉淀复盘结论，形成"目标—问题—归因—改进"的闭环。',
        acts:
          '<button class="btn" id="rvWord">导出汇总 Word</button>　' +
          P.createBtn(MOD, 'review.new', '新建复盘')
      }) +
      P.permTip(MOD) +
      P.statCards([
        { label: '复盘记录', val: all.length, unit: '份', ico: '◫', sub: P.scopeText() },
        { label: '已完成', val: doneN, unit: '份', ico: '✓', tone: 'done', sub: '进行中 ' + (all.length - doneN) + ' 份' },
        { label: '平均目标完成率', val: avgRate, unit: '%', ico: '◐', tone: rateTone(avgRate), sub: '各期目标达成的平均水平' },
        { label: '待跟进改进项', val: openActs.length, unit: '项', ico: '⚑', tone: openActs.length ? 'warn' : 'done', sub: '共 ' + acts.length + ' 项改进动作' }
      ]) + P.gap(4) +
      UI.grid(2,
        UI.card({ title: '各期目标完成率', sub: '按复盘时间排列，虚线为 100% 达成线', ico: '◈', body: P.chart('rvTrend', 300) }) +
        UI.card({ title: '复盘类型分布', sub: '点击可筛选该类型的复盘记录', ico: '◔', body: P.chart('rvType', 300) })
      ) + P.gap(4) +
      UI.card({
        flush: true, title: '复盘记录', ico: '▤', sub: '共 ' + rows.length + ' 份',
        extra: P.viewBar(MOD),
        body:
          '<div class="toolbar" id="rvFlt">' +
          '<input class="fld grow" type="text" data-f="kw" placeholder="搜索复盘主题 / 周期 / 结论…" value="' + E(f.kw) + '">' +
          P.sel('type', '全部类型', C.DICT.reviewType, f.type) +
          P.sel('status', '全部状态', ['已完成', '进行中'], f.status) +
          P.sel('line', '全部产品线', P.lineOpts(), f.line) +
          '<button class="btn-sm" data-reset>重置</button>' +
          '</div>' +
          '<div id="rvTbl"></div>'
      });

    var byDate = all.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    CH.line('rvTrend', {
      labels: byDate.map(function (r) { return r.period; }),
      series: [{ name: '目标完成率', data: byDate.map(function (r) { return r.goalRate; }), area: true }],
      height: 270, min: 0, yFmt: function (v) { return v + '%'; },
      onClick: function (si, i) { openRv(byDate[i]); }
    });

    CH.donut('rvType', {
      data: C.DICT.reviewType.map(function (t) {
        return { name: t, value: all.filter(function (r) { return r.type === t; }).length };
      }).filter(function (x) { return x.value; }),
      height: 270, inner: 56, center: { v: all.length, l: '复盘份数' }, legendSide: true,
      onClick: function (i, d) { P.setFlt(MOD, { type: d.name }); Shell.route(); }
    });

    UI.table('#rvTbl', {
      rows: rows, pageSize: 12, sort: { k: 'date', desc: true },
      onRow: function (r) { openRv(r); },
      rowCls: function (r) { return r.goalRate < 70 ? 'row-danger' : (r.goalRate < 85 ? 'row-warn' : ''); },
      cols: [
        { t: '编号', k: 'id', w: '80px', render: function (r) { return UI.idCell(r.id); } },
        {
          t: '复盘主题', k: 'title',
          render: function (r) { return UI.cell2(E(r.title), U.ellip(r.summary, 40)); }
        },
        { t: '类型', k: 'type', w: '96px', render: function (r) { return UI.tag(r.type); } },
        { t: '周期', k: 'period', w: '110px' },
        { t: '产品线', k: 'lineId', w: '130px', sortVal: function (r) { return lineName(r); }, render: function (r) { return lineName(r); } },
        { t: '负责人', k: 'owner', w: '110px', render: function (r) { return UI.owner(r.owner); } },
        { t: '复盘日期', k: 'date', w: '106px' },
        {
          t: '目标完成率', k: 'goalRate', w: '150px',
          render: function (r) { return UI.pcell(Math.min(r.goalRate, 120), rateTone(r.goalRate)); }
        },
        { t: '状态', k: 'status', w: '86px', render: function (r) { return UI.st('status', r.status); } },
        {
          t: '操作', k: '', w: '150px', sortable: false,
          render: function () {
            return '<div class="row-acts"><button class="btn-sm" data-act="view">详情</button>' +
              '<button class="btn-sm" data-act="word">报告</button>' +
              (P.ed(MOD) ? '<button class="btn-sm" data-act="edit">编辑</button>' : '') + '</div>';
          }
        }
      ],
      onAct: function (act, r) {
        if (act === 'view') openRv(r);
        else if (act === 'word') wordReview(r);
        else if (act === 'edit') editRv(r);
      },
      bulk: [{ t: '导出所选', fn: function (picked) { csvReviews(picked); } }]
    });

    P.bindFlt(P.$('rvFlt'), MOD, DEF_L);
    P.bindViews(ctx.el, MOD, DEF_L);
    P.$('rvWord').onclick = function () { wordSummary(rows, all); };
  }

  function csvReviews(list) {
    P.csv('经营复盘', list, [
      { label: '编号', key: 'id' }, { label: '主题', key: 'title' },
      { label: '类型', key: 'type' }, { label: '周期', key: 'period' },
      { label: '产品线', get: function (r) { return lineName(r); } },
      { label: '负责人', key: 'owner' }, { label: '日期', key: 'date' },
      { label: '目标完成率', get: function (r) { return r.goalRate + '%'; } },
      { label: '状态', key: 'status' }, { label: '结论', key: 'summary' }
    ]);
  }

  /* 复盘详情抽屉 */
  function openRv(r) {
    var gs = (r.goals || []).map(function (g) { return { g: g, rate: goalRate(g) }; });
    var body =
      P.hero({
        title: r.title, id: r.id,
        meta: [['类型', r.type], ['周期', r.period], ['产品线', lineName(r)], ['复盘日期', r.date]],
        right: UI.pcell(Math.min(r.goalRate, 120), rateTone(r.goalRate))
      }) + P.gap(3) +
      UI.sec('目标达成情况') +
      '<div class="tbl-wrap"><table class="tbl tbl-compact"><thead><tr>' +
      '<th>目标</th><th class="num">目标值</th><th class="num">实际值</th><th style="width:150px">完成率</th><th style="width:80px">结论</th>' +
      '</tr></thead><tbody>' +
      gs.map(function (x) {
        return '<tr><td>' + E(x.g.name) + (x.g.lowerBetter ? ' <span class="muted tiny">越低越好</span>' : '') + '</td>' +
          '<td class="num">' + E(x.g.target + x.g.unit) + '</td>' +
          '<td class="num">' + E(x.g.actual + x.g.unit) + '</td>' +
          '<td>' + UI.pcell(Math.min(x.rate, 120), rateTone(x.rate)) + '</td>' +
          '<td>' + (x.rate >= 100 ? UI.tag('达成', 'done') : UI.tag('未达成', 'danger')) + '</td></tr>';
      }).join('') +
      '</tbody></table></div>' + P.gap(3) +
      UI.sec('本期问题') +
      (r.issues || []).map(function (s, i) {
        return UI.listItem({ ico: String(i + 1), title: E(s) });
      }).join('') + P.gap(3) +
      UI.sec('原因归因') +
      (r.causes || []).map(function (c2) {
        return UI.listItem({
          ico: '◆', title: E(c2.issue) + ' ' + UI.tag(c2.type, c2.type === '资源' ? 'danger' : (c2.type === '协同' ? 'warn' : 'doing')),
          desc: E(c2.cause)
        });
      }).join('') + P.gap(3) +
      UI.sec('改进动作') +
      (r.actions || []).map(function (a) {
        var over = ACT_CLOSED.indexOf(a.status) < 0 && U.daysLeft(a.due) < 0;
        return UI.listItem({
          ico: '⚑', title: E(a.text),
          desc: '责任人 ' + E(a.owner) + ' · 截止 ' + E(a.due) + (over ? ' <span class="tag tag-danger">已逾期</span>' : ''),
          right: UI.st('status', a.status)
        });
      }).join('') + P.gap(3) +
      UI.sec('复盘结论') +
      '<div class="rich">' + E(r.summary) + '</div>';

    UI.drawer({
      title: '复盘详情', sub: r.type + ' · ' + r.period, wide: true, body: body,
      foot: '<button class="btn" data-word>导出报告</button>' +
        (P.ed(MOD) ? '<button class="btn btn-primary" data-edit>编辑</button>' : '') +
        '<span class="grow"></span><button class="btn" data-close>关闭</button>',
      onOpen: function (h) {
        h.el.querySelector('[data-word]').addEventListener('click', function () { wordReview(r); });
        var eb = h.el.querySelector('[data-edit]');
        if (eb) eb.addEventListener('click', function () { h.close(); editRv(r); });
      }
    });
  }

  /* 新建 / 编辑复盘 */
  function editRv(r) {
    if (!P.ed(MOD)) { UI.toast('当前角色没有编辑权限', 'warn'); return; }
    var isNew = !r;
    r = r || { type: '月度复盘', status: '进行中', owner: S.roleObj().user.name, goalRate: 80, date: U.fmtDate(S.TODAY) };
    UI.formModal({
      title: isNew ? '新建复盘' : '编辑复盘 · ' + r.id,
      wide: true,
      fields: [
        { k: 'title', label: '复盘主题', val: r.title || '', req: true, hint: '例如：2026-08 月度复盘' },
        { k: 'type', label: '复盘类型', type: 'select', opts: C.DICT.reviewType, val: r.type, req: true },
        { k: 'period', label: '复盘周期', val: r.period || '', req: true, hint: '月度填 2026-08，季度填 2026Q3，版本填版本号' },
        { k: 'lineId', label: '产品线', type: 'select', opts: [{ v: '', t: '全公司' }].concat(P.lineOpts()), val: r.lineId || '' },
        { k: 'owner', label: '复盘负责人', type: 'select', opts: P.memberNames(), val: r.owner },
        { k: 'date', label: '复盘日期', type: 'date', val: r.date },
        { k: 'goalRate', label: '目标完成率(%)', type: 'number', val: r.goalRate, req: true },
        { k: 'status', label: '状态', type: 'select', opts: ['进行中', '已完成'], val: r.status },
        { k: 'summary', label: '复盘结论', type: 'textarea', rows: 4, val: r.summary || '' }
      ],
      onSubmit: function (d) {
        d.goalRate = +d.goalRate || 0;
        if (isNew) {
          S.add('reviews', Object.assign({
            id: U.uid('RV'), goals: [], issues: [], causes: [], actions: []
          }, d));
          UI.toast('复盘已创建', 'done');
        } else {
          S.update('reviews', r.id, d);
          UI.toast('复盘已更新', 'done');
        }
        Shell.route();
      }
    });
  }

  /* 单份复盘报告 */
  function wordReview(r) {
    P.word('复盘报告-' + r.id, r.title, [
      {
        h: '一、复盘概要',
        kv: [['复盘编号', r.id], ['复盘类型', r.type], ['复盘周期', r.period],
        ['产品线', lineName(r)], ['负责人', r.owner], ['复盘日期', r.date],
        ['目标完成率', r.goalRate + '%'], ['状态', r.status]]
      },
      {
        h: '二、目标达成情况',
        table: P.wTable(
          [{ t: '目标', k: 'name' },
          { t: '目标值', get: function (g) { return g.target + g.unit; } },
          { t: '实际值', get: function (g) { return g.actual + g.unit; } },
          { t: '完成率', get: function (g) { return goalRate(g) + '%'; } },
          { t: '结论', get: function (g) { return goalRate(g) >= 100 ? '达成' : '未达成'; } }],
          r.goals || []
        )
      },
      { h: '三、本期问题', list: r.issues || [] },
      {
        h: '四、原因归因',
        table: P.wTable(
          [{ t: '问题', k: 'issue' }, { t: '归因类型', k: 'type' }, { t: '根本原因', k: 'cause' }],
          r.causes || []
        )
      },
      {
        h: '五、改进动作',
        table: P.wTable(
          [{ t: '改进事项', k: 'text' }, { t: '责任人', k: 'owner' }, { t: '截止时间', k: 'due' }, { t: '状态', k: 'status' }],
          r.actions || []
        )
      },
      { h: '六、复盘结论', p: r.summary }
    ]);
  }

  /* 汇总报告 */
  function wordSummary(rows, all) {
    var gs = allGoals(all), miss = gs.filter(function (g) { return g.rate < 100; });
    var cs = allCauses(all), acts = allActions(all);
    var openActs = acts.filter(function (a) { return ACT_CLOSED.indexOf(a.status) < 0; });
    P.word('经营复盘汇总', '经营复盘汇总', [
      {
        h: '一、总体情况',
        p: '当前口径共沉淀复盘 ' + all.length + ' 份，平均目标完成率 ' +
          (all.length ? Math.round(U.avg(all, 'goalRate')) : 0) + '%，' +
          '累计目标项 ' + gs.length + ' 个，其中未达成 ' + miss.length + ' 个；' +
          '改进动作 ' + acts.length + ' 项，尚未闭环 ' + openActs.length + ' 项。'
      },
      {
        h: '二、复盘记录',
        table: P.wTable(
          [{ t: '编号', k: 'id' }, { t: '主题', k: 'title' }, { t: '类型', k: 'type' },
          { t: '周期', k: 'period' }, { t: '产品线', get: function (r) { return lineName(r); } },
          { t: '完成率', get: function (r) { return r.goalRate + '%'; } }, { t: '状态', k: 'status' }],
          rows
        )
      },
      miss.length ? {
        h: '三、未达成目标',
        table: P.wTable(
          [{ t: '所属复盘', k: 'rvTitle' }, { t: '目标', k: 'name' },
          { t: '目标值', get: function (g) { return g.target + g.unit; } },
          { t: '实际值', get: function (g) { return g.actual + g.unit; } },
          { t: '完成率', get: function (g) { return g.rate + '%'; } }],
          miss
        )
      } : null,
      {
        h: '四、问题归因分布',
        table: P.wTable(
          [{ t: '归因类型', k: 't' }, { t: '问题数', k: 'n' }, { t: '占比', k: 'r' }, { t: '典型问题', k: 'top' }],
          CAUSE_TYPES.map(function (t) {
            var g2 = cs.filter(function (c2) { return c2.type === t; });
            return {
              t: t, n: g2.length, r: U.pctStr(g2.length, cs.length),
              top: U.uniq(g2.map(function (c2) { return c2.issue; })).slice(0, 3).join('、')
            };
          })
        )
      },
      openActs.length ? {
        h: '五、待闭环改进动作',
        table: P.wTable(
          [{ t: '改进事项', k: 'text' }, { t: '责任人', k: 'owner' }, { t: '截止时间', k: 'due' },
          { t: '状态', k: 'status' }, { t: '来源复盘', k: 'rvTitle' }],
          openActs
        )
      } : null
    ]);
  }

  /* ========================================================
     子页 2：目标完成率
     ======================================================== */
  function goal(ctx) {
    var all = S.reviews();
    var gs = allGoals(all);
    var f = P.flt(MOD, DEF_L);
    var rows = gs.filter(function (g) {
      if (f.kw && (g.name + g.rvTitle + g.line).toLowerCase().indexOf(f.kw.toLowerCase()) < 0) return false;
      return true;
    });

    var hit = gs.filter(function (g) { return g.rate >= 100; });
    var bad = gs.filter(function (g) { return g.rate < 70; });
    var avgR = gs.length ? Math.round(U.avg(gs, 'rate')) : 0;

    /* 按目标名称聚合 */
    var names = U.uniq(gs.map(function (g) { return g.name; }));
    var byName = names.map(function (n) {
      var g2 = gs.filter(function (x) { return x.name === n; });
      return {
        name: n, n: g2.length, avg: Math.round(U.avg(g2, 'rate')),
        hit: g2.filter(function (x) { return x.rate >= 100; }).length, items: g2
      };
    }).sort(function (a, b) { return a.avg - b.avg; });

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: '目标完成率', desc: '把各期复盘的目标项拉平对比，看清哪些目标长期达成、哪些反复掉队。',
        acts: '<button class="btn" id="glCsv">导出 CSV</button><button class="btn" id="glWord">导出 Word</button>'
      }) +
      P.permTip(MOD) +
      P.statCards([
        { label: '目标项总数', val: gs.length, unit: '个', ico: '◈', sub: '来自 ' + all.length + ' 份复盘' },
        { label: '达成目标', val: hit.length, unit: '个', ico: '✓', tone: 'done', sub: '达成率 ' + U.pctStr(hit.length, gs.length) },
        { label: '平均完成率', val: avgR, unit: '%', ico: '◐', tone: rateTone(avgR), sub: '全部目标项加总平均' },
        { label: '严重未达成', val: bad.length, unit: '个', ico: '⚠', tone: bad.length ? 'danger' : 'done', sub: '完成率低于 70%' }
      ]) + P.gap(4) +
      UI.grid(2,
        UI.card({ title: '各目标平均完成率', sub: '由低到高排列，靠前的是长期短板', ico: '▤', body: P.chart('glRank', 300) }) +
        UI.card({ title: '各期完成率走势', sub: '按复盘周期看目标完成率的变化', ico: '◈', body: P.chart('glTrend', 300) })
      ) + P.gap(4) +
      UI.card({
        flush: true, title: '目标明细', ico: '◫', sub: '共 ' + rows.length + ' 项',
        body:
          '<div class="toolbar" id="glFlt">' +
          '<input class="fld grow" type="text" data-f="kw" placeholder="搜索目标名称 / 复盘主题…" value="' + E(f.kw) + '">' +
          '<button class="btn-sm" data-reset>重置</button>' +
          '</div>' +
          '<div id="glTbl"></div>'
      });

    CH.bars('glRank', {
      data: byName.map(function (x) {
        return {
          label: x.name, value: x.avg, text: x.avg + '%（达成 ' + x.hit + '/' + x.n + '）',
          color: x.avg >= 100 ? CH.TONE.done : (x.avg >= 85 ? CH.TONE.doing : (x.avg >= 70 ? CH.TONE.warn : CH.TONE.danger)),
          target: 100
        };
      }),
      max: 120,
      onClick: function (i) { P.setFlt(MOD, { kw: byName[i].name }); Shell.route(); }
    });

    var byDate = all.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    CH.line('glTrend', {
      labels: byDate.map(function (r) { return r.period; }),
      series: names.slice(0, 4).map(function (n, i) {
        return {
          name: n,
          data: byDate.map(function (r) {
            var g = (r.goals || []).filter(function (x) { return x.name === n; })[0];
            return g ? goalRate(g) : 0;
          }),
          color: CH.PAL[i % CH.PAL.length]
        };
      }),
      height: 270, legend: true, min: 0, yFmt: function (v) { return v + '%'; }
    });

    UI.table('#glTbl', {
      rows: rows, pageSize: 15, sort: { k: 'rate', desc: false },
      onRow: function (r) { var rv = S.DB.reviews.filter(function (x) { return x.id === r.rvId; })[0]; if (rv) openRv(rv); },
      rowCls: function (r) { return r.rate < 70 ? 'row-danger' : (r.rate < 100 ? 'row-warn' : ''); },
      cols: [
        { t: '所属复盘', k: 'rvTitle', w: '190px', render: function (r) { return UI.cell2(E(r.rvTitle), r.period + ' · ' + r.line); } },
        { t: '目标', k: 'name', w: '150px', render: function (r) { return E(r.name) + (r.lowerBetter ? ' <span class="muted tiny">越低越好</span>' : ''); } },
        { t: '目标值', k: 'target', w: '96px', align: 'right', render: function (r) { return r.target + r.unit; } },
        { t: '实际值', k: 'actual', w: '96px', align: 'right', render: function (r) { return r.actual + r.unit; } },
        {
          t: '完成率', k: 'rate', w: '170px',
          render: function (r) { return UI.pcell(Math.min(r.rate, 120), rateTone(r.rate)); }
        },
        {
          t: '差距', k: '', w: '110px', align: 'right', sortable: false,
          render: function (r) {
            var d = r.lowerBetter ? r.target - r.actual : r.actual - r.target;
            if (d >= 0) return '<span class="c-done">+' + U.fmtNum(d) + r.unit + '</span>';
            return '<b class="c-danger">' + U.fmtNum(d) + r.unit + '</b>';
          }
        },
        {
          t: '结论', k: '', w: '90px', sortable: false,
          render: function (r) { return r.rate >= 100 ? UI.tag('达成', 'done') : UI.tag('未达成', 'danger'); }
        }
      ]
    });

    P.bindFlt(P.$('glFlt'), MOD, DEF_L);
    P.$('glCsv').onclick = function () {
      P.csv('目标完成率', rows, [
        { label: '所属复盘', key: 'rvTitle' }, { label: '周期', key: 'period' },
        { label: '产品线', key: 'line' }, { label: '目标', key: 'name' },
        { label: '目标值', get: function (r) { return r.target + r.unit; } },
        { label: '实际值', get: function (r) { return r.actual + r.unit; } },
        { label: '完成率', get: function (r) { return r.rate + '%'; } }
      ]);
    };
    P.$('glWord').onclick = function () {
      P.word('目标完成率分析', '目标完成率分析', [
        {
          h: '一、总体结论',
          kv: [['数据口径', P.scopeText()], ['目标项总数', gs.length + ' 个'],
          ['达成目标', hit.length + ' 个（' + U.pctStr(hit.length, gs.length) + '）'],
          ['平均完成率', avgR + '%'], ['严重未达成', bad.length + ' 个']]
        },
        {
          h: '二、按目标汇总',
          table: P.wTable(
            [{ t: '目标', k: 'name' }, { t: '出现次数', k: 'n' },
            { t: '平均完成率', get: function (x) { return x.avg + '%'; } },
            { t: '达成次数', get: function (x) { return x.hit + '/' + x.n; } }],
            byName
          )
        },
        {
          h: '三、目标明细',
          table: P.wTable(
            [{ t: '复盘', k: 'rvTitle' }, { t: '目标', k: 'name' },
            { t: '目标值', get: function (r) { return r.target + r.unit; } },
            { t: '实际值', get: function (r) { return r.actual + r.unit; } },
            { t: '完成率', get: function (r) { return r.rate + '%'; } }],
            rows
          )
        },
        bad.length ? {
          h: '四、需要重点改进的目标',
          list: bad.map(function (g) {
            return g.rvTitle + ' 的「' + g.name + '」目标 ' + g.target + g.unit + '，实际 ' +
              g.actual + g.unit + '，完成率仅 ' + g.rate + '%，建议在下期复盘中列为重点跟踪项。';
          })
        } : null
      ]);
    };
  }

  /* ========================================================
     子页 3：问题归因与改进
     ======================================================== */
  function cause(ctx) {
    var all = S.reviews();
    var cs = allCauses(all), acts = allActions(all);
    var f = P.flt(MOD, DEF_L);

    var rows = cs.filter(function (c2) {
      if (f.type && c2.type !== f.type) return false;
      if (f.kw && (c2.issue + c2.cause + c2.rvTitle).toLowerCase().indexOf(f.kw.toLowerCase()) < 0) return false;
      return true;
    });

    var closed = acts.filter(function (a) { return ACT_CLOSED.indexOf(a.status) < 0 ? false : true; });
    var overdue = acts.filter(function (a) { return a.overdue; });
    var issues = U.uniq(cs.map(function (c2) { return c2.issue; }));

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: '问题归因与改进', desc: '把复盘中的问题按流程 / 协同 / 资源三类归因，并跟踪每项改进动作的闭环情况。',
        acts: '<button class="btn" id="csWord">导出 Word</button>'
      }) +
      P.permTip(MOD) +
      P.statCards([
        { label: '归因条目', val: cs.length, unit: '条', ico: '◆', sub: '覆盖 ' + issues.length + ' 类问题' },
        { label: '改进动作', val: acts.length, unit: '项', ico: '⚑', sub: '来自 ' + all.length + ' 份复盘' },
        { label: '改进闭环率', val: U.pct(closed.length, acts.length), unit: '%', ico: '◑', tone: rateTone(U.pct(closed.length, acts.length)), sub: '已完成 ' + closed.length + ' 项' },
        { label: '逾期改进项', val: overdue.length, unit: '项', ico: '⚠', tone: overdue.length ? 'danger' : 'done', sub: overdue.length ? '需要立即推动' : '改进推进正常' }
      ]) + P.gap(4) +
      UI.grid(2,
        UI.card({ title: '归因类型分布', sub: '点击可筛选该类型的问题', ico: '◔', body: P.chart('csType', 300) }) +
        UI.card({ title: '高频问题排行', sub: '同一问题在多期复盘中重复出现，说明尚未根治', ico: '▤', body: P.chart('csTop', 300) })
      ) + P.gap(4) +
      UI.card({
        flush: true, title: '问题与根因', ico: '◫', sub: '共 ' + rows.length + ' 条',
        body:
          '<div class="toolbar" id="csFlt">' +
          '<input class="fld grow" type="text" data-f="kw" placeholder="搜索问题 / 根因 / 复盘…" value="' + E(f.kw) + '">' +
          P.sel('type', '全部归因类型', CAUSE_TYPES, f.type) +
          '<button class="btn-sm" data-reset>重置</button>' +
          '</div>' +
          '<div id="csTbl"></div>'
      }) + P.gap(4) +
      UI.card({
        flush: true, title: '改进动作跟踪', ico: '⚑',
        sub: '共 ' + acts.length + ' 项，未闭环 ' + (acts.length - closed.length) + ' 项',
        body: '<div id="csActTbl"></div>'
      });

    CH.donut('csType', {
      data: CAUSE_TYPES.map(function (t) {
        return { name: t, value: cs.filter(function (c2) { return c2.type === t; }).length, color: CAUSE_TONE[t] };
      }).filter(function (x) { return x.value; }),
      height: 270, inner: 56, center: { v: cs.length, l: '归因条目' }, legendSide: true,
      onClick: function (i, d) { P.setFlt(MOD, { type: d.name }); Shell.route(); }
    });

    var issueRank = issues.map(function (n) {
      var g2 = cs.filter(function (c2) { return c2.issue === n; });
      return { name: n, n: g2.length, type: g2[0].type };
    }).sort(function (a, b) { return b.n - a.n; }).slice(0, 10);
    CH.bars('csTop', {
      data: issueRank.map(function (x) {
        return { label: x.name, value: x.n, text: x.n + ' 次（' + x.type + '）', color: CAUSE_TONE[x.type] };
      }),
      onClick: function (i) { P.setFlt(MOD, { kw: issueRank[i].name }); Shell.route(); }
    });

    UI.table('#csTbl', {
      rows: rows, pageSize: 12, sort: { k: 'type', desc: false },
      onRow: function (r) { var rv = S.DB.reviews.filter(function (x) { return x.id === r.rvId; })[0]; if (rv) openRv(rv); },
      cols: [
        { t: '问题', k: 'issue', w: '150px' },
        {
          t: '归因类型', k: 'type', w: '110px',
          render: function (r) { return UI.tag(r.type, r.type === '资源' ? 'danger' : (r.type === '协同' ? 'warn' : 'doing')); }
        },
        { t: '根本原因', k: 'cause' },
        { t: '来源复盘', k: 'rvTitle', w: '190px', render: function (r) { return UI.cell2(E(r.rvTitle), r.period + ' · ' + r.line); } }
      ]
    });

    UI.table('#csActTbl', {
      rows: acts, pageSize: 10, sort: { k: 'due', desc: false },
      rowCls: function (r) { return r.overdue ? 'row-danger' : (ACT_CLOSED.indexOf(r.status) >= 0 ? 'row-done' : ''); },
      onRow: function (r) { var rv = S.DB.reviews.filter(function (x) { return x.id === r.rvId; })[0]; if (rv) openRv(rv); },
      cols: [
        { t: '改进事项', k: 'text' },
        { t: '责任人', k: 'owner', w: '120px', render: function (r) { return UI.owner(r.owner); } },
        { t: '截止时间', k: 'due', w: '150px', render: function (r) { return UI.due(r.due); } },
        { t: '状态', k: 'status', w: '96px', render: function (r) { return UI.st('status', r.status); } },
        { t: '来源复盘', k: 'rvTitle', w: '190px' }
      ]
    });

    P.bindFlt(P.$('csFlt'), MOD, DEF_L);
    P.$('csWord').onclick = function () {
      P.word('问题归因与改进', '问题归因与改进跟踪', [
        {
          h: '一、总体情况',
          p: '当前口径共梳理归因条目 ' + cs.length + ' 条，覆盖 ' + issues.length + ' 类问题；' +
            '配套改进动作 ' + acts.length + ' 项，已闭环 ' + closed.length + ' 项（闭环率 ' +
            U.pctStr(closed.length, acts.length) + '），逾期 ' + overdue.length + ' 项。'
        },
        {
          h: '二、归因类型分布',
          table: P.wTable(
            [{ t: '归因类型', k: 't' }, { t: '条目数', k: 'n' }, { t: '占比', k: 'r' }, { t: '典型问题', k: 'top' }],
            CAUSE_TYPES.map(function (t) {
              var g2 = cs.filter(function (c2) { return c2.type === t; });
              return {
                t: t, n: g2.length, r: U.pctStr(g2.length, cs.length),
                top: U.uniq(g2.map(function (c2) { return c2.issue; })).join('、')
              };
            })
          )
        },
        {
          h: '三、高频问题',
          table: P.wTable(
            [{ t: '问题', k: 'name' }, { t: '出现次数', k: 'n' }, { t: '归因类型', k: 'type' }],
            issueRank
          )
        },
        {
          h: '四、问题与根因明细',
          table: P.wTable(
            [{ t: '问题', k: 'issue' }, { t: '归因类型', k: 'type' }, { t: '根本原因', k: 'cause' }, { t: '来源复盘', k: 'rvTitle' }],
            rows
          )
        },
        {
          h: '五、改进动作跟踪',
          table: P.wTable(
            [{ t: '改进事项', k: 'text' }, { t: '责任人', k: 'owner' }, { t: '截止时间', k: 'due' },
            { t: '状态', k: 'status' }, { t: '来源复盘', k: 'rvTitle' }],
            acts
          )
        },
        overdue.length ? {
          h: '六、逾期改进项',
          list: overdue.map(function (a) {
            return a.text + '（责任人 ' + a.owner + '，应于 ' + a.due + ' 完成，当前 ' + a.status + '），来源：' + a.rvTitle + '。';
          })
        } : null
      ]);
    };
  }

  /* ======================================================== */
  Shell.page(MOD, {
    render: function (ctx) {
      if (ctx.sub === 'goal') goal(ctx);
      else if (ctx.sub === 'cause') cause(ctx);
      else reviewList(ctx);
    }
  });
})();
