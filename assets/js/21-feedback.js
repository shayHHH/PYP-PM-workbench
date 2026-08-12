/* ============================================================
 * 21-feedback.js  用户反馈（产品总监专属）
 * 子页：ledger  反馈台账
 *       cluster 问题聚类（按主题聚合 + 影响面矩阵）
 *       tags    标签管理
 * ========================================================== */
(function () {
  'use strict';
  var E = U.esc, MOD = 'feedback';

  var DEF_F = { kw: '', status: '', source: '', impact: '', cluster: '', line: '' };
  var OPEN_ST = ['待分类', '待评估'];

  function ed() { return P.ed(MOD); }
  function all() { return S.feedbacks(); }
  function isOpen(f) { return OPEN_ST.indexOf(f.status) >= 0; }
  /* 影响面权重：用于「影响面 × 数量」的加权排序 */
  var IMPACT_W = { '全量用户': 4, '重点客户': 3, '部分用户': 2, '单一客户': 1 };
  function weight(f) { return (IMPACT_W[f.impact] || 1) * Math.max(1, f.count); }

  /* ============================================================
   * 子页 1：反馈台账
   * ========================================================== */
  function ledger(ctx) {
    var f = P.flt(MOD, DEF_F);
    var list = all();
    var rows = list.filter(function (x) {
      if (f.kw && !U.matchAny(x, ['title', 'id', 'customer', 'handler', 'reply'], f.kw)) return false;
      if (f.status && x.status !== f.status) return false;
      if (f.source && x.source !== f.source) return false;
      if (f.impact && x.impact !== f.impact) return false;
      if (f.cluster && x.cluster !== f.cluster) return false;
      if (f.line && x.lineId !== f.line) return false;
      return true;
    });
    var open = list.filter(isOpen);
    var adopted = list.filter(function (x) { return x.status === '已纳入需求'; });
    var clusters = U.uniq(list.map(function (x) { return x.cluster; }));

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: '用户反馈台账',
        desc: '来自工单、NPS、销售、社群与访谈的原始声音，是需求池的上游　·　' + P.scopeText() +
          '　·　共 ' + list.length + ' 条，命中 ' + rows.length + ' 条',
        acts: UI.exportMenu({ word: true })
      }) +
      P.permTip(MOD) +
      P.statCards([
        { label: '反馈总量', val: list.length, unit: '条', ico: '☷', tone: 'doing', sub: '累计提及 ' + U.fmtNum(U.sum(list, 'count')) + ' 次' },
        { label: '待处理', val: open.length, unit: '条', ico: '⚠', tone: 'warn', sub: '待分类 + 待评估', mod: MOD, key: 'ledger' },
        { label: '已纳入需求', val: adopted.length, unit: '条', ico: '✓', tone: 'done', sub: '转化率 ' + U.pctStr(adopted.length, list.length) },
        { label: '平均 NPS', val: list.length ? U.avg(list, 'nps').toFixed(1) : '0', unit: '分', ico: '◔', tone: 'plan', sub: '满分 10 分' }
      ]) + P.gap(4) +
      UI.grid(2,
        UI.card({ title: '反馈来源分布', sub: '点击可回填筛选', ico: '◍', body: P.chart('fbSrc', 250) }) +
        UI.card({ title: '影响面 × 状态', sub: '越靠左上越应该优先处理', ico: '▦', body: P.chart('fbMatrix', 250) })
      ) + P.gap(4) +
      UI.card({
        flush: true,
        body: '<div class="toolbar" id="fbFlt">' +
          '<input class="fld fld-search" data-f="kw" placeholder="搜索反馈内容 / 客户 / 处理人" value="' + E(f.kw) + '">' +
          P.sel('line', '全部产品线', P.lineOpts(), f.line) +
          P.sel('status', '全部状态', C.DICT.fbStatus, f.status) +
          P.sel('source', '全部来源', C.DICT.fbSource, f.source) +
          P.sel('impact', '全部影响面', C.DICT.fbImpact, f.impact) +
          P.sel('cluster', '全部聚类', clusters, f.cluster) +
          '<span class="grow"></span>' + P.viewBar(MOD) +
          '<button class="btn btn-sm" data-reset>重置</button>' +
          '</div><div id="fbTbl"></div>'
      });

    /* 来源环图 */
    var bySrc = U.countBy(list, 'source');
    var srcRows = C.DICT.fbSource.filter(function (s) { return bySrc[s]; })
      .map(function (s) { return { name: s, value: bySrc[s] }; });
    if (srcRows.length) {
      CH.donut('fbSrc', {
        data: srcRows, height: 250, center: { v: list.length, l: '反馈总条数' },
        onClick: function (i, d) {
          P.setFlt(MOD, Object.assign({}, P.flt(MOD, DEF_F), { source: d.name }));
          Shell.route();
        }
      });
    } else P.$('fbSrc').innerHTML = UI.empty('当前口径下暂无反馈');

    /* 影响面 × 状态热力 */
    var imps = C.DICT.fbImpact, sts = C.DICT.fbStatus;
    CH.heat('fbMatrix', {
      rows: imps, cols: sts, labelW: 76, vLabel: '反馈条数',
      matrix: imps.map(function (im) {
        return sts.map(function (st) {
          return list.filter(function (x) { return x.impact === im && x.status === st; }).length;
        });
      }),
      fmt: function (n) { return n ? String(n) : ''; },
      onClick: function (r, c) {
        P.setFlt(MOD, Object.assign({}, P.flt(MOD, DEF_F), { impact: imps[r], status: sts[c] }));
        Shell.route();
      }
    });

    UI.table('#fbTbl', {
      pageSize: 12, select: true,
      cols: [
        { k: 'id', t: '编号', w: '84px', render: function (r) { return UI.idCell(r.id); } },
        {
          k: 'title', t: '反馈内容',
          render: function (r) {
            return UI.cell2(E(r.title),
              UI.tag(r.cluster, 'plain') + ' ' + E(r.customer) + ' · ' + E(r.createAt));
          }
        },
        { k: 'lineName', t: '产品线', w: '124px' },
        { k: 'source', t: '来源', w: '108px', render: function (r) { return UI.tag(r.source, 'plain'); } },
        {
          k: 'impact', t: '影响面', w: '124px',
          render: function (r) {
            return UI.cell2(UI.tag(r.impact, r.impact === '全量用户' ? 'danger' : (r.impact === '重点客户' ? 'warn' : 'plain')),
              '提及 ' + r.count + ' 次');
          },
          sortVal: function (r) { return weight(r); }
        },
        { k: 'nps', t: 'NPS', w: '72px', align: 'right', render: function (r) { return '<b class="' + (r.nps >= 8 ? '' : 'muted') + '">' + r.nps + '</b>'; } },
        { k: 'handler', t: '处理人', w: '96px', render: function (r) { return UI.owner(r.handler); } },
        { k: 'status', t: '状态', w: '110px', render: function (r) { return UI.tag(r.status, C.tone('status', r.status)); } },
        {
          k: '', t: '操作', w: '116px', sortable: false, align: 'right',
          render: function () { return '<div class="row-acts"><button data-act="open">详情</button>' + (ed() ? '<button data-act="edit">处理</button>' : '') + '</div>'; }
        }
      ],
      rows: U.sortBy(rows, 'createAt', true),
      rowCls: function (r) { return r.impact === '全量用户' && isOpen(r) ? 'row-warn' : ''; },
      empty: '当前筛选条件下没有反馈',
      emptyAct: '<button class="btn" data-reset>重置筛选</button>',
      bulk: ed() ? [
        {
          t: '批量转需求', cls: 'btn-primary',
          fn: function (picked, clear) {
            picked.forEach(function (r) { S.update('feedbacks', r.id, { status: '已纳入需求' }); });
            clear(); Shell.route();
            UI.toast('已将 ' + picked.length + ' 条反馈标记为「已纳入需求」', 'ok');
          }
        },
        { t: '批量导出', fn: function (picked) { csvFb(picked); } }
      ] : [{ t: '批量导出', fn: function (picked) { csvFb(picked); } }],
      onAct: function (act, r) {
        if (act === 'edit') editFb(r); else openFb(r);
      },
      onRow: function (r) { openFb(r); }
    });

    var flt = P.$('fbFlt');
    P.bindFlt(flt, MOD, DEF_F, function () { Shell.route(); });
    P.bindViews(flt, MOD, DEF_F);

    UI.bindExport(ctx.el, {
      csv: function () { csvFb(rows); },
      word: function () { wordFb(list, rows); }
    });

    if (ctx.id) {
      var hit = list.filter(function (x) { return x.id === ctx.id; })[0];
      if (hit) openFb(hit);
    }
  }

  function csvFb(rows) {
    P.csv('用户反馈台账', rows, [
      { label: '编号', key: 'id' }, { label: '反馈内容', key: 'title' },
      { label: '产品线', key: 'lineName' }, { label: '来源', key: 'source' },
      { label: '影响面', key: 'impact' }, { label: '提及次数', key: 'count' },
      { label: '聚类', key: 'cluster' }, { label: '标签', get: function (r) { return (r.tags || []).join('/'); } },
      { label: '客户', key: 'customer' }, { label: 'NPS', key: 'nps' },
      { label: '处理人', key: 'handler' }, { label: '状态', key: 'status' },
      { label: '提出时间', key: 'createAt' }, { label: '关联需求', key: 'linkedReq' },
      { label: '处理回复', key: 'reply' }
    ]);
  }

  function wordFb(list, rows) {
    var byCluster = U.countBy(list, 'cluster');
    P.word('用户反馈报告', '用户反馈汇总报告', [
      {
        h: '一、总体情况',
        p: '当前口径共收集反馈 ' + list.length + ' 条，累计提及 ' + U.sum(list, 'count') + ' 次，' +
          '待处理 ' + list.filter(isOpen).length + ' 条，已纳入需求 ' +
          list.filter(function (x) { return x.status === '已纳入需求'; }).length + ' 条，平均 NPS ' +
          (list.length ? U.avg(list, 'nps').toFixed(1) : 0) + ' 分。'
      },
      {
        h: '二、问题聚类分布',
        table: {
          cols: [{ t: '聚类主题', k: 'name' }, { t: '反馈条数', k: 'value' },
          { t: '占比', get: function (r) { return U.pctStr(r.value, list.length); } }],
          rows: Object.keys(byCluster).map(function (k) { return { name: k, value: byCluster[k] }; })
            .sort(function (a, b) { return b.value - a.value; })
        }
      },
      {
        h: '三、高影响面待处理反馈',
        table: {
          cols: [
            { t: '编号', k: 'id' }, { t: '反馈内容', k: 'title' }, { t: '产品线', k: 'lineName' },
            { t: '影响面', k: 'impact' }, { t: '提及次数', k: 'count' }, { t: '客户', k: 'customer' },
            { t: '处理人', k: 'handler' }, { t: '状态', k: 'status' }
          ],
          rows: list.filter(function (x) { return isOpen(x) && ['全量用户', '重点客户'].indexOf(x.impact) >= 0; })
            .sort(function (a, b) { return weight(b) - weight(a); })
        }
      },
      {
        h: '四、反馈明细',
        table: {
          cols: [
            { t: '编号', k: 'id' }, { t: '反馈内容', k: 'title' }, { t: '来源', k: 'source' },
            { t: '聚类', k: 'cluster' }, { t: '影响面', k: 'impact' }, { t: '状态', k: 'status' },
            { t: '提出时间', k: 'createAt' }
          ],
          rows: rows
        }
      }
    ]);
    UI.toast('反馈报告已导出为 Word', 'ok');
  }

  function openFb(r) {
    var req = r.linkedReq ? S.reqBy(r.linkedReq) : null;
    var similar = all().filter(function (x) { return x.cluster === r.cluster && x.id !== r.id; }).slice(0, 6);
    UI.drawer({
      title: r.title,
      sub: r.id + '　·　' + r.lineName + '　·　' + r.createAt,
      body:
        UI.sec('反馈要素', P.kv([
          ['产品线', E(r.lineName)],
          ['来源渠道', UI.tag(r.source, 'plain')],
          ['提出客户', E(r.customer)],
          ['影响面', UI.tag(r.impact, r.impact === '全量用户' ? 'danger' : (r.impact === '重点客户' ? 'warn' : 'plain')) + ' <span class="muted tiny">提及 ' + r.count + ' 次</span>'],
          ['聚类主题', UI.tag(r.cluster, 'plain')],
          ['标签', (r.tags || []).map(function (t) { return UI.tag(t, 'plain'); }).join(' ') || '—'],
          ['NPS 评分', '<b>' + r.nps + '</b> / 10'],
          ['处理人', UI.owner(r.handler)],
          ['当前状态', UI.tag(r.status, C.tone('status', r.status))],
          ['加权优先度', weight(r) + '（影响面权重 × 提及次数）']
        ])) +
        UI.sec('处理结论', r.reply ? '<div class="rich">' + E(r.reply) + '</div>' : UI.empty('尚未填写处理结论')) +
        UI.sec('关联需求', req
          ? UI.listItem({
            ico: '☰', title: E(req.title), desc: E(req.lineName + ' · ' + req.type),
            right: UI.tag(req.status, C.tone('status', req.status)),
            click: C.canSee('requirements', S.role()),
            data: ' data-jump="requirements/pool/' + E(req.id) + '"'
          })
          : UI.empty('尚未转化为需求')) +
        UI.sec('同类反馈（' + r.cluster + '）', similar.length
          ? similar.map(function (x) {
            return UI.listItem({
              ico: '☷', title: E(x.title),
              desc: E(x.lineName + ' · ' + x.customer + ' · 提及 ' + x.count + ' 次'),
              right: UI.tag(x.status, C.tone('status', x.status)),
              click: true, data: ' data-fb="' + E(x.id) + '"'
            });
          }).join('')
          : UI.empty('该聚类下暂无其他反馈')),
      foot: '<button class="btn" data-close>关闭</button>' +
        (ed() ? '<button class="btn-primary" data-edit>处理反馈</button>' : ''),
      onOpen: function (h) {
        h.el.querySelector('[data-close]').addEventListener('click', h.close);
        var eb = h.el.querySelector('[data-edit]');
        if (eb) eb.addEventListener('click', function () { h.close(); editFb(r); });
        h.el.querySelectorAll('[data-jump]').forEach(function (n) {
          n.addEventListener('click', function () {
            var p = n.getAttribute('data-jump').split('/');
            h.close(); Shell.go(p[0], p[1], p[2]);
          });
        });
        h.el.querySelectorAll('[data-fb]').forEach(function (n) {
          n.addEventListener('click', function () {
            var x = all().filter(function (y) { return y.id === n.getAttribute('data-fb'); })[0];
            if (x) { h.close(); openFb(x); }
          });
        });
      }
    });
  }

  function editFb(r) {
    var clusters = U.uniq(S.DB.feedbacks.map(function (x) { return x.cluster; }));
    UI.formModal({
      title: '处理反馈 · ' + r.id, wide: true,
      tip: '处理反馈的关键是给出明确结论：纳入需求、暂不处理还是已解决，并回填结论文本以便客户成功同步给客户。',
      fields: [
        { k: 'title', label: '反馈内容', req: true, full: true, val: r.title },
        { k: 'status', label: '处理状态', type: 'select', opts: C.DICT.fbStatus, val: r.status, req: true },
        { k: 'cluster', label: '聚类主题', type: 'select', opts: clusters, val: r.cluster, req: true },
        { k: 'impact', label: '影响面', type: 'select', opts: C.DICT.fbImpact, val: r.impact, req: true },
        { k: 'count', label: '提及次数', type: 'number', min: 1, val: r.count, req: true },
        { k: 'handler', label: '处理人', type: 'select', opts: P.memberNames(), val: r.handler, req: true },
        { k: 'nps', label: 'NPS 评分（0-10）', type: 'number', min: 0, max: 10, val: r.nps, req: true },
        { k: 'linkedReq', label: '关联需求编号', val: r.linkedReq, placeholder: '如 REQ-04，可留空', hint: '纳入需求后回填，便于反馈到需求的追溯' },
        { k: 'reply', label: '处理结论', type: 'textarea', full: true, rows: 4, val: r.reply, placeholder: '给客户成功 / 销售的口径说明' }
      ],
      onSubmit: function (d, h) {
        d.count = U.num(d.count, 1);
        d.nps = U.clamp(U.num(d.nps, 5), 0, 10);
        S.update('feedbacks', r.id, d);
        h.close(); Shell.route();
        UI.toast('反馈已更新', 'ok');
      }
    });
  }

  /* ============================================================
   * 子页 2：问题聚类
   * ========================================================== */
  function cluster(ctx) {
    var list = all();
    var keys = U.uniq(list.map(function (x) { return x.cluster; }));
    var groups = keys.map(function (k) {
      var g = list.filter(function (x) { return x.cluster === k; });
      var op = g.filter(isOpen);
      return {
        name: k, n: g.length, count: U.sum(g, 'count'),
        open: op.length,
        adopted: g.filter(function (x) { return x.status === '已纳入需求'; }).length,
        nps: g.length ? +U.avg(g, 'nps').toFixed(1) : 0,
        w: U.sum(g, weight),
        lines: U.uniq(g.map(function (x) { return x.lineName; })),
        top: U.sortBy(g, 'count', true).slice(0, 5),
        items: g
      };
    }).sort(function (a, b) { return b.w - a.w; });

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: '问题聚类',
        desc: '把散点反馈按主题收敛成「问题簇」，用「影响面加权量」判断该不该立项　·　共 ' +
          keys.length + ' 个聚类主题，' + list.length + ' 条反馈',
        acts: UI.exportMenu({ word: true })
      }) +
      P.permTip(MOD) +
      P.statCards([
        { label: '聚类主题', val: keys.length, unit: '类', ico: '◍', tone: 'doing', sub: '覆盖 ' + list.length + ' 条反馈' },
        { label: '最大问题簇', val: groups[0] ? groups[0].n : 0, unit: '条', ico: '◈', tone: 'warn', sub: groups[0] ? groups[0].name : '—' },
        { label: '待处理占比', val: U.pct(list.filter(isOpen).length, list.length), unit: '%', ico: '⚠', tone: 'danger', sub: '待分类 + 待评估' },
        { label: '立项转化率', val: U.pct(list.filter(function (x) { return x.status === '已纳入需求'; }).length, list.length), unit: '%', ico: '✓', tone: 'done', sub: '反馈 → 需求' }
      ]) + P.gap(4) +
      UI.grid(2,
        UI.card({ title: '聚类加权排行', sub: '影响面权重 × 提及次数，越高越该立项', ico: '▤', body: P.chart('clRank', 260) }) +
        UI.card({ title: '聚类 × 产品线', sub: '哪条线在哪类问题上最吃紧', ico: '▦', body: P.chart('clHeat', 260) })
      ) + P.gap(4) +
      UI.grid(2, groups.map(function (g) {
        return UI.card({
          title: g.name, ico: '◍',
          sub: g.n + ' 条反馈 · 累计提及 ' + g.count + ' 次 · 涉及 ' + g.lines.length + ' 条产品线',
          extra: g.open ? UI.tag(g.open + ' 条待处理', 'warn') : UI.tag('已全部处理', 'done'),
          body:
            P.kv([
              ['加权优先度', '<b>' + g.w + '</b>'],
              ['处理进展', g.adopted + ' 条已纳入需求 / ' + g.n + ' 条'],
              ['平均 NPS', g.nps + ' 分'],
              ['涉及产品线', g.lines.join('、')]
            ]) +
            '<div class="sec-t" style="margin:var(--sp-3) 0 var(--sp-2)">高频反馈 TOP5</div>' +
            g.top.map(function (x) {
              return UI.listItem({
                ico: String(x.count), title: E(x.title),
                desc: E(x.lineName + ' · ' + x.customer),
                right: UI.tag(x.status, C.tone('status', x.status)),
                click: true, data: ' data-fb="' + E(x.id) + '"'
              });
            }).join(''),
          foot: '<button class="btn btn-sm" data-cl="' + E(g.name) + '">在台账中查看全部</button>'
        });
      }).join(''));

    CH.bars('clRank', {
      data: groups.map(function (g) { return { label: g.name, value: g.w, text: g.w + '（' + g.n + ' 条）' }; }),
      palette: true,
      onClick: function (i) {
        P.setFlt(MOD, Object.assign({}, P.flt(MOD, DEF_F), { cluster: groups[i].name }));
        Shell.go(MOD, 'ledger');
      }
    });

    var ls = S.DB.lines;
    CH.heat('clHeat', {
      rows: keys, cols: ls.map(function (l) { return l.code; }), labelW: 118, vLabel: '反馈条数',
      matrix: keys.map(function (k) {
        return ls.map(function (l) {
          return list.filter(function (x) { return x.cluster === k && x.lineId === l.id; }).length;
        });
      }),
      fmt: function (n) { return n ? String(n) : ''; },
      onClick: function (r, c) {
        P.setFlt(MOD, Object.assign({}, P.flt(MOD, DEF_F), { cluster: keys[r], line: ls[c].id }));
        Shell.go(MOD, 'ledger');
      }
    });

    ctx.el.querySelectorAll('[data-cl]').forEach(function (b) {
      b.addEventListener('click', function () {
        P.setFlt(MOD, Object.assign({}, P.flt(MOD, DEF_F), { cluster: b.getAttribute('data-cl') }));
        Shell.go(MOD, 'ledger');
      });
    });
    ctx.el.querySelectorAll('[data-fb]').forEach(function (n) {
      n.addEventListener('click', function () {
        var x = list.filter(function (y) { return y.id === n.getAttribute('data-fb'); })[0];
        if (x) openFb(x);
      });
    });

    UI.bindExport(ctx.el, {
      csv: function () {
        P.csv('问题聚类', groups, [
          { label: '聚类主题', key: 'name' }, { label: '反馈条数', key: 'n' },
          { label: '累计提及', key: 'count' }, { label: '待处理', key: 'open' },
          { label: '已纳入需求', key: 'adopted' }, { label: '加权优先度', key: 'w' },
          { label: '平均NPS', key: 'nps' },
          { label: '涉及产品线', get: function (r) { return r.lines.join('/'); } }
        ]);
      },
      word: function () {
        P.word('问题聚类报告', '用户反馈问题聚类报告', [
          {
            h: '一、聚类结论',
            p: '共形成 ' + keys.length + ' 个问题簇。按「影响面权重 × 提及次数」排序，最应优先立项的是「' +
              (groups[0] || {}).name + '」（加权 ' + (groups[0] || {}).w + '，' + (groups[0] || {}).n + ' 条反馈）。'
          },
          {
            h: '二、聚类汇总',
            table: {
              cols: [
                { t: '聚类主题', k: 'name' }, { t: '反馈条数', k: 'n' }, { t: '累计提及', k: 'count' },
                { t: '待处理', k: 'open' }, { t: '已纳入需求', k: 'adopted' },
                { t: '加权优先度', k: 'w' }, { t: '平均NPS', k: 'nps' },
                { t: '涉及产品线', get: function (r) { return r.lines.join('、'); } }
              ],
              rows: groups
            }
          }
        ].concat(groups.map(function (g) {
          return {
            h3: g.name + '　高频反馈',
            table: {
              cols: [{ t: '反馈内容', k: 'title' }, { t: '产品线', k: 'lineName' },
              { t: '客户', k: 'customer' }, { t: '提及次数', k: 'count' }, { t: '状态', k: 'status' }],
              rows: g.top
            }
          };
        })));
        UI.toast('聚类报告已导出为 Word', 'ok');
      }
    });
  }

  /* ============================================================
   * 子页 3：标签管理
   * ========================================================== */
  function tags(ctx) {
    var list = all();
    var map = {};
    list.forEach(function (x) {
      (x.tags || []).forEach(function (t) {
        map[t] = map[t] || { name: t, n: 0, count: 0, open: 0, adopted: 0, lines: [], items: [] };
        map[t].n++;
        map[t].count += x.count;
        if (isOpen(x)) map[t].open++;
        if (x.status === '已纳入需求') map[t].adopted++;
        if (map[t].lines.indexOf(x.lineName) < 0) map[t].lines.push(x.lineName);
        map[t].items.push(x);
      });
    });
    var rows = Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.n - a.n; });
    var untagged = list.filter(function (x) { return !(x.tags || []).length; });

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: '标签管理',
        desc: '标签是反馈的第二维度（聚类之外的切面），用于跨主题地找出「体验类」「合规类」等横向问题　·　共 ' +
          rows.length + ' 个标签',
        acts: UI.exportMenu({ word: true }) + (ed() ? '　<button class="btn-primary" id="tgNew">＋ 新增标签</button>' : '')
      }) +
      P.permTip(MOD) +
      P.statCards([
        { label: '标签总数', val: rows.length, unit: '个', ico: '◫', tone: 'doing', sub: '覆盖 ' + list.length + ' 条反馈' },
        { label: '最热标签', val: rows[0] ? rows[0].n : 0, unit: '条', ico: '◈', tone: 'warn', sub: rows[0] ? rows[0].name : '—' },
        { label: '未打标签', val: untagged.length, unit: '条', ico: '⚠', tone: untagged.length ? 'danger' : 'done', sub: untagged.length ? '建议补齐后再做聚类' : '全部已打标' },
        { label: '平均每条标签数', val: list.length ? (U.sum(list, function (x) { return (x.tags || []).length; }) / list.length).toFixed(1) : '0', unit: '个', ico: '◔', tone: 'plan', sub: '标签粒度参考' }
      ]) + P.gap(4) +
      UI.grid(2,
        UI.card({ title: '标签热度', sub: '按反馈条数排序，点击查看该标签下的反馈', ico: '▤', body: P.chart('tgRank', 280) }) +
        UI.card({ title: '标签处理进度', sub: '每个标签下待处理 / 已纳入需求的比例', ico: '▦', body: P.chart('tgProg', 280) })
      ) + P.gap(4) +
      UI.card({ flush: true, title: '标签明细', ico: '◫', body: '<div id="tgTbl"></div>' });

    CH.bars('tgRank', {
      data: rows.slice(0, 12).map(function (r) { return { label: r.name, value: r.n, text: r.n + ' 条' }; }),
      palette: true,
      onClick: function (i) { openTag(rows[i]); }
    });

    CH.bar('tgProg', {
      labels: rows.slice(0, 8).map(function (r) { return r.name; }),
      height: 280, stack: true, legend: true,
      series: [
        { name: '待处理', data: rows.slice(0, 8).map(function (r) { return r.open; }), color: CH.TONE.warn },
        { name: '已纳入需求', data: rows.slice(0, 8).map(function (r) { return r.adopted; }), color: CH.TONE.done },
        { name: '其他状态', data: rows.slice(0, 8).map(function (r) { return r.n - r.open - r.adopted; }), color: CH.TONE.plan }
      ]
    });

    UI.table('#tgTbl', {
      pageSize: 0,
      cols: [
        { k: 'name', t: '标签', w: '170px', render: function (r) { return UI.tag(r.name, 'plain') + ' <span class="muted tiny">' + r.n + ' 条</span>'; } },
        {
          k: 'n', t: '反馈条数', w: '150px', align: 'right',
          render: function (r) {
            var mx = rows[0] ? rows[0].n : 1;
            return '<div style="display:flex;align-items:center;gap:8px;justify-content:flex-end">' +
              UI.pbar(Math.round(r.n / mx * 100), 'doing') + '<b style="min-width:28px;text-align:right">' + r.n + '</b></div>';
          }
        },
        { k: 'count', t: '累计提及', w: '104px', align: 'right' },
        { k: 'open', t: '待处理', w: '96px', align: 'right', render: function (r) { return r.open ? '<b class="tag tag-warn">' + r.open + '</b>' : '0'; } },
        { k: 'adopted', t: '已纳入需求', w: '116px', align: 'right' },
        { k: 'lines', t: '涉及产品线', render: function (r) { return r.lines.map(function (l) { return UI.tag(l, 'plain'); }).join(' '); }, sortVal: function (r) { return r.lines.length; } },
        {
          k: '', t: '操作', w: '150px', sortable: false, align: 'right',
          render: function () { return '<div class="row-acts"><button data-act="view">查看反馈</button><button data-act="go">去台账</button></div>'; }
        }
      ],
      rows: rows,
      empty: '暂无标签数据',
      onAct: function (act, r) {
        if (act === 'go') {
          P.setFlt(MOD, Object.assign({}, P.flt(MOD, DEF_F), { kw: r.name }));
          Shell.go(MOD, 'ledger');
        } else openTag(r);
      },
      onRow: function (r) { openTag(r); }
    });

    var nb = P.$('tgNew');
    if (nb) nb.addEventListener('click', function () {
      UI.formModal({
        title: '为反馈新增标签', one: true,
        tip: '选择一条反馈并追加标签。标签用于横向切面分析，建议控制在 10 个以内。',
        fields: [
          { k: 'fb', label: '目标反馈', type: 'select', req: true, opts: list.slice(0, 40).map(function (x) { return { v: x.id, t: x.id + ' ' + U.ellip(x.title, 22) }; }) },
          { k: 'tag', label: '新增标签', req: true, placeholder: '如：续约风险' }
        ],
        onSubmit: function (d, h) {
          var t = list.filter(function (x) { return x.id === d.fb; })[0];
          if (t) {
            var ts = (t.tags || []).slice();
            if (ts.indexOf(d.tag) < 0) ts.push(d.tag);
            S.update('feedbacks', t.id, { tags: ts });
          }
          h.close(); Shell.route();
          UI.toast('标签已添加', 'ok');
        }
      });
    });

    UI.bindExport(ctx.el, {
      csv: function () {
        P.csv('反馈标签', rows, [
          { label: '标签', key: 'name' }, { label: '反馈条数', key: 'n' },
          { label: '累计提及', key: 'count' }, { label: '待处理', key: 'open' },
          { label: '已纳入需求', key: 'adopted' },
          { label: '涉及产品线', get: function (r) { return r.lines.join('/'); } }
        ]);
      },
      word: function () {
        P.word('反馈标签分析', '用户反馈标签分析', [
          {
            h: '一、标签概览',
            p: '共使用 ' + rows.length + ' 个标签覆盖 ' + list.length + ' 条反馈，未打标签的反馈 ' + untagged.length + ' 条。'
          },
          {
            h: '二、标签明细',
            table: {
              cols: [
                { t: '标签', k: 'name' }, { t: '反馈条数', k: 'n' }, { t: '累计提及', k: 'count' },
                { t: '待处理', k: 'open' }, { t: '已纳入需求', k: 'adopted' },
                { t: '涉及产品线', get: function (r) { return r.lines.join('、'); } }
              ],
              rows: rows
            }
          },
          untagged.length ? {
            h: '三、未打标签的反馈',
            table: {
              cols: [{ t: '编号', k: 'id' }, { t: '反馈内容', k: 'title' }, { t: '产品线', k: 'lineName' }, { t: '状态', k: 'status' }],
              rows: untagged
            }
          } : { h: '三、未打标签的反馈', p: '全部反馈均已打标。' }
        ]);
        UI.toast('标签分析已导出为 Word', 'ok');
      }
    });
  }

  function openTag(r) {
    UI.drawer({
      title: '标签 · ' + r.name,
      sub: r.n + ' 条反馈　·　累计提及 ' + r.count + ' 次　·　待处理 ' + r.open + ' 条',
      body: UI.sec('标签概况', P.kv([
        ['反馈条数', r.n],
        ['累计提及次数', r.count],
        ['待处理', r.open + ' 条'],
        ['已纳入需求', r.adopted + ' 条'],
        ['涉及产品线', r.lines.join('、')]
      ])) +
        UI.sec('该标签下的反馈', r.items.map(function (x) {
          return UI.listItem({
            ico: '☷', title: E(x.title),
            desc: E(x.lineName + ' · ' + x.customer + ' · 提及 ' + x.count + ' 次'),
            right: UI.tag(x.status, C.tone('status', x.status)),
            click: true, data: ' data-fb="' + E(x.id) + '"'
          });
        }).join('')),
      onOpen: function (h) {
        h.el.querySelectorAll('[data-fb]').forEach(function (n) {
          n.addEventListener('click', function () {
            var x = all().filter(function (y) { return y.id === n.getAttribute('data-fb'); })[0];
            if (x) { h.close(); openFb(x); }
          });
        });
      }
    });
  }

  /* ============================================================ */
  Shell.page(MOD, {
    render: function (ctx) {
      if (ctx.sub === 'cluster') cluster(ctx);
      else if (ctx.sub === 'tags') tags(ctx);
      else ledger(ctx);
    }
  });
})();
