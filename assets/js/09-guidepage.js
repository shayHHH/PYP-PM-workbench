/* ==========================================================================
   09-guidepage · 「上手与数据」模块页
     start  上手引导（清单 + 怎么用 + 速查）
     map    功能地图（本角色可见的每个模块各干什么、什么时候用）
     data   数据管理（数据存在哪 / 备份 / 导入 / 清空 / 组织与我）
   ========================================================================== */
(function () {
  'use strict';
  var E = U.esc;
  var MOD = 'guide';

  Shell.page(MOD, {
    render: function (ctx) {
      if (ctx.sub === 'map') return renderMap(ctx);
      if (ctx.sub === 'data') return renderData(ctx);
      return renderStart(ctx);
    }
  });

  /* ============================================================
   * 上手引导
   * ========================================================== */
  function renderStart(ctx) {
    var el = ctx.el, ro = S.roleObj();
    el.innerHTML =
      P.head({
        title: '上手引导',
        desc: '不知道下一步做什么的时候，回到这一页。',
        acts: '<button class="btn" data-go="guide/map">功能地图</button>' +
          '<button class="btn" data-go="guide/data">数据管理</button>'
      }) +
      modeBar() +
      G.setupCard(false) + P.gap(4) +
      UI.grid(2,
        UI.card({
          title: '你现在是「' + E(ro.name) + '」视角', ico: ro.ico,
          sub: E(ro.slogan),
          body: UI.dl([
            ['数据口径', S.isDirector()
              ? '按<b>产品线</b>聚合。顶栏可切「全部产品线」或某一条线，所有页面跟着变。'
              : '收敛到<b>单个项目</b>。顶栏切项目，所有页面跟着变。'],
            ['独有模块', S.isDirector()
              ? '产品规划 / 用户反馈 / 团队管理 / 经营复盘'
              : '项目计划 / 任务管理 / 进度跟踪 / 资源协调 / 需求变更 / 交付管理 / 周报月报'],
            ['怎么切换', '右上角角色开关。<b>底层数据是同一份</b>，切角色只换看法与权限，不会复制或丢失任何数据。'],
            ['为什么要两个', '同一条需求，总监关心它的价值与排期，项目经理关心它拆成哪些任务、卡在谁那里。一份数据，两种问法。']
          ])
        }) +
        UI.card({
          title: '常用操作速查', ico: '⌘',
          sub: '记住这几个，用起来会快很多',
          body: UI.dl([
            ['⌘K / Ctrl+K', '全局搜索。需求 / 任务 / 版本 / 会议 / 风险 / 反馈 / 项目 / 交付物，回车直接打开第一条。'],
            ['顶栏 ＋ 新建', '在任何页面都能建东西，不用先跳到对应模块。'],
            ['表格', '点表头排序，勾选后出现批量操作，右下角翻页，右上角导出 CSV / Word。'],
            ['看板', '卡片直接拖到另一列，状态立刻落库。'],
            ['图表', '悬浮看明细，点击可下钻到对应列表。'],
            ['Esc', '关掉抽屉、弹窗和搜索结果。']
          ])
        })
      ) + P.gap(4) +
      UI.card({
        title: '数据存在哪里', ico: '⛁',
        sub: '这一段值得看完',
        body:
          UI.notice('warn',
            '这是一个<b>纯本地</b>工具：没有服务器，不联网，数据只写在<b>这台电脑、这个浏览器</b>的本地存储里。' +
            '换浏览器、换电脑、清理浏览器数据，都会看不到。') +
          '<div style="height:12px"></div>' +
          UI.dl([
            ['会自动保存吗', '会。你每一次新建 / 修改，都立刻写入本地存储，不需要点保存。'],
            ['怎么备份', '「数据管理」页 → 导出 JSON。建议每周导一次，存到网盘或邮件给自己。'],
            ['怎么换电脑', '在旧电脑导出 JSON，在新电脑「数据管理 → 导入」选这个文件。'],
            ['里面有假数据吗', '没有。这个工作台不带任何演示数据，你看到的每一条都是你自己录的。']
          ]),
        foot: '<button class="btn" data-go="guide/data">去数据管理</button>'
      });
    G.bindSetup(el);
  }

  /* 当前数据量条 */
  function modeBar() {
    var c = S.counts();
    var n = DATA.CORE.reduce(function (s, k) { return s + (c[k] || 0); }, 0);
    return '<div class="gd-mode real">' +
      '<div class="gm-l"><span class="gm-dot"></span><b>我的数据</b>' +
      '<span class="gm-s">' +
      (n ? '已录入 ' + n + ' 条核心记录，每次改动自动保存在本地' : '还是一张白纸，跟着下面的清单开始') +
      '</span></div>' +
      '<div class="gm-r"><button class="btn-sm" data-go="guide/data">数据管理</button></div></div>' +
      '<div style="height:var(--sp-4)"></div>';
  }

  /* ============================================================
   * 功能地图
   * ========================================================== */
  function renderMap(ctx) {
    var el = ctx.el, role = S.role();
    var h = P.head({
      title: '功能地图',
      desc: '20 个模块分别在什么场景下用。看不懂哪个就点进去，里面还有一段说明。',
      acts: '<button class="btn" data-go="guide/start">回到上手引导</button>'
    });

    C.navFor(role).forEach(function (g) {
      var cards = g.items.map(function (it) {
        var t = G.tipOf(it.key) || {};
        var cnt = countOf(it.key);
        return '<div class="gd-mapc" data-go="' + E(it.key) + '">' +
          '<div class="gmc-h"><span class="gmc-i">' + E(it.ico) + '</span>' +
          '<span class="gmc-t">' + E(it.label) + '</span>' +
          (cnt === null ? '' : '<span class="gmc-n">' + cnt + '</span>') + '</div>' +
          '<div class="gmc-w">' + E(t.what || '') + '</div>' +
          (t.when ? '<div class="gmc-when">用在：' + E(t.when) + '</div>' : '') +
          '<div class="gmc-subs">' + (it.subs || []).map(function (s) {
            return '<span>' + E(s.label) + '</span>';
          }).join('') + '</div>' +
          '</div>';
      }).join('');
      h += UI.card({
        title: g.group, ico: g.roles ? '◆' : '◇',
        sub: g.roles ? '只有「' + C.ROLES[g.roles[0]].name + '」看得到' : '两个角色都能看到，但口径与默认视图不同',
        body: '<div class="gd-map">' + cards + '</div>'
      }) + P.gap(4);
    });
    el.innerHTML = h;
  }

  /* 模块对应集合的当前条数；算不出来的返回 null（不显示徽标）。字典在 G 里，避免两处各写一份。 */
  function countOf(mod) { return G.countOf(mod); }

  /* ============================================================
   * 数据管理
   * ========================================================== */
  function renderData(ctx) {
    var el = ctx.el;
    var c = S.counts(), org = S.org(), my = S.me();

    var rows = [
      ['产品线', c.lines], ['项目', c.projects], ['成员', c.members],
      ['需求', c.requirements], ['版本', c.releases], ['任务', c.tasks],
      ['阶段 / 里程碑', c.phases + ' / ' + c.milestones], ['风险 / 问题', c.risks + ' / ' + c.issues],
      ['会议 / Action', c.meetings + ' / ' + c.actions], ['交付物', c.deliverables],
      ['变更申请', c.changes], ['复盘 / 周报', c.reviews + ' / ' + c.reports],
      ['待办 / 笔记', c.todos + ' / ' + c.notes], ['工作留痕', c.traces]
    ];

    el.innerHTML =
      P.head({
        title: '数据管理',
        desc: '备份、导入与清空。所有操作只影响这台电脑上的本地数据。',
        acts: '<button class="btn" data-go="guide/start">回到上手引导</button>'
      }) +
      UI.grid(2,
        UI.card({
          title: '数据存在哪里', ico: '⛁',
          sub: '纯本地 · 不联网 · 自动保存',
          body: UI.dl([
            ['位置', '这台电脑、这个浏览器的本地存储（localStorage，键名 <code>pmw.db</code>）。'],
            ['何时保存', '每一次新建 / 修改 / 删除都立刻写入，不需要点保存。'],
            ['会上传吗', '不会。整个工作台没有任何网络请求，断网也能正常用。'],
            ['什么情况会丢', '清理浏览器数据、卸载浏览器、换电脑或换浏览器。<b>所以要导出备份。</b>']
          ])
        }) +
        UI.card({
          title: '组织与我', ico: '▤',
          sub: '顶栏显示、Word 导出封面、打印页眉、默认负责人都用它',
          body: UI.dl([
            ['组织名称', E(org.name || '—')],
            ['事业部 / 团队', E(org.bu || '—')],
            ['你的名字', my.name ? E(my.name) : '<span class="muted">还没填，现在显示为「我」</span>']
          ]) + '<div style="height:12px"></div>' +
            UI.notice('plain', '改名字时，历史数据里以旧名字登记的负责人 / 操作人会一并更新。'),
          foot: '<button class="btn-primary" data-gorg>修改</button>'
        })
      ) + P.gap(4) +
      UI.grid(2,
        UI.card({
          title: '备份与迁移', ico: '⇩',
          sub: '强烈建议定期导出',
          body:
            UI.notice('warn', '数据只存在这个浏览器里。<b>清理浏览器数据 = 数据全没</b>，而且无法找回。' +
              '养成每周导出一次的习惯，文件存到网盘或者邮件发给自己。') +
            '<div style="height:12px"></div>' +
            UI.dl([
              ['导出', '把当前数据打包成一个 JSON 文件下载下来。'],
              ['导入', '选一个之前导出的 JSON 文件，<b>整库替换</b>当前的真实数据（不是合并）。'],
              ['注意', '导入前建议先导出一份当前数据，以防选错文件。']
            ]),
          foot: '<button class="btn-primary" data-gexport>导出 JSON 备份</button>' +
            '<button class="btn" data-gimport>导入 JSON</button>' +
            '<input type="file" accept=".json,application/json" id="gdFile" style="display:none">'
        }) +
        UI.card({
          title: '当前数据量', ico: '☰',
          sub: '以下都是你自己录的',
          body: '<div class="gd-cnt">' + rows.map(function (r) {
            return '<div class="gc-i"><span class="gc-l">' + E(r[0]) + '</span>' +
              '<span class="gc-v' + (String(r[1]) === '0' ? ' zero' : '') + '">' + E(r[1]) + '</span></div>';
          }).join('') + '</div>',
          foot: '<button class="btn-danger" data-gclear>清空我的全部数据</button>'
        })
      );

    /* ---- 绑定 ---- */
    var bo = el.querySelector('[data-gorg]');
    if (bo) bo.addEventListener('click', G.editOrg);

    var bx = el.querySelector('[data-gexport]');
    if (bx) bx.addEventListener('click', function () {
      DATA.exportJSON();
      DATA.markStep('backup');
      UI.toast('备份已导出', 'ok');
    });

    var file = el.querySelector('#gdFile');
    var bi = el.querySelector('[data-gimport]');
    if (bi && file) {
      bi.addEventListener('click', function () { file.value = ''; file.click(); });
      file.addEventListener('change', function () {
        var f = file.files && file.files[0];
        if (!f) return;
        var rd = new FileReader();
        rd.onload = function () {
          UI.confirm(
            '即将用文件「' + E(f.name) + '」<b>整库替换</b>当前的真实数据。<br><br>当前数据会被覆盖且无法撤销。',
            function () {
              var res = DATA.importJSON(String(rd.result));
              if (!res.ok) { UI.toast(res.msg, 'err', 4000); return; }
              UI.toast(res.msg + '，即将刷新', 'ok');
              setTimeout(function () { location.reload(); }, 700);
            },
            { title: '确认导入', okText: '覆盖导入', danger: true }
          );
        };
        rd.onerror = function () { UI.toast('文件读取失败', 'err'); };
        rd.readAsText(f);
      });
    }

    var bc = el.querySelector('[data-gclear]');
    if (bc) bc.addEventListener('click', function () {
      UI.confirm(
        '将清空你在这个工作台里录入的<b>全部数据</b>（产品线、项目、需求、版本、任务、风险、会议……）。',
        function () {
          UI.confirm('再确认一次：这个操作<b>无法撤销</b>。建议先导出一份备份。',
            function () { DATA.clearReal(); location.reload(); },
            { title: '最后确认', okText: '我确定，清空', danger: true });
        },
        { title: '清空全部数据', okText: '继续', danger: true, tip: '现在还可以点「取消」，然后去导出一份备份。' }
      );
    });
  }
})();
