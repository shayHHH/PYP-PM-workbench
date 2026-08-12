/* ============================================================
 * 06-shell.js  应用外壳
 * 顶栏（组织/作用域/搜索/时钟/角色切换/提醒/新建/用户）
 * 侧栏（按角色渲染导航 + 徽标）、hash 路由、面包屑与返回、全局搜索
 * 页面注册：Shell.page(modKey, {render(ctx)})  ctx = {mod,sub,id,el,nav}
 * ========================================================== */
window.Shell = (function () {
  'use strict';

  var E = U.esc;
  var PAGES = {};
  var CREATE_FN = {};
  var histStack = [];
  var current = { mod: '', sub: '', id: '' };

  /* ---------------- 页面注册 ---------------- */
  function page(key, def) { PAGES[key] = def; }
  function onCreate(key, fn) { CREATE_FN[key] = fn; }

  /* ---------------- 路由 ---------------- */
  function parseHash() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    var p = h.split('/').filter(function (x) { return x !== ''; });
    return { mod: p[0] || '', sub: p[1] || '', id: p.slice(2).join('/') || '' };
  }

  function go(mod, sub, id) {
    var h = '#/' + mod + (sub ? '/' + sub : '') + (id ? '/' + id : '');
    if (location.hash === h) route();
    else location.hash = h;
  }

  function back() {
    if (histStack.length > 1) {
      histStack.pop();
      var prev = histStack.pop();
      go(prev.mod, prev.sub, prev.id);
    } else {
      go(S.roleObj().home, 'main');
    }
  }

  function route() {
    var r = parseHash();
    var role = S.role();

    /* 空路由 → 角色首页。直接渲染，避免新入口页首次进入时等 hashchange 留白。 */
    if (!r.mod) {
      r = { mod: S.roleObj().home, sub: 'main', id: '' };
      if (history && history.replaceState) history.replaceState(null, '', '#/' + r.mod + '/' + r.sub);
    }

    /* 模块存在性与权限校验 */
    var mod = C.MOD[r.mod];
    if (!mod) { renderNotFound(r.mod); return; }
    if (!C.canSee(r.mod, role)) { renderDenied(mod); return; }

    /* 子页面校验 */
    var subs = mod.subs || [];
    if (!r.sub || !subs.some(function (s) { return s.key === r.sub; })) {
      r.sub = subs.length ? subs[0].key : 'main';
    }

    current = r;
    var last = histStack[histStack.length - 1];
    if (!last || last.mod !== r.mod || last.sub !== r.sub || last.id !== r.id) histStack.push(r);
    if (histStack.length > 40) histStack.shift();
    S.state.route = r.mod + '/' + r.sub;

    paintNav();
    paintCrumb(mod, r);

    var el = document.getElementById('content');
    el.innerHTML = '';
    el.scrollTop = 0;

    var def = PAGES[r.mod];
    if (!def || !def.render) {
      el.innerHTML = UI.pageHead({ title: mod.label, desc: '该模块页面尚未加载' }) +
        UI.notice('warn', '模块 <b>' + E(r.mod) + '</b> 的渲染器未注册。');
      return;
    }
    try {
      def.render({ mod: r.mod, sub: r.sub, id: r.id, el: el, nav: mod });
    } catch (err) {
      el.innerHTML = UI.pageHead({ title: mod.label }) +
        UI.notice('danger', '页面渲染出错：' + E(err && err.message ? err.message : String(err)));
      if (window.console) console.error(err);
    }
    document.title = mod.label + (window.PMW_EDITION === 'pm' ? ' · 项目管理工作台' : ' · 产品管理工作台');
  }

  function renderNotFound(k) {
    document.getElementById('content').innerHTML =
      UI.pageHead({ title: '页面不存在' }) +
      UI.empty('未找到模块「' + E(k) + '」，可能链接已失效。',
        '<button class="btn-primary" onclick="Shell.go(\'dashboard\',\'main\')">返回工作台首页</button>', '⚠');
    paintCrumb(null, { mod: k, sub: '', id: '' });
  }

  function renderDenied(mod) {
    var role = S.role();
    var other = role === 'director' ? 'pm' : 'director';
    document.getElementById('content').innerHTML =
      UI.pageHead({ title: mod.label, tag: UI.tag('无权限', 'danger') }) +
      UI.notice('warn', '当前角色<b>「' + E(C.ROLES[role].name) + '」</b>不可访问该模块。' +
        '该模块属于<b>「' + E(C.ROLES[other].name) + '」</b>的角色增强模块。') +
      UI.empty('切换到「' + C.ROLES[other].name + '」视角即可查看本模块。',
        '<button class="btn-primary" data-switch-role="' + other + '">切换为' + C.ROLES[other].name + '视角</button>', '⛔');
    var b = document.querySelector('[data-switch-role]');
    if (b) b.addEventListener('click', function () {
      S.setRole(b.getAttribute('data-switch-role'));
      route();
    });
    paintCrumb(mod, { mod: mod.key, sub: '', id: '' });
  }

  /* ---------------- 侧栏 ---------------- */
  function navBadges() {
    var b = {};
    var role = S.role();
    b.risks = S.risks().filter(function (x) { return x.status !== '已关闭' && (x.level === '高' || x.level === '紧急'); }).length;
    b.todos = S.todos().filter(function (x) { return ['已完成', '已取消'].indexOf(x.status) < 0; }).length;
    b.meetings = S.actions().filter(function (x) { return x.status !== '已完成' && U.daysLeft(x.due) < 0; }).length;
    if (role === 'pm') {
      b.tasks = S.tasks().filter(function (x) { return x.status !== '已完成' && x.overdue; }).length;
      b.changes = S.changes().filter(function (x) { return x.status === '待审批'; }).length;
    } else {
      b.releases = S.rels().filter(function (x) { return x.status === '待发布'; }).length;
      b.feedback = S.feedbacks().filter(function (x) { return x.status === '待处理'; }).length;
    }
    return b;
  }

  function paintNav() {
    var role = S.role();
    var badges = navBadges();
    var h = '';
    C.navFor(role).forEach(function (g) {
      if (!g.items.length) return;
      var isRoleGroup = g.group.indexOf('公共') < 0;
      h += '<div class="nav-group"><div class="nav-group-t' + (isRoleGroup ? ' role-tag' : '') + '"' +
        (isRoleGroup ? ' data-role-label="' + E(C.ROLES[role].short) + '"' : '') + '>' + E(g.group) + '</div>';
      g.items.forEach(function (it) {
        var on = it.key === current.mod;
        var n = badges[it.key];
        var hot = it.key === 'risks' || it.key === 'tasks';
        h += '<div class="nav-item' + (on ? ' on' : '') + '" data-mod="' + E(it.key) + '" title="' + E(it.label) + '">' +
          '<span class="nav-ico">' + it.ico + '</span><span class="nav-label">' + E(it.label) + '</span>' +
          (n ? '<span class="nav-badge ' + (hot ? 'hot' : 'warn') + '">' + n + '</span>' : '') +
          '</div>';
        if (on && it.subs && it.subs.length > 1) {
          h += '<div class="nav-subs">';
          it.subs.forEach(function (s) {
            h += '<div class="nav-sub' + (s.key === current.sub ? ' on' : '') + '" data-mod="' + E(it.key) + '" data-sub="' + E(s.key) + '">' +
              E(s.label) + '</div>';
          });
          h += '</div>';
        }
      });
      h += '</div>';
    });
    var box = document.getElementById('navScroll');
    box.innerHTML = h;
    box.querySelectorAll('[data-mod]').forEach(function (n) {
      n.addEventListener('click', function (e) {
        e.stopPropagation();
        go(n.getAttribute('data-mod'), n.getAttribute('data-sub') || '');
      });
    });
  }

  /* ---------------- 面包屑 ---------------- */
  function paintCrumb(mod, r) {
    var crumbs = document.getElementById('crumbs');
    var right = document.getElementById('crumbRight');
    var backBtn = document.getElementById('crumbBack');
    var role = S.role();
    var parts = [];
    parts.push({ t: C.ROLES[role].name + '视角', k: '' });
    if (S.isDirector()) {
      var L = S.curLine();
      parts.push({ t: L ? L.name : '全部产品线', k: '' });
    } else {
      var P = S.curProject();
      parts.push({ t: P ? P.name : '未选择项目', k: '' });
    }
    if (mod) {
      parts.push({ t: mod.label, k: mod.key });
      var s = (mod.subs || []).filter(function (x) { return x.key === r.sub; })[0];
      if (s && mod.subs.length > 1) parts.push({ t: s.label, k: mod.key + '/' + s.key });
    }
    if (r.id) parts.push({ t: r.id, k: '' });

    crumbs.innerHTML = parts.map(function (p, i) {
      var last = i === parts.length - 1;
      var tag = (p.k && !last) ? 'a' : 'span';
      return (i ? '<span class="sep">/</span>' : '') +
        '<' + tag + (last ? ' class="cur"' : '') + (p.k && !last ? ' data-cb="' + E(p.k) + '"' : '') + '>' +
        E(p.t) + '</' + tag + '>';
    }).join('');
    crumbs.querySelectorAll('[data-cb]').forEach(function (n) {
      n.addEventListener('click', function () {
        var p = n.getAttribute('data-cb').split('/');
        go(p[0], p[1] || '');
      });
    });

    backBtn.classList.toggle('on', histStack.length > 1 || !!r.id);

    /* 右侧：角色专属快捷入口 */
    var acts = '';
    var q = C.ROLES[role].quick.slice(0, 3);
    q.forEach(function (x) {
      acts += '<button class="btn-sm" data-create="' + E(x.k) + '">' + x.ico + ' ' + E(x.label) + '</button>';
    });
    acts += '<span class="vdiv"></span><button class="btn-sm" id="btnPrint" title="打印当前页">⎙ 打印</button>';
    right.innerHTML = acts;
    right.querySelectorAll('[data-create]').forEach(function (b) {
      b.addEventListener('click', function () { create(b.getAttribute('data-create')); });
    });
    var pb = document.getElementById('btnPrint');
    if (pb) pb.addEventListener('click', function () { U.printPage(); });
  }

  /* ---------------- 顶栏：作用域 ---------------- */
  function paintScope() {
    var lineSel = document.getElementById('scopeLine');
    var projSel = document.getElementById('scopeProject');
    var lines = S.DB.lines;

    var lh = S.isDirector() ? '<option value="">全部产品线（' + lines.length + '）</option>' : '';
    lines.forEach(function (l) {
      lh += '<option value="' + l.id + '"' + (l.id === S.state.lineId ? ' selected' : '') + '>' + E(l.name) + '</option>';
    });
    /* 空库时下拉是空的，直接说清楚该去哪儿，别让人对着一个空控件发呆 */
    lineSel.innerHTML = lines.length ? lh : '<option value="">（还没有产品线）</option>';

    var ps = S.projectsInScope();
    var ph = '';
    if (S.isDirector()) ph += '<option value="">全部项目（' + ps.length + '）</option>';
    ps.forEach(function (p) {
      ph += '<option value="' + p.id + '"' + (p.id === S.state.projectId ? ' selected' : '') + '>' + E(p.name) + '</option>';
    });
    projSel.innerHTML = ph || '<option value="">（' + (lines.length ? '该产品线下暂无项目' : '还没有项目') + '）</option>';
    if (S.isPM() && ps.length) projSel.value = S.state.projectId;

    var stt = S.scopeStatus();
    var badge = document.getElementById('scopeStatus');
    badge.className = 'tag tag-lg tag-' + stt.tone;
    badge.textContent = stt.text;

    paintOrg();
  }

  /* ---------------- 顶栏：角色与用户 ---------------- */
  function paintRole() {
    var role = S.role(), ro = C.ROLES[role];
    document.querySelectorAll('#roleSwitch .role-opt').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-role') === role);
    });
    document.getElementById('userName').textContent = ro.user.name;
    document.getElementById('userRole').textContent = ro.name;
    var av = document.getElementById('userAva');
    av.textContent = U.initials(ro.user.name);
    av.className = 'user-avatar ' + U.avaCls(ro.user.name);
  }

  /* ---------------- 顶栏：时钟 ---------------- */
  function tickClock() {
    var now = new Date();
    document.getElementById('clockDate').textContent = U.fmtDate(now, 'MM月DD日 周W');
    /* U.fmtDate 只识别大写 HH，写成 hh 会原样输出「hh:55:30」 */
    document.getElementById('clockTime').textContent = U.fmtDate(now, 'HH:mm:ss');
  }

  /* ---------------- 顶栏：提醒 ---------------- */
  function paintNotice() {
    var role = S.role();
    var list = (S.DB.notices || []).filter(function (n) { return C.canSee(n.mod, role); });
    /* 逾期 Action + 高风险 + 待办到期 汇总 */
    var badge = document.getElementById('noticeBadge');
    badge.textContent = list.length;
    badge.style.display = list.length ? '' : 'none';
    var pop = document.getElementById('popNotice');
    var h = '<div class="pop-t">提醒中心 · ' + list.length + ' 条</div>';
    if (!list.length) h += '<div class="muted tiny" style="padding:10px">暂无提醒</div>';
    list.slice(0, 10).forEach(function (n, i) {
      h += '<button data-notice="' + i + '"><span class="tag tag-' + (n.tone === 'info' ? 'doing' : n.tone) + '" style="flex:0 0 auto">' +
        ({ risk: '风险', action: '待办', release: '版本', change: '变更' }[n.type] || '提醒') + '</span>' +
        '<span class="grow" style="white-space:normal;text-align:left;line-height:1.45">' + E(n.title) + '</span></button>';
    });
    h += '<div class="pop-sep"></div><button data-notice-all>查看全部待办 →</button>';
    pop.innerHTML = h;
    pop.querySelectorAll('[data-notice]').forEach(function (b) {
      b.addEventListener('click', function () {
        pop.classList.remove('on');
        var n = list[+b.getAttribute('data-notice')];
        go(n.mod, '', n.ref);
      });
    });
    pop.querySelector('[data-notice-all]').addEventListener('click', function () {
      pop.classList.remove('on'); go('todos', 'mine');
    });
  }

  /* ---------------- 顶栏：新建菜单 ---------------- */
  function paintCreate() {
    var pop = document.getElementById('popCreate');
    var items = C.createFor(S.role());
    var h = '<div class="pop-t">快速新建</div>';
    items.forEach(function (it) {
      h += '<button data-create="' + E(it.k) + '"><span>' + it.ico + '</span>' + E(it.label) + '</button>';
    });
    pop.innerHTML = h;
    pop.querySelectorAll('[data-create]').forEach(function (b) {
      b.addEventListener('click', function () {
        pop.classList.remove('on');
        create(b.getAttribute('data-create'));
      });
    });
  }

  /* 组织抬头（可在「上手与数据 → 数据管理」里修改） */
  function paintOrg() {
    var n = document.getElementById('orgName'), b = document.getElementById('orgBu');
    if (n) n.textContent = C.ORG.name || '我的组织';
    if (b) { b.textContent = C.ORG.bu || ''; b.style.display = C.ORG.bu ? '' : 'none'; }
  }

  function paintUser() {
    var ro = S.roleObj();
    var pop = document.getElementById('popUser');
    pop.innerHTML =
      '<div class="pop-t">' + E(ro.user.name) + ' · ' + E(ro.user.title) + '</div>' +
      '<button data-u="todos">我的待办</button>' +
      '<button data-u="trace">我的工作留痕</button>' +
      '<div class="pop-sep"></div>' +
      '<div class="pop-t">角色视角</div>' +
      '<button data-u="role-director">' + (S.isDirector() ? '● ' : '○ ') + '产品总监视角</button>' +
      '<button data-u="role-pm">' + (S.isPM() ? '● ' : '○ ') + '项目经理视角</button>' +
      '<div class="pop-sep"></div>' +
      '<div class="pop-t">数据</div>' +
      '<button data-u="guide">上手引导</button>' +
      '<button data-u="data">数据管理 · 备份 / 导入</button>' +
      '<button data-u="backup">立即导出备份</button>' +
      '<div class="pop-sep"></div>' +
      /* 注意：这里只清界面偏好，绝不碰业务数据。清业务数据在「数据管理」页，有两道确认。 */
      '<button data-u="reset">重置界面偏好（不动数据）</button>';
    pop.querySelectorAll('[data-u]').forEach(function (b) {
      b.addEventListener('click', function () {
        pop.classList.remove('on');
        var k = b.getAttribute('data-u');
        if (k === 'todos') go('todos', 'mine');
        else if (k === 'trace') go('trace', 'timeline');
        else if (k === 'guide') go('guide', 'start');
        else if (k === 'data') go('guide', 'data');
        else if (k === 'backup') { DATA.exportJSON(); DATA.markStep('backup'); UI.toast('备份已导出', 'ok'); }
        else if (k === 'role-director') S.setRole('director');
        else if (k === 'role-pm') S.setRole('pm');
        else if (k === 'reset') {
          UI.confirm('将复位角色、产品线 / 项目选择、保存的视图与排序偏好，并刷新页面。<br><br>' +
            '<b>你录入的业务数据不受影响。</b>', function () {
              ['role', 'lineId', 'projectId', 'savedViews', 'prefs', 'mini'].forEach(U.drop);
              location.reload();
            }, { okText: '复位并刷新' });
        }
      });
    });
  }

  /* ---------------- 全局搜索 ---------------- */
  var lastKw = '';
  function doSearch(kw) {
    var pop = document.getElementById('gsPop');
    lastKw = kw;
    if (!kw) { pop.classList.remove('on'); pop.innerHTML = ''; return; }
    var groups = S.search(kw);
    var h = '';
    if (!groups.length) {
      h = '<div class="gs-empty">未找到与「' + E(kw) + '」相关的内容<br><span class="tiny">可搜索：需求 / 任务 / 版本 / 会议 / 风险 / 反馈 / 项目 / 交付物</span></div>';
    } else {
      groups.forEach(function (g) {
        h += '<div class="gs-group"><div class="gs-group-t">' + E(g.group) + '（' + g.items.length + '）</div>';
        g.items.forEach(function (it) {
          h += '<div class="gs-item" data-mod="' + E(it.mod) + '" data-sub="' + E(it.subPage || '') + '" data-id="' + E(it.ref) + '">' +
            '<span class="gs-id">' + E(it.id) + '</span>' +
            '<span class="gs-title">' + U.hl(U.ellip(it.title, 34), kw) + '</span>' +
            '<span class="gs-sub">' + E(it.sub || '') + '</span></div>';
        });
        h += '</div>';
      });
      h += '<div class="gs-foot">共 ' + U.sum(groups, function (g) { return g.items.length; }) + ' 条结果 · 回车打开第一条 · Esc 关闭</div>';
    }
    pop.innerHTML = h;
    pop.classList.add('on');
    pop.querySelectorAll('.gs-item').forEach(function (n) {
      n.addEventListener('click', function () { openHit(n); });
    });
  }

  function openHit(n) {
    document.getElementById('gsPop').classList.remove('on');
    document.getElementById('globalSearch').value = '';
    go(n.getAttribute('data-mod'), n.getAttribute('data-sub'), n.getAttribute('data-id'));
  }

  /* ---------------- 新建入口 ---------------- */
  function create(key) {
    var def = C.CREATE.filter(function (x) { return x.k === key; })[0];
    if (def && !C.canSee(def.mod, S.role())) {
      UI.toast('当前角色无权新建该对象', 'err');
      return;
    }
    if (CREATE_FN[key]) { CREATE_FN[key](); return; }
    /* 尚未注册专用表单时，跳转到对应模块 */
    if (def) { go(def.mod, ''); UI.toast('已进入' + def.label + '模块，可在此新建', 'info'); }
    else UI.toast('未知的新建类型：' + key, 'err');
  }

  /* ---------------- 使用说明 ---------------- */
  function help() {
    var role = S.role();
    UI.modal({
      title: '使用说明 · 产品管理工作台',
      wide: true,
      body:
        UI.notice('info', '这是一套<b>统一后台</b>：产品总监与项目经理共用同一份底层数据，' +
          '切换角色只改变<b>视图口径、默认排序、重点模块与可见权限</b>，不改变数据本身。') +
        '<div style="height:14px"></div>' +
        UI.sec('角色差异', UI.dl([
          ['产品总监', '数据口径 = <b>产品线</b>（可切到全部产品线）；首页为全局驾驶舱，突出规划、版本节奏、经营数据、团队协同与风险概览'],
          ['项目经理', '数据口径 = <b>单项目</b>；首页为项目执行工作台，突出任务进度、甘特图、风险阻塞、资源协调与交付推进'],
          ['增强模块', '总监独有：产品规划 / 用户反馈 / 团队管理 / 经营复盘<br>项管独有：项目计划 / 任务管理 / 进度跟踪 / 资源协调 / 需求变更 / 交付管理 / 周报月报'],
          ['共有模块', '仪表盘 / 需求管理 / 版本管理 / 数据分析 / 项目协同 / 会议纪要 / 风险预警 / 工作留痕 / 待办中心（同一模块两角色看到的<b>口径与默认视图不同</b>）']
        ])) +
        UI.sec('快捷键与交互', UI.dl([
          ['⌘K / Ctrl+K', '聚焦全局搜索（需求 / 任务 / 版本 / 会议 / 风险 / 反馈 / 项目 / 交付物）'],
          ['Esc', '关闭抽屉、弹窗与搜索结果'],
          ['图表', '悬浮查看明细，点击可下钻到对应列表'],
          ['表格', '点击表头排序、支持勾选批量操作、右下角分页、可导出 CSV / Word'],
          ['看板', '卡片可拖拽切换状态列'],
          ['记忆', '角色、产品线、项目选择与保存的视图会写入本地存储，下次打开自动恢复']
        ])) +
        UI.sec('数据说明',
          UI.notice('warn', '这里的每一条数据都是<b>你自己录的</b>，不带任何演示数据。' +
            '纯本地运行，不联网、不上传，每次新增 / 修改都会立刻写入这个浏览器的本地存储。' +
            '<b>请定期在「上手与数据 → 数据管理」里导出 JSON 备份</b>——清理浏览器数据会让它全部消失。')),
      foot: '<button class="btn" data-close data-gohelp>打开上手引导</button>' +
        '<button class="btn-primary" data-close>知道了</button>',
      onOpen: function (h) {
        h.el.querySelector('[data-gohelp]').addEventListener('click', function () { go('guide', 'start'); });
      }
    });
  }

  function safeInit(name, fn) {
    try { fn(); }
    catch (err) {
      if (window.console) console.error('[Shell init] ' + name, err);
    }
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    /* 专版入口锁死角色并隐藏角色切换器。 */
    if (window.PMW_EDITION === 'pm' || window.PMW_EDITION === 'director') {
      var lockedRole = window.PMW_EDITION === 'pm' ? 'pm' : 'director';
      S.setRole(lockedRole);
      /* 用 CSS 藏，不 remove()。下面 bind() 要给 #roleSwitch 绑事件，
         节点摘掉就是 null.addEventListener，整个 init 当场断在这儿。 */
      document.body.setAttribute('data-role', lockedRole);
      document.body.classList.add('edition-' + lockedRole);
      /* 钉死角色。不是安全边界（本地文件，开控制台谁都能改），
         是防意外：这台机器如果先用过总监版，localStorage 里会残留 role='director'，
         或某个模块内部顺手调了 setRole，都会让 PM 看到一堆不归他管的模块。 */
      var _set = S.setRole;
      S.setRole = function () { return _set.call(S, lockedRole); };
    }

    /* 时钟 */
    tickClock();
    setInterval(tickClock, 1000);

    /* 作用域切换 */
    document.getElementById('scopeLine').addEventListener('change', function () {
      S.setLine(this.value);
    });
    document.getElementById('scopeProject').addEventListener('change', function () {
      S.setProject(this.value);
    });

    /* 角色切换 */
    document.getElementById('roleSwitch').addEventListener('click', function (e) {
      var b = e.target.closest('.role-opt');
      if (!b) return;
      var r = b.getAttribute('data-role');
      if (r === S.role()) return;
      S.setRole(r);
      UI.toast('已切换为「' + C.ROLES[r].name + '」视角：' + C.ROLES[r].slogan, 'info', 2600);
    });

    /* 弹出菜单 */
    UI.bindPop(document.getElementById('btnNotice'), document.getElementById('popNotice'));
    UI.bindPop(document.getElementById('btnCreate'), document.getElementById('popCreate'));
    UI.bindPop(document.getElementById('userChip'), document.getElementById('popUser'));

    /* 全局搜索 */
    var gs = document.getElementById('globalSearch');
    var gsPop = document.getElementById('gsPop');
    gs.addEventListener('input', U.debounce(function () { doSearch(gs.value.trim()); }, 140));
    gs.addEventListener('focus', function () { if (gs.value.trim()) doSearch(gs.value.trim()); });
    gs.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { gs.blur(); gsPop.classList.remove('on'); }
      if (e.key === 'Enter') {
        var first = gsPop.querySelector('.gs-item');
        if (first) openHit(first);
      }
    });
    document.getElementById('gsClear').addEventListener('click', function () {
      gs.value = ''; gsPop.classList.remove('on'); gs.focus();
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('#gsearch')) gsPop.classList.remove('on');
    });
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); gs.focus(); gs.select(); }
    });

    /* 侧栏折叠 / 说明 */
    document.getElementById('btnMini').addEventListener('click', function () {
      var app = document.getElementById('app');
      app.classList.toggle('mini');
      U.save('mini', app.classList.contains('mini') ? 1 : 0);
      setTimeout(function () { CH.redrawAll(); }, 220);
    });
    if (U.load('mini')) document.getElementById('app').classList.add('mini');
    document.getElementById('btnHelp').addEventListener('click', help);

    /* 返回 */
    document.getElementById('crumbBack').addEventListener('click', back);

    /* 内容区通用委托：data-go 跳模块、data-create 新建 */
    document.getElementById('content').addEventListener('click', function (e) {
      var g = e.target.closest('[data-go]');
      if (g) {
        var p = g.getAttribute('data-go').split('/');
        go(p[0], p[1] || '', p[2] || '');
        return;
      }
      var c = e.target.closest('[data-create]');
      if (c) { create(c.getAttribute('data-create')); }
    });

    /* 数据 / 角色 / 作用域变化 → 重绘 */
    S.onChange(function (what) {
      paintScope();
      if (what === 'role') {
        paintRole(); paintCreate(); paintUser(); paintNotice();
        /* 角色切换后：若当前模块不可见，回到该角色首页；否则原地刷新 */
        if (current.mod && !C.canSee(current.mod, S.role())) go(S.roleObj().home, 'main');
        else route();
      } else {
        paintNotice();
        route();
      }
    });

    window.addEventListener('hashchange', route);

    safeInit('paintOrg', paintOrg);
    safeInit('paintScope', paintScope);
    safeInit('paintRole', paintRole);
    safeInit('paintCreate', paintCreate);
    safeInit('paintUser', paintUser);
    safeInit('paintNotice', paintNotice);
    route();
  }

  return {
    page: page, onCreate: onCreate, create: create,
    go: go, back: back, route: route, current: function () { return current; },
    paintNav: paintNav, paintScope: paintScope, paintNotice: paintNotice,
    paintOrg: paintOrg, paintRole: paintRole, paintUser: paintUser,
    help: help, init: init, PAGES: PAGES
  };
})();
