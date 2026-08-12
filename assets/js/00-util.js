/* ==========================================================================
   00-util · 基础工具
   ========================================================================== */
window.U = (function () {
  'use strict';

  /* ---------- 转义 / DOM ---------- */
  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  }
  function on(root, evt, sel, fn) {
    root.addEventListener(evt, function (e) {
      var t = e.target.closest(sel);
      if (t && root.contains(t)) fn.call(t, e, t);
    });
  }

  /* ---------- 日期 ---------- */
  var WD = ['日', '一', '二', '三', '四', '五', '六'];
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function toDate(v) {
    if (v instanceof Date) return v;
    if (typeof v === 'number') return new Date(v);
    if (!v) return null;
    var s = String(v).trim().replace(/\//g, '-');
    // 2026-08-09 / 2026-08-09 14:30
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
    var d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  function fmtDate(v, f) {
    var d = toDate(v); if (!d) return '';
    f = f || 'YYYY-MM-DD';
    return f.replace('YYYY', d.getFullYear())
      .replace('MM', pad(d.getMonth() + 1)).replace('DD', pad(d.getDate()))
      .replace('HH', pad(d.getHours())).replace('mm', pad(d.getMinutes()))
      .replace('ss', pad(d.getSeconds())).replace('W', WD[d.getDay()]);
  }
  function fmtMD(v) { return fmtDate(v, 'MM-DD'); }
  function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function dayDiff(a, b) {
    var x = toDate(a), y = toDate(b); if (!x || !y) return 0;
    return Math.round((new Date(y.getFullYear(), y.getMonth(), y.getDate()) -
      new Date(x.getFullYear(), x.getMonth(), x.getDate())) / 864e5);
  }
  function addDay(v, n) { var d = toDate(v); if (!d) return null; var r = new Date(d); r.setDate(r.getDate() + n); return r; }
  /* 距今：负数=已过期 */
  function daysLeft(v) { return dayDiff(today(), v); }
  function relTime(v) {
    var d = toDate(v); if (!d) return '';
    var s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 0) return fmtDate(v, 'MM-DD HH:mm');
    if (s < 60) return '刚刚';
    if (s < 3600) return Math.floor(s / 60) + ' 分钟前';
    if (s < 86400) return Math.floor(s / 3600) + ' 小时前';
    if (s < 86400 * 7) return Math.floor(s / 86400) + ' 天前';
    return fmtDate(v, 'MM-DD');
  }
  function dueText(v) {
    var n = daysLeft(v);
    if (n === null) return '';
    if (n < 0) return '逾期 ' + (-n) + ' 天';
    if (n === 0) return '今天到期';
    if (n === 1) return '明天到期';
    return n + ' 天后';
  }
  /* ISO 周次 */
  function weekOf(v) {
    var d = toDate(v); if (!d) return '';
    var t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
    var w1 = new Date(t.getFullYear(), 0, 4);
    return t.getFullYear() + '-W' + pad(1 + Math.round(((t - w1) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7));
  }
  function monthOf(v) { return fmtDate(v, 'YYYY-MM'); }
  function quarterOf(v) { var d = toDate(v); return d ? d.getFullYear() + 'Q' + (Math.floor(d.getMonth() / 3) + 1) : ''; }
  /* 本周一 ~ 本周日 */
  function weekRange(base) {
    var d = base ? toDate(base) : today();
    var dow = (d.getDay() + 6) % 7;
    var s = addDay(d, -dow); s.setHours(0, 0, 0, 0);
    var e = addDay(s, 6); e.setHours(23, 59, 59, 0);
    return [s, e];
  }
  function inRange(v, a, b) { var d = toDate(v); return !!d && d >= toDate(a) && d <= toDate(b); }

  /* ---------- 数字 ---------- */
  function num(v, d) { var n = Number(v); return isFinite(n) ? n : (d === undefined ? 0 : d); }
  function fmtNum(v, dec) {
    var n = num(v);
    return n.toFixed(dec === undefined ? 0 : dec).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function kmb(v) {
    var n = num(v), a = Math.abs(n);
    if (a >= 1e8) return (n / 1e8).toFixed(2) + '亿';
    if (a >= 1e4) return (n / 1e4).toFixed(a >= 1e6 ? 1 : 2) + '万';
    return fmtNum(n);
  }
  function pct(a, b, dec) {
    if (!b) return 0;
    return +((a / b) * 100).toFixed(dec === undefined ? 0 : dec);
  }
  function pctStr(a, b, dec) { return pct(a, b, dec) + '%'; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function pick(f) {
    if (!f) return function (x) { return x; };
    return typeof f === 'function' ? f : function (x) { return x[f]; };
  }
  function sum(list, f) {
    var g = pick(f);
    return (list || []).reduce(function (s, x) { return s + num(g(x)); }, 0);
  }
  function avg(list, f) { return list && list.length ? sum(list, f) / list.length : 0; }
  function max(list, f) {
    var g = pick(f);
    return (list || []).reduce(function (s, x) { return Math.max(s, num(g(x))); }, 0);
  }
  function min(list, f) {
    var g = pick(f);
    if (!list || !list.length) return 0;
    return list.reduce(function (s, x, i) { return i ? Math.min(s, num(g(x))) : num(g(x)); }, 0);
  }
  function delta(cur, prev) {
    if (!prev) return { v: 0, dir: 'flat', text: '—' };
    var d = ((cur - prev) / Math.abs(prev)) * 100;
    return {
      v: +d.toFixed(1),
      dir: d > 0.05 ? 'up' : (d < -0.05 ? 'down' : 'flat'),
      text: (d > 0 ? '+' : '') + d.toFixed(1) + '%'
    };
  }

  /* ---------- 集合 ---------- */
  function by(list, key) {
    var m = {};
    (list || []).forEach(function (x) { m[typeof key === 'function' ? key(x) : x[key]] = x; });
    return m;
  }
  function group(list, key) {
    var m = {};
    (list || []).forEach(function (x) {
      var k = typeof key === 'function' ? key(x) : x[key];
      (m[k] = m[k] || []).push(x);
    });
    return m;
  }
  function countBy(list, key) {
    var m = {};
    (list || []).forEach(function (x) {
      var k = typeof key === 'function' ? key(x) : x[key];
      m[k] = (m[k] || 0) + 1;
    });
    return m;
  }
  function uniq(list) { return list.filter(function (x, i) { return list.indexOf(x) === i; }); }
  function sortBy(list, key, desc) {
    var f = typeof key === 'function' ? key : function (x) { return x[key]; };
    return list.slice().sort(function (a, b) {
      var x = f(a), y = f(b);
      if (x === y) return 0;
      if (x === undefined || x === null || x === '') return 1;
      if (y === undefined || y === null || y === '') return -1;
      var r = (typeof x === 'number' && typeof y === 'number') ? x - y : String(x).localeCompare(String(y), 'zh');
      return desc ? -r : r;
    });
  }
  function orderBy(list, arr) {
    return list.slice().sort(function (a, b) {
      var i = arr.indexOf(a), j = arr.indexOf(b);
      return (i < 0 ? 999 : i) - (j < 0 ? 999 : j);
    });
  }
  function take(list, n) { return (list || []).slice(0, n); }

  /* ---------- 字符串 / 搜索 ---------- */
  function match(text, kw) {
    if (!kw) return true;
    return String(text || '').toLowerCase().indexOf(String(kw).toLowerCase()) >= 0;
  }
  function matchAny(obj, fields, kw) {
    if (!kw) return true;
    return fields.some(function (f) { return match(obj[f], kw); });
  }
  function hl(text, kw) {
    var t = esc(text);
    if (!kw) return t;
    var i = t.toLowerCase().indexOf(String(kw).toLowerCase());
    if (i < 0) return t;
    return t.slice(0, i) + '<mark style="background:#fef08a;padding:0 1px">' +
      t.slice(i, i + kw.length) + '</mark>' + t.slice(i + kw.length);
  }
  function ellip(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; }
  function initials(name) {
    var s = String(name || '?').trim();
    return /[一-龥]/.test(s) ? s.slice(-2) : s.slice(0, 2).toUpperCase();
  }
  function avaCls(name) {
    var s = String(name || ''), h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff;
    return 'ava-c' + (h % 8);
  }
  function uid(prefix) {
    return (prefix || 'ID') + '-' + Date.now().toString(36).slice(-5).toUpperCase() +
      Math.random().toString(36).slice(2, 5).toUpperCase();
  }

  /* ---------- 存储 ---------- */
  /* 两个发行版必须各存各的。file:// 下所有本地文件共用一个 localStorage 分区，
     同一台机器上 index.html 和 pm.html 会撞进同一个库——项目经理导入分发包、
     改任务进度，会直接写花总监的真实数据。换个前缀就物理隔开了。 */
  var NS = window.PMW_EDITION === 'pm' ? 'pmw-pm.' : 'pmw.';
  function save(k, v) { try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) { } }
  function load(k, d) {
    try { var s = localStorage.getItem(NS + k); return s === null ? d : JSON.parse(s); }
    catch (e) { return d; }
  }
  function drop(k) { try { localStorage.removeItem(NS + k); } catch (e) { } }
  function dropAll() {
    try {
      Object.keys(localStorage).filter(function (k) { return k.indexOf(NS) === 0; })
        .forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) { }
  }

  /* ---------- 导出 ---------- */
  function download(name, content, mime) {
    var blob = content instanceof Blob ? content : new Blob(['﻿' + content], { type: mime || 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 300);
  }
  function toCSV(rows, cols) {
    var head = cols.map(function (c) { return '"' + String(c.label).replace(/"/g, '""') + '"'; }).join(',');
    var body = rows.map(function (r) {
      return cols.map(function (c) {
        var v = typeof c.get === 'function' ? c.get(r) : r[c.key];
        if (v === null || v === undefined) v = '';
        return '"' + String(v).replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"';
      }).join(',');
    }).join('\r\n');
    return head + '\r\n' + body;
  }
  function exportCSV(name, rows, cols) {
    download(name + '_' + fmtDate(new Date(), 'YYYYMMDD') + '.csv', toCSV(rows, cols), 'text/csv;charset=utf-8');
  }
  /* Word：用 HTML 伪装的 .doc，Word/WPS 都能正常打开 */
  function exportWord(name, title, bodyHtml) {
    var html =
      '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" ' +
      'xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8">' +
      '<title>' + esc(title) + '</title><style>' +
      'body{font-family:"Microsoft YaHei","PingFang SC",sans-serif;font-size:10.5pt;line-height:1.75;color:#1f2937}' +
      'h1{font-size:19pt;border-bottom:2px solid #2563eb;padding-bottom:8px;color:#0f172a}' +
      'h2{font-size:14pt;margin:20px 0 8px;color:#1e40af;border-left:4px solid #2563eb;padding-left:8px}' +
      'h3{font-size:12pt;margin:14px 0 6px;color:#334155}' +
      'table{border-collapse:collapse;width:100%;margin:8px 0;font-size:9.5pt}' +
      'th{background:#f1f5f9;border:1px solid #cbd5e1;padding:6px 8px;text-align:left;font-weight:bold}' +
      'td{border:1px solid #cbd5e1;padding:6px 8px;vertical-align:top}' +
      '.meta{color:#64748b;font-size:9pt;margin-bottom:16px}' +
      '.tag{display:inline-block;padding:1px 6px;border:1px solid #cbd5e1;border-radius:3px;font-size:8.5pt;background:#f8fafc}' +
      'ul,ol{margin:6px 0 6px 22px}li{margin:3px 0}' +
      '.sig{margin-top:32px;color:#64748b;font-size:9pt;border-top:1px solid #e2e8f0;padding-top:10px}' +
      '</style></head><body>' + bodyHtml +
      '<div class="sig">本文档由「产品管理工作台」于 ' + fmtDate(new Date(), 'YYYY-MM-DD HH:mm') + ' 自动生成</div>' +
      '</body></html>';
    download(name + '_' + fmtDate(new Date(), 'YYYYMMDD') + '.doc', html, 'application/msword');
  }
  function exportJSON(name, obj) {
    download(name + '_' + fmtDate(new Date(), 'YYYYMMDD') + '.json', JSON.stringify(obj, null, 2), 'application/json');
  }
  function printPage() { window.print(); }

  /* ---------- 杂项 ---------- */
  function debounce(fn, ms) {
    var t; return function () {
      var a = arguments, s = this;
      clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms || 200);
    };
  }
  function copy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove(); return true;
    } catch (e) { return false; }
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  /* 确定性伪随机：同样的种子每次刷新出同一批数据 */
  function rng(seed) {
    var s = seed || 1;
    return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }
  /* 注意：这里曾经也叫 pick，与上方 sum/avg/max/min 依赖的取值助手 pick(f) 重名。
     函数声明会提升且后者覆盖前者，导致 U.sum/avg/max/min 全线失效，故改名 randPick。 */
  function randPick(arr, r) { return arr[Math.floor((r || Math.random()) * arr.length) % arr.length]; }

  return {
    esc: esc, $: $, $$: $$, el: el, on: on,
    pad: pad, toDate: toDate, fmtDate: fmtDate, fmtMD: fmtMD, today: today,
    dayDiff: dayDiff, addDay: addDay, daysLeft: daysLeft, relTime: relTime, dueText: dueText,
    weekOf: weekOf, monthOf: monthOf, quarterOf: quarterOf, weekRange: weekRange, inRange: inRange,
    num: num, fmtNum: fmtNum, kmb: kmb, pct: pct, pctStr: pctStr, clamp: clamp,
    sum: sum, avg: avg, max: max, min: min, delta: delta,
    by: by, group: group, countBy: countBy, uniq: uniq, sortBy: sortBy, orderBy: orderBy, take: take,
    match: match, matchAny: matchAny, hl: hl, ellip: ellip, initials: initials, avaCls: avaCls, uid: uid,
    save: save, load: load, drop: drop, dropAll: dropAll,
    download: download, toCSV: toCSV, exportCSV: exportCSV, exportWord: exportWord,
    exportJSON: exportJSON, printPage: printPage,
    debounce: debounce, copy: copy, clone: clone, rng: rng, randPick: randPick,
    WD: WD
  };
})();
