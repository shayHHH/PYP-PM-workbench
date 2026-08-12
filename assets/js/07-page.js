/* ============================================================
 * 07-page.js  页面级公共助手 P
 * 19 个业务模块共用：权限提示、筛选条、保存视图、导出、
 * 图表容器、Word 报告拼装、常用下拉数据源。
 * 只依赖 U / C / S / CH / UI，不持有任何业务状态。
 * ========================================================== */
window.P = (function () {
  'use strict';
  var E = U.esc;

  /* ============ 权限 ============ */
  function ed(mod) { return C.canEdit(mod, S.role()); }
  /* full = 可直接增删改；limited = 可推进但关键字段需走审批（见 C.PERM_NOTE） */
  function full(mod) { return C.permOf(mod, S.role()) === 'full'; }
  function permTip(mod) {
    var n = C.PERM_NOTE[mod + '.' + S.role()];
    if (!n) return '';
    return UI.notice(S.isDirector() ? 'info' : 'warn', E(n)) + gap(3);
  }
  /* 角色默认视图说明（挂在页面标题右侧） */
  function viewTag(mod) {
    var v = C.viewOf(S.role(), mod);
    if (!v.note) return '';
    return '<span class="tag tag-accent">' + E(S.roleObj().name + '视角') + '</span>' +
      '<span class="muted tiny" style="font-weight:400">' + E(v.note) + '</span>';
  }
  function gap(n) { return '<div style="height:var(--sp-' + (n || 4) + ')"></div>'; }

  /* ============ 页头 ============ */
  /* o: {title, desc, acts, mod} */
  function head(o) {
    o = o || {};
    return UI.pageHead({
      title: o.title,
      tag: o.mod ? viewTag(o.mod) : o.tag,
      desc: o.desc,
      acts: o.acts
    });
  }

  /* ============ 下拉 ============ */
  function sel(k, empty, list, val, cls) {
    var h = '<select class="fld ' + (cls || '') + '" data-f="' + E(k) + '">' +
      '<option value="">' + E(empty) + '</option>';
    (list || []).forEach(function (o) {
      var v = (o && typeof o === 'object') ? o.v : o;
      var t = (o && typeof o === 'object') ? o.t : o;
      h += '<option value="' + E(v) + '"' + (String(v) === String(val === undefined ? '' : val) ? ' selected' : '') +
        '>' + E(t) + '</option>';
    });
    return h + '</select>';
  }
  function opts(list, vk, tk) {
    return (list || []).map(function (x) { return { v: x[vk], t: x[tk] }; });
  }
  function lineOpts() { return opts(S.linesInScope(), 'id', 'name'); }
  function projOpts() { return opts(S.projectsInScope(), 'id', 'name'); }
  function relOpts() { return opts(S.rels(), 'id', 'name'); }
  function memberNames() { return S.members().map(function (m) { return m.name; }); }

  /* ============ 筛选条状态 ============ */
  function flt(mod, def) {
    return Object.assign({}, def, (C.viewOf(S.role(), mod).filter) || {}, S.pref(mod, 'filter', null) || {});
  }
  function setFlt(mod, f) { S.setPref(mod, 'filter', f); }

  /* root 内所有 [data-f] 控件双向绑定；[data-reset] 复位 */
  function bindFlt(root, mod, def, onChange) {
    if (!root) return;
    root.querySelectorAll('[data-f]').forEach(function (n) {
      var isText = n.tagName === 'INPUT' && n.type !== 'date';
      var fire = function () {
        var f = flt(mod, def);
        f[n.getAttribute('data-f')] = n.value;
        setFlt(mod, f);
        onChange(f);
      };
      n.addEventListener(n.tagName === 'SELECT' ? 'change' : 'input', isText ? U.debounce(fire, 200) : fire);
    });
    root.querySelectorAll('[data-chip]').forEach(function (b) {
      b.addEventListener('click', function () {
        var f = flt(mod, def);
        var k = b.getAttribute('data-chip'), v = b.getAttribute('data-v');
        f[k] = String(f[k]) === v ? '' : v;
        setFlt(mod, f);
        Shell.route();
      });
    });
    var rs = root.querySelector('[data-reset]');
    if (rs) rs.addEventListener('click', function () {
      setFlt(mod, Object.assign({}, def));
      Shell.route();
      UI.toast('筛选条件已重置');
    });
  }

  /* ============ 保存视图 ============ */
  function viewBar(mod) { return UI.viewBar(mod); }
  function bindViews(root, mod, def) {
    if (!root) return;
    var views = S.savedViews(mod);
    root.querySelectorAll('[data-view]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        if (e.target.hasAttribute('data-delview')) return;
        var v = views[+b.getAttribute('data-view')];
        if (!v) return;
        setFlt(mod, Object.assign({}, def, v.filter));
        Shell.route();
        UI.toast('已应用视图「' + v.name + '」');
      });
    });
    root.querySelectorAll('[data-delview]').forEach(function (x) {
      x.addEventListener('click', function (e) {
        e.stopPropagation();
        var v = views[+x.getAttribute('data-delview')];
        if (!v) return;
        S.dropView(mod, v.name);
        Shell.route();
      });
    });
    var sv = root.querySelector('[data-saveview]');
    if (sv) sv.addEventListener('click', function () {
      UI.formModal({
        title: '保存当前视图', one: true,
        tip: '保存后会记住当前的全部筛选条件，下次一键切回。视图按角色分别存储。',
        fields: [{ k: 'name', label: '视图名称', req: true, placeholder: '如：高价值待排期' }],
        onSubmit: function (d) {
          S.saveView(mod, d.name, flt(mod, def));
          Shell.route();
          UI.toast('视图「' + d.name + '」已保存', 'ok');
        }
      });
    });
  }

  /* ============ 图表容器 ============ */
  function chart(id, h) {
    return '<div class="chart" id="' + E(id) + '"' + (h ? ' style="min-height:' + h + 'px"' : '') + '></div>';
  }
  function $(id) { return document.getElementById(id); }

  /* ============ 导出 ============ */
  /* cols: [{label, key}] 或 [{label, get(row)}] */
  function csv(name, rows, cols) { U.exportCSV(name, rows, cols); }

  /* Word 报告：统一封面 + 分节 */
  /* secs: [{h:'标题', p:'段落', table:{cols:[{t,get}],rows:[]}, list:[], html:''}] */
  function word(fileName, title, secs, meta) {
    var b = '<h1>' + E(title) + '</h1>';
    b += '<div class="meta">' + E([
      C.ORG.name + ' · ' + C.ORG.bu,
      '导出角色：' + S.roleObj().name + '（' + S.roleObj().user.name + '）',
      '数据口径：' + scopeText(),
      '生成时间：' + U.fmtDate(new Date(), 'YYYY-MM-DD HH:mm')
    ].concat(meta || []).join('　|　')) + '</div>';
    (secs || []).forEach(function (s) {
      if (!s) return;
      if (s.h) b += '<h2>' + E(s.h) + '</h2>';
      if (s.h3) b += '<h3>' + E(s.h3) + '</h3>';
      if (s.p) b += '<p>' + E(s.p) + '</p>';
      if (s.list && s.list.length) {
        b += '<ul>' + s.list.map(function (x) { return '<li>' + E(x) + '</li>'; }).join('') + '</ul>';
      }
      if (s.kv && s.kv.length) {
        b += '<table>' + s.kv.map(function (p) {
          return '<tr><th style="width:150px">' + E(p[0]) + '</th><td>' + E(p[1] === undefined || p[1] === null || p[1] === '' ? '—' : p[1]) + '</td></tr>';
        }).join('') + '</table>';
      }
      if (s.table) b += wTable(s.table.cols, s.table.rows);
      if (s.html) b += s.html;
    });
    U.exportWord(fileName, title, b);
  }
  function wTable(cols, rows) {
    var h = '<table><tr>' + (cols || []).map(function (c) { return '<th>' + E(c.t) + '</th>'; }).join('') + '</tr>';
    if (!rows || !rows.length) return h + '<tr><td colspan="' + (cols || []).length + '">（无数据）</td></tr></table>';
    rows.forEach(function (r) {
      h += '<tr>' + cols.map(function (c) {
        var v = c.get ? c.get(r) : r[c.k];
        return '<td>' + E(v === undefined || v === null || v === '' ? '—' : v) + '</td>';
      }).join('') + '</tr>';
    });
    return h + '</table>';
  }

  function scopeText() {
    if (S.isPM()) {
      var p = S.curProject();
      return '当前项目 · ' + (p ? p.name : '全部项目');
    }
    var l = S.curLine();
    return l ? '产品线 · ' + l.name : '全部产品线';
  }

  /* ============ 通用小件 ============ */
  function statCards(items) {
    return UI.grid(items.length > 4 ? 4 : items.length, items.map(UI.metric).join(''));
  }
  function kv(pairs) { return UI.dl(pairs, 'dl-2col'); }
  /* 空态分两种，说的话完全不同：
       模块整体没数据 → 教学式空态（这是什么 / 什么时候用 / 第一步做什么）
       只是当前口径没数据 → 提示切换上方的产品线 / 项目 */
  function emptyMod(msg) {
    var mod = ((window.Shell && Shell.current && Shell.current()) || {}).mod;
    if (window.G && mod && G.countOf(mod) === 0) return G.emptyFor(mod);
    return UI.empty(msg || '当前口径下暂无数据，可切换上方的产品线 / 项目试试');
  }

  /* 详情页返回按钮 + 摘要条 */
  function hero(o) {
    return '<div class="detail-hero"><div class="dh-top"><div class="grow">' +
      '<div class="dh-title">' + o.title + (o.id ? ' <span class="dh-id">' + E(o.id) + '</span>' : '') + '</div>' +
      (o.meta ? '<div class="dh-meta">' + o.meta.map(function (m) {
        return '<div class="dm"><span class="dm-l">' + E(m[0]) + '</span><span class="dm-v">' + m[1] + '</span></div>';
      }).join('') + '</div>' : '') +
      '</div>' + (o.right ? '<div>' + o.right + '</div>' : '') + '</div></div>';
  }

  /* 数字格式 */
  function pctCell(v01, bad) { return UI.pcell(Math.round((v01 || 0) * 100), UI.ptone((v01 || 0) * 100, bad)); }

  /* 「新建」按钮：无权限时给出灰化 + 说明 */
  function createBtn(mod, createKey, text) {
    if (ed(mod)) return '<button class="btn-primary" data-create="' + E(createKey) + '">＋ ' + E(text) + '</button>';
    return '<button class="btn" disabled title="当前角色无编辑权限">＋ ' + E(text) + '</button>';
  }

  return {
    ed: ed, full: full, permTip: permTip, viewTag: viewTag, gap: gap, head: head,
    sel: sel, opts: opts, lineOpts: lineOpts, projOpts: projOpts, relOpts: relOpts, memberNames: memberNames,
    flt: flt, setFlt: setFlt, bindFlt: bindFlt,
    viewBar: viewBar, bindViews: bindViews,
    chart: chart, $: $, csv: csv, word: word, wTable: wTable, scopeText: scopeText,
    statCards: statCards, kv: kv, emptyMod: emptyMod, hero: hero, pctCell: pctCell, createBtn: createBtn
  };
})();
