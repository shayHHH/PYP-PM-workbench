/* ============================================================
 * 15-meetings.js  会议纪要
 * 子页：list 会议列表（含详情抽屉：议程 / 纪要 / 决策 / Action）
 *       actions Action Item 跟踪
 * 总监视角突出「决策项」，PM 视角突出「Action Item」
 * ========================================================== */
(function () {
  'use strict';
  var E = U.esc, MOD = 'meetings';

  var DEF_M = { kw: '', type: '', host: '', range: '' };
  var DEF_A = { kw: '', status: '', owner: '', overdue: '' };

  function ed() { return P.ed(MOD); }
  function view() { return C.viewOf(S.role(), MOD); }
  function focusDecision() { return (view().cols || []).indexOf('decisions') >= 0; }

  /* Action 归属某场会议 */
  function actsOf(m) {
    return S.actions('all').filter(function (a) { return a.meetingId === m.id; });
  }
  function openActs(list) {
    return list.filter(function (a) { return ['已完成', '已取消'].indexOf(a.status) < 0; });
  }

  /* ============================================================
   * 子页 1：会议列表
   * ========================================================== */
  function mList(f) {
    var days = U.num(f.range, 0);
    return S.meetings().filter(function (m) {
      if (f.kw && !U.matchAny(m, ['title', 'id', 'host', 'projectName', 'content'], f.kw)) return false;
      if (f.type && m.type !== f.type) return false;
      if (f.host && m.host !== f.host) return false;
      if (days && Math.abs(U.dayDiff(m.date, S.TODAY)) > days) return false;
      return true;
    }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  }

  function list(ctx) {
    var f = P.flt(MOD, DEF_M);
    var all = S.meetings();
    var rows = mList(f);
    var acts = S.actions();
    var decCount = all.reduce(function (s, m) { return s + (m.decisions || []).length; }, 0);
    var thisMonth = all.filter(function (m) { return U.monthOf(m.date) === U.monthOf(S.TODAY); });

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: '会议纪要',
        desc: '会议议程、纪要正文、决策项与 Action Item 的统一归档　·　' + P.scopeText() +
          '　·　共 ' + all.length + ' 场，命中 ' + rows.length + ' 场',
        acts: UI.exportMenu({ word: true }) + '　' + P.createBtn(MOD, 'meeting.new', '新建会议纪要')
      }) +
      P.permTip(MOD) +
      P.statCards([
        { label: '会议总数', val: all.length, unit: '场', ico: '▤', tone: 'doing', sub: '本月 ' + thisMonth.length + ' 场' },
        { label: '决策条数', val: decCount, unit: '条', ico: '◈', tone: 'plan', sub: '平均每场 ' + (all.length ? (decCount / all.length).toFixed(1) : '0') + ' 条' },
        { label: 'Action Item', val: acts.length, unit: '项', ico: '✓', tone: 'done', sub: '已完成 ' + acts.filter(function (a) { return a.status === '已完成'; }).length + ' 项' },
        { label: '逾期 Action', val: acts.filter(function (a) { return a.status === '已逾期'; }).length, unit: '项', ico: '⚠', tone: 'danger', sub: '需在下次周会升级' }
      ]) + P.gap(4) +
      UI.grid(2,
        UI.card({ title: '会议类型分布', sub: '反映当前阶段的会议重心', ico: '◍', body: P.chart('mtType', 250) }) +
        UI.card({ title: '会议节奏', sub: '近 12 周会议场次', ico: '▤', body: P.chart('mtWeek', 250) })
      ) + P.gap(4) +
      UI.card({
        flush: true,
        body: '<div class="toolbar" id="mtFlt">' +
          '<input class="fld fld-search" data-f="kw" placeholder="搜索会议主题 / 编号 / 主持人" value="' + E(f.kw) + '">' +
          P.sel('type', '全部会议类型', C.DICT.meetType, f.type) +
          P.sel('host', '全部主持人', P.memberNames(), f.host) +
          P.sel('range', '全部时间', [
            { v: '7', t: '近 7 天' }, { v: '30', t: '近 30 天' }, { v: '90', t: '近 90 天' }
          ], f.range) +
          '<span class="grow"></span>' + P.viewBar(MOD) +
          '<button class="btn btn-sm" data-reset>重置</button>' +
          '</div><div id="mtTbl"></div>'
      });

    /* ---- 类型分布 ---- */
    var byType = U.countBy(all, 'type');
    var typeRows = C.DICT.meetType.filter(function (t) { return byType[t]; })
      .map(function (t) { return { name: t, value: byType[t] }; });
    if (typeRows.length) {
      CH.donut('mtType', {
        data: typeRows, height: 250, center: { v: all.length, l: '会议总场次' },
        onClick: function (i, d) {
          P.setFlt(MOD, Object.assign({}, P.flt(MOD, DEF_M), { type: d.name }));
          Shell.route();
        }
      });
    } else P.$('mtType').innerHTML = UI.empty('当前口径下暂无会议记录');

    /* ---- 近 12 周节奏 ---- */
    var wk = [], wLabels = [], wVals = [];
    for (var i = 11; i >= 0; i--) {
      var s = U.addDay(S.TODAY, -i * 7 - 6), e = U.addDay(S.TODAY, -i * 7);
      wk.push([s, e]);
      wLabels.push(U.fmtMD(e));
      wVals.push(all.filter(function (m) { return U.inRange(m.date, s, e); }).length);
    }
    CH.bar('mtWeek', {
      labels: wLabels, height: 250, xEvery: 2,
      series: [{ name: '会议场次', data: wVals, color: CH.TONE.doing }],
      valueLabel: true,
      onClick: function (idx) {
        var r = wk[idx];
        UI.toast(U.fmtMD(r[0]) + ' ~ ' + U.fmtMD(r[1]) + ' 共 ' + wVals[idx] + ' 场会议');
      }
    });

    /* ---- 表格 ---- */
    var cs = [
      { k: 'date', t: '会议日期', w: '112px', render: function (r) { return UI.cell2(E(r.date), r.time); } },
      {
        k: 'title', t: '会议主题',
        render: function (r) {
          return UI.cell2(UI.tag(r.type, 'plain') + ' ' + E(r.title),
            r.projectName + ' · ' + r.place);
        }
      },
      { k: 'host', t: '主持人', w: '112px', render: function (r) { return UI.owner(r.host); } },
      {
        k: 'attendees', t: '参会', w: '128px', sortVal: function (r) { return (r.attendees || []).length; },
        render: function (r) {
          return UI.avaStack(r.attendees, 3) +
            '<span class="muted tiny"> ' + (r.attendees || []).length + ' 人</span>';
        }
      }
    ];
    /* 角色差异列 */
    if (focusDecision()) {
      cs.push({
        k: 'decisions', t: '决策项', w: '96px', align: 'center',
        sortVal: function (r) { return (r.decisions || []).length; },
        render: function (r) {
          var n = (r.decisions || []).length;
          return n ? UI.tag(n + ' 条决策', 'plan') : '<span class="muted">—</span>';
        }
      });
    }
    cs.push({
      k: 'actionIds', t: 'Action', w: '124px', align: 'center',
      sortVal: function (r) { return openActs(actsOf(r)).length; },
      render: function (r) {
        var a = actsOf(r), o = openActs(a);
        var od = a.filter(function (x) { return x.status === '已逾期'; }).length;
        if (!a.length) return '<span class="muted">—</span>';
        return UI.tag(o.length + ' / ' + a.length + ' 未闭环', o.length ? 'warn' : 'done') +
          (od ? ' ' + UI.tag('逾期 ' + od, 'danger') : '');
      }
    });
    cs.push({
      k: '', t: '操作', w: '116px', sortable: false, align: 'right',
      render: function () {
        return '<div class="row-acts"><button data-act="open">纪要</button>' +
          '<button data-act="word">导出</button></div>';
      }
    });

    var tb = UI.table('#mtTbl', {
      cols: cs, rows: rows, pageSize: 12, select: true, index: true,
      empty: '没有匹配的会议记录',
      rowCls: function (r) { return actsOf(r).some(function (a) { return a.status === '已逾期'; }) ? 'row-warn' : ''; },
      onRow: function (r) { openMeeting(r); },
      onAct: function (act, r) { act === 'word' ? wordMinutes(r) : openMeeting(r); },
      bulk: [
        { t: '批量导出所选（CSV）', fn: function (picked) { csvMeetings('会议纪要_所选', picked); } },
        {
          t: '合并导出纪要（Word）', cls: 'btn-primary',
          fn: function (picked) { wordPack(picked); }
        }
      ]
    });

    var box = P.$('mtFlt');
    P.bindFlt(box, MOD, DEF_M, function (nf) { tb.setRows(mList(nf)); });
    P.bindViews(box, MOD, DEF_M);

    UI.bindExport(ctx.el, {
      csv: function () { csvMeetings('会议纪要', rows); },
      word: function () { wordPack(rows); }
    });

    /* 深链：#/meetings/list/MT01 */
    if (ctx.id) {
      var hit = S.meetBy(ctx.id);
      if (hit) openMeeting(hit);
    }
  }

  function csvMeetings(name, list) {
    P.csv(name, list, [
      { label: '编号', key: 'id' }, { label: '日期', key: 'date' }, { label: '时段', key: 'time' },
      { label: '主题', key: 'title' }, { label: '类型', key: 'type' },
      { label: '项目', key: 'projectName' }, { label: '产品线', key: 'lineName' },
      { label: '主持人', key: 'host' }, { label: '地点', key: 'place' },
      { label: '参会人数', get: function (m) { return (m.attendees || []).length; } },
      { label: '参会人', get: function (m) { return (m.attendees || []).join(' / '); } },
      { label: '决策条数', get: function (m) { return (m.decisions || []).length; } },
      { label: 'Action 数', get: function (m) { return actsOf(m).length; } },
      { label: '未闭环 Action', get: function (m) { return openActs(actsOf(m)).length; } }
    ]);
  }

  /* ============ 会议详情抽屉 ============ */
  function openMeeting(m) {
    var acts = actsOf(m);
    UI.drawer({
      wide: true,
      title: E(m.title) + ' ' + UI.tag(m.type, 'plain'),
      sub: m.date + ' ' + m.time + ' · ' + m.place + ' · 主持人 ' + m.host,
      body:
        UI.sec('会议信息', UI.dl([
          ['会议编号', m.id], ['会议类型', UI.tag(m.type, 'plain')],
          ['所属项目', m.projectName], ['所属产品线', m.lineName],
          ['会议日期', m.date + '（' + U.fmtDate(m.date, 'W') + '）'], ['会议时段', m.time],
          ['会议地点', m.place], ['主持人', UI.owner(m.host)],
          ['参会人员（' + (m.attendees || []).length + '）', (m.attendees || []).map(function (n) { return UI.tag(n, 'plain'); }).join(' ')],
          ['缺席人员', (m.absent || []).length ? (m.absent || []).map(function (n) { return UI.tag(n, 'warn'); }).join(' ') : '无']
        ], 'dl-2col')) +
        UI.sec('会议议程', '<ol class="ord-list">' +
          (m.agenda || []).map(function (a) { return '<li>' + E(a) + '</li>'; }).join('') + '</ol>') +
        UI.sec('纪要正文', '<div class="rich">' + E(m.content) + '</div>') +
        UI.sec('决策项（' + (m.decisions || []).length + '）',
          (m.decisions || []).length
            ? (m.decisions || []).map(function (d, i) {
              return UI.listItem({
                ico: '◈', icoStyle: 'background:var(--s-plan-bg);color:var(--s-plan)',
                title: E(d.text), meta: '决策人：' + E(d.by)
              });
            }).join('')
            : UI.empty('本次会议未产生决策项')) +
        UI.sec('Action Item（' + acts.length + '）',
          acts.length ? acts.map(function (a) {
            return UI.listItem({
              ico: '✓', title: E(a.content),
              desc: '负责人 ' + E(a.owner) + ' · 截止 ' + E(a.due),
              right: UI.st('status', a.status) + (a.status === '已逾期' ? ' ' + UI.due(a.due) : '')
            });
          }).join('') : UI.empty('本次会议未产生 Action Item'),
          '<button class="btn btn-sm" data-go-act>去跟踪</button>'),
      foot: '<div class="left"><button class="btn" data-word>导出纪要（Word）</button></div>' +
        '<button class="btn" data-close>关闭</button>' +
        (ed() ? '<button class="btn-primary" data-edit>编辑纪要</button>' : ''),
      onOpen: function (d) {
        var w = d.el.querySelector('[data-word]');
        if (w) w.addEventListener('click', function () { wordMinutes(m); });
        var g = d.el.querySelector('[data-go-act]');
        if (g) g.addEventListener('click', function () { d.close(); Shell.go(MOD, 'actions'); });
        var eb = d.el.querySelector('[data-edit]');
        if (eb) eb.addEventListener('click', function () { d.close(); editMeeting(m); });
      }
    });
  }

  function editMeeting(m) {
    UI.formModal({
      title: '编辑会议纪要 · ' + m.id, wide: true,
      fields: [
        { k: 'title', label: '会议主题', req: true, val: m.title, full: true },
        { k: 'type', label: '会议类型', type: 'select', req: true, opts: C.DICT.meetType, val: m.type },
        { k: 'host', label: '主持人', type: 'select', req: true, opts: P.memberNames(), val: m.host },
        { k: 'date', label: '会议日期', type: 'date', req: true, val: m.date },
        { k: 'time', label: '会议时段', req: true, val: m.time, placeholder: '如 14:00-15:30' },
        { k: 'place', label: '会议地点', val: m.place, full: true },
        { k: 'agenda', label: '会议议程', type: 'textarea', rows: 4, full: true, val: (m.agenda || []).join('\n'), hint: '每行一条' },
        { k: 'content', label: '纪要正文', type: 'textarea', rows: 4, full: true, val: m.content },
        { k: 'decisions', label: '决策项', type: 'textarea', rows: 3, full: true, val: (m.decisions || []).map(function (d) { return d.text; }).join('\n'), hint: '每行一条' }
      ],
      onSubmit: function (d) {
        S.update('meetings', m.id, {
          title: d.title, type: d.type, host: d.host, date: d.date, time: d.time, place: d.place,
          agenda: d.agenda.split('\n').map(function (x) { return x.trim(); }).filter(Boolean),
          content: d.content,
          decisions: d.decisions.split('\n').map(function (x) { return x.trim(); }).filter(Boolean)
            .map(function (x) { return { text: x, by: d.host }; })
        });
        UI.toast('会议纪要已更新', 'ok');
        Shell.route();
      }
    });
  }

  /* 单场纪要 Word */
  function wordMinutes(m) {
    var acts = actsOf(m);
    P.word('会议纪要_' + m.id, m.title + '　会议纪要', [
      {
        h: '一、会议信息',
        kv: [
          ['会议编号', m.id], ['会议类型', m.type], ['所属项目', m.projectName],
          ['所属产品线', m.lineName], ['会议日期', m.date], ['会议时段', m.time],
          ['会议地点', m.place], ['主持人', m.host],
          ['参会人员', (m.attendees || []).join('、')],
          ['缺席人员', (m.absent || []).join('、') || '无']
        ]
      },
      { h: '二、会议议程', list: m.agenda || [] },
      { h: '三、纪要正文', p: m.content },
      {
        h: '四、决策项',
        table: {
          cols: [{ t: '决策内容', k: 'text' }, { t: '决策人', k: 'by' }],
          rows: m.decisions || []
        }
      },
      {
        h: '五、Action Item',
        table: {
          cols: [
            { t: '编号', k: 'id' }, { t: '事项', k: 'content' }, { t: '负责人', k: 'owner' },
            { t: '截止日期', k: 'due' }, { t: '状态', k: 'status' }
          ], rows: acts
        }
      },
      {
        h: '六、后续跟进说明',
        p: openActs(acts).length
          ? '本次会议尚有 ' + openActs(acts).length + ' 项 Action Item 未闭环，请相关负责人在截止日期前完成并在系统内更新状态；逾期项将在下次项目周会上升级跟进。'
          : '本次会议 Action Item 已全部闭环，无遗留事项。'
      }
    ], ['会议编号：' + m.id]);
  }

  /* 多场纪要合并 Word */
  function wordPack(list) {
    var secs = [{
      h: '一、总体情况',
      p: '统计口径：' + P.scopeText() + '；本次导出 ' + list.length + ' 场会议，累计决策 ' +
        list.reduce(function (s, m) { return s + (m.decisions || []).length; }, 0) + ' 条，Action Item ' +
        list.reduce(function (s, m) { return s + actsOf(m).length; }, 0) + ' 项。'
    }, {
      h: '二、会议一览',
      table: {
        cols: [
          { t: '日期', k: 'date' }, { t: '主题', k: 'title' }, { t: '类型', k: 'type' },
          { t: '项目', k: 'projectName' }, { t: '主持人', k: 'host' },
          { t: '参会', get: function (m) { return (m.attendees || []).length + ' 人'; } },
          { t: '决策', get: function (m) { return (m.decisions || []).length + ' 条'; } },
          { t: '未闭环 Action', get: function (m) { return openActs(actsOf(m)).length + ' 项'; } }
        ], rows: list
      }
    }];
    secs.push({ h: '三、逐场纪要' });
    list.slice(0, 30).forEach(function (m) {
      secs.push({ h3: m.date + '　' + m.title + '（' + m.type + '）' });
      secs.push({ p: '主持人：' + m.host + '；地点：' + m.place + '；参会：' + (m.attendees || []).join('、') });
      if ((m.agenda || []).length) secs.push({ p: '议程：' + m.agenda.join('；') });
      secs.push({ p: m.content });
      if ((m.decisions || []).length) secs.push({ list: m.decisions.map(function (d) { return '【决策】' + d.text + '（' + d.by + '）'; }) });
      var a = actsOf(m);
      if (a.length) secs.push({ list: a.map(function (x) { return '【Action】' + x.content + ' — ' + x.owner + '，截止 ' + x.due + '，' + x.status; }) });
    });
    P.word('会议纪要汇编', '会议纪要汇编', secs);
  }

  /* ============================================================
   * 子页 2：Action Item 跟踪
   * ========================================================== */
  function aList(f) {
    return S.actions().filter(function (a) {
      if (f.kw && !U.matchAny(a, ['content', 'id', 'owner', 'meetingTitle', 'projectName'], f.kw)) return false;
      if (f.status && a.status !== f.status) return false;
      if (f.owner && a.owner !== f.owner) return false;
      if (f.overdue === '1' && a.status !== '已逾期') return false;
      return true;
    }).sort(function (x, y) { return x.due < y.due ? -1 : 1; });
  }

  function actions(ctx) {
    var f = P.flt(MOD, DEF_A);
    var all = S.actions();
    var rows = aList(f);
    var done = all.filter(function (a) { return a.status === '已完成'; });
    var od = all.filter(function (a) { return a.status === '已逾期'; });

    ctx.el.innerHTML =
      P.head({
        mod: MOD, title: 'Action Item 跟踪',
        desc: '会议产出的待办事项闭环跟踪　·　' + P.scopeText() + '　·　共 ' + all.length + ' 项，命中 ' + rows.length + ' 项',
        acts: UI.exportMenu({ word: true })
      }) +
      P.permTip(MOD) +
      P.statCards([
        { label: 'Action 总数', val: all.length, unit: '项', ico: '✓', tone: 'doing', sub: '来自 ' + U.uniq(all.map(function (a) { return a.meetingId; })).length + ' 场会议' },
        { label: '未闭环', val: openActs(all).length, unit: '项', ico: '◔', tone: 'warn', sub: '进行中 ' + all.filter(function (a) { return a.status === '进行中'; }).length + ' 项' },
        { label: '已逾期', val: od.length, unit: '项', ico: '⚠', tone: 'danger', sub: od.length ? '最久逾期 ' + maxOverdue(od) + ' 天' : '暂无逾期' },
        { label: '闭环率', val: U.pct(done.length, all.length), unit: '%', ico: '◎', tone: U.pct(done.length, all.length) >= 70 ? 'done' : 'warn', sub: '已完成 ' + done.length + ' / ' + all.length }
      ]) + P.gap(4) +
      UI.grid(2,
        UI.card({ title: 'Action 状态分布', sub: '点击环图可下钻筛选', ico: '◍', body: P.chart('aiDonut', 250) }) +
        UI.card({ title: '责任人负载 TOP8', sub: '未闭环 Action 数量（红色含逾期）', ico: '▤', body: P.chart('aiOwner') })
      ) + P.gap(4) +
      UI.card({
        flush: true,
        body: '<div class="toolbar" id="aiFlt">' +
          '<input class="fld fld-search" data-f="kw" placeholder="搜索事项 / 编号 / 负责人 / 来源会议" value="' + E(f.kw) + '">' +
          P.sel('status', '全部状态', C.DICT.actionStatus, f.status) +
          P.sel('owner', '全部负责人', P.memberNames(), f.owner) +
          P.sel('overdue', '全部时效', [{ v: '1', t: '仅看已逾期' }], f.overdue) +
          '<span class="grow"></span>' + P.viewBar(MOD) +
          '<button class="btn btn-sm" data-reset>重置</button>' +
          '</div><div id="aiTbl"></div>'
      });

    /* ---- 状态分布 ---- */
    var byS = U.countBy(all, 'status');
    var sRows = C.DICT.actionStatus.filter(function (s) { return byS[s]; })
      .map(function (s) { return { name: s, value: byS[s] }; });
    if (sRows.length) {
      CH.donut('aiDonut', {
        data: sRows, height: 250, center: { v: all.length, l: 'Action 总数' },
        onClick: function (i, d) {
          P.setFlt(MOD, Object.assign({}, P.flt(MOD, DEF_A), { status: d.name, overdue: '' }));
          Shell.route();
        }
      });
    } else P.$('aiDonut').innerHTML = UI.empty('当前口径下暂无 Action Item');

    /* ---- 责任人负载 ---- */
    var open = openActs(all);
    var byO = U.countBy(open, 'owner');
    var oRows = Object.keys(byO).map(function (k) { return { name: k, value: byO[k] }; })
      .sort(function (a, b) { return b.value - a.value; }).slice(0, 8);
    if (oRows.length) {
      CH.bars('aiOwner', {
        data: oRows.map(function (r) {
          var mine = open.filter(function (a) { return a.owner === r.name; });
          var no = mine.filter(function (a) { return a.status === '已逾期'; }).length;
          return {
            label: r.name, value: r.value,
            color: no ? CH.TONE.danger : (r.value > 2 ? CH.TONE.warn : CH.TONE.doing),
            text: r.value + ' 项' + (no ? '（逾期 ' + no + '）' : '')
          };
        }),
        onClick: function (i) {
          P.setFlt(MOD, Object.assign({}, P.flt(MOD, DEF_A), { owner: oRows[i].name }));
          Shell.route();
        }
      });
    } else P.$('aiOwner').innerHTML = UI.empty('暂无未闭环的 Action Item');

    /* ---- 表格 ---- */
    var tb = UI.table('#aiTbl', {
      cols: [
        { k: 'id', t: '编号', w: '76px', render: function (r) { return UI.idCell(r.id); } },
        { k: 'content', t: '事项内容', render: function (r) { return UI.cell2(E(r.content), r.projectName); } },
        {
          k: 'meetingTitle', t: '来源会议', w: '190px',
          render: function (r) {
            return '<span class="link" data-go="meetings/list/' + E(r.meetingId) + '">' + E(U.ellip(r.meetingTitle, 16)) + '</span>' +
              '<div class="cell-sub">' + E(r.meetingId) + '</div>';
          }
        },
        { k: 'owner', t: '负责人', w: '112px', render: function (r) { return UI.owner(r.owner); } },
        {
          k: 'due', t: '截止日期', w: '126px',
          render: function (r) {
            if (['已完成', '已取消'].indexOf(r.status) >= 0) return '<span class="muted">' + E(r.due) + '</span>';
            return UI.cell2(E(r.due), UI.due(r.due));
          }
        },
        { k: 'status', t: '状态', w: '86px', render: function (r) { return UI.st('status', r.status); } },
        {
          k: '', t: '操作', w: '128px', sortable: false, align: 'right',
          render: function (r) {
            if (!ed()) return '<div class="row-acts"><button data-act="open">详情</button></div>';
            return '<div class="row-acts"><button data-act="open">详情</button>' +
              (['已完成', '已取消'].indexOf(r.status) < 0 ? '<button data-act="done">标记完成</button>' : '<button data-act="edit">编辑</button>') +
              '</div>';
          }
        }
      ],
      rows: rows, pageSize: 12, select: true, index: true,
      empty: '没有匹配的 Action Item',
      rowCls: function (r) { return r.status === '已逾期' ? 'row-danger' : ''; },
      onRow: function (r) { openAction(r); },
      onAct: function (act, r) {
        if (act === 'done') markDone([r]);
        else if (act === 'edit') editAction(r);
        else openAction(r);
      },
      bulk: ed() ? [
        { t: '批量标记完成', cls: 'btn-primary', fn: function (picked, clear) { markDone(picked, clear); } },
        { t: '批量导出所选', fn: function (picked) { csvActions('ActionItem_所选', picked); } }
      ] : [
        { t: '批量导出所选', fn: function (picked) { csvActions('ActionItem_所选', picked); } }
      ]
    });

    var box = P.$('aiFlt');
    P.bindFlt(box, MOD, DEF_A, function (nf) { tb.setRows(aList(nf)); });
    P.bindViews(box, MOD, DEF_A);

    UI.bindExport(ctx.el, {
      csv: function () { csvActions('ActionItem', rows); },
      word: function () {
        P.word('ActionItem跟踪', 'Action Item 跟踪表', [
          {
            h: '一、总体情况',
            p: '统计口径：' + P.scopeText() + '；共 ' + all.length + ' 项 Action Item，已完成 ' + done.length +
              ' 项（闭环率 ' + U.pctStr(done.length, all.length) + '），未闭环 ' + openActs(all).length + ' 项，其中逾期 ' + od.length + ' 项。'
          },
          {
            h: '二、未闭环清单',
            table: {
              cols: [
                { t: '编号', k: 'id' }, { t: '事项', k: 'content' }, { t: '来源会议', k: 'meetingTitle' },
                { t: '项目', k: 'projectName' }, { t: '负责人', k: 'owner' },
                { t: '截止', k: 'due' }, { t: '状态', k: 'status' }
              ], rows: openActs(rows)
            }
          },
          {
            h: '三、逾期事项与建议',
            list: od.map(function (a) {
              return '【' + a.id + '】' + a.content + '（负责人 ' + a.owner + '，原定 ' + a.due + '，' + U.dueText(a.due) + '）——建议在下次周会重新确认承诺时间。';
            })
          },
          {
            h: '四、责任人负载',
            table: { cols: [{ t: '负责人', k: 'name' }, { t: '未闭环项数', k: 'value' }], rows: oRows }
          }
        ]);
      }
    });
  }

  function maxOverdue(list) {
    return Math.max.apply(null, list.map(function (a) { return Math.max(0, -U.daysLeft(a.due)); }).concat([0]));
  }

  function csvActions(name, list) {
    P.csv(name, list, [
      { label: '编号', key: 'id' }, { label: '事项', key: 'content' },
      { label: '来源会议', key: 'meetingTitle' }, { label: '会议编号', key: 'meetingId' },
      { label: '项目', key: 'projectName' }, { label: '负责人', key: 'owner' },
      { label: '截止日期', key: 'due' }, { label: '状态', key: 'status' },
      { label: '是否逾期', get: function (a) { return a.status === '已逾期' ? '是' : '否'; } },
      { label: '备注', key: 'note' }
    ]);
  }

  function markDone(list, clear) {
    if (!list.length) return;
    UI.confirm('确认将选中的 ' + list.length + ' 项 Action Item 标记为「已完成」？', function () {
      list.forEach(function (a) { S.update('actions', a.id, { status: '已完成', overdue: false }); });
      if (clear) clear();
      Shell.route();
      UI.toast(list.length + ' 项 Action 已闭环', 'ok');
    }, { title: '闭环 Action Item', tip: '闭环后仍可在会议纪要中追溯，状态变更会计入闭环率统计。', tipType: 'info' });
  }

  function openAction(a) {
    var m = S.meetBy(a.meetingId);
    UI.drawer({
      title: E(a.content), sub: a.id + ' · 来源会议 ' + a.meetingTitle,
      body:
        UI.sec('事项详情', UI.dl([
          ['所属项目', a.projectName], ['负责人', UI.owner(a.owner)],
          ['截止日期', a.due + '　' + UI.due(a.due)], ['当前状态', UI.st('status', a.status)],
          ['来源会议', m ? (m.date + ' ' + m.title) : a.meetingTitle],
          ['会议类型', m ? m.type : '—'],
          ['备注', a.note || '—']
        ], 'dl-2col')) +
        (m ? UI.sec('该会议的决策项',
          (m.decisions || []).length
            ? (m.decisions || []).map(function (d) {
              return UI.listItem({ ico: '◈', title: E(d.text), meta: '决策人：' + E(d.by) });
            }).join('')
            : UI.empty('该会议无决策项')) : '') +
        UI.sec('跟进建议', '<div class="rich">' +
          (a.status === '已逾期'
            ? '该事项已逾期 ' + Math.max(0, -U.daysLeft(a.due)) + ' 天，建议立即与负责人确认卡点，重新给出承诺时间，并在下次周会同步。'
            : (a.status === '已完成' ? '事项已闭环，可作为会议决策落地的证据留档。'
              : '事项在正常推进中，建议在截止日前 2 天做一次进度确认。')) + '</div>'),
      foot: '<div class="left"><button class="btn" data-go-meet>查看会议纪要</button></div>' +
        '<button class="btn" data-close>关闭</button>' +
        (ed() ? '<button class="btn-primary" data-edit>更新进展</button>' : ''),
      onOpen: function (d) {
        var g = d.el.querySelector('[data-go-meet]');
        if (g) g.addEventListener('click', function () { d.close(); Shell.go(MOD, 'list', a.meetingId); });
        var eb = d.el.querySelector('[data-edit]');
        if (eb) eb.addEventListener('click', function () { d.close(); editAction(a); });
      }
    });
  }

  function editAction(a) {
    UI.formModal({
      title: '更新 Action Item · ' + a.id, wide: true,
      fields: [
        { k: 'content', label: '事项内容', req: true, full: true, val: a.content },
        { k: 'owner', label: '负责人', type: 'select', req: true, opts: P.memberNames(), val: a.owner },
        { k: 'due', label: '截止日期', type: 'date', req: true, val: a.due },
        { k: 'status', label: '状态', type: 'select', req: true, opts: C.DICT.actionStatus, val: a.status },
        { k: 'note', label: '进展备注', type: 'textarea', full: true, val: a.note, placeholder: '如：已完成压测，报告待评审' }
      ],
      onSubmit: function (d) {
        S.update('actions', a.id, {
          content: d.content, owner: d.owner, due: d.due, status: d.status, note: d.note,
          overdue: d.status === '已逾期'
        });
        UI.toast('Action Item 已更新', 'ok');
        Shell.route();
      }
    });
  }

  /* ============================================================ */
  Shell.page(MOD, {
    render: function (ctx) {
      if (ctx.sub === 'actions') actions(ctx);
      else list(ctx);
    }
  });
})();
