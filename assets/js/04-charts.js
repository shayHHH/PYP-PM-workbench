/* ============================================================
 * 04-charts.js  图表引擎（纯 SVG / 原生 DOM，无第三方依赖）
 * 提供：折线、面积、柱状、堆叠柱、组合图、环形、漏斗、迷你走势、
 *       甘特图、热力矩阵、条形对比、状态流转阶梯、发布时间线
 * 所有图表：host 元素 + 配置对象；自动响应窗口尺寸变化；统一 tooltip
 * ========================================================== */
window.CH = (function () {
  'use strict';

  var PAL = ['#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#dc2626',
    '#65a30d', '#c026d3', '#0284c7', '#ea580c', '#4f46e5', '#059669'];

  var TONE = {
    done: '#16a34a', doing: '#2563eb', plan: '#64748b', warn: '#d97706',
    danger: '#dc2626', idle: '#94a3b8', cyan: '#0891b2', accent: '#4f46e5'
  };

  var NS = 'http://www.w3.org/2000/svg';

  /* ---------------- 基础工具 ---------------- */
  function mk(tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  function host(h) {
    if (!h) return null;
    if (typeof h === 'string') return document.getElementById(h.replace(/^#/, '')) || document.querySelector(h);
    return h;
  }

  function width(el, min) {
    var w = el.clientWidth || el.getBoundingClientRect().width || 0;
    return Math.max(w, min || 260);
  }

  function color(i, c) { return c || PAL[i % PAL.length]; }

  function accent() {
    var v = getComputedStyle(document.body).getPropertyValue('--c-accent');
    return (v || '').trim() || '#4f46e5';
  }

  /* 生成"好看"的刻度 */
  function niceScale(min, max, ticks) {
    ticks = ticks || 4;
    if (min === max) { max = min + 1; }
    if (min > 0 && min / (max || 1) > 0.55) { /* 保留底部留白，不强制归零 */ } else if (min > 0) min = 0;
    if (max < 0) max = 0;
    var span = max - min || 1;
    var step = Math.pow(10, Math.floor(Math.log(span / ticks) / Math.LN10));
    var err = span / ticks / step;
    if (err >= 7.5) step *= 10; else if (err >= 3.5) step *= 5; else if (err >= 1.5) step *= 2;
    var lo = Math.floor(min / step) * step;
    var hi = Math.ceil(max / step) * step;
    var out = [];
    for (var v = lo; v <= hi + step * 0.001; v += step) out.push(Math.round(v * 1e6) / 1e6);
    return { min: lo, max: hi, ticks: out, step: step };
  }

  function defFmt(v) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    var a = Math.abs(v);
    if (a >= 100000000) return (v / 100000000).toFixed(1) + '亿';
    if (a >= 10000) return (v / 10000).toFixed(a >= 100000 ? 0 : 1) + '万';
    if (a >= 1000) return (Math.round(v * 10) / 10).toLocaleString('en-US');
    return String(Math.round(v * 100) / 100);
  }

  /* ---------------- Tooltip ---------------- */
  var tipEl = null;
  function tip() {
    if (!tipEl) tipEl = document.getElementById('chartTip');
    return tipEl;
  }
  function tipShow(ev, html) {
    var t = tip(); if (!t) return;
    t.innerHTML = html;
    t.style.display = 'block';
    tipMove(ev);
  }
  function tipMove(ev) {
    var t = tip(); if (!t || t.style.display === 'none') return;
    var w = t.offsetWidth, h = t.offsetHeight;
    var x = ev.clientX + 14, y = ev.clientY + 14;
    if (x + w > window.innerWidth - 8) x = ev.clientX - w - 14;
    if (y + h > window.innerHeight - 8) y = ev.clientY - h - 14;
    t.style.left = Math.max(6, x) + 'px';
    t.style.top = Math.max(6, y) + 'px';
  }
  function tipHide() { var t = tip(); if (t) t.style.display = 'none'; }

  function tipRow(c, name, val) {
    return '<div class="tp-row"><span><i style="background:' + c + '"></i>' + esc(name) + '</span><b>' + esc(val) + '</b></div>';
  }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function bindTip(node, htmlFn, onClick) {
    node.addEventListener('mouseenter', function (e) { tipShow(e, htmlFn()); });
    node.addEventListener('mousemove', tipMove);
    node.addEventListener('mouseleave', tipHide);
    if (onClick) {
      node.style.cursor = 'pointer';
      node.addEventListener('click', function (e) { tipHide(); onClick(e); });
    }
  }

  /* ---------------- 重绘登记（窗口尺寸变化）---------------- */
  var registry = [];
  function register(el, fn) {
    el.__chRedraw = fn;
    for (var i = 0; i < registry.length; i++) {
      if (!document.body.contains(registry[i].el)) { registry.splice(i, 1); i--; }
      else if (registry[i].el === el) { registry[i].fn = fn; return; }
    }
    registry.push({ el: el, fn: fn });
  }
  var rzTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(rzTimer);
    rzTimer = setTimeout(function () {
      tipHide();
      for (var i = 0; i < registry.length; i++) {
        if (!document.body.contains(registry[i].el)) { registry.splice(i, 1); i--; continue; }
        try { registry[i].fn(); } catch (e) { }
      }
    }, 160);
  });

  /* 图例 */
  function legend(el, items, onToggle) {
    var wrap = document.createElement('div');
    wrap.className = 'chart-legend';
    items.forEach(function (it, i) {
      var b = document.createElement('span');
      b.className = 'lg';
      b.innerHTML = '<i style="background:' + it.color + '"></i>' + esc(it.name);
      if (onToggle) {
        b.addEventListener('click', function () {
          b.classList.toggle('off');
          onToggle(i, !b.classList.contains('off'));
        });
      } else b.style.cursor = 'default';
      wrap.appendChild(b);
    });
    el.appendChild(wrap);
    return wrap;
  }

  /* ============================================================
   * 折线 / 面积图
   * opt: {labels:[], series:[{name,data:[],color,dash,area,type:'line|bar'}],
   *       height, yFmt, xEvery, area, smooth, legend, min, max, mark:[{x,label}], onClick(si,i)}
   * ========================================================== */
  function line(h, opt) {
    var el = host(h); if (!el) return;
    opt = opt || {};
    var draw = function () { drawLine(el, opt); };
    register(el, draw); draw();
  }

  function drawLine(el, opt) {
    el.innerHTML = '';
    el.classList.add('chart');
    var labels = opt.labels || [];
    var series = (opt.series || []).filter(function (s) { return s.__off !== true; });
    var all = opt.series || [];
    var H = opt.height || 240;
    var W = width(el, 300);
    var yFmt = opt.yFmt || defFmt;
    var padL = opt.padL !== undefined ? opt.padL : 46;
    var padR = opt.padR !== undefined ? opt.padR : 14;
    var padT = 14, padB = 30;
    var cw = Math.max(W - padL - padR, 40), ch = Math.max(H - padT - padB, 40);

    var vals = [];
    series.forEach(function (s) { (s.data || []).forEach(function (v) { if (v !== null && v !== undefined && !isNaN(v)) vals.push(+v); }); });
    if (!vals.length) vals = [0, 1];
    var mn = opt.min !== undefined ? opt.min : Math.min.apply(null, vals);
    var mx = opt.max !== undefined ? opt.max : Math.max.apply(null, vals);
    var sc = niceScale(mn, mx, opt.ticks || 4);
    var y0 = sc.min, y1 = sc.max;

    var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, height: H, width: W });
    var X = function (i) { return labels.length <= 1 ? padL + cw / 2 : padL + (cw * i) / (labels.length - 1); };
    var Y = function (v) { return padT + ch - ((v - y0) / (y1 - y0 || 1)) * ch; };

    /* 网格 + Y 轴 */
    sc.ticks.forEach(function (t) {
      var y = Y(t);
      svg.appendChild(mk('line', { x1: padL, y1: y, x2: padL + cw, y2: y, stroke: '#eef2f7', 'stroke-width': 1 }));
      svg.appendChild(mk('text', { x: padL - 7, y: y + 3.5, 'text-anchor': 'end', 'font-size': 10, fill: '#94a3b8' }, yFmt(t)));
    });

    /* X 轴标签 */
    var every = opt.xEvery || Math.max(1, Math.ceil(labels.length / Math.floor(cw / 58)));
    labels.forEach(function (lb, i) {
      if (i % every !== 0 && i !== labels.length - 1) return;
      svg.appendChild(mk('text', {
        x: X(i), y: padT + ch + 16, 'text-anchor': i === 0 ? 'start' : (i === labels.length - 1 ? 'end' : 'middle'),
        'font-size': 10, fill: '#94a3b8'
      }, lb));
    });
    svg.appendChild(mk('line', { x1: padL, y1: padT + ch, x2: padL + cw, y2: padT + ch, stroke: '#e2e8f0' }));

    /* 标记线 */
    (opt.mark || []).forEach(function (m) {
      var mi = typeof m.x === 'number' ? m.x : labels.indexOf(m.x);
      if (mi < 0) return;
      svg.appendChild(mk('line', { x1: X(mi), y1: padT, x2: X(mi), y2: padT + ch, stroke: m.color || '#dc2626', 'stroke-width': 1, 'stroke-dasharray': '3 3' }));
      if (m.label) svg.appendChild(mk('text', { x: X(mi) + 3, y: padT + 9, 'font-size': 9, fill: m.color || '#dc2626' }, m.label));
    });

    /* 柱系列（组合图）先画 */
    var barSeries = series.filter(function (s) { return s.type === 'bar'; });
    if (barSeries.length && labels.length) {
      var slot = cw / labels.length;
      var bw = Math.max(4, Math.min(26, slot * 0.5 / barSeries.length));
      barSeries.forEach(function (s, bi) {
        var c = color(all.indexOf(s), s.color);
        (s.data || []).forEach(function (v, i) {
          if (v === null || v === undefined) return;
          var hgt = Math.max(1, Y(y0) - Y(v));
          var x = X(i) - (bw * barSeries.length) / 2 + bi * bw;
          svg.appendChild(mk('rect', { x: x, y: Y(v), width: bw - 1, height: hgt, fill: c, opacity: .82, rx: 2, 'class': 'bar' }));
        });
      });
    }

    /* 折线 */
    series.forEach(function (s, si) {
      if (s.type === 'bar') return;
      var idx = all.indexOf(s);
      var c = color(idx, s.color);
      var pts = [], dArr = [];
      (s.data || []).forEach(function (v, i) {
        if (v === null || v === undefined || isNaN(v)) return;
        pts.push([X(i), Y(v), i, +v]);
      });
      if (!pts.length) return;
      pts.forEach(function (p, i) { dArr.push((i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)); });
      var d = dArr.join(' ');

      if (opt.area || s.area) {
        var gid = 'g' + Math.random().toString(36).slice(2, 8);
        var lg = mk('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 });
        lg.appendChild(mk('stop', { offset: '0%', 'stop-color': c, 'stop-opacity': .26 }));
        lg.appendChild(mk('stop', { offset: '100%', 'stop-color': c, 'stop-opacity': .01 }));
        var defs = mk('defs'); defs.appendChild(lg); svg.appendChild(defs);
        svg.appendChild(mk('path', {
          d: d + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + (padT + ch) + ' L' + pts[0][0].toFixed(1) + ' ' + (padT + ch) + ' Z',
          fill: 'url(#' + gid + ')', stroke: 'none'
        }));
      }
      svg.appendChild(mk('path', {
        d: d, fill: 'none', stroke: c, 'stroke-width': s.w || 2,
        'stroke-linejoin': 'round', 'stroke-linecap': 'round',
        'stroke-dasharray': s.dash ? '5 4' : null
      }));
      if (opt.dot !== false && pts.length <= 40) {
        pts.forEach(function (p) {
          svg.appendChild(mk('circle', { cx: p[0], cy: p[1], r: pts.length > 20 ? 2 : 2.8, fill: '#fff', stroke: c, 'stroke-width': 1.6, 'class': 'dot' }));
        });
      }
    });

    /* 悬浮命中区 */
    var guide = mk('line', { x1: 0, y1: padT, x2: 0, y2: padT + ch, stroke: '#cbd5e1', 'stroke-width': 1, opacity: 0 });
    svg.appendChild(guide);
    labels.forEach(function (lb, i) {
      var hw = labels.length <= 1 ? cw : cw / (labels.length - 1);
      var r = mk('rect', {
        x: X(i) - hw / 2, y: padT, width: hw, height: ch, fill: 'transparent', 'class': 'hit'
      });
      bindTip(r, function () {
        var rows = '<b>' + esc(lb) + '</b>';
        series.forEach(function (s) {
          var idx = all.indexOf(s);
          var v = (s.data || [])[i];
          if (v === null || v === undefined) return;
          rows += tipRow(color(idx, s.color), s.name, (s.fmt || yFmt)(v));
        });
        return rows;
      }, opt.onClick ? function () { opt.onClick(i, labels[i]); } : null);
      r.addEventListener('mouseenter', function () { guide.setAttribute('x1', X(i)); guide.setAttribute('x2', X(i)); guide.setAttribute('opacity', 1); });
      r.addEventListener('mouseleave', function () { guide.setAttribute('opacity', 0); });
      svg.appendChild(r);
    });

    el.appendChild(svg);

    if (opt.legend !== false && all.length > 1) {
      legend(el, all.map(function (s, i) { return { name: s.name, color: color(i, s.color) }; }), function (i, on) {
        all[i].__off = !on;
        drawLine(el, opt);
      });
    }
  }

  /* ============================================================
   * 柱状图 / 堆叠柱
   * opt: {labels, series:[{name,data,color}], stack, height, yFmt, horizontal, legend, onClick(i)}
   * ========================================================== */
  function bar(h, opt) {
    var el = host(h); if (!el) return;
    opt = opt || {};
    var draw = function () { opt.horizontal ? drawHBar(el, opt) : drawBar(el, opt); };
    register(el, draw); draw();
  }

  function drawBar(el, opt) {
    el.innerHTML = '';
    el.classList.add('chart');
    var labels = opt.labels || [];
    var all = opt.series || [];
    var series = all.filter(function (s) { return s.__off !== true; });
    var H = opt.height || 240, W = width(el, 300);
    var yFmt = opt.yFmt || defFmt;
    var padL = opt.padL !== undefined ? opt.padL : 44, padR = 14, padT = 16, padB = 32;
    var cw = Math.max(W - padL - padR, 40), ch = Math.max(H - padT - padB, 40);

    var vals = [];
    if (opt.stack) {
      labels.forEach(function (_, i) {
        var s = 0; series.forEach(function (se) { s += +(se.data || [])[i] || 0; }); vals.push(s);
      });
    } else series.forEach(function (s) { (s.data || []).forEach(function (v) { vals.push(+v || 0); }); });
    if (!vals.length) vals = [0, 1];
    var sc = niceScale(0, Math.max.apply(null, vals), opt.ticks || 4);
    var y0 = 0, y1 = sc.max;

    var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, height: H, width: W });
    var Y = function (v) { return padT + ch - ((v - y0) / (y1 - y0 || 1)) * ch; };
    sc.ticks.forEach(function (t) {
      var y = Y(t);
      svg.appendChild(mk('line', { x1: padL, y1: y, x2: padL + cw, y2: y, stroke: '#eef2f7' }));
      svg.appendChild(mk('text', { x: padL - 7, y: y + 3.5, 'text-anchor': 'end', 'font-size': 10, fill: '#94a3b8' }, yFmt(t)));
    });
    svg.appendChild(mk('line', { x1: padL, y1: padT + ch, x2: padL + cw, y2: padT + ch, stroke: '#e2e8f0' }));

    var slot = cw / Math.max(labels.length, 1);
    var groupW = Math.min(slot * 0.68, opt.maxBar || 46);
    var bw = opt.stack ? groupW : groupW / Math.max(series.length, 1);

    labels.forEach(function (lb, i) {
      var cx = padL + slot * i + slot / 2;
      var acc = 0;
      series.forEach(function (s, si) {
        var idx = all.indexOf(s);
        var v = +(s.data || [])[i] || 0;
        if (!v && opt.stack) return;
        var c = color(idx, s.color);
        var x = opt.stack ? cx - bw / 2 : cx - groupW / 2 + si * bw;
        var yTop, hgt;
        if (opt.stack) { yTop = Y(acc + v); hgt = Y(acc) - Y(acc + v); acc += v; }
        else { yTop = Y(v); hgt = Y(0) - Y(v); }
        var r = mk('rect', {
          x: x, y: yTop, width: Math.max(bw - (opt.stack ? 0 : 2), 2), height: Math.max(hgt, v ? 1 : 0),
          fill: c, rx: opt.stack ? 0 : 3, 'class': 'bar'
        });
        bindTip(r, function () {
          return '<b>' + esc(lb) + '</b>' + tipRow(c, s.name, (s.fmt || yFmt)(v));
        }, opt.onClick ? function () { opt.onClick(i, lb, s.name); } : null);
        svg.appendChild(r);
      });
      if (opt.valueLabel && series.length === 1) {
        var vv = +(series[0].data || [])[i] || 0;
        svg.appendChild(mk('text', { x: cx, y: Y(vv) - 5, 'text-anchor': 'middle', 'font-size': 10, fill: '#64748b' }, yFmt(vv)));
      }
      var every = Math.max(1, Math.ceil(labels.length / Math.floor(cw / 52)));
      if (i % every === 0 || labels.length <= 12) {
        svg.appendChild(mk('text', { x: cx, y: padT + ch + 16, 'text-anchor': 'middle', 'font-size': 10, fill: '#94a3b8' }, lb));
      }
    });

    el.appendChild(svg);
    if (opt.legend !== false && all.length > 1) {
      legend(el, all.map(function (s, i) { return { name: s.name, color: color(i, s.color) }; }), function (i, on) {
        all[i].__off = !on; drawBar(el, opt);
      });
    }
  }

  /* 横向柱（排行榜） */
  function drawHBar(el, opt) {
    el.innerHTML = '';
    el.classList.add('chart');
    var labels = opt.labels || [];
    var s0 = (opt.series || [])[0] || { data: [] };
    var yFmt = opt.yFmt || defFmt;
    var rowH = opt.rowH || 26;
    var H = opt.height || (labels.length * rowH + 22), W = width(el, 300);
    var padL = opt.padL !== undefined ? opt.padL : 92, padR = 46, padT = 6;
    var cw = Math.max(W - padL - padR, 40);
    var mx = Math.max.apply(null, (s0.data || [0]).map(function (v) { return +v || 0; }).concat([1]));
    var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, height: H, width: W });
    labels.forEach(function (lb, i) {
      var y = padT + i * rowH;
      var v = +(s0.data || [])[i] || 0;
      var bwid = Math.max(2, (v / mx) * cw);
      var c = (opt.colors && opt.colors[i]) || color(i, s0.color);
      svg.appendChild(mk('text', { x: padL - 8, y: y + rowH / 2 + 3.5, 'text-anchor': 'end', 'font-size': 11, fill: '#475569' },
        lb.length > 8 ? lb.slice(0, 8) + '…' : lb));
      svg.appendChild(mk('rect', { x: padL, y: y + 4, width: cw, height: rowH - 12, fill: '#f1f5f9', rx: 3 }));
      var r = mk('rect', { x: padL, y: y + 4, width: bwid, height: rowH - 12, fill: c, rx: 3, 'class': 'bar' });
      bindTip(r, function () { return '<b>' + esc(lb) + '</b>' + tipRow(c, s0.name || '数值', yFmt(v)); },
        opt.onClick ? function () { opt.onClick(i, lb); } : null);
      svg.appendChild(r);
      svg.appendChild(mk('text', { x: padL + cw + 6, y: y + rowH / 2 + 3.5, 'font-size': 11, fill: '#0f172a', 'font-weight': 600 }, yFmt(v)));
    });
    el.appendChild(svg);
  }

  /* ============================================================
   * 环形图 / 饼图
   * opt: {data:[{name,value,color}], height, inner, center:{v,l}, legendSide, onClick(i)}
   * ========================================================== */
  function donut(h, opt) {
    var el = host(h); if (!el) return;
    opt = opt || {};
    var draw = function () { drawDonut(el, opt); };
    register(el, draw); draw();
  }

  function drawDonut(el, opt) {
    el.innerHTML = '';
    el.classList.add('chart');
    var data = (opt.data || []).filter(function (d) { return (+d.value || 0) >= 0; });
    var H = opt.height || 200, W = width(el, 200);
    var side = opt.legendSide !== false && W > 320;
    var cx = side ? Math.min(H, W * .45) / 2 + 12 : W / 2;
    var cy = H / 2;
    var R = Math.min(H, side ? W * .5 : W) / 2 - 8;
    var r0 = opt.inner !== undefined ? opt.inner : R * 0.62;
    var total = data.reduce(function (a, b) { return a + (+b.value || 0); }, 0);
    var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, height: H, width: W });

    if (!total) {
      svg.appendChild(mk('circle', { cx: cx, cy: cy, r: (R + r0) / 2, fill: 'none', stroke: '#f1f5f9', 'stroke-width': R - r0 }));
      svg.appendChild(mk('text', { x: cx, y: cy + 4, 'text-anchor': 'middle', 'font-size': 12, fill: '#94a3b8' }, '暂无数据'));
      el.appendChild(svg);
      return;
    }

    var ang = -Math.PI / 2;
    data.forEach(function (d, i) {
      var v = +d.value || 0;
      if (!v) return;
      var a2 = ang + (v / total) * Math.PI * 2;
      var large = (a2 - ang) > Math.PI ? 1 : 0;
      var p = [
        'M', (cx + R * Math.cos(ang)).toFixed(2), (cy + R * Math.sin(ang)).toFixed(2),
        'A', R, R, 0, large, 1, (cx + R * Math.cos(a2)).toFixed(2), (cy + R * Math.sin(a2)).toFixed(2),
        'L', (cx + r0 * Math.cos(a2)).toFixed(2), (cy + r0 * Math.sin(a2)).toFixed(2),
        'A', r0, r0, 0, large, 0, (cx + r0 * Math.cos(ang)).toFixed(2), (cy + r0 * Math.sin(ang)).toFixed(2), 'Z'
      ].join(' ');
      var c = color(i, d.color);
      var path = mk('path', { d: p, fill: c, 'class': 'arc', stroke: '#fff', 'stroke-width': 1.4 });
      bindTip(path, function () {
        return '<b>' + esc(d.name) + '</b>' + tipRow(c, '数量', defFmt(v) + '（' + (v / total * 100).toFixed(1) + '%）');
      }, opt.onClick ? function () { opt.onClick(i, d); } : null);
      svg.appendChild(path);
      ang = a2;
    });

    if (r0 > 8) {
      var cV = opt.center && opt.center.v !== undefined ? opt.center.v : defFmt(total);
      var cL = opt.center && opt.center.l !== undefined ? opt.center.l : '合计';
      svg.appendChild(mk('text', { x: cx, y: cy - 1, 'text-anchor': 'middle', 'font-size': Math.min(22, r0 * .62), 'font-weight': 700, fill: '#0f172a' }, cV));
      svg.appendChild(mk('text', { x: cx, y: cy + 15, 'text-anchor': 'middle', 'font-size': 10, fill: '#94a3b8' }, cL));
    }

    /* 右侧图例（带数值） */
    if (side) {
      var lx = cx + R + 26;
      var lh = Math.min(20, (H - 12) / Math.max(data.length, 1));
      var ly = cy - (data.length * lh) / 2 + lh / 2;
      data.forEach(function (d, i) {
        var y = ly + i * lh;
        svg.appendChild(mk('rect', { x: lx, y: y - 5, width: 9, height: 9, rx: 2, fill: color(i, d.color) }));
        svg.appendChild(mk('text', { x: lx + 14, y: y + 3, 'font-size': 11, fill: '#475569' }, d.name));
        svg.appendChild(mk('text', { x: W - 6, y: y + 3, 'text-anchor': 'end', 'font-size': 11, 'font-weight': 600, fill: '#0f172a' },
          defFmt(d.value) + ' · ' + ((+d.value || 0) / total * 100).toFixed(0) + '%'));
      });
    }
    el.appendChild(svg);
    if (!side) legend(el, data.map(function (d, i) { return { name: d.name + ' ' + defFmt(d.value), color: color(i, d.color) }; }));
  }

  /* ============================================================
   * 漏斗图
   * opt: {data:[{name,value}], height, colors, onClick(i)}
   * ========================================================== */
  function funnel(h, opt) {
    var el = host(h); if (!el) return;
    opt = opt || {};
    var draw = function () { drawFunnel(el, opt); };
    register(el, draw); draw();
  }

  function drawFunnel(el, opt) {
    el.innerHTML = '';
    el.classList.add('chart');
    var data = opt.data || [];
    if (!data.length) return;
    var H = opt.height || (data.length * 46 + 16), W = width(el, 320);
    var padL = 4, padR = 128;
    var cw = W - padL - padR;
    var rowH = (H - 12) / data.length;
    var mx = Math.max.apply(null, data.map(function (d) { return +d.value || 0; }).concat([1]));
    var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, height: H, width: W });
    var cxc = padL + cw / 2;

    data.forEach(function (d, i) {
      var v = +d.value || 0;
      var nx = i < data.length - 1 ? (+data[i + 1].value || 0) : v;
      var w1 = (v / mx) * cw, w2 = (nx / mx) * cw;
      var y = 6 + i * rowH, hh = rowH - 8;
      var c = color(i, d.color || (opt.colors && opt.colors[i]));
      var p = 'M' + (cxc - w1 / 2) + ' ' + y + ' L' + (cxc + w1 / 2) + ' ' + y +
        ' L' + (cxc + w2 / 2) + ' ' + (y + hh) + ' L' + (cxc - w2 / 2) + ' ' + (y + hh) + ' Z';
      var rate = i === 0 ? 100 : (v / (+data[0].value || 1) * 100);
      var step = i === 0 ? 100 : (v / (+data[i - 1].value || 1) * 100);
      var path = mk('path', { d: p, fill: c, opacity: .88, 'class': 'arc' });
      bindTip(path, function () {
        return '<b>' + esc(d.name) + '</b>' +
          tipRow(c, '人数/数量', defFmt(v)) +
          tipRow('#94a3b8', '整体转化', rate.toFixed(1) + '%') +
          tipRow('#94a3b8', '环节转化', step.toFixed(1) + '%');
      }, opt.onClick ? function () { opt.onClick(i, d); } : null);
      svg.appendChild(path);
      svg.appendChild(mk('text', { x: cxc, y: y + hh / 2 + 4, 'text-anchor': 'middle', 'font-size': 11, fill: '#fff', 'font-weight': 600 }, d.name));
      svg.appendChild(mk('text', { x: W - padR + 12, y: y + hh / 2 + 1, 'font-size': 11, 'font-weight': 600, fill: '#0f172a' }, defFmt(v)));
      svg.appendChild(mk('text', { x: W - padR + 12, y: y + hh / 2 + 13, 'font-size': 10, fill: i > 0 && step < 60 ? '#dc2626' : '#94a3b8' },
        i === 0 ? '入口 100%' : ('环节 ' + step.toFixed(1) + '% / 整体 ' + rate.toFixed(1) + '%')));
    });
    el.appendChild(svg);
  }

  /* ============================================================
   * 迷你走势（返回 SVG 字符串，用于指标卡）
   * ========================================================== */
  function sparkSVG(data, o) {
    o = o || {};
    var w = o.w || 88, h = o.h || 26, c = o.color || accent();
    var d = (data || []).map(function (v) { return +v || 0; });
    if (d.length < 2) return '';
    var mn = Math.min.apply(null, d), mx = Math.max.apply(null, d);
    var sp = (mx - mn) || 1;
    var pts = d.map(function (v, i) {
      return [(i / (d.length - 1)) * (w - 2) + 1, h - 2 - ((v - mn) / sp) * (h - 5)];
    });
    var path = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    var area = o.area === false ? '' :
      '<path d="' + path + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + h + ' L' + pts[0][0].toFixed(1) + ' ' + h + ' Z" fill="' + c + '" opacity=".1"/>';
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" style="display:block">' + area +
      '<path d="' + path + '" fill="none" stroke="' + c + '" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<circle cx="' + pts[pts.length - 1][0].toFixed(1) + '" cy="' + pts[pts.length - 1][1].toFixed(1) + '" r="2" fill="' + c + '"/></svg>';
  }

  /* ============================================================
   * 条形对比（HTML，.bars）
   * data:[{label,value,color,target,text}]
   * ========================================================== */
  function bars(h, opt) {
    var el = host(h); if (!el) return;
    opt = opt || {};
    var data = opt.data || [];
    var fmt = opt.fmt || defFmt;
    var mx = opt.max || Math.max.apply(null, data.map(function (d) { return +d.value || 0; }).concat([1]));
    var html = '<div class="bars">';
    data.forEach(function (d, i) {
      var w = Math.min(100, ((+d.value || 0) / mx) * 100);
      var c = d.color || (opt.palette ? color(i) : accent());
      html += '<div class="bar-row" data-i="' + i + '">' +
        '<span class="br-lb" title="' + esc(d.label) + '">' + esc(d.label) + '</span>' +
        '<span class="br-track"><span class="br-fill" style="width:' + w.toFixed(1) + '%;background:' + c + '"></span>' +
        (d.target ? '<span class="br-target" style="left:' + Math.min(100, (d.target / mx) * 100).toFixed(1) + '%"></span>' : '') +
        '</span>' +
        '<span class="br-v">' + esc(d.text || fmt(d.value)) + '</span></div>';
    });
    html += '</div>';
    el.innerHTML = html;
    if (opt.onClick) {
      el.querySelectorAll('.bar-row').forEach(function (r) {
        r.style.cursor = 'pointer';
        r.addEventListener('click', function () { opt.onClick(+r.getAttribute('data-i'), data[+r.getAttribute('data-i')]); });
      });
    }
  }

  /* ============================================================
   * 状态流转阶梯（HTML，.flow）
   * steps:[{name,value,rate}]
   * ========================================================== */
  function flow(h, opt) {
    var el = host(h); if (!el) return;
    opt = opt || {};
    var steps = opt.steps || [];
    var first = +(steps[0] || {}).value || 1;
    var html = '<div class="flow">';
    steps.forEach(function (s, i) {
      var hot = opt.hot !== undefined ? (i === opt.hot) : false;
      /* rate 可能被调用方传成 null 或 "45%" 这样的字符串，统一强制成数字 */
      var rate = (s.rate === undefined || s.rate === null)
        ? ((+s.value || 0) / first * 100)
        : (parseFloat(s.rate) || 0);
      html += '<div class="flow-step' + (hot ? ' hot' : '') + '" data-k="' + esc(s.key || s.name) + '">' +
        '<div class="fs-n">' + defFmt(s.value) + '</div>' +
        '<div class="fs-l">' + esc(s.name) + '</div>' +
        '<div class="fs-r">' + (i === 0 ? '流入基数' : ('留存 ' + rate.toFixed(0) + '%')) + '</div>' +
        '</div>';
    });
    html += '</div>';
    el.innerHTML = html;
    if (opt.onClick) {
      el.querySelectorAll('.flow-step').forEach(function (n, i) {
        n.style.cursor = 'pointer';
        n.addEventListener('click', function () { opt.onClick(i, steps[i]); });
      });
    }
  }

  /* ============================================================
   * 热力矩阵（HTML，.heat）
   * opt: {rows:[], cols:[], matrix:[[v]], max, fmt, level(v,max)->0..4, onClick(r,c,v)}
   * ========================================================== */
  function heat(h, opt) {
    var el = host(h); if (!el) return;
    opt = opt || {};
    var rows = opt.rows || [], cols = opt.cols || [], m = opt.matrix || [];
    var fmt = opt.fmt || function (v) { return v === null || v === undefined ? '' : String(v); };
    var flat = [];
    m.forEach(function (r) { (r || []).forEach(function (v) { if (v !== null && v !== undefined) flat.push(+v); }); });
    var mx = opt.max || (flat.length ? Math.max.apply(null, flat) : 1);
    var lv = opt.level || function (v) {
      if (v === null || v === undefined || v === '') return 0;
      var p = mx ? v / mx : 0;
      if (p <= 0) return 0;
      if (p < .3) return 1; if (p < .55) return 2; if (p < .8) return 3; return 4;
    };
    var lw = opt.labelW || 84;
    var html = '<div class="heat" style="grid-template-columns:' + lw + 'px repeat(' + cols.length + ',1fr)">';
    html += '<div class="heat-axis"></div>';
    cols.forEach(function (c) { html += '<div class="heat-axis">' + esc(c) + '</div>'; });
    rows.forEach(function (r, ri) {
      html += '<div class="heat-axis" style="justify-content:flex-end;padding-right:6px">' + esc(r) + '</div>';
      cols.forEach(function (c, ci) {
        var v = (m[ri] || [])[ci];
        html += '<div class="heat-cell l' + lv(v, mx) + '" data-r="' + ri + '" data-c="' + ci + '">' + esc(fmt(v, ri, ci)) + '</div>';
      });
    });
    html += '</div>';
    el.innerHTML = html;
    el.querySelectorAll('.heat-cell').forEach(function (n) {
      var ri = +n.getAttribute('data-r'), ci = +n.getAttribute('data-c');
      var v = (m[ri] || [])[ci];
      bindTip(n, function () {
        return '<b>' + esc(rows[ri]) + ' · ' + esc(cols[ci]) + '</b>' + tipRow(accent(), opt.vLabel || '数值', fmt(v, ri, ci) || '—');
      }, opt.onClick ? function () { opt.onClick(ri, ci, v); } : null);
    });
  }

  /* ============================================================
   * 甘特图（HTML+绝对定位，.gantt）
   * opt: {rows:[{id,name,level,type:'bar|mile|grp',start,end,progress,tone,label,sub,dep:[id]}],
   *       start, end, unit:'day|week|month', height, onClick(row), legend:[{name,tone}]}
   * ========================================================== */
  function gantt(h, opt) {
    var el = host(h); if (!el) return;
    opt = opt || {};
    var draw = function () { drawGantt(el, opt); };
    register(el, draw); draw();
  }

  function D(x) { return x instanceof Date ? x : new Date(String(x).replace(/-/g, '/')); }
  function dd(a, b) { return Math.round((D(b) - D(a)) / 86400000); }

  function drawGantt(el, opt) {
    /* 宿主容器通常被写成固定高度（P.chart / chartBox 生成的内联 height:NNNpx）。
       但甘特是 HTML 流式布局、真实高度由行数决定，撑破固定高度后不会被裁剪，
       会直接盖住下面那张卡片。所以这里把固定高度取下来，
       转成 .gantt 自身的滚动上限，容器改为按内容自适应。 */
    var boxH = opt.maxH || opt.height || 0;
    if (!boxH) {
      /* 第一次绘制后 style.height 已被改成 auto，量不到了，先记在 data 上 */
      boxH = +el.getAttribute('data-gh') || parseInt(el.style.height, 10) || 0;
      if (boxH) el.setAttribute('data-gh', boxH);
    }
    if (el.style.height && el.style.height !== 'auto') el.style.height = 'auto';

    var rows = opt.rows || [];
    if (!rows.length) { el.innerHTML = '<div class="empty"><div class="em-t">暂无排期数据</div></div>'; return; }
    var ds = opt.start ? D(opt.start) : null, de = opt.end ? D(opt.end) : null;
    rows.forEach(function (r) {
      if (r.start) { var s = D(r.start); if (!ds || s < ds) ds = s; }
      var e = r.end ? D(r.end) : (r.start ? D(r.start) : null);
      if (e && (!de || e > de)) de = e;
    });
    if (!ds || !de) { el.innerHTML = '<div class="empty"><div class="em-t">暂无排期数据</div></div>'; return; }
    ds = new Date(ds.getFullYear(), ds.getMonth(), ds.getDate() - 3);
    de = new Date(de.getFullYear(), de.getMonth(), de.getDate() + 3);
    var days = Math.max(dd(ds, de), 7);
    var unit = opt.unit || (days > 220 ? 'month' : (days > 70 ? 'week' : 'day'));
    var pxPerDay = unit === 'day' ? 30 : (unit === 'week' ? 7.2 : 3.4);
    var trackW = Math.max(days * pxPerDay, 640);
    var X = function (d) { return (dd(ds, d) / days) * trackW; };
    var rowH = 34;

    var left = '<div class="gantt-left"><div class="gantt-head">任务 / 阶段</div>';
    var right = '<div class="gantt-right" style="width:' + trackW + 'px"><div class="gantt-head" style="width:' + trackW + 'px">';

    /* 表头刻度 */
    var cur = new Date(ds.getFullYear(), ds.getMonth(), ds.getDate());
    var cells = [];
    if (unit === 'month') {
      cur = new Date(ds.getFullYear(), ds.getMonth(), 1);
      while (cur <= de) {
        var nxt = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
        cells.push({ s: new Date(Math.max(cur, ds)), e: nxt, t: (cur.getMonth() + 1) + '月', sub: cur.getFullYear() });
        cur = nxt;
      }
    } else if (unit === 'week') {
      var wd = cur.getDay() === 0 ? 6 : cur.getDay() - 1;
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() - wd);
      while (cur <= de) {
        var n2 = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 7);
        cells.push({ s: cur, e: n2, t: (cur.getMonth() + 1) + '/' + cur.getDate(), sub: '' });
        cur = n2;
      }
    } else {
      while (cur <= de) {
        var n3 = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
        cells.push({ s: cur, e: n3, t: cur.getDate(), sub: ['日', '一', '二', '三', '四', '五', '六'][cur.getDay()] });
        cur = n3;
      }
    }
    cells.forEach(function (c, i) {
      var x = X(c.s), w = X(c.e) - X(c.s);
      right += '<div class="ghead-cell" style="left:' + x.toFixed(1) + 'px;width:' + w.toFixed(1) + 'px">' +
        (c.sub ? '<b>' + esc(c.sub) + '</b>' : '') + esc(c.t) + '</div>';
    });
    right += '</div>';

    /* 网格背景 + 今日线 */
    var grid = '';
    cells.forEach(function (c) { grid += '<div class="gcol" style="left:' + X(c.s).toFixed(1) + 'px"></div>'; });
    var todayD = opt.today ? D(opt.today) : new Date();
    if (todayD >= ds && todayD <= de) grid += '<div class="gtoday" style="left:' + X(todayD).toFixed(1) + 'px"></div>';

    /* 行 */
    var bodyRight = '';
    rows.forEach(function (r, i) {
      var tone = r.tone || 'doing';
      left += '<div class="gantt-row" data-i="' + i + '">' +
        (r.icon ? '<span>' + esc(r.icon) + '</span>' : '') +
        '<span class="gr-name' + (r.level === 2 ? ' lv2' : '') + (r.type === 'grp' ? ' grp' : '') + '" title="' + esc(r.name) + '">' + esc(r.name) + '</span>' +
        (r.right ? '<span class="tiny muted nowrap">' + esc(r.right) + '</span>' : '') + '</div>';

      var inner = '';
      if (r.type === 'mile') {
        var mx2 = X(D(r.start || r.end));
        inner = '<div class="gmile ' + tone + '" style="left:' + (mx2 - 6).toFixed(1) + 'px" data-i="' + i + '"></div>' +
          '<div class="gb-label" style="position:absolute;left:' + (mx2 + 10).toFixed(1) + 'px;top:9px;font-size:11px;color:#64748b;white-space:nowrap">' + esc(r.label || '') + '</div>';
      } else if (r.start && r.end) {
        var x1 = X(D(r.start)), x2 = X(D(r.end));
        var w = Math.max(x2 - x1, 4);
        inner = '<div class="gbar ' + tone + (r.type === 'grp' ? ' grp' : '') + '" data-i="' + i + '" style="left:' + x1.toFixed(1) + 'px;width:' + w.toFixed(1) + 'px">' +
          (r.progress !== undefined && r.type !== 'grp' ? '<div class="gb-fill" style="width:' + (100 - Math.min(100, Math.max(0, r.progress))) + '%;margin-left:' + Math.min(100, Math.max(0, r.progress)) + '%"></div>' : '') +
          (r.label ? '<span class="gb-label">' + esc(r.label) + '</span>' : '') + '</div>';
      }
      bodyRight += '<div class="gantt-row" data-i="' + i + '">' + inner + '</div>';
    });

    left += '</div>';
    right += '<div style="position:relative">' + grid + bodyRight + '</div></div>';

    var lg = '';
    var lgItems = opt.legend || [
      { name: '已完成', tone: 'done' }, { name: '进行中', tone: 'doing' },
      { name: '有延期风险', tone: 'warn' }, { name: '已延期', tone: 'danger' }, { name: '未开始', tone: 'idle' }
    ];
    lg = '<div class="gantt-legend">' + lgItems.map(function (x) {
      return '<span><i style="background:' + (TONE[x.tone] || x.tone) + '"></i>' + esc(x.name) + '</span>';
    }).join('') + '<span><i style="background:#dc2626;width:2px"></i>今日</span></div>';

    el.innerHTML = '<div class="gantt"' + (boxH ? ' style="max-height:' + boxH + 'px"' : '') + '><div class="gantt-inner">' + left + right + '</div></div>' + lg;

    /* 交互 */
    var nodes = el.querySelectorAll('.gbar,.gmile');
    Array.prototype.forEach.call(nodes, function (n) {
      var r = rows[+n.getAttribute('data-i')];
      bindTip(n, function () {
        var s = '<b>' + esc(r.name) + '</b>';
        if (r.start) s += tipRow(TONE[r.tone] || '#2563eb', '开始', String(r.start));
        if (r.end && r.type !== 'mile') s += tipRow('#94a3b8', '结束', String(r.end));
        if (r.progress !== undefined) s += tipRow('#94a3b8', '进度', r.progress + '%');
        if (r.tipExtra) s += r.tipExtra;
        return s;
      }, opt.onClick ? function () { opt.onClick(r); } : null);
    });
    if (opt.onClick) {
      Array.prototype.forEach.call(el.querySelectorAll('.gantt-left .gantt-row'), function (n) {
        n.addEventListener('click', function () { opt.onClick(rows[+n.getAttribute('data-i')]); });
      });
    }
    /* 左右行同步高亮 */
    var lrows = el.querySelectorAll('.gantt-left .gantt-row');
    var rrows = el.querySelectorAll('.gantt-right .gantt-row');
    function sync(i, on) {
      if (lrows[i]) lrows[i].style.background = on ? 'var(--c-bg-2)' : '';
      if (rrows[i]) rrows[i].style.background = on ? 'var(--c-bg-2)' : '';
    }
    Array.prototype.forEach.call(lrows, function (n, i) {
      n.addEventListener('mouseenter', function () { sync(i, true); });
      n.addEventListener('mouseleave', function () { sync(i, false); });
    });
    Array.prototype.forEach.call(rrows, function (n, i) {
      n.addEventListener('mouseenter', function () { sync(i, true); });
      n.addEventListener('mouseleave', function () { sync(i, false); });
    });

    /* 滚动到今日附近 */
    var box = el.querySelector('.gantt');
    if (box && todayD >= ds && todayD <= de) {
      var tx = X(todayD);
      box.scrollLeft = Math.max(0, tx - box.clientWidth * 0.42);
    }
  }

  /* ============================================================
   * 发布时间线（HTML，.rel-line）
   * items:[{id,label,date,tone,sub}]
   * ========================================================== */
  function timeline(h, opt) {
    var el = host(h); if (!el) return;
    opt = opt || {};
    var items = (opt.items || []).slice().sort(function (a, b) { return D(a.date) - D(b.date); });
    if (!items.length) { el.innerHTML = '<div class="empty"><div class="em-t">暂无版本节点</div></div>'; return; }
    var s = D(items[0].date), e = D(items[items.length - 1].date);
    var span = Math.max(dd(s, e), 1);
    var html = '<div class="rel-line"><div class="rel-track" style="min-width:' + Math.max(items.length * 118, 640) + 'px">';
    items.forEach(function (it, i) {
      var p = (dd(s, D(it.date)) / span) * 100;
      html += '<div class="rel-node ' + (it.tone || 'plan') + (i % 2 ? ' alt' : '') + '" style="left:' + p.toFixed(2) + '%" data-i="' + i + '">' +
        '<span class="rn-date">' + esc(it.date) + '</span>' +
        '<span class="rn-dot"></span>' +
        '<span class="rn-lb">' + esc(it.label) + '</span></div>';
    });
    html += '</div></div>';
    el.innerHTML = html;
    Array.prototype.forEach.call(el.querySelectorAll('.rel-node'), function (n) {
      var it = items[+n.getAttribute('data-i')];
      bindTip(n, function () {
        return '<b>' + esc(it.label) + '</b>' + tipRow(TONE[it.tone] || '#64748b', '计划日期', it.date) +
          (it.sub ? tipRow('#94a3b8', '说明', it.sub) : '');
      }, opt.onClick ? function () { opt.onClick(it); } : null);
    });
  }

  /* ============================================================
   * 进度环（小型，返回字符串）
   * ========================================================== */
  function ringSVG(pct, o) {
    o = o || {};
    var size = o.size || 56, sw = o.sw || 6, c = o.color || accent();
    var r = (size - sw) / 2, cx = size / 2;
    var len = 2 * Math.PI * r;
    var p = Math.min(100, Math.max(0, +pct || 0));
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
      '<circle cx="' + cx + '" cy="' + cx + '" r="' + r + '" fill="none" stroke="#eef2f7" stroke-width="' + sw + '"/>' +
      '<circle cx="' + cx + '" cy="' + cx + '" r="' + r + '" fill="none" stroke="' + c + '" stroke-width="' + sw + '" stroke-linecap="round" ' +
      'stroke-dasharray="' + (len * p / 100).toFixed(2) + ' ' + len.toFixed(2) + '" transform="rotate(-90 ' + cx + ' ' + cx + ')"/>' +
      '<text x="' + cx + '" y="' + (cx + 4) + '" text-anchor="middle" font-size="' + (size * .27).toFixed(0) + '" font-weight="700" fill="#0f172a">' + Math.round(p) + '</text>' +
      '</svg>';
  }

  return {
    PAL: PAL, TONE: TONE, fmt: defFmt, niceScale: niceScale, color: color,
    line: line, bar: bar, donut: donut, funnel: funnel, bars: bars, flow: flow,
    heat: heat, gantt: gantt, timeline: timeline,
    sparkSVG: sparkSVG, ringSVG: ringSVG,
    tipShow: tipShow, tipHide: tipHide, tipRow: tipRow, bindTip: bindTip, legend: legend,
    redrawAll: function () { registry.forEach(function (r) { try { r.fn(); } catch (e) { } }); }
  };
})();
