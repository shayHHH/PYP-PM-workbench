/* ============================================================
 * 13-analytics.js  数据分析
 * 子页：kpi 核心指标看板 / trend 趋势分析 / funnel 漏斗与转化 / retention 留存分析
 * 角色差异：总监 = 全量经营指标，按产品线维度聚合
 *           项目经理 = 口径收敛到当前项目，经营级指标隐藏，按版本维度看
 * ========================================================== */
(function () {
  'use strict';
  var E = U.esc, MOD = 'analytics';

  /* 经营级指标（PM 不可见）/ 交付质量类指标（两角色都看） */
  var BIZ_KEYS = ['arr', 'mau', 'renew', 'nps', 'ticket', 'sla'];
  var PM_KEYS = ['nps', 'ticket', 'sla'];
  var LINE_COLORS = ['#4f46e5', '#0891b2', '#16a34a', '#d97706', '#dc2626', '#7c3aed'];

  var DEF = { range: '12', dim: '', metric: 'arr', line: '' };

  function scoped() { return C.permOf(MOD, S.role()) === 'scoped'; }
  function keys() { return scoped() ? PM_KEYS : BIZ_KEYS; }
  function dimOf(f) { return f.dim || C.viewOf(S.role(), MOD).dim || 'line'; }
  function mt(key, lineId) { return S.metric(key, lineId === undefined ? '' : lineId); }
  function tone(good, mid) { return good ? 'done' : (mid ? 'warn' : 'danger'); }
  function colored(txt, cssVar) { return '<b style="color:var(--s-' + cssVar + ')">' + E(txt) + '</b>'; }

  function tail(series, n) {
    n = U.num(n, 12);
    series = series || [];          /* 指标存在但某条产品线没数据时，series 是 undefined */
    return series.slice(Math.max(0, series.length - n));
  }
  /* 安全取某个指标的序列：指标记录可能压根不存在（用户只录了别的指标），
     直接 mt(...).series 会抛 "Cannot read properties of undefined"。 */
  function ser(key, lineId) { return (mt(key, lineId) || {}).series || []; }
  function fmtVal(m, v) {
    if (!m) return '—';
    if (m.fmt === 'p') return (Math.round(v * 10) / 10) + '%';
    if (m.fmt === 'k') return U.kmb(v);
    return U.fmtNum(v);
  }
  /* 指标当前值 / 环比 / 达标情况 */
  function stat(key, lineId, n) {
    var m = mt(key, lineId);
    if (!m) return null;
    var s = tail(m.series, n);
    var cur = s.length ? s[s.length - 1].value : 0;
    var prev = s.length > 1 ? s[s.length - 2].value : 0;
    return {
      m: m, series: s, cur: cur, prev: prev, delta: U.delta(cur, prev),
      reach: m.lowerBetter ? (cur <= m.target) : (cur >= m.target),
      gap: m.lowerBetter ? (m.target - cur) : (cur - m.target),
      rate: m.lowerBetter ? U.pct(m.target, cur || 1) : U.pct(cur, m.target)
    };
  }
  /* 总监：可自由切换产品线口径。
     PM：产品线选择器不出现，口径固定收敛到「当前项目所属产品线」——
     指标序列只按 lineId 分桶（无项目级序列），这是数据模型下最贴近本项目的口径；
     若该产品线缺该指标，S.metric 会回落到全局序列。 */
  function curLineId(f) {
    if (!S.isDirector()) {
      var p = S.curProject();
      return (p && p.lineId) || '';
    }
    return f.line || S.state.lineId || '';
  }

  /* ============================================================
   * 子页 1：核心指标看板
   * ========================================================== */
  function kpi(ctx) {
    var f = P.flt(MOD, DEF);
    var ks = keys(), lineId = curLineId(f);
    var sts = ks.map(function (k) { return stat(k, lineId, f.range); }).filter(Boolean);

    var cards = sts.map(function (st) {
      return UI.metric({
        label: st.m.name, val: fmtVal(st.m, st.cur), unit: st.m.unit === '%' ? '' : st.m.unit,
        ico: '◔', tone: st.reach ? 'done' : (st.rate >= 90 ? 'warn' : 'danger'),
        sub: '目标 ' + fmtVal(st.m, st.m.target),
        sub2: st.reach ? '已达标' : '达成 ' + st.rate + '%',
        delta: st.delta, reverse: !!st.m.lowerBetter,
        spark: st.series.map(function (x) { return x.value; }),
        sparkColor: st.reach ? CH.TONE.done : CH.TONE.warn
      });
    }).join('');

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: '核心指标看板',
        desc: P.scopeText() + '　·　近 ' + f.range + ' 周　·　周粒度采集，最新一周为当前值',
        acts: UI.exportMenu({ word: true })
      }) +
      P.permTip(MOD) +
      '<div class="toolbar" id="anFlt" style="border:1px solid var(--c-border);border-radius:var(--radius-lg)">' +
      fltBar(f, { line: S.isDirector() }) + '</div>' + P.gap(4) +
      (scoped()
        ? UI.notice('info', '当前为<b>项目经理</b>口径：仅展示与交付质量直接相关的指标（NPS / 工单量 / 可用性），ARR、MAU、续约率等经营指标需切换到产品总监视角查看。') + P.gap(4)
        : '') +
      UI.grid(3, cards) + P.gap(4) +
      UI.grid(2,
        UI.card({
          title: '指标达成对比', sub: '当前值相对目标的达成率，竖线为 100% 目标位', ico: '▤',
          body: P.chart('kpiBars')
        }) +
        UI.card({
          title: scoped() ? '本项目交付概览' : '各产品线 ARR 走势',
          sub: scoped() ? '版本与需求交付口径' : '点击图例可切换显示的产品线', ico: '◍',
          body: scoped() ? deliverPanel() : P.chart('kpiLine', 250)
        })
      ) + P.gap(4) +
      UI.card({
        title: '指标明细', sub: '点击任意行跳转到该指标的趋势分析', ico: '≣', flush: true,
        body: '<div id="kpiTbl"></div>'
      });

    CH.bars('kpiBars', {
      data: sts.map(function (st) {
        return {
          label: st.m.name.split(' ')[0],
          value: U.clamp(st.rate, 0, 130),
          color: st.reach ? CH.TONE.done : (st.rate >= 90 ? CH.TONE.warn : CH.TONE.danger),
          target: 100,
          text: fmtVal(st.m, st.cur) + ' / ' + fmtVal(st.m, st.m.target)
        };
      }),
      max: 130,
      onClick: function (i) { goTrend(sts[i].m.key); }
    });

    if (!scoped()) {
      var ls = S.linesInScope();
      CH.line('kpiLine', {
        labels: tail(ser('arr', ''), f.range).map(function (x) { return U.fmtMD(x.date); }),
        series: ls.map(function (l, i) {
          return {
            name: l.name, color: LINE_COLORS[i % LINE_COLORS.length],
            data: tail(ser('arr', l.id), f.range).map(function (x) { return x.value; })
          };
        }),
        height: 250, legend: true, xEvery: 3,
        yFmt: function (v) { return U.kmb(v); }
      });
    }

    UI.table('#kpiTbl', {
      cols: [
        { k: 'name', t: '指标', w: 210, sortable: true, render: function (r) { return UI.cell2(r.name, r.key.toUpperCase() + (r.lowerBetter ? ' · 越低越好' : ' · 越高越好')); } },
        { k: 'cur', t: '当前值', align: 'right', sortable: true, render: function (r) { return '<b>' + fmtVal(r._m, r.cur) + '</b><div class="cell-sub">' + E(r._m.unit || '—') + '</div>'; } },
        { k: 'target', t: '目标值', align: 'right', render: function (r) { return fmtVal(r._m, r.target); } },
        { k: 'rate', t: '达成率', w: 140, sortable: true, render: function (r) { return UI.pcell(U.clamp(r.rate, 0, 200), r.reach ? 'done' : (r.rate >= 90 ? 'warn' : 'danger')); } },
        { k: 'wow', t: '周环比', w: 100, align: 'right', render: function (r) { return UI.trend(r.delta, { reverse: r.lowerBetter }); } },
        { k: 'spark', t: '近期走势', w: 130, render: function (r) { return CH.sparkSVG(r.sp, { w: 110, h: 26, color: r.reach ? CH.TONE.done : CH.TONE.warn, area: true }); } },
        { k: 'st', t: '判定', w: 90, render: function (r) { return r.reach ? UI.tag('已达标', 'done') : UI.tag('未达标', r.rate >= 90 ? 'warn' : 'danger'); } }
      ],
      rows: sts.map(function (st) {
        return {
          key: st.m.key, name: st.m.name, cur: st.cur, target: st.m.target, rate: st.rate,
          reach: st.reach, delta: st.delta, lowerBetter: st.m.lowerBetter,
          sp: st.series.map(function (x) { return x.value; }), _m: st.m
        };
      }),
      compact: true, empty: '当前角色下暂无可见指标',
      onRow: function (r) { goTrend(r.key); }
    });

    bindFlt(ctx);
    UI.bindExport(ctx.el, {
      csv: function () {
        P.csv('核心指标看板', sts, [
          { label: '指标', get: function (r) { return r.m.name; } },
          { label: '单位', get: function (r) { return r.m.unit; } },
          { label: '当前值', get: function (r) { return r.cur; } },
          { label: '目标值', get: function (r) { return r.m.target; } },
          { label: '达成率(%)', get: function (r) { return r.rate; } },
          { label: '周环比', get: function (r) { return r.delta.text; } },
          { label: '是否达标', get: function (r) { return r.reach ? '是' : '否'; } }
        ]);
      },
      word: function () {
        var miss = sts.filter(function (r) { return !r.reach; });
        P.word('核心指标看板', '核心指标看板报告', [
          { h: '一、指标总览', p: '统计口径：' + P.scopeText() + '；时间范围：近 ' + f.range + ' 周；共 ' + sts.length + ' 项指标，达标 ' + (sts.length - miss.length) + ' 项。' },
          {
            table: {
              cols: [
                { t: '指标', get: function (r) { return r.m.name; } },
                { t: '当前值', get: function (r) { return fmtVal(r.m, r.cur) + r.m.unit; } },
                { t: '目标值', get: function (r) { return fmtVal(r.m, r.m.target) + r.m.unit; } },
                { t: '达成率', get: function (r) { return r.rate + '%'; } },
                { t: '周环比', get: function (r) { return r.delta.text; } },
                { t: '结论', get: function (r) { return r.reach ? '已达标' : '未达标'; } }
              ], rows: sts
            }
          },
          {
            h: '二、需重点关注的指标',
            list: miss.length ? miss.map(function (r) {
              return r.m.name + '：当前 ' + fmtVal(r.m, r.cur) + r.m.unit + '，距目标还差 ' +
                fmtVal(r.m, Math.abs(r.gap)) + r.m.unit + '，达成率 ' + r.rate + '%。';
            }) : ['全部指标均已达标，保持当前节奏并持续监控。']
          }
        ]);
      }
    });
  }

  function goTrend(key) {
    var f = P.flt(MOD, DEF);
    f.metric = key;
    P.setFlt(MOD, f);
    Shell.go(MOD, 'trend');
  }

  /* PM 口径的交付概览 */
  function deliverPanel() {
    var rs = S.rels('project'), qs = S.reqs('project');
    var online = qs.filter(function (q) { return q.status === '已上线'; });
    var bug = U.sum(rs, 'bugCount');
    var ot = S.releaseOnTime('project');
    return UI.dl([
      ['关联版本数', rs.length + ' 个'],
      ['已发布版本', rs.filter(function (x) { return x.status === '已发布'; }).length + ' 个'],
      ['版本按期率', ot.rate + '%（' + ot.ok + '/' + ot.total + '）'],
      ['关联需求数', qs.length + ' 条'],
      ['已上线需求', online.length + ' 条'],
      ['需求上线率', U.pctStr(online.length, qs.length)],
      ['累计缺陷数', bug + ' 个'],
      ['需求缺陷比', qs.length ? (bug / qs.length).toFixed(1) + ' 个/条' : '—']
    ], 'dl-2col');
  }

  /* ============================================================
   * 子页 2：趋势分析
   * ========================================================== */
  function trend(ctx) {
    var f = P.flt(MOD, DEF);
    var ks = keys();
    if (ks.indexOf(f.metric) < 0) f.metric = ks[0];
    var dim = dimOf(f);
    if (!S.isDirector() && dim === 'line') dim = 'release';
    var lineId = dim === 'line' ? '' : curLineId(f);

    /* 库里有指标、但未必有「当前选中的这一个」——比如只录了 NPS 却切到了 ARR。
       先在有数据的 key 里回落一次，实在一个都没有再给空态，不能直接 st.series 崩掉。 */
    var st = stat(f.metric, lineId, f.range);
    if (!st) {
      var alt = ks.filter(function (k) { return !!mt(k, lineId); })[0];
      if (alt) { f.metric = alt; P.setFlt(MOD, f); st = stat(alt, lineId, f.range); }
    }
    if (!st) {
      ctx.el.innerHTML = P.head({ mod: MOD, title: '趋势分析', desc: P.scopeText() }) +
        UI.notice('info', '当前口径下还没有可用的指标序列。' +
          '可能是这条产品线还没录指标数据，或录的指标不在当前角色可见范围内——' +
          '换一条产品线，或到「核心指标看板」先录一条。') +
        P.gap(4) + P.emptyMod('当前口径下没有指标数据');
      return;
    }
    var s = st.series;
    var labels = s.map(function (x) { return U.fmtMD(x.date); });

    var series = [], note = '';
    if (dim === 'line') {
      var ls = S.linesInScope();
      series = ls.map(function (l, i) {
        return {
          name: l.name, color: LINE_COLORS[i % LINE_COLORS.length],
          data: tail(ser(f.metric, l.id), f.range).map(function (x) { return x.value; })
        };
      });
      note = '按产品线拆分，共 ' + ls.length + ' 条线';
    } else {
      series = [{ name: st.m.name, data: s.map(function (x) { return x.value; }), color: CH.TONE.accent, area: true }];
      note = dim === 'release' ? '版本维度：图中竖虚线为版本实际上线时间点' : '全量汇总口径';
    }

    /* 版本上线标记 */
    var marks = [];
    if (dim === 'release') {
      var from = s[0].date;
      S.rels().filter(function (r) { return r.realDate && r.realDate >= from; }).slice(0, 8).forEach(function (r) {
        var idx = -1, best = 1e9;
        s.forEach(function (p, i) {
          var d = Math.abs(U.dayDiff(p.date, r.realDate));
          if (d < best) { best = d; idx = i; }
        });
        if (idx >= 0) marks.push({ x: idx, label: r.name, color: CH.TONE.doing });
      });
    }

    var first = s[0].value, last = s[s.length - 1].value;
    var maxP = s.reduce(function (a, b) { return b.value > a.value ? b : a; }, s[0]);
    var minP = s.reduce(function (a, b) { return b.value < a.value ? b : a; }, s[0]);
    var rangeGood = st.m.lowerBetter ? last < first : last > first;
    var wow = s.map(function (p, i) { return i === 0 ? 0 : U.num(U.delta(p.value, s[i - 1].value).v); });

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: '趋势分析',
        desc: st.m.name + '　·　近 ' + f.range + ' 周　·　' + note,
        acts: UI.exportMenu({ word: true })
      }) +
      P.permTip(MOD) +
      '<div class="toolbar" id="anFlt" style="border:1px solid var(--c-border);border-radius:var(--radius-lg)">' +
      fltBar(f, { line: S.isDirector() && dim !== 'line', metric: true, dim: true }) + '</div>' + P.gap(4) +
      P.statCards([
        {
          label: '当前值', val: fmtVal(st.m, last), unit: st.m.unit === '%' ? '' : st.m.unit, ico: '◉',
          tone: st.reach ? 'done' : 'warn', delta: st.delta, reverse: !!st.m.lowerBetter,
          sub: '目标 ' + fmtVal(st.m, st.m.target)
        },
        {
          label: '区间累计变化', val: U.delta(last, first).text, ico: '↗',
          tone: rangeGood ? 'done' : 'danger',
          sub: fmtVal(st.m, first) + ' → ' + fmtVal(st.m, last)
        },
        { label: '区间峰值', val: fmtVal(st.m, maxP.value), ico: '▲', tone: 'doing', sub: U.fmtMD(maxP.date) + ' 当周' },
        { label: '区间谷值', val: fmtVal(st.m, minP.value), ico: '▼', tone: 'plan', sub: U.fmtMD(minP.date) + ' 当周' }
      ]) + P.gap(4) +
      UI.card({
        title: st.m.name + ' 走势', sub: '点击折线上的数据点查看当周各维度数值', ico: '◔',
        extra: UI.chips([{ key: '12', label: '近12周' }, { key: '18', label: '近18周' }, { key: '26', label: '近26周' }], f.range, 'range'),
        body: P.chart('trLine', 300)
      }) + P.gap(4) +
      UI.grid(2,
        UI.card({ title: '周环比波动', sub: '相邻两周变化幅度（%），0 轴上下摆动越小越稳定', ico: '▥', body: P.chart('trWow', 230) }) +
        UI.card({ title: '周度明细', sub: '最近 12 周原始数值与距目标差额', ico: '≣', flush: true, body: '<div id="trTbl"></div>' })
      );

    CH.line('trLine', {
      labels: labels, series: series, height: 300, legend: series.length > 1,
      xEvery: 3, dot: true, mark: marks,
      yFmt: function (v) { return st.m.fmt === 'p' ? v + '%' : U.kmb(v); },
      onClick: function (i, label) {
        UI.toast(label + ' 当周　' + series.map(function (x) { return x.name + ' ' + fmtVal(st.m, x.data[i]); }).join('　·　'));
      }
    });

    CH.line('trWow', {
      labels: labels, height: 230, xEvery: 3, dot: true,
      series: [{ name: '周环比', data: wow, color: CH.TONE.doing, area: true }],
      yFmt: function (v) { return v + '%'; }
    });

    UI.table('#trTbl', {
      cols: [
        { k: 'date', t: '周次', w: 90, render: function (r) { return U.fmtMD(r.date); } },
        { k: 'value', t: '数值', align: 'right', render: function (r) { return '<b>' + fmtVal(st.m, r.value) + '</b>'; } },
        {
          k: 'wow', t: '环比', w: 90, align: 'right',
          render: function (r) { return r.i === 0 ? '<span class="muted">—</span>' : UI.trend(U.delta(r.value, s[r.i - 1].value), { reverse: !!st.m.lowerBetter }); }
        },
        {
          k: 'gap', t: '距目标', w: 110, align: 'right',
          render: function (r) {
            var g = st.m.lowerBetter ? (st.m.target - r.value) : (r.value - st.m.target);
            return colored((g >= 0 ? '+' : '') + fmtVal(st.m, g), g >= 0 ? 'done' : 'danger');
          }
        }
      ],
      rows: s.map(function (x, i) { return { date: x.date, value: x.value, i: i }; }).slice(-12).reverse(),
      compact: true, maxH: 288, pageSize: 12
    });

    bindFlt(ctx);
    UI.bindExport(ctx.el, {
      csv: function () {
        P.csv(st.m.name + '_趋势', s, [
          { label: '周次', key: 'date' },
          { label: st.m.name + (st.m.unit ? '(' + st.m.unit + ')' : ''), key: 'value' }
        ]);
      },
      word: function () {
        P.word(st.m.name + '_趋势分析', st.m.name + ' 趋势分析', [
          {
            h: '一、结论摘要',
            list: [
              '统计区间：近 ' + f.range + ' 周（' + U.fmtMD(s[0].date) + ' ~ ' + U.fmtMD(s[s.length - 1].date) + '）。',
              '当前值 ' + fmtVal(st.m, last) + st.m.unit + '，目标 ' + fmtVal(st.m, st.m.target) + st.m.unit + '，' +
              (st.reach ? '已达标。' : '尚未达标，达成率 ' + st.rate + '%。'),
              '区间累计变化 ' + U.delta(last, first).text + '，' + (rangeGood ? '方向符合预期。' : '方向不利，需要干预。'),
              '峰值 ' + fmtVal(st.m, maxP.value) + '（' + U.fmtMD(maxP.date) + '），谷值 ' + fmtVal(st.m, minP.value) + '（' + U.fmtMD(minP.date) + '）。'
            ]
          },
          {
            h: '二、周度明细',
            table: {
              cols: [
                { t: '周次', get: function (r) { return U.fmtMD(r.date); } },
                { t: '数值', get: function (r) { return fmtVal(st.m, r.value) + st.m.unit; } }
              ], rows: s.slice().reverse()
            }
          }
        ], ['分析维度：' + (dim === 'line' ? '产品线' : dim === 'release' ? '版本节点' : '全量汇总')]);
      }
    });
  }

  /* ============================================================
   * 子页 3：漏斗与转化
   * ========================================================== */
  function funnelPage(ctx) {
    var raw = S.DB.funnel;
    var steps = raw.map(function (x, i) {
      var prev = i === 0 ? x.value : raw[i - 1].value;
      return {
        name: x.name, value: x.value,
        rate: i === 0 ? 100 : U.pct(x.value, prev, 1),
        allRate: U.pct(x.value, raw[0].value, 2),
        lost: i === 0 ? 0 : prev - x.value
      };
    });
    var worst = steps.slice(1).reduce(function (a, b) { return b.rate < a.rate ? b : a; }, steps[1]);
    var payRate = steps[4] ? steps[4].allRate : 0;
    var flow = S.reqFlow();
    var hotIdx = 0, hotV = -1;
    flow.steps.forEach(function (x, i) { if (x.value > hotV) { hotV = x.value; hotIdx = i; } });

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: '漏斗与转化',
        desc: '业务转化漏斗（用户侧）与需求流转漏斗（交付侧）对照分析　·　' + P.scopeText(),
        acts: UI.exportMenu({ word: true })
      }) +
      P.permTip(MOD) +
      P.statCards([
        { label: '漏斗入口量', val: U.kmb(steps[0].value), ico: '⇥', tone: 'doing', sub: steps[0].name },
        { label: '整体付费转化', val: payRate + '%', ico: '◎', tone: tone(payRate >= 5, payRate >= 3), sub: '访问 → 付费转化' },
        { label: '最大流失环节', val: worst.name, ico: '⚠', tone: 'warn', sub: '通过率 ' + worst.rate + '% · 流失 ' + U.kmb(worst.lost) },
        { label: '需求平均周期', val: flow.avgCycle, unit: '天', ico: '↻', tone: 'plan', sub: '近 30 天上线 ' + flow.throughput + ' 条' }
      ]) + P.gap(4) +
      UI.grid(2,
        UI.card({ title: '业务转化漏斗', sub: '点击任一层查看该层转化明细与优化建议', ico: '▽', body: P.chart('fnMain', 330) }) +
        UI.card({ title: '逐层转化率', sub: '相对上一层的通过率，绿=健康 / 橙=可优化 / 红=重点流失', ico: '▤', body: P.chart('fnRate', 330) })
      ) + P.gap(4) +
      UI.card({
        title: '需求流转漏斗（交付侧）',
        sub: '需求从评审到上线各阶段的在途量，堆积最多的阶段即当前交付瓶颈；点击阶段跳转需求池',
        ico: '⇉', extra: UI.tag('共 ' + flow.total + ' 条需求', 'plan'),
        body: P.chart('fnFlow')
      }) + P.gap(4) +
      UI.card({ title: '漏斗明细', sub: '含流失量与流失率判定', ico: '≣', flush: true, body: '<div id="fnTbl"></div>' });

    CH.funnel('fnMain', {
      data: steps.map(function (s, i) {
        return { name: s.name, value: s.value, color: ['#4f46e5', '#4338ca', '#0891b2', '#0e7490', '#16a34a', '#15803d'][i] };
      }),
      height: 330,
      onClick: function (i) {
        var s = steps[i];
        UI.drawer({
          title: s.name, sub: '业务转化漏斗第 ' + (i + 1) + ' 层',
          body: UI.sec('该层数据', UI.dl([
            ['本层量级', U.fmtNum(s.value)],
            ['相对上一层', s.rate + '%'],
            ['相对入口', s.allRate + '%'],
            ['本层流失', s.lost ? U.fmtNum(s.lost) + '（' + (100 - s.rate).toFixed(1) + '%）' : '—'],
            ['判定', s.rate >= 70 ? '健康' : (s.rate >= 40 ? '有优化空间' : '重点流失环节')],
            ['优化建议', s.rate >= 70 ? '保持监控，无需专项投入。'
              : (s.rate >= 40 ? '建议做 A/B 实验验证引导路径与文案。'
                : '建议列为本季度重点优化项，拆解为需求进入需求池。')]
          ], 'dl-2col')),
          foot: '<button class="btn" data-close>关闭</button>'
        });
      }
    });

    CH.bar('fnRate', {
      labels: steps.slice(1).map(function (s) { return s.name; }),
      series: [{ name: '层转化率', data: steps.slice(1).map(function (s) { return s.rate; }) }],
      horizontal: true, height: 330, rowH: 46, padL: 100,
      yFmt: function (v) { return v + '%'; },
      colors: steps.slice(1).map(function (s) {
        return s.rate >= 70 ? CH.TONE.done : (s.rate >= 40 ? CH.TONE.warn : CH.TONE.danger);
      })
    });

    CH.flow('fnFlow', {
      steps: flow.steps.map(function (x) { return { name: x.name, value: x.value, key: x.name }; }),
      hot: hotIdx,
      onClick: function (i, step) {
        S.setPref('requirements', 'filter',
          Object.assign({}, S.pref('requirements', 'filter', {}) || {}, { status: step.name }));
        Shell.go('requirements', 'pool');
      }
    });

    UI.table('#fnTbl', {
      cols: [
        { k: 'name', t: '漏斗层级', w: 170 },
        { k: 'value', t: '量级', align: 'right', sortable: true, render: function (r) { return U.fmtNum(r.value); } },
        { k: 'rate', t: '层转化率', w: 150, render: function (r) { return UI.pcell(r.rate, r.rate >= 70 ? 'done' : (r.rate >= 40 ? 'warn' : 'danger')); } },
        { k: 'allRate', t: '累计转化率', w: 120, align: 'right', render: function (r) { return r.allRate + '%'; } },
        { k: 'lost', t: '流失量', align: 'right', render: function (r) { return r.lost ? colored('-' + U.fmtNum(r.lost), 'danger') : '<span class="muted">—</span>'; } },
        {
          k: 'st', t: '判定', w: 100,
          render: function (r) {
            if (r.rate >= 70) return UI.tag('健康', 'done');
            if (r.rate >= 40) return UI.tag('可优化', 'warn');
            return UI.tag('重点流失', 'danger');
          }
        }
      ],
      rows: steps, compact: true, index: true
    });

    UI.bindExport(ctx.el, {
      csv: function () {
        P.csv('转化漏斗', steps, [
          { label: '层级', key: 'name' }, { label: '量级', key: 'value' },
          { label: '层转化率(%)', key: 'rate' }, { label: '累计转化率(%)', key: 'allRate' },
          { label: '流失量', key: 'lost' }
        ]);
      },
      word: function () {
        P.word('漏斗与转化分析', '漏斗与转化分析', [
          {
            h: '一、业务转化漏斗',
            table: {
              cols: [
                { t: '层级', k: 'name' }, { t: '量级', get: function (r) { return U.fmtNum(r.value); } },
                { t: '层转化率', get: function (r) { return r.rate + '%'; } },
                { t: '累计转化率', get: function (r) { return r.allRate + '%'; } },
                { t: '流失量', get: function (r) { return r.lost ? U.fmtNum(r.lost) : '—'; } }
              ], rows: steps
            }
          },
          {
            h: '二、关键结论',
            list: [
              '整体付费转化率（访问 → 付费）为 ' + payRate + '%。',
              '最大流失环节为「' + worst.name + '」，层转化率仅 ' + worst.rate + '%，流失 ' + U.fmtNum(worst.lost) + '。',
              '交付侧当前堆积最多的阶段为「' + flow.steps[hotIdx].name + '」（' + hotV + ' 条），是交付瓶颈。',
              '需求平均交付周期 ' + flow.avgCycle + ' 天，近 30 天上线 ' + flow.throughput + ' 条需求。'
            ]
          },
          {
            h: '三、需求流转分布',
            table: { cols: [{ t: '阶段', k: 'name' }, { t: '在途需求数', k: 'value' }], rows: flow.steps }
          }
        ]);
      }
    });
  }

  /* ============================================================
   * 子页 4：留存分析
   * ========================================================== */
  function retention(ctx) {
    var rows = S.DB.retention;
    var maxLen = rows.reduce(function (a, r) { return Math.max(a, r.cells.length); }, 0);
    var cols = [];
    for (var i = 0; i < maxLen; i++) cols.push('W' + i);
    var matrix = rows.map(function (r) {
      var arr = r.cells.slice();
      while (arr.length < maxLen) arr.push(null);
      return arr;
    });

    var avgByWeek = cols.map(function (c, ci) {
      var vs = rows.map(function (r) { return r.cells[ci]; })
        .filter(function (v) { return v !== undefined && v !== null; });
      return vs.length ? +U.avg(vs).toFixed(1) : 0;
    });
    var w1 = avgByWeek[1] || 0, w4 = avgByWeek[4] || 0;
    var cmp = rows.filter(function (r) { return r.cells.length > 1; });
    var best = cmp.reduce(function (a, b) { return b.cells[1] > a.cells[1] ? b : a; }, cmp[0]);
    var worst = cmp.reduce(function (a, b) { return b.cells[1] < a.cells[1] ? b : a; }, cmp[0]);

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: '留存分析',
        desc: '按注册周分群（Cohort）的周留存矩阵　·　共 ' + rows.length + ' 个分群，最长观察 ' + maxLen + ' 周',
        acts: UI.exportMenu({ word: true })
      }) +
      P.permTip(MOD) +
      P.statCards([
        { label: '次周留存 W1', val: w1 + '%', ico: '◑', tone: tone(w1 >= 70, w1 >= 55), sub: '全部分群平均' },
        { label: '四周留存 W4', val: w4 + '%', ico: '◕', tone: tone(w4 >= 40, w4 >= 25), sub: '较 W1 衰减 ' + (w1 - w4).toFixed(1) + ' 个百分点' },
        { label: '最优分群', val: best.cohort, ico: '★', tone: 'done', sub: 'W1 ' + best.cells[1] + '% · 样本 ' + U.fmtNum(best.size) },
        { label: '最弱分群', val: worst.cohort, ico: '⚠', tone: 'warn', sub: 'W1 ' + worst.cells[1] + '% · 样本 ' + U.fmtNum(worst.size) }
      ]) + P.gap(4) +
      UI.card({
        title: 'Cohort 留存热力矩阵',
        sub: '行 = 注册周分群，列 = 注册后第 N 周；颜色越深留存越高，右上三角为尚未到达的观察窗口',
        ico: '▦', extra: UI.tag('单位 %', 'plan'), body: P.chart('reHeat')
      }) + P.gap(4) +
      UI.grid(2,
        UI.card({ title: '平均留存衰减曲线', sub: '全部分群按周次求平均，观察衰减是否收敛', ico: '◔', body: P.chart('reCurve', 250) }) +
        UI.card({ title: '各分群 W1 留存对比', sub: '识别质量异常的获客批次', ico: '▤', body: P.chart('reBars', 250) })
      ) + P.gap(4) +
      UI.card({ title: '分群明细', sub: '含样本量与逐周留存率', ico: '≣', flush: true, body: '<div id="reTbl"></div>' });

    CH.heat('reHeat', {
      rows: rows.map(function (r) { return r.cohort; }),
      cols: cols, matrix: matrix, max: 100, labelW: 96, vLabel: '留存率',
      fmt: function (v) { return (v === null || v === undefined) ? '' : v + '%'; },
      onClick: function (ri, ci, v) {
        if (v === null || v === undefined) return;
        UI.toast(rows[ri].cohort + ' 分群第 ' + ci + ' 周留存 ' + v + '%（样本 ' + U.fmtNum(rows[ri].size) + '）');
      }
    });

    CH.line('reCurve', {
      labels: cols, height: 250, dot: true, min: 0, max: 100,
      series: [{ name: '平均留存', data: avgByWeek, color: CH.TONE.accent, area: true }],
      yFmt: function (v) { return v + '%'; }
    });

    CH.bar('reBars', {
      labels: rows.map(function (r) { return r.cohort.replace(' 周', ''); }),
      series: [{ name: 'W1 留存', data: rows.map(function (r) { return r.cells[1] || 0; }) }],
      horizontal: true, height: 250, rowH: 30, padL: 66,
      yFmt: function (v) { return v + '%'; },
      colors: rows.map(function (r) {
        var v = r.cells[1] || 0;
        return v >= 75 ? CH.TONE.done : (v >= 60 ? CH.TONE.warn : CH.TONE.danger);
      })
    });

    var tCols = [
      { k: 'cohort', t: '分群（注册周）', w: 140 },
      { k: 'size', t: '样本量', w: 100, align: 'right', sortable: true, render: function (r) { return U.fmtNum(r.size); } }
    ];
    cols.forEach(function (c, ci) {
      tCols.push({
        k: c, t: c, w: 74, align: 'right',
        render: function (r) {
          var v = r.cells[ci];
          if (v === undefined || v === null) return '<span class="muted">—</span>';
          return colored(v + '%', v >= 75 ? 'done' : (v >= 55 ? 'warn' : 'danger'));
        }
      });
    });
    UI.table('#reTbl', { cols: tCols, rows: rows, compact: true });

    UI.bindExport(ctx.el, {
      csv: function () {
        P.csv('留存分析', rows, [{ label: '分群', key: 'cohort' }, { label: '样本量', key: 'size' }].concat(
          cols.map(function (c, ci) {
            return { label: c + '留存(%)', get: function (r) { return r.cells[ci] === undefined ? '' : r.cells[ci]; } };
          })
        ));
      },
      word: function () {
        P.word('留存分析', '用户留存（Cohort）分析', [
          {
            h: '一、核心结论',
            list: [
              '全部分群平均次周（W1）留存 ' + w1 + '%，第四周（W4）留存 ' + w4 + '%。',
              '表现最好的分群为「' + best.cohort + '」，W1 留存 ' + best.cells[1] + '%，样本 ' + U.fmtNum(best.size) + '。',
              '表现最弱的分群为「' + worst.cohort + '」，W1 留存 ' + worst.cells[1] + '%，建议回溯该周的获客渠道与新手引导链路。'
            ]
          },
          {
            h: '二、留存矩阵',
            table: {
              cols: [{ t: '分群', k: 'cohort' }, { t: '样本量', get: function (r) { return U.fmtNum(r.size); } }].concat(
                cols.map(function (c, ci) {
                  return { t: c, get: function (r) { return r.cells[ci] === undefined ? '—' : r.cells[ci] + '%'; } };
                })
              ), rows: rows
            }
          },
          {
            h: '三、平均衰减曲线',
            table: {
              cols: [{ t: '周次', k: 'c' }, { t: '平均留存', get: function (r) { return r.v + '%'; } }],
              rows: cols.map(function (c, i) { return { c: c, v: avgByWeek[i] }; })
            }
          }
        ]);
      }
    });
  }

  /* ============================================================
   * 公共筛选条
   * ========================================================== */
  function fltBar(f, o) {
    o = o || {};
    var h = '<span class="muted tiny">时间范围</span>' +
      P.sel('range', '', [{ v: '12', t: '近 12 周' }, { v: '18', t: '近 18 周' }, { v: '26', t: '近 26 周' }], f.range);
    if (o.metric) {
      h += '<span class="muted tiny">指标</span>' +
        P.sel('metric', '', keys().map(function (k) {
          var m = mt(k, '');
          return { v: k, t: m ? m.name : k };
        }), f.metric);
    }
    if (o.dim) {
      var dims = S.isDirector()
        ? [{ v: 'line', t: '按产品线拆分' }, { v: 'total', t: '全量汇总' }, { v: 'release', t: '按版本节点' }]
        : [{ v: 'release', t: '按版本节点' }, { v: 'total', t: '全量汇总' }];
      h += '<span class="muted tiny">分析维度</span>' + P.sel('dim', '', dims, dimOf(f));
    }
    if (o.line) {
      h += '<span class="muted tiny">产品线</span>' + P.sel('line', '全部产品线', P.lineOpts(), f.line);
    }
    h += '<span class="grow"></span>' + P.viewBar(MOD) +
      '<button class="btn btn-sm" data-reset>重置</button>';
    return h;
  }

  function bindFlt(ctx) {
    var box = document.getElementById('anFlt');
    P.bindFlt(box, MOD, DEF, function () { Shell.route(); });
    P.bindViews(box, MOD, DEF);
    /* 卡片右上角的时间范围 chips */
    ctx.el.querySelectorAll('[data-chip="range"]').forEach(function (b) {
      b.addEventListener('click', function () {
        var f = P.flt(MOD, DEF);
        f.range = b.getAttribute('data-v');
        P.setFlt(MOD, f);
        Shell.route();
      });
    });
  }

  /* ============================================================
     四个子页全都建立在「指标数据」之上：没有指标记录，就没有 series 可画。
     这里统一拦一道，而不是在下面四十多处 st.m / .series 各补一个 ||——
     补了也只是把崩溃换成满屏的「—」，不如直接告诉你第一步该做什么。

     各子页依赖的集合不同：
       核心指标 / 趋势 → metrics
       漏斗与转化      → funnel
       留存分析        → retention
     ========================================================== */
  var NEED = {
    kpi: { coll: 'metrics', name: '指标数据', create: 'metric.new' },
    trend: { coll: 'metrics', name: '指标数据', create: 'metric.new' },
    funnel: { coll: 'funnel', name: '漏斗数据', create: '' },
    retention: { coll: 'retention', name: '留存数据', create: '' }
  };
  function guard(ctx, sub) {
    var need = NEED[sub] || NEED.kpi;
    if ((S.DB[need.coll] || []).length) return false;
    ctx.el.innerHTML = P.head({
      mod: MOD, title: '数据分析',
      desc: '经营与交付指标的看板。它不自己产生数据，只呈现你录入的指标。'
    }) +
      UI.notice('info',
        '这一页要用到<b>' + E(need.name) + '</b>，现在一条都还没有，所以没有可画的曲线。' +
        (need.create
          ? '点下面的按钮录第一条：指标名、单位、目标值，再按周补数值，这里就有内容了。'
          : '这类数据目前需要从外部导入（顶栏「数据」→ 导入 JSON），或先用其它子页。')) +
      (need.create
        ? '<div style="margin-top:var(--sp-4)">' + P.createBtn(MOD, need.create, '录第一条' + need.name) + '</div>'
        : '') +
      P.gap(4) + P.emptyMod('还没有' + need.name);
    return true;
  }

  Shell.page(MOD, {
    render: function (ctx) {
      var sub = ctx.sub || 'kpi';
      if (guard(ctx, sub)) return;
      if (sub === 'trend') trend(ctx);
      else if (sub === 'funnel') funnelPage(ctx);
      else if (sub === 'retention') retention(ctx);
      else kpi(ctx);
    }
  });
})();
