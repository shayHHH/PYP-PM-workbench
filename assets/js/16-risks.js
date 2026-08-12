/* ============================================================
 * 16-risks.js  风险预警
 * 子页：ledger 风险台账（红黄绿三色灯）/ issues 问题清单 / trend 趋势统计
 * 总监默认只看高等级风险；PM 全等级可见、按处理时限排序
 * ========================================================== */
(function () {
  'use strict';
  var E = U.esc, MOD = 'risks';

  var DEF_R = { kw: '', level: '', type: '', status: '', owner: '', open: '' };
  var DEF_I = { kw: '', status: '', priority: '', source: '', owner: '' };
  var CLOSED_R = ['已缓解', '已关闭'];
  var CLOSED_I = ['已解决', '已关闭'];

  function ed() { return P.ed(MOD); }
  function openR(list) { return list.filter(function (x) { return CLOSED_R.indexOf(x.status) < 0; }); }
  function lightOf(lv) { return UI.light(C.tone('light', lv), lv + '风险'); }

  /* ============================================================
   * 子页 1：风险台账
   * ========================================================== */
  function rList(f) {
    return S.risks().filter(function (r) {
      if (f.kw && !U.matchAny(r, ['title', 'id', 'owner', 'projectName', 'impactDesc'], f.kw)) return false;
      if (f.level && r.level !== f.level) return false;
      if (f.type && r.type !== f.type) return false;
      if (f.status && r.status !== f.status) return false;
      if (f.owner && r.owner !== f.owner) return false;
      if (f.open === '1' && CLOSED_R.indexOf(r.status) >= 0) return false;
      return true;
    }).sort(function (a, b) {
      var w = { '高': 0, '中': 1, '低': 2 };
      if (w[a.level] !== w[b.level]) return w[a.level] - w[b.level];
      return a.dueAt < b.dueAt ? -1 : 1;
    });
  }

  function ledger(ctx) {
    var f = P.flt(MOD, DEF_R);
    var all = S.risks();
    var rows = rList(f);
    var op = openR(all);

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: '风险台账',
        desc: '按红黄绿三色灯管理项目与产品线风险　·　' + P.scopeText() +
          '　·　共 ' + all.length + ' 条，命中 ' + rows.length + ' 条',
        acts: UI.exportMenu({ word: true }) + '　' + P.createBtn(MOD, 'risk.new', '登记风险')
      }) +
      P.permTip(MOD) +
      (S.isDirector() && String(f.level) === '高'
        ? UI.notice('info', '当前为<b>产品总监默认视角</b>，仅展示 <b>高等级</b> 风险。需要查看全部等级请在下方筛选条中把「风险等级」改为「全部等级」。') + P.gap(3)
        : '') +
      P.statCards([
        { label: '未闭环风险', val: op.length, unit: '条', ico: '⚠', tone: 'warn', sub: '累计登记 ' + all.length + ' 条' },
        { label: '高等级风险', val: op.filter(function (r) { return r.level === '高'; }).length, unit: '条', ico: '●', tone: 'danger', sub: '红灯，需专人跟进' },
        { label: '已升级', val: all.filter(function (r) { return r.status === '已升级'; }).length, unit: '条', ico: '↑', tone: 'plan', sub: '升级至事业群管理会' },
        { label: '逾期未处理', val: op.filter(function (r) { return r.overdue; }).length, unit: '条', ico: '⏱', tone: 'danger', sub: '已超过计划处理时限' }
      ]) + P.gap(4) +
      UI.grid(2,
        UI.card({ title: '风险矩阵（可能性 × 影响）', sub: '格子内为风险条数，点击可下钻', ico: '▩', body: P.chart('rkMatrix', 250) }) +
        UI.card({ title: '风险类型分布', sub: '未闭环风险按类型统计', ico: '◍', body: P.chart('rkType', 250) })
      ) + P.gap(4) +
      UI.card({
        flush: true,
        body: '<div class="toolbar" id="rkFlt">' +
          '<input class="fld fld-search" data-f="kw" placeholder="搜索风险 / 编号 / 负责人" value="' + E(f.kw) + '">' +
          P.sel('level', '全部等级', C.DICT.riskLevel, f.level) +
          P.sel('type', '全部风险类型', C.DICT.riskType, f.type) +
          P.sel('status', '全部状态', C.DICT.riskStatus, f.status) +
          P.sel('owner', '全部负责人', P.memberNames(), f.owner) +
          P.sel('open', '全部风险', [{ v: '1', t: '仅看未闭环' }], f.open) +
          '<span class="grow"></span>' + P.viewBar(MOD) +
          '<button class="btn btn-sm" data-reset>重置</button>' +
          '</div><div id="rkTbl"></div>'
      });

    /* ---- 风险矩阵 ---- */
    var PR = ['高', '中', '低'], IM = ['高', '中', '低'];
    var matrix = PR.map(function (p) {
      return IM.map(function (im) {
        return op.filter(function (r) { return r.prob === p && r.impact === im; }).length;
      });
    });
    CH.heat('rkMatrix', {
      rows: PR.map(function (x) { return '可能性 ' + x; }),
      cols: IM.map(function (x) { return '影响 ' + x; }),
      matrix: matrix, labelW: 76, vLabel: true,
      fmt: function (v) { return v ? v + ' 条' : '—'; },
      onClick: function (ri2, ci) {
        var hit = op.filter(function (r) { return r.prob === PR[ri2] && r.impact === IM[ci]; });
        if (!hit.length) { UI.toast('该格子暂无风险'); return; }
        UI.drawer({
          title: '可能性 ' + PR[ri2] + ' × 影响 ' + IM[ci],
          sub: '共 ' + hit.length + ' 条未闭环风险',
          body: hit.map(function (r) {
            return UI.listItem({
              ico: '⚠', title: E(r.title),
              desc: r.projectName + ' · ' + r.type + ' · 负责人 ' + r.owner,
              meta: '处理时限 ' + r.dueAt,
              right: lightOf(r.level) + UI.st('status', r.status)
            });
          }).join(''),
          foot: '<button class="btn" data-close>关闭</button>'
        });
      }
    });

    /* ---- 类型分布 ---- */
    var byType = U.countBy(op, 'type');
    var tRows = C.DICT.riskType.filter(function (t) { return byType[t]; })
      .map(function (t) { return { name: t, value: byType[t] }; });
    if (tRows.length) {
      CH.donut('rkType', {
        data: tRows, height: 250, center: { v: op.length, l: '未闭环风险' },
        onClick: function (i, d) {
          P.setFlt(MOD, Object.assign({}, P.flt(MOD, DEF_R), { type: d.name, open: '1' }));
          Shell.route();
        }
      });
    } else P.$('rkType').innerHTML = UI.empty('当前口径下没有未闭环风险');

    /* ---- 表格 ---- */
    var tb = UI.table('#rkTbl', {
      cols: [
        { k: 'id', t: '编号', w: '74px', render: function (r) { return UI.idCell(r.id); } },
        { k: 'level', t: '灯', w: '72px', align: 'center', sortVal: function (r) { return { '高': 0, '中': 1, '低': 2 }[r.level]; }, render: function (r) { return lightOf(r.level); } },
        { k: 'title', t: '风险描述', render: function (r) { return UI.cell2(E(r.title), r.impactDesc); } },
        { k: 'type', t: '类型', w: '104px', render: function (r) { return UI.tag(r.type, 'plain'); } },
        { k: 'projectName', t: '所属项目', w: '150px', render: function (r) { return UI.cell2(E(r.projectName), r.lineName); } },
        { k: 'owner', t: '负责人', w: '112px', render: function (r) { return UI.owner(r.owner); } },
        { k: 'response', t: '应对', w: '74px', align: 'center', render: function (r) { return UI.tag(r.response, 'plain'); } },
        {
          k: 'dueAt', t: '处理时限', w: '124px',
          render: function (r) {
            if (CLOSED_R.indexOf(r.status) >= 0) return '<span class="muted">' + E(r.dueAt) + '</span>';
            return UI.cell2(E(r.dueAt), UI.due(r.dueAt));
          }
        },
        {
          k: 'status', t: '状态', w: '92px',
          render: function (r) { return UI.st('status', r.status) + (r.escalated ? ' ' + UI.tag('↑', 'danger', { title: '已升级至 ' + r.escalateTo }) : ''); }
        },
        {
          k: '', t: '操作', w: '120px', sortable: false, align: 'right',
          render: function () {
            return '<div class="row-acts"><button data-act="open">详情</button>' +
              (ed() ? '<button data-act="edit">处置</button>' : '') + '</div>';
          }
        }
      ],
      rows: rows, pageSize: 12, select: true, index: true,
      empty: '没有匹配的风险记录',
      rowCls: function (r) { return CLOSED_R.indexOf(r.status) < 0 && r.level === '高' ? 'row-danger' : (r.overdue ? 'row-warn' : ''); },
      onRow: function (r) { openRisk(r); },
      onAct: function (act, r) { act === 'edit' ? editRisk(r) : openRisk(r); },
      bulk: ed() ? [
        {
          t: '批量标记已缓解', cls: 'btn-primary', fn: function (picked, clear) {
            UI.confirm('确认将选中的 ' + picked.length + ' 条风险标记为「已缓解」？', function () {
              picked.forEach(function (r) { S.update('risks', r.id, { status: '已缓解', overdue: false, escalated: false }); });
              clear(); Shell.route();
              UI.toast(picked.length + ' 条风险已闭环', 'ok');
            }, { title: '批量处置风险', tip: '闭环后仍会保留在台账与趋势统计中，可随时回看处置过程。', tipType: 'info' });
          }
        },
        { t: '批量导出所选', fn: function (picked) { csvRisks('风险台账_所选', picked); } }
      ] : [
        { t: '批量导出所选', fn: function (picked) { csvRisks('风险台账_所选', picked); } }
      ]
    });

    var box = P.$('rkFlt');
    P.bindFlt(box, MOD, DEF_R, function (nf) { tb.setRows(rList(nf)); });
    P.bindViews(box, MOD, DEF_R);

    UI.bindExport(ctx.el, {
      csv: function () { csvRisks('风险台账', rows); },
      word: function () { wordRisks(rows); }
    });

    if (ctx.id) {
      var hit2 = S.riskBy(ctx.id);
      if (hit2) openRisk(hit2);
    }
  }

  function csvRisks(name, list) {
    P.csv(name, list, [
      { label: '编号', key: 'id' }, { label: '风险描述', key: 'title' },
      { label: '等级', key: 'level' }, { label: '类型', key: 'type' },
      { label: '项目', key: 'projectName' }, { label: '产品线', key: 'lineName' },
      { label: '可能性', key: 'prob' }, { label: '影响程度', key: 'impact' },
      { label: '影响说明', key: 'impactDesc' }, { label: '应对策略', key: 'response' },
      { label: '缓解计划', key: 'plan' }, { label: '负责人', key: 'owner' },
      { label: '发现日期', key: 'foundAt' }, { label: '处理时限', key: 'dueAt' },
      { label: '状态', key: 'status' },
      { label: '是否逾期', get: function (r) { return r.overdue ? '是' : '否'; } },
      { label: '是否升级', get: function (r) { return r.escalated ? '是（' + r.escalateTo + '）' : '否'; } }
    ]);
  }

  function wordRisks(list) {
    var op = openR(list);
    P.word('风险台账', '项目风险台账与处置报告', [
      {
        h: '一、总体情况',
        p: '统计口径：' + P.scopeText() + '；共登记风险 ' + list.length + ' 条，未闭环 ' + op.length +
          ' 条，其中高等级 ' + op.filter(function (r) { return r.level === '高'; }).length +
          ' 条、已升级 ' + list.filter(function (r) { return r.status === '已升级'; }).length +
          ' 条、逾期未处理 ' + op.filter(function (r) { return r.overdue; }).length + ' 条。'
      },
      {
        h: '二、未闭环风险清单',
        table: {
          cols: [
            { t: '编号', k: 'id' }, { t: '风险描述', k: 'title' }, { t: '等级', k: 'level' },
            { t: '类型', k: 'type' }, { t: '项目', k: 'projectName' }, { t: '负责人', k: 'owner' },
            { t: '应对', k: 'response' }, { t: '处理时限', k: 'dueAt' }, { t: '状态', k: 'status' }
          ], rows: op
        }
      },
      {
        h: '三、高等级风险处置说明',
        list: op.filter(function (r) { return r.level === '高'; }).map(function (r) {
          return '【' + r.id + '】' + r.title + '（' + r.projectName + '，负责人 ' + r.owner + '）：' +
            r.impactDesc + '；应对策略「' + r.response + '」，' + r.plan;
        })
      },
      {
        h: '四、升级事项',
        list: list.filter(function (r) { return r.escalated; }).map(function (r) {
          return '【' + r.id + '】' + r.title + ' —— 已升级至 ' + (r.escalateTo || '上级管理会') + '，等待决策。';
        })
      }
    ]);
  }

  function openRisk(r) {
    var iss = S.issues('all').filter(function (x) { return x.relatedRisk === r.id; });
    UI.drawer({
      wide: true,
      title: lightOf(r.level) + ' ' + E(r.title),
      sub: r.id + ' · ' + r.type + ' · ' + r.projectName + ' · 负责人 ' + r.owner,
      body:
        UI.sec('风险要素', UI.dl([
          ['风险编号', r.id], ['风险类型', UI.tag(r.type, 'plain')],
          ['风险等级', lightOf(r.level)], ['当前状态', UI.st('status', r.status)],
          ['可能性', UI.tag(r.prob, C.tone('level', r.prob))], ['影响程度', UI.tag(r.impact, C.tone('level', r.impact))],
          ['所属项目', r.projectName], ['所属产品线', r.lineName],
          ['责任人', UI.owner(r.owner)], ['应对策略', UI.tag(r.response, 'plain')],
          ['发现日期', r.foundAt], ['处理时限', r.dueAt + '　' + (CLOSED_R.indexOf(r.status) < 0 ? UI.due(r.dueAt) : '')],
          ['是否升级', r.escalated ? UI.tag('已升级至 ' + r.escalateTo, 'danger') : '否'],
          ['风险分值', r.score]
        ], 'dl-2col')) +
        UI.sec('影响说明', '<div class="rich">' + E(r.impactDesc) + '</div>') +
        UI.sec('缓解计划', '<div class="rich">' + E(r.plan) + '</div>') +
        UI.sec('跟进记录（' + (r.updates || []).length + '）',
          (r.updates || []).length
            ? UI.tline((r.updates || []).map(function (u) {
              return { time: u.at, title: E(u.text), meta: '<span>' + E(u.by) + '</span>' };
            }))
            : UI.empty('暂无跟进记录')) +
        UI.sec('关联问题（' + iss.length + '）',
          iss.length ? iss.map(function (x) {
            return UI.listItem({
              ico: '◆', title: E(x.title), desc: x.projectName + ' · 来源 ' + x.source + ' · 负责人 ' + x.owner,
              right: UI.pri(x.priority) + UI.st('status', x.status)
            });
          }).join('') : UI.empty('暂无关联问题')),
      foot: '<div class="left"><button class="btn" data-add-log>补充跟进记录</button></div>' +
        '<button class="btn" data-close>关闭</button>' +
        (ed() ? '<button class="btn-primary" data-edit>处置风险</button>' : ''),
      onOpen: function (d) {
        var a = d.el.querySelector('[data-add-log]');
        if (a) a.addEventListener('click', function () {
          if (!ed()) { UI.toast('当前角色无编辑权限', 'err'); return; }
          UI.formModal({
            title: '补充跟进记录 · ' + r.id, one: true,
            fields: [{ k: 'text', label: '跟进说明', type: 'textarea', req: true, rows: 3, placeholder: '如：已完成压测，风险等级下调为中' }],
            onSubmit: function (v) {
              var ups = (r.updates || []).slice();
              ups.unshift({ at: U.fmtDate(S.TODAY), by: S.roleObj().user.name, text: v.text });
              S.update('risks', r.id, { updates: ups });
              d.close(); Shell.route();
              UI.toast('跟进记录已补充', 'ok');
            }
          });
        });
        var eb = d.el.querySelector('[data-edit]');
        if (eb) eb.addEventListener('click', function () { d.close(); editRisk(r); });
      }
    });
  }

  function editRisk(r) {
    UI.formModal({
      title: '处置风险 · ' + r.id, wide: true,
      fields: [
        { k: 'title', label: '风险描述', req: true, full: true, val: r.title },
        { k: 'type', label: '风险类型', type: 'select', req: true, opts: C.DICT.riskType, val: r.type },
        { k: 'level', label: '风险等级', type: 'select', req: true, opts: C.DICT.riskLevel, val: r.level },
        { k: 'prob', label: '可能性', type: 'select', req: true, opts: C.DICT.riskLevel, val: r.prob },
        { k: 'impact', label: '影响程度', type: 'select', req: true, opts: C.DICT.riskLevel, val: r.impact },
        { k: 'response', label: '应对策略', type: 'select', req: true, opts: ['规避', '减轻', '转移', '接受'], val: r.response },
        { k: 'owner', label: '责任人', type: 'select', req: true, opts: P.memberNames(), val: r.owner },
        { k: 'dueAt', label: '处理时限', type: 'date', req: true, val: r.dueAt },
        { k: 'status', label: '当前状态', type: 'select', req: true, opts: C.DICT.riskStatus, val: r.status },
        { k: 'impactDesc', label: '影响说明', type: 'textarea', full: true, val: r.impactDesc },
        { k: 'plan', label: '缓解计划', type: 'textarea', full: true, val: r.plan }
      ],
      onSubmit: function (d) {
        S.update('risks', r.id, {
          title: d.title, type: d.type, level: d.level, prob: d.prob, impact: d.impact,
          response: d.response, owner: d.owner, dueAt: d.dueAt, status: d.status,
          impactDesc: d.impactDesc, plan: d.plan,
          escalated: d.status === '已升级',
          escalateTo: d.status === '已升级' ? (r.escalateTo || '事业群管理会') : '',
          overdue: U.daysLeft(d.dueAt) < 0 && CLOSED_R.indexOf(d.status) < 0,
          score: ({ '高': 3, '中': 2, '低': 1 })[d.level] * ({ '高': 3, '中': 2, '低': 1 })[d.prob]
        });
        UI.toast('风险已更新', 'ok');
        Shell.route();
      }
    });
  }

  /* ============================================================
   * 子页 2：问题清单
   * ========================================================== */
  function iList(f) {
    return S.issues().filter(function (x) {
      if (f.kw && !U.matchAny(x, ['title', 'id', 'owner', 'projectName', 'resolution'], f.kw)) return false;
      if (f.status && x.status !== f.status) return false;
      if (f.priority && x.priority !== f.priority) return false;
      if (f.source && x.source !== f.source) return false;
      if (f.owner && x.owner !== f.owner) return false;
      return true;
    }).sort(function (a, b) {
      if (a.priority !== b.priority) return a.priority < b.priority ? -1 : 1;
      return a.dueAt < b.dueAt ? -1 : 1;
    });
  }

  function issues(ctx) {
    var f = P.flt(MOD, DEF_I);
    var all = S.issues();
    var rows = iList(f);
    var op = all.filter(function (x) { return CLOSED_I.indexOf(x.status) < 0; });

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: '问题清单',
        desc: '线上反馈、测试发现、监控告警等具体问题的闭环跟踪　·　' + P.scopeText() +
          '　·　共 ' + all.length + ' 条，命中 ' + rows.length + ' 条',
        acts: UI.exportMenu({ word: true })
      }) +
      P.permTip(MOD) +
      P.statCards([
        { label: '未闭环问题', val: op.length, unit: '条', ico: '◆', tone: 'warn', sub: '累计 ' + all.length + ' 条' },
        { label: 'P0 / P1', val: op.filter(function (x) { return x.priority === 'P0' || x.priority === 'P1'; }).length, unit: '条', ico: '!', tone: 'danger', sub: '高优先级，需当日响应' },
        { label: '逾期未解决', val: op.filter(function (x) { return x.overdue; }).length, unit: '条', ico: '⏱', tone: 'danger', sub: '已超过承诺解决时限' },
        { label: '解决率', val: U.pct(all.length - op.length, all.length), unit: '%', ico: '◎', tone: U.pct(all.length - op.length, all.length) >= 60 ? 'done' : 'warn', sub: '已解决 ' + (all.length - op.length) + ' / ' + all.length }
      ]) + P.gap(4) +
      UI.grid(2,
        UI.card({ title: '问题状态分布', sub: '点击可下钻筛选', ico: '◍', body: P.chart('isDonut', 250) }) +
        UI.card({ title: '问题来源分布', sub: '反映质量问题的暴露渠道', ico: '▤', body: P.chart('isSrc') })
      ) + P.gap(4) +
      UI.card({
        flush: true,
        body: '<div class="toolbar" id="isFlt">' +
          '<input class="fld fld-search" data-f="kw" placeholder="搜索问题 / 编号 / 负责人" value="' + E(f.kw) + '">' +
          P.sel('status', '全部状态', C.DICT.issueStatus, f.status) +
          P.sel('priority', '全部优先级', C.DICT.priority, f.priority) +
          P.sel('source', '全部来源', ['线上反馈', '测试发现', '监控告警', '客户报障', '内部自查'], f.source) +
          P.sel('owner', '全部负责人', P.memberNames(), f.owner) +
          '<span class="grow"></span>' + P.viewBar(MOD) +
          '<button class="btn btn-sm" data-reset>重置</button>' +
          '</div><div id="isTbl"></div>'
      });

    var byS = U.countBy(all, 'status');
    var sRows = C.DICT.issueStatus.filter(function (s) { return byS[s]; })
      .map(function (s) { return { name: s, value: byS[s] }; });
    if (sRows.length) {
      CH.donut('isDonut', {
        data: sRows, height: 250, center: { v: all.length, l: '问题总数' },
        onClick: function (i, d) {
          P.setFlt(MOD, Object.assign({}, P.flt(MOD, DEF_I), { status: d.name }));
          Shell.route();
        }
      });
    } else P.$('isDonut').innerHTML = UI.empty('当前口径下暂无问题记录');

    var bySrc = U.countBy(all, 'source');
    var srcRows = Object.keys(bySrc).map(function (k) { return { name: k, value: bySrc[k] }; })
      .sort(function (a, b) { return b.value - a.value; });
    if (srcRows.length) {
      CH.bars('isSrc', {
        data: srcRows.map(function (r) {
          var mine = all.filter(function (x) { return x.source === r.name && CLOSED_I.indexOf(x.status) < 0; });
          return {
            label: r.name, value: r.value,
            color: mine.length > 2 ? CH.TONE.warn : CH.TONE.doing,
            text: r.value + ' 条（未闭环 ' + mine.length + '）'
          };
        }),
        onClick: function (i) {
          P.setFlt(MOD, Object.assign({}, P.flt(MOD, DEF_I), { source: srcRows[i].name }));
          Shell.route();
        }
      });
    } else P.$('isSrc').innerHTML = UI.empty('暂无问题来源数据');

    var tb = UI.table('#isTbl', {
      cols: [
        { k: 'id', t: '编号', w: '72px', render: function (r) { return UI.idCell(r.id); } },
        { k: 'priority', t: '优先级', w: '80px', render: function (r) { return UI.pri(r.priority); } },
        { k: 'title', t: '问题描述', render: function (r) { return UI.cell2(E(r.title), r.resolution || '待处理'); } },
        { k: 'source', t: '来源', w: '96px', render: function (r) { return UI.tag(r.source, 'plain'); } },
        { k: 'projectName', t: '所属项目', w: '150px', render: function (r) { return UI.cell2(E(r.projectName), r.lineName); } },
        { k: 'owner', t: '负责人', w: '112px', render: function (r) { return UI.owner(r.owner); } },
        {
          k: 'dueAt', t: '解决时限', w: '124px',
          render: function (r) {
            if (CLOSED_I.indexOf(r.status) >= 0) return '<span class="muted">' + E(r.dueAt) + '</span>';
            return UI.cell2(E(r.dueAt), UI.due(r.dueAt));
          }
        },
        {
          k: 'relatedRisk', t: '关联风险', w: '104px', align: 'center',
          render: function (r) {
            if (!r.relatedRisk) return '<span class="muted">—</span>';
            return '<span class="link" data-go="risks/ledger/' + E(r.relatedRisk) + '">' + E(r.relatedRisk) + '</span>';
          }
        },
        { k: 'status', t: '状态', w: '90px', render: function (r) { return UI.st('status', r.status); } },
        {
          k: '', t: '操作', w: '120px', sortable: false, align: 'right',
          render: function () {
            return '<div class="row-acts"><button data-act="open">详情</button>' +
              (ed() ? '<button data-act="edit">处理</button>' : '') + '</div>';
          }
        }
      ],
      rows: rows, pageSize: 12, select: true, index: true,
      empty: '没有匹配的问题记录',
      rowCls: function (r) { return r.overdue ? 'row-danger' : ''; },
      onRow: function (r) { openIssue(r); },
      onAct: function (act, r) { act === 'edit' ? editIssue(r) : openIssue(r); },
      bulk: ed() ? [
        {
          t: '批量标记已解决', cls: 'btn-primary', fn: function (picked, clear) {
            UI.confirm('确认将选中的 ' + picked.length + ' 条问题标记为「已解决」？', function () {
              picked.forEach(function (x) { S.update('issues', x.id, { status: '已解决', overdue: false, resolution: x.resolution || '已修复并回归通过' }); });
              clear(); Shell.route();
              UI.toast(picked.length + ' 条问题已闭环', 'ok');
            }, { title: '批量处理问题' });
          }
        },
        { t: '批量导出所选', fn: function (picked) { csvIssues('问题清单_所选', picked); } }
      ] : [
        { t: '批量导出所选', fn: function (picked) { csvIssues('问题清单_所选', picked); } }
      ]
    });

    var box = P.$('isFlt');
    P.bindFlt(box, MOD, DEF_I, function (nf) { tb.setRows(iList(nf)); });
    P.bindViews(box, MOD, DEF_I);

    UI.bindExport(ctx.el, {
      csv: function () { csvIssues('问题清单', rows); },
      word: function () {
        P.word('问题清单', '问题清单与处理情况', [
          {
            h: '一、总体情况',
            p: '统计口径：' + P.scopeText() + '；共 ' + all.length + ' 条问题，未闭环 ' + op.length +
              ' 条，解决率 ' + U.pctStr(all.length - op.length, all.length) + '。'
          },
          {
            h: '二、未闭环问题',
            table: {
              cols: [
                { t: '编号', k: 'id' }, { t: '优先级', k: 'priority' }, { t: '问题', k: 'title' },
                { t: '来源', k: 'source' }, { t: '项目', k: 'projectName' },
                { t: '负责人', k: 'owner' }, { t: '时限', k: 'dueAt' }, { t: '状态', k: 'status' }
              ], rows: rows.filter(function (x) { return CLOSED_I.indexOf(x.status) < 0; })
            }
          },
          {
            h: '三、逾期问题',
            list: op.filter(function (x) { return x.overdue; }).map(function (x) {
              return '【' + x.id + '】' + x.title + '（' + x.priority + '，负责人 ' + x.owner + '，' + U.dueText(x.dueAt) + '）';
            })
          }
        ]);
      }
    });
  }

  function csvIssues(name, list) {
    P.csv(name, list, [
      { label: '编号', key: 'id' }, { label: '问题描述', key: 'title' },
      { label: '优先级', key: 'priority' }, { label: '来源', key: 'source' },
      { label: '项目', key: 'projectName' }, { label: '产品线', key: 'lineName' },
      { label: '负责人', key: 'owner' }, { label: '发现日期', key: 'foundAt' },
      { label: '解决时限', key: 'dueAt' }, { label: '状态', key: 'status' },
      { label: '是否逾期', get: function (x) { return x.overdue ? '是' : '否'; } },
      { label: '关联风险', key: 'relatedRisk' }, { label: '处理结论', key: 'resolution' }
    ]);
  }

  function openIssue(x) {
    var rk = x.relatedRisk ? S.riskBy(x.relatedRisk) : null;
    UI.drawer({
      title: UI.pri(x.priority) + ' ' + E(x.title),
      sub: x.id + ' · ' + x.projectName + ' · 来源 ' + x.source,
      body:
        UI.sec('问题详情', UI.dl([
          ['问题编号', x.id], ['优先级', UI.pri(x.priority)],
          ['当前状态', UI.st('status', x.status)], ['是否逾期', x.overdue ? UI.tag('已逾期', 'danger') : UI.tag('正常', 'done')],
          ['所属项目', x.projectName], ['所属产品线', x.lineName],
          ['问题来源', UI.tag(x.source, 'plain')], ['负责人', UI.owner(x.owner)],
          ['发现日期', x.foundAt], ['解决时限', x.dueAt + '　' + (CLOSED_I.indexOf(x.status) < 0 ? UI.due(x.dueAt) : '')],
          ['处理结论', x.resolution || '—']
        ], 'dl-2col')) +
        (rk ? UI.sec('关联风险', UI.listItem({
          ico: '⚠', title: E(rk.title),
          desc: rk.type + ' · ' + rk.projectName + ' · 负责人 ' + rk.owner,
          right: lightOf(rk.level) + UI.st('status', rk.status)
        })) : ''),
      foot: '<button class="btn" data-close>关闭</button>' +
        (ed() ? '<button class="btn-primary" data-edit>处理问题</button>' : ''),
      onOpen: function (d) {
        var b = d.el.querySelector('[data-edit]');
        if (b) b.addEventListener('click', function () { d.close(); editIssue(x); });
      }
    });
  }

  function editIssue(x) {
    UI.formModal({
      title: '处理问题 · ' + x.id, wide: true,
      fields: [
        { k: 'title', label: '问题描述', req: true, full: true, val: x.title },
        { k: 'priority', label: '优先级', type: 'select', req: true, opts: C.DICT.priority, val: x.priority },
        { k: 'status', label: '状态', type: 'select', req: true, opts: C.DICT.issueStatus, val: x.status },
        { k: 'owner', label: '负责人', type: 'select', req: true, opts: P.memberNames(), val: x.owner },
        { k: 'dueAt', label: '解决时限', type: 'date', req: true, val: x.dueAt },
        { k: 'source', label: '问题来源', type: 'select', req: true, opts: ['线上反馈', '测试发现', '监控告警', '客户报障', '内部自查'], val: x.source },
        { k: 'resolution', label: '处理结论', type: 'textarea', full: true, val: x.resolution, placeholder: '闭环时填写，如：已修复并回归通过' }
      ],
      onSubmit: function (d) {
        S.update('issues', x.id, {
          title: d.title, priority: d.priority, status: d.status, owner: d.owner,
          dueAt: d.dueAt, source: d.source, resolution: d.resolution,
          overdue: U.daysLeft(d.dueAt) < 0 && CLOSED_I.indexOf(d.status) < 0
        });
        UI.toast('问题已更新', 'ok');
        Shell.route();
      }
    });
  }

  /* ============================================================
   * 子页 3：趋势统计
   * ========================================================== */
  function trend(ctx) {
    var risks = S.risks('all');
    var iss = S.issues('all');
    var scopeR = S.risks(), scopeI = S.issues();
    var op = openR(scopeR);

    /* 近 12 周新增 / 闭环 */
    var labels = [], added = [], closed = [], stock = [];
    for (var i = 11; i >= 0; i--) {
      var s = U.addDay(S.TODAY, -i * 7 - 6), e = U.addDay(S.TODAY, -i * 7);
      labels.push(U.fmtMD(e));
      added.push(scopeR.filter(function (r) { return U.inRange(r.foundAt, s, e); }).length);
      closed.push(scopeR.filter(function (r) { return CLOSED_R.indexOf(r.status) >= 0 && U.inRange(r.dueAt, s, e); }).length);
      stock.push(scopeR.filter(function (r) {
        return U.dayDiff(r.foundAt, e) >= 0 && (CLOSED_R.indexOf(r.status) < 0 || U.dayDiff(r.dueAt, e) < 0);
      }).length);
    }

    /* 项目三色灯 */
    var projs = S.projectsInScope().map(function (p) {
      var mine = openR(scopeR.filter(function (r) { return r.projectId === p.id; }));
      var hi = mine.filter(function (r) { return r.level === '高'; }).length;
      var mid = mine.filter(function (r) { return r.level === '中'; }).length;
      var lv = hi ? '高' : (mid ? '中' : '低');
      return { p: p, open: mine.length, hi: hi, mid: mid, lv: lv, od: mine.filter(function (r) { return r.overdue; }).length };
    }).sort(function (a, b) { return b.hi - a.hi || b.open - a.open; });

    var esc = scopeR.filter(function (r) { return r.escalated; });

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: '风险趋势统计',
        desc: '风险新增与闭环节奏、类型集中度、项目三色灯与升级记录　·　' + P.scopeText(),
        acts: UI.exportMenu({ word: true })
      }) +
      P.permTip(MOD) +
      P.statCards([
        { label: '近 4 周新增', val: added.slice(-4).reduce(function (a, b) { return a + b; }, 0), unit: '条', ico: '↗', tone: 'warn', sub: '前 4 周 ' + added.slice(-8, -4).reduce(function (a, b) { return a + b; }, 0) + ' 条' },
        { label: '近 4 周闭环', val: closed.slice(-4).reduce(function (a, b) { return a + b; }, 0), unit: '条', ico: '✓', tone: 'done', sub: '闭环速度决定风险存量' },
        { label: '当前存量', val: op.length, unit: '条', ico: '≡', tone: op.length > 8 ? 'danger' : 'doing', sub: '高 ' + op.filter(function (r) { return r.level === '高'; }).length + ' · 中 ' + op.filter(function (r) { return r.level === '中'; }).length + ' · 低 ' + op.filter(function (r) { return r.level === '低'; }).length },
        { label: '红灯项目', val: projs.filter(function (x) { return x.lv === '高'; }).length, unit: '个', ico: '●', tone: 'danger', sub: '共 ' + projs.length + ' 个项目在管' }
      ]) + P.gap(4) +
      UI.card({
        title: '风险新增 / 闭环 / 存量趋势', sub: '近 12 周，按自然周统计', ico: '◹',
        extra: '<span class="muted tiny">存量持续走高说明闭环速度跟不上暴露速度</span>',
        body: P.chart('rtLine', 300)
      }) + P.gap(4) +
      UI.grid(2,
        UI.card({ title: '风险类型集中度', sub: '全部风险按类型排行', ico: '▤', body: P.chart('rtType') }) +
        UI.card({ title: '问题优先级分布', sub: '未闭环问题按优先级', ico: '◍', body: P.chart('rtPri', 250) })
      ) + P.gap(4) +
      UI.card({
        title: '项目风险三色灯', sub: '按未闭环高风险数排序；点击行查看该项目风险', ico: '◉', flush: true,
        body: '<div id="rtProj"></div>'
      }) + P.gap(4) +
      UI.card({
        title: '风险升级记录（' + esc.length + '）', sub: '已升级至上级管理会的风险', ico: '↑',
        body: esc.length ? esc.map(function (r) {
          return UI.listItem({
            ico: '↑', icoStyle: 'background:var(--s-danger-bg);color:var(--s-danger)',
            title: E(r.title),
            desc: r.projectName + ' · ' + r.type + ' · 负责人 ' + r.owner,
            meta: '升级至 ' + E(r.escalateTo || '上级管理会') + ' · 处理时限 ' + E(r.dueAt),
            right: lightOf(r.level) + UI.st('status', r.status),
            click: true, data: ' data-go="risks/ledger/' + E(r.id) + '"'
          });
        }).join('') : UI.empty('当前口径下没有已升级的风险')
      });

    CH.line('rtLine', {
      labels: labels, height: 300, legend: true, dot: true,
      series: [
        { name: '新增风险', data: added, color: CH.TONE.danger },
        { name: '闭环风险', data: closed, color: CH.TONE.done },
        { name: '未闭环存量', data: stock, color: CH.TONE.warn, area: true }
      ]
    });

    var byType = U.countBy(scopeR, 'type');
    var tRows = C.DICT.riskType.filter(function (t) { return byType[t]; })
      .map(function (t) { return { name: t, value: byType[t] }; })
      .sort(function (a, b) { return b.value - a.value; });
    if (tRows.length) {
      CH.bar('rtType', {
        horizontal: true, labels: tRows.map(function (r) { return r.name; }),
        series: [{ name: '风险条数', data: tRows.map(function (r) { return r.value; }) }],
        colors: tRows.map(function (r) {
          var hi = scopeR.filter(function (x) { return x.type === r.name && x.level === '高' && CLOSED_R.indexOf(x.status) < 0; }).length;
          return hi ? CH.TONE.danger : CH.TONE.doing;
        }),
        onClick: function (i) {
          P.setFlt(MOD, Object.assign({}, P.flt(MOD, DEF_R), { type: tRows[i].name, level: '' }));
          Shell.go(MOD, 'ledger');
        }
      });
    } else P.$('rtType').innerHTML = UI.empty('暂无风险数据');

    var opI = scopeI.filter(function (x) { return CLOSED_I.indexOf(x.status) < 0; });
    var byP = U.countBy(opI, 'priority');
    var pRows = C.DICT.priority.filter(function (p) { return byP[p]; })
      .map(function (p) { return { name: p, value: byP[p], color: p === 'P0' ? CH.TONE.danger : (p === 'P1' ? CH.TONE.warn : CH.TONE.doing) }; });
    if (pRows.length) {
      CH.donut('rtPri', {
        data: pRows, height: 250, center: { v: opI.length, l: '未闭环问题' },
        onClick: function (i, d) {
          P.setFlt(MOD, Object.assign({}, P.flt(MOD, DEF_I), { priority: d.name }));
          Shell.go(MOD, 'issues');
        }
      });
    } else P.$('rtPri').innerHTML = UI.empty('暂无未闭环问题');

    UI.table('#rtProj', {
      cols: [
        { k: 'lv', t: '三色灯', w: '86px', align: 'center', render: function (r) { return UI.light(C.tone('light', r.lv)); } },
        { k: 'name', t: '项目', sortVal: function (r) { return r.p.name; }, render: function (r) { return UI.cell2(E(r.p.name), r.p.lineName + ' · ' + r.p.pm); } },
        { k: 'status', t: '项目状态', w: '96px', sortVal: function (r) { return r.p.status; }, render: function (r) { return UI.st('status', r.p.status); } },
        { k: 'hi', t: '高风险', w: '84px', align: 'right', render: function (r) { return r.hi ? '<b style="color:var(--s-danger)">' + r.hi + '</b>' : '<span class="muted">0</span>'; } },
        { k: 'mid', t: '中风险', w: '84px', align: 'right', render: function (r) { return r.mid || '<span class="muted">0</span>'; } },
        { k: 'open', t: '未闭环合计', w: '104px', align: 'right' },
        { k: 'od', t: '逾期', w: '74px', align: 'right', render: function (r) { return r.od ? UI.tag(r.od, 'danger') : '<span class="muted">0</span>'; } },
        { k: 'progress', t: '项目进度', w: '140px', sortVal: function (r) { return r.p.progress; }, render: function (r) { return P.pctCell(r.p.progress, r.lv === '高'); } }
      ],
      rows: projs, pageSize: 0, index: true,
      empty: '当前口径下暂无项目',
      rowCls: function (r) { return r.lv === '高' ? 'row-danger' : (r.lv === '中' ? 'row-warn' : ''); },
      onRow: function (r) {
        P.setFlt(MOD, Object.assign({}, P.flt(MOD, DEF_R), { kw: '', level: '', open: '1' }));
        S.setProject(r.p.id);
        Shell.go(MOD, 'ledger');
      }
    });

    UI.bindExport(ctx.el, {
      csv: function () {
        P.csv('风险趋势统计', labels.map(function (l, i) {
          return { week: l, added: added[i], closed: closed[i], stock: stock[i] };
        }), [
          { label: '周次（截止日）', key: 'week' }, { label: '新增风险', key: 'added' },
          { label: '闭环风险', key: 'closed' }, { label: '未闭环存量', key: 'stock' }
        ]);
      },
      word: function () {
        P.word('风险趋势统计', '风险趋势与三色灯报告', [
          {
            h: '一、趋势概览',
            p: '统计口径：' + P.scopeText() + '。近 4 周新增风险 ' + added.slice(-4).reduce(function (a, b) { return a + b; }, 0) +
              ' 条、闭环 ' + closed.slice(-4).reduce(function (a, b) { return a + b; }, 0) +
              ' 条，当前未闭环存量 ' + op.length + ' 条（高 ' + op.filter(function (r) { return r.level === '高'; }).length + ' 条）。'
          },
          {
            h: '二、周度明细',
            table: {
              cols: [{ t: '周次', k: 'week' }, { t: '新增', k: 'added' }, { t: '闭环', k: 'closed' }, { t: '存量', k: 'stock' }],
              rows: labels.map(function (l, i) { return { week: l, added: added[i], closed: closed[i], stock: stock[i] }; })
            }
          },
          {
            h: '三、项目三色灯',
            table: {
              cols: [
                { t: '项目', get: function (r) { return r.p.name; } },
                { t: '产品线', get: function (r) { return r.p.lineName; } },
                { t: '项目经理', get: function (r) { return r.p.pm; } },
                { t: '三色灯', get: function (r) { return ({ '高': '红灯', '中': '黄灯', '低': '绿灯' })[r.lv]; } },
                { t: '高风险', k: 'hi' }, { t: '未闭环', k: 'open' }, { t: '逾期', k: 'od' }
              ], rows: projs
            }
          },
          {
            h: '四、升级事项',
            list: esc.map(function (r) {
              return '【' + r.id + '】' + r.title + '（' + r.projectName + '）已升级至 ' + (r.escalateTo || '上级管理会') + '，处理时限 ' + r.dueAt + '。';
            })
          }
        ]);
      }
    });
  }

  /* ============================================================ */
  Shell.page(MOD, {
    render: function (ctx) {
      if (ctx.sub === 'issues') issues(ctx);
      else if (ctx.sub === 'trend') trend(ctx);
      else ledger(ctx);
    }
  });
})();
