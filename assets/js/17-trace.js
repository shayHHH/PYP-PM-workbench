/* ============================================================
 * 17-trace.js  工作留痕
 * 子页：timeline 时间轴视图（可下钻到原对象 + 批量导出 Word）
 *       stats    类型统计（类型分布 / 活跃趋势 / 人员与项目排行）
 * 总监视角关注规划调整与版本发布，PM 视角关注任务流转与交付验收
 * ========================================================== */
(function () {
  'use strict';
  var E = U.esc, MOD = 'trace';

  var DEF_T = { kw: '', type: '', actor: '', range: '30', ref: '' };
  var PAGE = 40;

  /* 留痕对象 → 可跳转的模块/子页 */
  var REF_MOD = {
    requirement: ['requirements', 'pool'],
    release: ['releases', 'plan'],
    task: ['tasks', 'list'],
    risk: ['risks', 'ledger'],
    meeting: ['meetings', 'list'],
    change: ['changes', 'list'],
    deliverable: ['delivery', 'items'],
    roadmap: ['roadmap', 'map']
  };
  var REF_LABEL = {
    requirement: '需求', release: '版本', task: '任务', risk: '风险',
    meeting: '会议', change: '变更', deliverable: '交付物', roadmap: '规划项'
  };

  function refGo(t) {
    var m = REF_MOD[t.refType];
    if (!m || !t.refId || !C.canSee(m[0], S.role())) return '';
    return ' data-go="' + E(m[0] + '/' + m[1] + '/' + t.refId) + '"';
  }
  function view() { return C.viewOf(S.role(), MOD); }

  /* 角色关注的留痕类型（用于「角色关注」快捷筛选） */
  function focusTypes() {
    return S.isDirector() ? ['规划调整', '版本发布', '会议决策', '风险处置']
      : ['任务流转', '交付验收', '变更审批', '风险处置'];
  }

  function filtered(f) {
    var days = U.num(f.range, 0);
    return S.traces().filter(function (t) {
      if (f.kw && !U.matchAny(t, ['title', 'desc', 'actor', 'id', 'projectName'], f.kw)) return false;
      if (f.type && t.type !== f.type) return false;
      if (f.actor && t.actor !== f.actor) return false;
      if (f.ref && t.refType !== f.ref) return false;
      if (days && U.dayDiff(t.time.slice(0, 10), S.TODAY) > days) return false;
      return true;
    });
  }

  /* ============================================================
   * 子页 1：时间轴
   * ========================================================== */
  function timeline(ctx) {
    var f = P.flt(MOD, DEF_T);
    var all = S.traces();
    var rows = filtered(f);
    var shown = S.pref(MOD, 'shown', PAGE);
    if (shown > rows.length) shown = rows.length;

    var wk = U.weekRange(S.TODAY);
    var thisWeek = all.filter(function (t) { return U.inRange(t.time.slice(0, 10), wk[0], wk[1]); });
    var actors = U.uniq(all.map(function (t) { return t.actor; }));
    var projs = U.uniq(all.map(function (t) { return t.projectName; }).filter(Boolean));

    var byType = U.countBy(all, 'type');
    var chipItems = [{ key: '', label: '全部类型', n: all.length }].concat(
      C.DICT.traceType.filter(function (t) { return byType[t]; })
        .map(function (t) { return { key: t, label: t, n: byType[t] }; })
    );

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: '工作留痕',
        desc: '所有关键动作自动留痕，可回溯「谁在什么时候对什么对象做了什么」　·　' + P.scopeText() +
          '　·　共 ' + all.length + ' 条，命中 ' + rows.length + ' 条',
        acts: '<button class="btn" data-focus>只看' + E(S.roleObj().short || S.roleObj().name) + '关注</button>　' +
          UI.exportMenu({ word: true })
      }) +
      P.permTip(MOD) +
      P.statCards([
        { label: '留痕总数', val: all.length, unit: '条', ico: '◷', tone: 'doing', sub: '当前口径全量' },
        { label: '本周新增', val: thisWeek.length, unit: '条', ico: '＋', tone: 'done', sub: U.fmtMD(wk[0]) + ' ~ ' + U.fmtMD(wk[1]) },
        { label: '涉及人员', val: actors.length, unit: '人', ico: '☗', tone: 'plan', sub: '活跃操作人' },
        { label: '涉及项目', val: projs.length, unit: '个', ico: '◫', tone: 'plain', sub: '含规划类无项目归属' }
      ]) + P.gap(4) +
      UI.card({
        title: '留痕时间轴', sub: '按日期倒序，点击条目可跳转到原对象', ico: '◷',
        extra: '<span class="muted tiny">' + E(view().note || '') + '</span>',
        body:
          '<div class="toolbar" id="trFlt">' +
          '<input class="fld fld-search" data-f="kw" placeholder="搜索标题 / 说明 / 操作人" value="' + E(f.kw) + '">' +
          P.sel('actor', '全部操作人', actors, f.actor) +
          P.sel('ref', '全部对象类型', Object.keys(REF_LABEL).map(function (k) { return { v: k, t: REF_LABEL[k] }; }), f.ref) +
          P.sel('range', '全部时间', [
            { v: '7', t: '近 7 天' }, { v: '30', t: '近 30 天' },
            { v: '90', t: '近 90 天' }, { v: '180', t: '近半年' }
          ], f.range) +
          '<span class="grow"></span>' + P.viewBar(MOD) +
          '<button class="btn btn-sm" data-reset>重置</button>' +
          '</div>' +
          UI.chips(chipItems, f.type, 'type') +
          '<div id="trBody" style="margin-top:var(--sp-3)"></div>'
      });

    paintList(rows, shown);

    var flt = P.$('trFlt');
    P.bindFlt(flt, MOD, DEF_T, function () { S.setPref(MOD, 'shown', PAGE); Shell.route(); });
    P.bindViews(flt, MOD, DEF_T);
    /* chips 也走 bindFlt 的 [data-chip] 委托，但它挂在 card 内的兄弟节点上 */
    P.bindFlt(ctx.el.querySelector('.chip-row'), MOD, DEF_T, function () { Shell.route(); });

    var fb = ctx.el.querySelector('[data-focus]');
    if (fb) fb.addEventListener('click', function () {
      var ts = focusTypes();
      UI.drawer({
        title: S.roleObj().name + '关注的留痕', sub: ts.join(' · '),
        body: ts.map(function (t) {
          var list = rows.filter(function (x) { return x.type === t; });
          return UI.sec(t + '（' + list.length + '）',
            list.length ? UI.tline(list.slice(0, 8).map(item), { groupByDate: false })
              : UI.empty('该类型暂无留痕'));
        }).join('')
      });
    });

    UI.bindExport(ctx.el, {
      csv: function () {
        P.csv('工作留痕', rows, [
          { label: '时间', key: 'time' }, { label: '类型', key: 'type' },
          { label: '标题', key: 'title' }, { label: '说明', key: 'desc' },
          { label: '操作人', key: 'actor' }, { label: '项目', key: 'projectName' },
          { label: '产品线', key: 'lineName' },
          { label: '对象类型', get: function (r) { return REF_LABEL[r.refType] || '—'; } },
          { label: '对象编号', key: 'refId' }
        ]);
      },
      word: function () { wordTrace(rows, f); }
    });
  }

  function item(t) {
    var g = refGo(t);
    return {
      time: t.time,
      tone: g ? 'clickable' : '',
      title: UI.tag(t.type, C.tone('traceType', t.type)) + ' ' + E(t.title),
      desc: E(t.desc || ''),
      meta: '<span>' + E(t.actor) + '</span><span>' + E(t.projectName || t.lineName || '—') + '</span>' +
        (t.refId ? '<span>' + E((REF_LABEL[t.refType] || '对象') + ' ' + t.refId) + '</span>' : '') +
        (g ? '<span class="muted tiny">点击查看对象</span>' : ''),
      data: g
    };
  }

  function paintList(rows, shown) {
    var el = P.$('trBody');
    if (!el) return;
    if (!rows.length) { el.innerHTML = UI.empty('当前筛选条件下没有留痕记录', '<button class="btn" data-reset>重置筛选</button>'); return; }
    el.innerHTML = UI.tline(rows.slice(0, shown).map(item), { groupByDate: true }) +
      (shown < rows.length
        ? '<div style="text-align:center;margin-top:var(--sp-3)">' +
        '<button class="btn" id="trMore">加载更多（还有 ' + (rows.length - shown) + ' 条）</button></div>'
        : '<div class="muted tiny" style="text-align:center;margin-top:var(--sp-3)">已显示全部 ' + rows.length + ' 条留痕</div>');
    var more = P.$('trMore');
    if (more) more.addEventListener('click', function () {
      S.setPref(MOD, 'shown', shown + PAGE);
      paintList(rows, shown + PAGE);
    });
  }

  function wordTrace(rows, f) {
    var byType = U.countBy(rows, 'type');
    var byActor = U.countBy(rows, 'actor');
    P.word('工作留痕记录', '工作留痕记录', [
      {
        h: '一、留痕概览',
        p: '本次导出共 ' + rows.length + ' 条留痕记录，时间范围' +
          (U.num(f.range, 0) ? '为近 ' + f.range + ' 天' : '为全部历史') +
          '，覆盖 ' + Object.keys(byType).length + ' 类动作、' + Object.keys(byActor).length + ' 名操作人。'
      },
      {
        h: '二、类型分布',
        table: {
          cols: [{ t: '留痕类型', k: 'name' }, { t: '条数', k: 'value' }, { t: '占比', k: 'pct' }],
          rows: Object.keys(byType).map(function (k) {
            return { name: k, value: byType[k], pct: U.pctStr(byType[k], rows.length) };
          }).sort(function (a, b) { return b.value - a.value; })
        }
      },
      {
        h: '三、留痕明细',
        table: {
          cols: [
            { t: '时间', k: 'time' }, { t: '类型', k: 'type' }, { t: '标题', k: 'title' },
            { t: '说明', k: 'desc' }, { t: '操作人', k: 'actor' },
            { t: '所属项目', get: function (r) { return r.projectName || r.lineName || '—'; } },
            { t: '关联对象', get: function (r) { return r.refId ? (REF_LABEL[r.refType] || '对象') + ' ' + r.refId : '—'; } }
          ],
          rows: rows.slice(0, 300)
        }
      },
      rows.length > 300 ? { p: '（明细仅导出最近 300 条，如需全量请使用 CSV 导出。）' } : null
    ]);
    UI.toast('留痕记录已导出为 Word', 'ok');
  }

  /* ============================================================
   * 子页 2：类型统计
   * ========================================================== */
  function stats(ctx) {
    var all = S.traces();
    var focus = focusTypes();
    var focusN = all.filter(function (t) { return focus.indexOf(t.type) >= 0; }).length;

    /* 近 12 周 */
    var wLabels = [], weeks = [];
    for (var i = 11; i >= 0; i--) {
      var s = U.addDay(S.TODAY, -i * 7 - 6), e = U.addDay(S.TODAY, -i * 7);
      weeks.push([s, e]);
      wLabels.push(U.fmtMD(e));
    }
    var actTypes = C.DICT.traceType.filter(function (t) {
      return all.some(function (x) { return x.type === t; });
    });
    var series = actTypes.map(function (t) {
      return {
        name: t, color: CH.TONE[C.tone('traceType', t)],
        data: weeks.map(function (w) {
          return all.filter(function (x) { return x.type === t && U.inRange(x.time.slice(0, 10), w[0], w[1]); }).length;
        })
      };
    });

    var byActor = U.countBy(all, 'actor');
    var actorRows = Object.keys(byActor).map(function (k) { return { name: k, value: byActor[k] }; })
      .sort(function (a, b) { return b.value - a.value; }).slice(0, 8);

    var byProj = U.countBy(all.filter(function (t) { return t.projectName; }), 'projectName');
    var projRows = Object.keys(byProj).map(function (k) {
      var list = all.filter(function (t) { return t.projectName === k; });
      var counts = U.countBy(list, 'type');
      var top = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0] || '—';
      return {
        name: k, total: list.length, top: top, topN: counts[top] || 0,
        last: (U.sortBy(list, 'time', true)[0] || {}).time || '',
        pid: (list[0] || {}).projectId || ''
      };
    }).sort(function (a, b) { return b.total - a.total; });

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: '留痕类型统计',
        desc: '按类型 / 时间 / 人员 / 项目四个维度分析工作痕迹的分布与活跃度　·　' + P.scopeText(),
        acts: UI.exportMenu({ word: true })
      }) +
      P.permTip(MOD) +
      P.statCards([
        { label: '留痕总数', val: all.length, unit: '条', ico: '◷', tone: 'doing', sub: '当前口径全量' },
        { label: '留痕类型', val: actTypes.length, unit: '类', ico: '◍', tone: 'plan', sub: '共 ' + C.DICT.traceType.length + ' 类可产生' },
        {
          label: S.roleObj().name + '关注类', val: focusN, unit: '条', ico: '◈', tone: 'plan',
          sub: focus.join(' / ')
        },
        {
          label: '周均留痕', val: (all.length ? Math.round(U.sum(series, function (se) { return U.sum(se.data); }) / 12) : 0),
          unit: '条/周', ico: '▤', tone: 'done', sub: '近 12 周平均'
        }
      ]) + P.gap(4) +
      UI.grid(2,
        UI.card({ title: '类型分布', sub: '点击环图可跳转到对应类型的时间轴', ico: '◍', body: P.chart('tsType', 260) }) +
        UI.card({ title: '操作人活跃度 TOP8', sub: '点击可查看该成员的留痕', ico: '☗', body: P.chart('tsActor', 260) })
      ) + P.gap(4) +
      UI.card({
        title: '近 12 周留痕趋势', sub: '按类型堆叠，可点击图例开关单个类型', ico: '▤',
        body: P.chart('tsWeek', 280)
      }) + P.gap(4) +
      UI.card({
        title: '项目留痕分布', sub: '留痕越少的在办项目，越可能存在过程记录缺失', ico: '◫',
        flush: true, body: '<div id="tsProj"></div>'
      });

    /* ---- 类型环图 ---- */
    var byType = U.countBy(all, 'type');
    var typeRows = actTypes.map(function (t) {
      return { name: t, value: byType[t], color: CH.TONE[C.tone('traceType', t)] };
    });
    if (typeRows.length) {
      CH.donut('tsType', {
        data: typeRows, height: 260, center: { v: all.length, l: '留痕总条数' },
        onClick: function (i, d) {
          P.setFlt(MOD, Object.assign({}, P.flt(MOD, DEF_T), { type: d.name, range: '' }));
          Shell.go(MOD, 'timeline');
        }
      });
    } else P.$('tsType').innerHTML = UI.empty('当前口径下暂无留痕');

    /* ---- 操作人排行 ---- */
    if (actorRows.length) {
      CH.bars('tsActor', {
        data: actorRows.map(function (a) { return { label: a.name, value: a.value, text: a.value + ' 条' }; }),
        palette: true,
        onClick: function (i, d) {
          P.setFlt(MOD, Object.assign({}, P.flt(MOD, DEF_T), { actor: d.label, range: '' }));
          Shell.go(MOD, 'timeline');
        }
      });
    } else P.$('tsActor').innerHTML = UI.empty('暂无操作人数据');

    /* ---- 周趋势堆叠 ---- */
    CH.bar('tsWeek', { labels: wLabels, series: series, stack: true, height: 280, xEvery: 1, legend: true });

    /* ---- 项目分布表 ---- */
    UI.table('#tsProj', {
      pageSize: 0, compact: true,
      cols: [
        { k: 'name', t: '项目', render: function (r) { return E(r.name); } },
        {
          k: 'total', t: '留痕条数', w: '160px', align: 'right',
          render: function (r) {
            var mx = projRows[0] ? projRows[0].total : 1;
            return '<div style="display:flex;align-items:center;gap:8px;justify-content:flex-end">' +
              UI.pbar(Math.round(r.total / mx * 100), 'doing') +
              '<b style="min-width:34px;text-align:right">' + r.total + '</b></div>';
          }
        },
        {
          k: 'top', t: '主要动作', w: '160px',
          render: function (r) { return UI.tag(r.top, C.tone('traceType', r.top)) + ' <span class="muted tiny">' + r.topN + ' 条</span>'; }
        },
        {
          k: 'last', t: '最近一次留痕', w: '170px',
          render: function (r) {
            var d = U.daysLeft(r.last.slice(0, 10));
            return UI.cell2(E(r.last), d < -14 ? '<span class="tag tag-warn">已 ' + (-d) + ' 天无记录</span>' : (-d) + ' 天前');
          }
        }
      ],
      rows: projRows,
      empty: '当前口径下暂无项目留痕',
      onRow: function (r) {
        if (r.pid) S.setProject(r.pid);
        P.setFlt(MOD, Object.assign({}, P.flt(MOD, DEF_T), { kw: '', type: '', range: '' }));
        Shell.go(MOD, 'timeline');
      }
    });

    UI.bindExport(ctx.el, {
      csv: function () {
        P.csv('留痕类型统计', typeRows, [
          { label: '类型', key: 'name' }, { label: '条数', key: 'value' }
        ]);
      },
      word: function () {
        P.word('留痕类型统计', '工作留痕类型统计报告', [
          {
            h: '一、总体情况',
            p: '当前口径共有留痕 ' + all.length + ' 条，覆盖 ' + actTypes.length + ' 类动作、' +
              Object.keys(byActor).length + ' 名操作人、' + projRows.length + ' 个项目。' +
              S.roleObj().name + '重点关注的「' + focus.join('、') + '」共 ' + focusN + ' 条，占比 ' + U.pctStr(focusN, all.length) + '。'
          },
          {
            h: '二、类型分布',
            table: {
              cols: [{ t: '类型', k: 'name' }, { t: '条数', k: 'value' },
              { t: '占比', get: function (r) { return U.pctStr(r.value, all.length); } }],
              rows: typeRows.slice().sort(function (a, b) { return b.value - a.value; })
            }
          },
          {
            h: '三、操作人活跃度',
            table: { cols: [{ t: '操作人', k: 'name' }, { t: '留痕条数', k: 'value' }], rows: actorRows }
          },
          {
            h: '四、项目留痕分布',
            table: {
              cols: [{ t: '项目', k: 'name' }, { t: '留痕条数', k: 'total' },
              { t: '主要动作', k: 'top' }, { t: '最近一次留痕', k: 'last' }],
              rows: projRows
            }
          }
        ]);
        UI.toast('统计报告已导出为 Word', 'ok');
      }
    });
  }

  /* ============================================================ */
  Shell.page(MOD, {
    render: function (ctx) {
      if (ctx.sub === 'stats') stats(ctx);
      else timeline(ctx);
    }
  });
})();
