/* ============================================================
 * 05-ui.js  UI 组件库
 * 字符串型：tag / pri / light / ava / pbar / metric / card / pageHead /
 *           empty / notice / dl / tabs / listItem / tline / quick / kpi
 * 交互型：toast / drawer / modal / confirm / formModal / table / kanban / pop
 * ========================================================== */
window.UI = (function () {
  'use strict';

  var E = U.esc;

  /* ---------------- 基础标签 ---------------- */
  function tag(text, tone, opt) {
    if (text === null || text === undefined || text === '') return '';
    opt = opt || {};
    return '<span class="tag tag-' + (tone || 'plain') + (opt.lg ? ' tag-lg' : '') + (opt.solid ? ' tag-solid' : '') + '"' +
      (opt.title ? ' title="' + E(opt.title) + '"' : '') + '>' +
      (opt.dot ? '<i class="dot"></i>' : '') + E(text) + '</span>';
  }
  /* 按字典自动上色：UI.st('status', '开发中') */
  function st(map, v, opt) { return tag(v, C.tone(map, v), opt); }

  function pri(p) {
    if (!p) return '';
    return '<span class="pri pri-' + E(p) + '">' + E(p) + '</span>';
  }

  function light(lv, text) {
    var k = lv === 'r' || lv === '红' ? 'r' : (lv === 'y' || lv === '黄' ? 'y' : 'g');
    var lb = text || ({ r: '红灯', y: '黄灯', g: '绿灯' })[k];
    return '<span class="light light-' + k + '">' + E(lb) + '</span>';
  }

  function ava(name, size) {
    if (!name) return '';
    return '<span class="ava ' + U.avaCls(name) + (size ? ' ava-' + size : '') + '" title="' + E(name) + '">' + E(U.initials(name)) + '</span>';
  }
  function owner(name, size) {
    if (!name) return '<span class="muted">未指派</span>';
    return '<span class="owner">' + ava(name, size || 'sm') + '<span>' + E(name) + '</span></span>';
  }
  function avaStack(names, max) {
    names = names || []; max = max || 4;
    var s = '<span class="ava-stack">';
    names.slice(0, max).forEach(function (n) { s += ava(n, 'sm'); });
    if (names.length > max) s += '<span class="ava ava-sm" style="background:var(--t-3)">+' + (names.length - max) + '</span>';
    return s + '</span>';
  }

  function pbar(pct, tone, lg) {
    var p = U.clamp(+pct || 0, 0, 100);
    return '<span class="pbar' + (lg ? ' pbar-lg' : '') + '"><i class="' + (tone || 'accent') + '" style="width:' + p + '%"></i></span>';
  }
  function pcell(pct, tone) {
    var p = Math.round(+pct || 0);
    return '<span class="pcell">' + pbar(p, tone) + '<span class="pv">' + p + '%</span></span>';
  }
  /* 按进度自动配色（结合是否延期） */
  function ptone(pct, bad) {
    if (bad) return 'danger';
    if (pct >= 100) return 'done';
    if (pct <= 0) return 'idle';
    return 'doing';
  }

  function trend(d, opt) {
    if (!d) return '';
    opt = opt || {};
    var cls = d.dir === 'up' ? (opt.reverse ? 'up-bad' : 'up') : (d.dir === 'down' ? (opt.reverse ? 'down-good' : 'down') : 'flat');
    var ico = d.dir === 'up' ? '↑' : (d.dir === 'down' ? '↓' : '→');
    return '<span class="trend ' + cls + '">' + ico + E(d.text) + '</span>';
  }

  function due(dateStr) {
    if (!dateStr) return '<span class="muted">—</span>';
    var t = U.dueText(dateStr);
    var left = U.daysLeft(dateStr);
    var cls = left < 0 ? 'tag-danger' : (left <= 2 ? 'tag-warn' : 'tag-plain');
    return '<span class="tag ' + cls + '">' + E(t) + '</span>';
  }

  /* ---------------- 结构块 ---------------- */
  function pageHead(o) {
    o = o || {};
    return '<div class="page-head">' +
      '<div class="page-head-l"><div class="page-title">' + E(o.title || '') +
      (o.tag ? ' ' + o.tag : '') + '</div>' +
      (o.desc ? '<div class="page-desc">' + o.desc + '</div>' : '') + '</div>' +
      '<div class="page-acts">' + (o.acts || '') + '</div></div>';
  }

  function card(o) {
    o = o || {};
    var h = '';
    if (o.title || o.extra) {
      h += '<div class="card-h"><div class="card-t">' +
        (o.ico ? '<span class="ct-ico">' + o.ico + '</span>' : '') + E(o.title || '') +
        (o.sub ? ' <small>' + E(o.sub) + '</small>' : '') + '</div>' +
        (o.extra ? '<div class="card-x">' + o.extra + '</div>' : '') + '</div>';
    }
    h += '<div class="card-b' + (o.flush ? ' flush' : '') + (o.tight ? ' tight' : '') + '"' +
      (o.bodyId ? ' id="' + o.bodyId + '"' : '') + (o.bodyStyle ? ' style="' + o.bodyStyle + '"' : '') + '>' +
      (o.body || '') + '</div>';
    if (o.foot) h += '<div class="card-f">' + o.foot + '</div>';
    return '<div class="card ' + (o.cls || '') + '"' + (o.id ? ' id="' + o.id + '"' : '') +
      (o.style ? ' style="' + o.style + '"' : '') + '>' + h + '</div>';
  }

  function metric(m) {
    m = m || {};
    var sub = '';
    if (m.delta) sub += trend(m.delta, { reverse: m.reverse });
    if (m.sub) sub += '<span>' + m.sub + '</span>';
    if (m.sub2) sub += '<span>' + m.sub2 + '</span>';
    return '<div class="metric ' + (m.tone ? 'tone-' + m.tone : '') + (m.mod ? ' clickable' : '') + '"' +
      (m.mod ? ' data-go="' + E(m.mod) + '"' : '') + (m.key ? ' data-metric="' + E(m.key) + '"' : '') + '>' +
      '<div class="metric-h">' + (m.ico ? '<span class="metric-ico">' + m.ico + '</span>' : '') +
      '<span class="metric-lb">' + E(m.label || '') + '</span></div>' +
      '<div class="metric-val">' + E(m.val === undefined ? '—' : m.val) +
      (m.unit ? '<span class="unit">' + E(m.unit) + '</span>' : '') + '</div>' +
      (sub ? '<div class="metric-sub">' + sub + '</div>' : '') +
      (m.spark ? '<div class="metric-spark">' + CH.sparkSVG(m.spark, { w: 96, h: 36, color: m.sparkColor }) + '</div>' : '') +
      '</div>';
  }

  function empty(msg, act, ico) {
    return '<div class="empty"><span class="e-ico">' + (ico || '◎') + '</span>' +
      '<div class="e-msg">' + E(msg || '暂无数据') + '</div>' +
      (act ? '<div class="e-act">' + act + '</div>' : '') + '</div>';
  }

  function notice(type, html, ico) {
    var icons = { info: 'ℹ', warn: '⚠', danger: '⛔', done: '✓', plain: '·' };
    return '<div class="notice notice-' + (type || 'info') + '">' +
      '<span class="n-ico">' + (ico || icons[type] || 'ℹ') + '</span><div>' + html + '</div></div>';
  }

  function dl(pairs, cls) {
    var h = '<dl class="dl ' + (cls || '') + '">';
    (pairs || []).forEach(function (p) {
      if (!p) return;
      h += '<dt>' + E(p[0]) + '</dt><dd>' + (p[1] === null || p[1] === undefined || p[1] === '' ? '<span class="muted">—</span>' : p[1]) + '</dd>';
    });
    return h + '</dl>';
  }

  function sec(title, body, extra) {
    return '<div class="sec"><div class="sec-t">' + E(title) +
      (extra ? '<span class="st-x">' + extra + '</span>' : '') + '</div>' + body + '</div>';
  }

  function tabs(items, active, opt) {
    opt = opt || {};
    var h = '<div class="tabs' + (opt.pill ? ' tabs-pill' : '') + '"' + (opt.id ? ' id="' + opt.id + '"' : '') + '>';
    items.forEach(function (t) {
      h += '<button class="tab' + (t.key === active ? ' on' : '') + '" data-tab="' + E(t.key) + '">' +
        E(t.label) + (t.n !== undefined ? '<span class="t-n">' + t.n + '</span>' : '') + '</button>';
    });
    return h + '</div>';
  }

  function chips(items, active, name) {
    var h = '<div class="chip-row">';
    items.forEach(function (c) {
      h += '<button class="chip' + (String(c.key) === String(active) ? ' on' : '') + '" data-chip="' + E(name || 'f') + '" data-v="' + E(c.key) + '">' +
        E(c.label) + (c.n !== undefined ? '<span class="n">' + c.n + '</span>' : '') + '</button>';
    });
    return h + '</div>';
  }

  function listItem(o) {
    return '<div class="list-item' + (o.click ? ' clickable' : '') + '"' + (o.data || '') + '>' +
      (o.ico ? '<span class="li-ico" ' + (o.icoStyle ? 'style="' + o.icoStyle + '"' : '') + '>' + o.ico + '</span>' : '') +
      '<div class="li-body"><div class="li-title">' + o.title + '</div>' +
      (o.desc ? '<div class="li-desc">' + o.desc + '</div>' : '') +
      (o.meta ? '<div class="li-meta">' + o.meta + '</div>' : '') + '</div>' +
      (o.right ? '<div class="li-right">' + o.right + '</div>' : '') + '</div>';
  }

  /* 时间轴（items: {time,title,desc,meta,tone,date}） */
  function tline(items, opt) {
    opt = opt || {};
    if (!items || !items.length) return empty(opt.emptyMsg || '暂无记录');
    var h = '<div class="tline">';
    var lastDate = null;
    items.forEach(function (it) {
      if (opt.groupByDate) {
        var d = (it.time || '').slice(0, 10);
        if (d && d !== lastDate) { h += '<div class="tl-date-sep">' + E(d) + '</div>'; lastDate = d; }
      }
      h += '<div class="tl-item ' + (it.tone || '') + '"' + (it.data || '') + '>' +
        (it.time ? '<div class="tl-time">' + E(it.time) + '</div>' : '') +
        '<div class="tl-title">' + it.title + '</div>' +
        (it.desc ? '<div class="tl-desc">' + it.desc + '</div>' : '') +
        (it.meta ? '<div class="tl-meta">' + it.meta + '</div>' : '') + '</div>';
    });
    return h + '</div>';
  }

  function quick(items) {
    var h = '<div class="quick">';
    (items || []).forEach(function (q) {
      h += '<button class="quick-btn" data-create="' + E(q.key) + '">' +
        '<span class="qb-ico">' + (q.ico || '+') + '</span><span>' + E(q.label) + '</span></button>';
    });
    return h + '</div>';
  }

  function grid(n, html) { return '<div class="grid g' + n + '">' + html + '</div>'; }

  function idCell(id) { return '<span class="id-cell">' + E(id) + '</span>'; }

  function cell2(main, sub) {
    return '<div class="cell-main">' + main + '</div>' + (sub ? '<div class="cell-sub">' + sub + '</div>' : '');
  }

  /* ---------------- Toast ---------------- */
  function toast(msg, type, ms) {
    var box = document.getElementById('toasts');
    if (!box) return;
    var icons = { ok: '✓', err: '✕', warn: '⚠', info: 'ℹ' };
    var n = document.createElement('div');
    n.className = 'toast ' + (type || 'ok');
    n.innerHTML = '<span>' + (icons[type || 'ok'] || '✓') + '</span><span>' + E(msg) + '</span>';
    box.appendChild(n);
    setTimeout(function () {
      n.style.transition = 'opacity .2s,transform .2s';
      n.style.opacity = '0'; n.style.transform = 'translateY(-8px)';
      setTimeout(function () { n.remove(); }, 220);
    }, ms || 2200);
  }

  /* ---------------- 遮罩层管理 ---------------- */
  var layers = [];
  function pushLayer(node, mask, onClose) {
    layers.push({ node: node, mask: mask, onClose: onClose });
  }
  function closeTop() {
    var l = layers[layers.length - 1];
    if (l && l.onClose) l.onClose();
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && layers.length) { e.preventDefault(); closeTop(); }
  });

  /* 叠层的 z-index：CSS 里所有遮罩、抽屉、弹窗都是同一个固定值，
     一旦出现「弹窗上再开弹窗」（比如表单里点字段的 ?），
     第二层的遮罩压不住第一层的弹窗，两层就会互相透视。
     所以按当前层数往上抬——层数无上限，叠几层都对。 */
  /* 步长必须大于「遮罩 600 → 弹窗 700」这 100 的差值，
     否则第 n+1 层的遮罩压不住第 n 层的弹窗，两层会互相透视。 */
  var Z_STEP = 200;
  function zAt(depth, base) { return (base || 600) + depth * Z_STEP; }

  function mkMask(onClick) {
    var m = document.createElement('div');
    m.className = 'mask';
    m.style.zIndex = zAt(layers.length, 600);
    document.body.appendChild(m);
    requestAnimationFrame(function () { m.classList.add('on'); });
    m.addEventListener('click', onClick);
    return m;
  }

  /* ---------------- 抽屉 ---------------- */
  function drawer(o) {
    o = o || {};
    var mask = mkMask(function () { if (o.maskClose !== false) close(); });
    var d = document.createElement('div');
    d.className = 'drawer' + (o.wide ? ' wide' : '') + (o.narrow ? ' narrow' : '');
    d.style.zIndex = zAt(layers.length, 700);
    d.innerHTML =
      '<div class="drawer-h"><div class="dh-l"><div class="drawer-t">' + (o.title || '') + '</div>' +
      (o.sub ? '<div class="drawer-sub">' + o.sub + '</div>' : '') + '</div>' +
      '<button class="drawer-x" data-x>×</button></div>' +
      '<div class="drawer-b">' + (o.body || '') + '</div>' +
      (o.foot ? '<div class="drawer-f">' + o.foot + '</div>' : '');
    document.body.appendChild(d);
    requestAnimationFrame(function () { d.classList.add('on'); });

    function close() {
      d.classList.remove('on'); mask.classList.remove('on');
      layers = layers.filter(function (l) { return l.node !== d; });
      setTimeout(function () { d.remove(); mask.remove(); }, 220);
      if (o.onClose) o.onClose();
    }
    d.querySelector('[data-x]').addEventListener('click', close);
    d.addEventListener('click', function (e) {
      var b = e.target.closest('[data-close]');
      if (b) close();
    });
    pushLayer(d, mask, close);
    var handle = { el: d, close: close, body: d.querySelector('.drawer-b') };
    if (o.onOpen) o.onOpen(handle);
    return handle;
  }

  /* ---------------- 模态 ---------------- */
  function modal(o) {
    o = o || {};
    var mask = mkMask(function () { if (o.maskClose !== false) close(); });
    var m = document.createElement('div');
    m.className = 'modal' + (o.wide ? ' wide' : '');
    m.style.zIndex = zAt(layers.length, 700);
    m.innerHTML =
      '<div class="modal-h"><div class="modal-t">' + (o.title || '') + '</div><button class="drawer-x" data-x>×</button></div>' +
      '<div class="modal-b">' + (o.body || '') + '</div>' +
      (o.foot ? '<div class="modal-f">' + o.foot + '</div>' : '');
    document.body.appendChild(m);
    requestAnimationFrame(function () { m.classList.add('on'); });
    function close() {
      m.classList.remove('on'); mask.classList.remove('on');
      layers = layers.filter(function (l) { return l.node !== m; });
      setTimeout(function () { m.remove(); mask.remove(); }, 200);
      if (o.onClose) o.onClose();
    }
    m.querySelector('[data-x]').addEventListener('click', close);
    m.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) close(); });
    pushLayer(m, mask, close);
    var handle = { el: m, close: close, body: m.querySelector('.modal-b') };
    if (o.onOpen) o.onOpen(handle);
    return handle;
  }

  function confirm(msg, onOk, o) {
    o = o || {};
    var h = modal({
      title: o.title || '确认操作',
      body: '<div style="font-size:var(--f-base);line-height:1.7;color:var(--t-2)">' + msg + '</div>' +
        (o.tip ? '<div style="margin-top:12px">' + notice(o.tipType || 'warn', o.tip) + '</div>' : ''),
      foot: '<button class="btn" data-close>取消</button>' +
        '<button class="' + (o.danger ? 'btn-danger' : 'btn-primary') + '" data-ok>' + E(o.okText || '确定') + '</button>',
      maskClose: true
    });
    h.el.querySelector('[data-ok]').addEventListener('click', function () {
      h.close();
      if (onOk) onOk();
    });
    return h;
  }

  /* ---------------- 表单 ---------------- */
  /* fields: [{k,label,type:'text|textarea|select|date|number|radio|checkbox|static',
   *           opts:[], val, req, full, hint, placeholder, min, max, rows}] */
  /* 字段「?」的点击：委托到 document，绑一次即可——
     表单可能长在弹窗里也可能长在抽屉里，且每次都是新建的节点。
     stopPropagation 是必须的：不拦住的话点击会冒泡到遮罩，把承载它的表单一起关掉。 */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-help]');
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    var hp = C.help(b.getAttribute('data-help'));
    if (!hp) return;
    modal({
      title: hp.title, wide: true, maskClose: true,
      body: '<div class="helpdoc">' + hp.html + '</div>',
      foot: '<button class="btn-primary" data-close>知道了</button>'
    });
  }, true);

  function form(fields, opt) {
    opt = opt || {};
    var h = '<div class="form' + (opt.one ? ' one' : '') + '"' + (opt.id ? ' id="' + opt.id + '"' : '') + '>';
    (fields || []).forEach(function (f) {
      if (!f) return;
      if (f.type === 'divider') { h += '<div class="fi full"><div class="divider" style="margin:0"></div></div>'; return; }
      if (f.type === 'html') { h += '<div class="fi full">' + f.html + '</div>'; return; }
      /* 字段级帮助：写 help:'键名'（对应 C.HELP），标签后出一个「?」，
         点开是一段讲清楚"这个数怎么填"的正文。内容统一放 01-config，
         免得同一个概念在不同表单里各说各的。 */
      var hp = f.help ? C.help(f.help) : null;
      h += '<div class="fi' + (f.full ? ' full' : '') + '" data-fi="' + E(f.k) + '">' +
        '<label>' + E(f.label) + (f.req ? '<span class="req">*</span>' : '') +
        (hp ? '<button type="button" class="fi-help" data-help="' + E(f.help) +
          '" title="怎么填？" aria-label="查看填写说明">?</button>' : '') +
        (f.hint ? '<span class="hint">' + E(f.hint) + '</span>' : '') + '</label>';
      var v = f.val === undefined || f.val === null ? '' : f.val;
      if (f.type === 'textarea') {
        h += '<textarea name="' + E(f.k) + '" rows="' + (f.rows || 3) + '" placeholder="' + E(f.placeholder || '') + '">' + E(v) + '</textarea>';
      } else if (f.type === 'select') {
        h += '<select name="' + E(f.k) + '">';
        if (f.empty !== false && !f.req) h += '<option value="">' + E(f.emptyText || '（不限）') + '</option>';
        (f.opts || []).forEach(function (o2) {
          var val = typeof o2 === 'object' ? o2.v : o2;
          var lb = typeof o2 === 'object' ? o2.t : o2;
          h += '<option value="' + E(val) + '"' + (String(val) === String(v) ? ' selected' : '') + '>' + E(lb) + '</option>';
        });
        h += '</select>';
      } else if (f.type === 'radio') {
        h += '<div class="fi-inline">';
        (f.opts || []).forEach(function (o2, i) {
          var val = typeof o2 === 'object' ? o2.v : o2;
          var lb = typeof o2 === 'object' ? o2.t : o2;
          h += '<label class="fi-radio"><input type="radio" name="' + E(f.k) + '" value="' + E(val) + '"' +
            (String(val) === String(v) ? ' checked' : '') + '>' + E(lb) + '</label>';
        });
        h += '</div>';
      } else if (f.type === 'checkbox') {
        h += '<div class="fi-inline">';
        (f.opts || []).forEach(function (o2) {
          var val = typeof o2 === 'object' ? o2.v : o2;
          var lb = typeof o2 === 'object' ? o2.t : o2;
          var on = (v instanceof Array) && v.indexOf(val) >= 0;
          h += '<label class="fi-radio"><input type="checkbox" name="' + E(f.k) + '" value="' + E(val) + '"' + (on ? ' checked' : '') + '>' + E(lb) + '</label>';
        });
        h += '</div>';
      } else if (f.type === 'static') {
        h += '<div style="font-size:var(--f-sm);padding-top:4px">' + (f.html || E(v)) + '</div>';
      } else {
        h += '<input type="' + (f.type || 'text') + '" name="' + E(f.k) + '" value="' + E(v) + '"' +
          (f.placeholder ? ' placeholder="' + E(f.placeholder) + '"' : '') +
          (f.min !== undefined ? ' min="' + f.min + '"' : '') +
          (f.max !== undefined ? ' max="' + f.max + '"' : '') + '>';
      }
      h += '<div class="fi-err">' + E(f.err || '此项为必填') + '</div></div>';
    });
    return h + '</div>';
  }

  function readForm(root) {
    var out = {};
    if (!root) return out;
    root.querySelectorAll('input,select,textarea').forEach(function (n) {
      var k = n.getAttribute('name');
      if (!k) return;
      if (n.type === 'checkbox') {
        if (!(out[k] instanceof Array)) out[k] = [];
        if (n.checked) out[k].push(n.value);
      } else if (n.type === 'radio') {
        if (n.checked) out[k] = n.value;
        else if (out[k] === undefined) out[k] = '';
      } else out[k] = n.value.trim();
    });
    return out;
  }

  function validate(root, fields) {
    var ok = true;
    root.querySelectorAll('.fi').forEach(function (n) { n.classList.remove('err'); });
    (fields || []).forEach(function (f) {
      if (!f || !f.req) return;
      var box = root.querySelector('[data-fi="' + f.k + '"]');
      if (!box) return;
      var v = '';
      var n = box.querySelector('input,select,textarea');
      if (n && n.type === 'radio') {
        var c = box.querySelector('input:checked'); v = c ? c.value : '';
      } else v = n ? n.value.trim() : '';
      if (!v) { box.classList.add('err'); ok = false; }
    });
    if (!ok) toast('请完善必填项', 'err');
    return ok;
  }

  /* 表单模态：一步完成"新建 XX" */
  function formModal(o) {
    var fields = o.fields || [];
    var h = modal({
      title: o.title,
      wide: o.wide,
      body: (o.tip ? notice('info', o.tip) + '<div style="height:12px"></div>' : '') + form(fields, { one: o.one }),
      foot: '<button class="btn" data-close>取消</button><button class="btn-primary" data-ok>' + E(o.okText || '确定') + '</button>'
    });
    /* 级联下拉：字段写 depends:'主字段' + optsFor(主字段值) 就会跟着联动。
       典型场景是「所属产品线 → 归属项目」——不联动的话，同一个项目会出现在
       任意产品线下面，而一个项目其实只属于一条线。
       初始也跑一次 sync，保证刚打开时就是过滤过的，而不是等用户去动一下。 */
    var froot = h.el.querySelector('.form');
    fields.forEach(function (f) {
      if (!f || !f.depends || typeof f.optsFor !== 'function') return;
      var master = froot.querySelector('[name="' + f.depends + '"]');
      var slave = froot.querySelector('[name="' + f.k + '"]');
      if (!master || !slave) return;
      function sync() {
        var list = f.optsFor(master.value) || [];
        var keep = slave.value;
        slave.innerHTML =
          (f.empty !== false && !f.req ? '<option value="">' + E(f.emptyText || '（不限）') + '</option>' : '') +
          list.map(function (o2) {
            var val = typeof o2 === 'object' ? o2.v : o2;
            var lb = typeof o2 === 'object' ? o2.t : o2;
            return '<option value="' + E(val) + '">' + E(lb) + '</option>';
          }).join('');
        /* 换了主字段后，原先选中的项可能已经不在候选里——能留则留，留不住就落到第一项，
           绝不留一个「看着还在、其实已不属于这条线」的值。 */
        var still = list.some(function (o2) { return String(typeof o2 === 'object' ? o2.v : o2) === String(keep); });
        slave.value = still ? keep : (slave.options[0] ? slave.options[0].value : '');
      }
      master.addEventListener('change', sync);
      sync();
    });

    h.el.querySelector('[data-ok]').addEventListener('click', function () {
      var root = h.el.querySelector('.form');
      if (!validate(root, fields)) return;
      var data = readForm(root);
      var r = o.onSubmit ? o.onSubmit(data, h) : true;
      if (r !== false) h.close();
    });
    return h;
  }

  /* ---------------- 数据表格 ---------------- */
  /* opt: {
   *   cols:[{k,t,w,cls,align,sortable,render(row,i),sortVal(row),th}],
   *   rows, pageSize, page, sort:{k,desc}, onRow(row), rowCls(row),
   *   select:bool, bulk:[{t,cls,fn(selectedRows)}], empty, compact, maxH,
   *   toolbar: html, footNote, onPage, id
   * } */
  function table(hostEl, opt) {
    var el = typeof hostEl === 'string' ? document.querySelector(hostEl) : hostEl;
    if (!el) return null;
    var state = {
      page: opt.page || 1,
      sort: opt.sort ? { k: opt.sort.k, desc: !!opt.sort.desc } : null,
      sel: {},
      rows: opt.rows || []
    };
    var pageSize = opt.pageSize === 0 ? 0 : (opt.pageSize || 15);

    function sorted() {
      var rows = state.rows.slice();
      if (state.sort && state.sort.k) {
        var col = (opt.cols || []).filter(function (c) { return c.k === state.sort.k; })[0];
        var f = col && col.sortVal ? col.sortVal : function (r) { return r[state.sort.k]; };
        rows.sort(function (a, b) {
          var x = f(a), y = f(b);
          if (x === undefined || x === null) x = '';
          if (y === undefined || y === null) y = '';
          if (typeof x === 'number' && typeof y === 'number') return x - y;
          return String(x).localeCompare(String(y), 'zh-CN');
        });
        if (state.sort.desc) rows.reverse();
      }
      return rows;
    }

    function render() {
      var rows = sorted();
      var total = rows.length;
      var pages = pageSize ? Math.max(1, Math.ceil(total / pageSize)) : 1;
      if (state.page > pages) state.page = pages;
      var view = pageSize ? rows.slice((state.page - 1) * pageSize, state.page * pageSize) : rows;

      var selCount = Object.keys(state.sel).filter(function (k) { return state.sel[k]; }).length;
      var h = '';
      if (opt.toolbar) h += '<div class="toolbar">' + opt.toolbar + '</div>';
      if (opt.select && selCount) {
        h += '<div class="bulk-bar">已选择 <b>' + selCount + '</b> 项' +
          '<span class="grow"></span>' +
          (opt.bulk || []).map(function (b, i) {
            return '<button class="btn-sm ' + (b.cls || '') + '" data-bulk="' + i + '">' + E(b.t) + '</button>';
          }).join('') +
          '<button class="btn-sm" data-bulk-clear>取消选择</button></div>';
      }

      if (!total) {
        h += opt.empty || empty('暂无符合条件的数据', opt.emptyAct);
        el.innerHTML = h;
        bindToolbar();
        return;
      }

      h += '<div class="tbl-wrap"' + (opt.maxH ? ' style="max-height:' + opt.maxH + 'px;overflow-y:auto"' : '') + '>';
      h += '<table class="tbl' + (opt.compact ? ' tbl-compact' : '') + '"><thead><tr>';
      if (opt.select) h += '<th style="width:32px"><input type="checkbox" class="ck" data-ck-all></th>';
      if (opt.index) h += '<th style="width:40px" class="mid">#</th>';
      (opt.cols || []).forEach(function (c) {
        var isSort = state.sort && state.sort.k === c.k;
        h += '<th' + (c.w ? ' style="width:' + (typeof c.w === 'number' ? c.w + 'px' : c.w) + '"' : '') +
          ' class="' + (c.align === 'right' ? 'num' : (c.align === 'center' ? 'mid' : '')) +
          (c.sortable !== false && c.k ? ' sortable' : '') + (isSort ? ' sorted' : '') + '"' +
          (c.k ? ' data-sort="' + E(c.k) + '"' : '') + '>' + E(c.t) +
          (c.sortable !== false && c.k ? '<span class="sort-i">' + (isSort ? (state.sort.desc ? '▼' : '▲') : '⇅') + '</span>' : '') + '</th>';
      });
      h += '</tr></thead><tbody>';
      view.forEach(function (r, i) {
        var rid = r.id || ((state.page - 1) * pageSize + i);
        h += '<tr class="' + (opt.onRow ? 'clickable ' : '') + (opt.rowCls ? (opt.rowCls(r) || '') : '') +
          (state.sel[rid] ? ' sel' : '') + '" data-id="' + E(rid) + '" data-i="' + i + '">';
        if (opt.select) h += '<td><input type="checkbox" class="ck" data-ck="' + E(rid) + '"' + (state.sel[rid] ? ' checked' : '') + '></td>';
        if (opt.index) h += '<td class="mid muted">' + ((state.page - 1) * pageSize + i + 1) + '</td>';
        (opt.cols || []).forEach(function (c) {
          var v = c.render ? c.render(r, i) : (r[c.k] === undefined || r[c.k] === null || r[c.k] === '' ? '<span class="muted">—</span>' : E(r[c.k]));
          h += '<td class="' + (c.align === 'right' ? 'num ' : (c.align === 'center' ? 'mid ' : '')) + (c.cls || '') + '">' + v + '</td>';
        });
        h += '</tr>';
      });
      h += '</tbody></table></div>';

      if (pageSize && total > pageSize) {
        h += '<div class="pager"><span>共 <b>' + total + '</b> 条 · 第 ' + state.page + '/' + pages + ' 页' +
          (opt.footNote ? ' · ' + opt.footNote : '') + '</span><div class="pager-btns">';
        h += '<button data-p="1"' + (state.page === 1 ? ' disabled' : '') + '>«</button>';
        h += '<button data-p="' + (state.page - 1) + '"' + (state.page === 1 ? ' disabled' : '') + '>‹</button>';
        var from = Math.max(1, state.page - 2), to = Math.min(pages, from + 4);
        from = Math.max(1, to - 4);
        for (var p = from; p <= to; p++) h += '<button data-p="' + p + '"' + (p === state.page ? ' class="on"' : '') + '>' + p + '</button>';
        h += '<button data-p="' + (state.page + 1) + '"' + (state.page === pages ? ' disabled' : '') + '>›</button>';
        h += '<button data-p="' + pages + '"' + (state.page === pages ? ' disabled' : '') + '>»</button>';
        h += '</div></div>';
      } else if (opt.footNote || total) {
        h += '<div class="pager"><span>共 <b>' + total + '</b> 条' + (opt.footNote ? ' · ' + opt.footNote : '') + '</span><span></span></div>';
      }

      el.innerHTML = h;
      bind(view);
      bindToolbar();
    }

    function bindToolbar() { if (opt.onToolbar) opt.onToolbar(el); }

    function bind(view) {
      el.querySelectorAll('th[data-sort]').forEach(function (th) {
        th.addEventListener('click', function () {
          var k = th.getAttribute('data-sort');
          if (state.sort && state.sort.k === k) state.sort.desc = !state.sort.desc;
          else state.sort = { k: k, desc: false };
          if (opt.onSort) opt.onSort(state.sort);
          render();
        });
      });
      el.querySelectorAll('[data-p]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (b.hasAttribute('disabled')) return;
          state.page = +b.getAttribute('data-p');
          render();
          var sc = el.closest('.content'); if (sc) sc.scrollTop = Math.max(0, el.offsetTop - 80);
        });
      });
      if (opt.onRow) {
        el.querySelectorAll('tbody tr').forEach(function (tr, i) {
          tr.addEventListener('click', function (e) {
            if (e.target.closest('input,button,a,.row-acts')) return;
            opt.onRow(view[i], e);
          });
        });
      }
      var all = el.querySelector('[data-ck-all]');
      if (all) {
        all.checked = view.length > 0 && view.every(function (r) { return state.sel[r.id]; });
        all.addEventListener('change', function () {
          view.forEach(function (r) { state.sel[r.id] = all.checked; });
          render();
        });
      }
      el.querySelectorAll('[data-ck]').forEach(function (c) {
        c.addEventListener('change', function () {
          state.sel[c.getAttribute('data-ck')] = c.checked;
          render();
        });
      });
      var clr = el.querySelector('[data-bulk-clear]');
      if (clr) clr.addEventListener('click', function () { state.sel = {}; render(); });
      el.querySelectorAll('[data-bulk]').forEach(function (b) {
        b.addEventListener('click', function () {
          var picked = state.rows.filter(function (r) { return state.sel[r.id]; });
          (opt.bulk[+b.getAttribute('data-bulk')].fn || function () { })(picked, function () { state.sel = {}; render(); });
        });
      });
      /* 行内操作按钮统一委托 */
      el.querySelectorAll('.row-acts button[data-act]').forEach(function (b) {
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          var tr = b.closest('tr');
          var row = view[+tr.getAttribute('data-i')];
          if (opt.onAct) opt.onAct(b.getAttribute('data-act'), row, e);
        });
      });
    }

    render();
    return {
      el: el,
      setRows: function (rows) { state.rows = rows || []; state.page = 1; render(); },
      selected: function () { return state.rows.filter(function (r) { return state.sel[r.id]; }); },
      refresh: render,
      state: state,
      view: function () { return sorted(); }
    };
  }

  /* ---------------- 看板 ---------------- */
  /* opt: {cols:[{key,name,tone}], rows, groupKey, card(row)->html,
   *       onMove(row,newKey), onCard(row), addText, onAdd(colKey), max} */
  function kanban(hostEl, opt) {
    var el = typeof hostEl === 'string' ? document.querySelector(hostEl) : hostEl;
    if (!el) return null;
    var rows = opt.rows || [];

    function render() {
      var h = '<div class="kanban">';
      (opt.cols || []).forEach(function (c) {
        var list = rows.filter(function (r) { return r[opt.groupKey] === c.key; });
        h += '<div class="kcol" data-col="' + E(c.key) + '">' +
          '<div class="kcol-h"><span class="k-dot" style="background:' + (CH.TONE[c.tone] || c.tone || '#94a3b8') + '"></span>' +
          '<span class="k-name">' + E(c.name) + '</span><span class="k-n">' + list.length + '</span></div>' +
          '<div class="kcol-b">';
        if (!list.length) h += '<div class="muted tiny center" style="padding:14px 0">暂无</div>';
        list.slice(0, opt.max || 100).forEach(function (r) {
          h += '<div class="kcard" draggable="true" data-id="' + E(r.id) + '">' + opt.card(r) + '</div>';
        });
        h += '</div>' + (opt.onAdd ? '<div class="kcol-add" data-add="' + E(c.key) + '">＋ ' + E(opt.addText || '新增') + '</div>' : '') + '</div>';
      });
      el.innerHTML = h + '</div>';
      bind();
    }

    function bind() {
      var dragId = null;
      el.querySelectorAll('.kcard').forEach(function (n) {
        n.addEventListener('dragstart', function () { dragId = n.getAttribute('data-id'); n.classList.add('dragging'); });
        n.addEventListener('dragend', function () { n.classList.remove('dragging'); dragId = null; });
        n.addEventListener('click', function (e) {
          if (e.target.closest('button')) return;
          var r = rows.filter(function (x) { return String(x.id) === n.getAttribute('data-id'); })[0];
          if (r && opt.onCard) opt.onCard(r);
        });
      });
      el.querySelectorAll('.kcol').forEach(function (col) {
        col.addEventListener('dragover', function (e) { e.preventDefault(); col.classList.add('drop-hint'); });
        col.addEventListener('dragleave', function () { col.classList.remove('drop-hint'); });
        col.addEventListener('drop', function (e) {
          e.preventDefault(); col.classList.remove('drop-hint');
          if (!dragId) return;
          var r = rows.filter(function (x) { return String(x.id) === dragId; })[0];
          var toKey = col.getAttribute('data-col');
          if (r && r[opt.groupKey] !== toKey && opt.onMove) opt.onMove(r, toKey);
          render();
        });
      });
      el.querySelectorAll('[data-add]').forEach(function (b) {
        b.addEventListener('click', function () { opt.onAdd(b.getAttribute('data-add')); });
      });
    }

    render();
    return { el: el, setRows: function (r) { rows = r || []; render(); }, refresh: render };
  }

  /* ---------------- 弹出菜单 ---------------- */
  function bindPop(btn, pop) {
    if (!btn || !pop) return;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var was = pop.classList.contains('on');
      document.querySelectorAll('.pop.on').forEach(function (p) { p.classList.remove('on'); });
      if (!was) pop.classList.add('on');
    });
    pop.addEventListener('click', function (e) { e.stopPropagation(); });
  }
  document.addEventListener('click', function () {
    document.querySelectorAll('.pop.on').forEach(function (p) { p.classList.remove('on'); });
  });

  /* ---------------- 导出封装 ---------------- */
  function exportMenu(o) {
    o = o || {};
    return '<div class="pop-wrap"><button class="btn" data-exp-btn>⇩ 导出 ▾</button>' +
      '<div class="pop" data-exp-pop>' +
      (o.csv === false ? '' : '<button data-exp="csv">导出 CSV / Excel</button>') +
      (o.word ? '<button data-exp="word">导出 Word 报告</button>' : '') +
      (o.print === false ? '' : '<button data-exp="print">打印当前视图</button>') +
      '</div></div>';
  }

  function bindExport(root, o) {
    if (!root) return;
    var btn = root.querySelector('[data-exp-btn]');
    var pop = root.querySelector('[data-exp-pop]') || (btn && btn.parentNode.querySelector('.pop'));
    bindPop(btn, pop);
    root.querySelectorAll('[data-exp]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-exp');
        if (pop) pop.classList.remove('on');
        if (t === 'csv') { o.csv(); toast('已导出 CSV 文件'); }
        else if (t === 'word') { o.word(); toast('已导出 Word 报告'); }
        else if (t === 'print') { U.printPage(); }
      });
    });
  }

  /* ---------------- 视图偏好条（保存视图）---------------- */
  function viewBar(mod, current, onApply) {
    var views = S.savedViews(mod);
    var h = '<div class="filter-summary"><span>已保存视图：</span>';
    if (!views.length) h += '<span class="muted">暂无</span>';
    views.forEach(function (v, i) {
      h += '<button class="chip" data-view="' + i + '">' + E(v.name) + '<span data-delview="' + i + '" title="删除">×</span></button>';
    });
    h += '<button class="btn-text" data-saveview>＋ 保存当前视图</button></div>';
    return h;
  }

  return {
    tag: tag, st: st, pri: pri, light: light, ava: ava, owner: owner, avaStack: avaStack,
    pbar: pbar, pcell: pcell, ptone: ptone, trend: trend, due: due,
    pageHead: pageHead, card: card, metric: metric, empty: empty, notice: notice,
    dl: dl, sec: sec, tabs: tabs, chips: chips, listItem: listItem, tline: tline,
    quick: quick, grid: grid, idCell: idCell, cell2: cell2,
    toast: toast, drawer: drawer, modal: modal, confirm: confirm,
    form: form, readForm: readForm, validate: validate, formModal: formModal,
    table: table, kanban: kanban, bindPop: bindPop,
    exportMenu: exportMenu, bindExport: bindExport, viewBar: viewBar
  };
})();
