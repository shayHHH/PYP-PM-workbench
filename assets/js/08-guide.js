/* ==========================================================================
   08-guide · 引导层 G
   --------------------------------------------------------------------------
   这一层只干一件事：在你还没有数据的时候，告诉你「这个页面是干什么的、
   现在该点哪里」；有数据之后就自动让路，不再打扰。

   三个出口：
     G.welcome()        首次打开的欢迎弹窗（选模式）
     G.setupCard()      上手清单（首页 + 上手引导页共用）
     G.emptyFor(mod)    每个模块的教学式空态（取代干巴巴的「暂无数据」）
   ========================================================================== */
window.G = (function () {
  'use strict';
  var E = U.esc;

  /* ============================================================
   * 一、模块教学词典
   * 每个模块回答三个问题：这是什么 / 什么时候用 / 第一步做什么
   * ========================================================== */
  var TIP = {
    dashboard: {
      what: '工作台首页。把当前角色最该盯的数字和事项拢到一屏。',
      when: '每天上班第一眼看这里。',
      first: '首页的内容是自动汇总出来的，不用手填——先去把产品线、项目、需求建起来，这里就有东西了。',
      go: 'guide/start', goText: '打开上手引导'
    },
    requirements: {
      what: '需求池。所有「要做什么」的源头都记在这里，从待评审一路流转到已上线。',
      when: '有人提了一个诉求、你决定要做，就在这里开一条。',
      first: '录一条需求：写清标题、归属产品线与项目、业务价值和预估人日。价值与人日会自动进「优先级管理」的四象限。',
      create: 'req.new', createText: '录第一条需求'
    },
    releases: {
      what: '版本管理。把需求打包成一次次发布，管住节奏与上线质量。',
      when: '需求评审完、准备排期时。',
      first: '建一个版本计划，填好四个窗口日期（开发启动 / 需求冻结 / 提测 / 计划上线），然后在需求池里把需求挂到这个版本上。',
      create: 'release.new', createText: '排第一个版本'
    },
    analytics: {
      what: '数据分析。跟踪产品的经营与转化指标，趋势、漏斗、留存。',
      when: '做决策前想看数、或月度复盘时。',
      first: '录一条指标：给它起个名（如「周活跃用户」）、选口径与单位，然后按周把数填进去，趋势图和达标情况会自动算。',
      create: 'metric.new', createText: '录第一条指标'
    },
    collab: {
      what: '项目协同。所有项目的一览、跨部门事项与动态流水。',
      when: '想知道「现在一共有几个项目、各自到哪一步了」。',
      first: '先建一个项目。项目是项目经理视角的口径单位，任务、阶段、交付物都挂在它下面。',
      create: 'project.new', createText: '建第一个项目'
    },
    meetings: {
      what: '会议纪要。议程、结论、以及会上分出去的 Action Item。',
      when: '开完会立刻记，趁热。',
      first: '记一次会议纪要：把决策项和 Action Item 分行写清楚，Action 会自动进「Action Item」跟踪列表并计算逾期。',
      create: 'meeting.new', createText: '记第一次会议'
    },
    risks: {
      what: '风险预警。用红黄绿三色管住「可能出事」和「已经出事」的东西。',
      when: '任何时候你心里觉得「这个可能要黄」。',
      first: '登记一条风险：写清影响、应对措施、责任人和处理时限。高等级风险会自动出现在首页和提醒中心。',
      create: 'risk.new', createText: '登记第一条风险'
    },
    trace: {
      what: '工作留痕。你在这个工作台里的每一次新建与修改，都会自动记一笔。',
      when: '写周报、做复盘、或者需要证明「这事什么时候改的」。',
      first: '不用手填。你在别的模块里建东西、改状态，这里就会自动长出记录。',
      go: 'guide/start', goText: '先去建点东西'
    },
    todos: {
      what: '待办中心。属于你个人的清单，两个角色各有一份，互不干扰。',
      when: '随手记，别指望脑子。',
      first: '加一条待办：写事项、优先级和截止日期即可。',
      create: 'todo.new', createText: '加第一条待办'
    },
    roadmap: {
      what: '产品规划。产品线台账、季度路线图泳道、OKR 目标映射。',
      when: '做季度规划、或需要向上汇报「我们在往哪走」。',
      first: '先建一条产品线——它是最外层的容器，项目 / 需求 / 版本都要挂在它下面。',
      create: 'line.new', createText: '建第一条产品线'
    },
    feedback: {
      what: '用户反馈。把工单、NPS、销售转达的原始声音收进来，聚类后转成需求。',
      when: '收到客户抱怨或表扬的时候。',
      first: '反馈台账目前还没有独立录入表单——可以先把重要反馈直接录成需求，来源选「客户提出」。',
      create: 'req.new', createText: '录成需求（来源选客户提出）'
    },
    team: {
      what: '团队管理。成员名册、负载热力、协同效率。',
      when: '排人、或者发现有人明显忙不过来的时候。',
      first: '把常打交道的人录进成员表。成员表是所有「负责人 / 处理人」下拉框的数据源，先录人，后面填单会快很多。',
      create: 'member.new', createText: '添加成员'
    },
    bizreview: {
      what: '经营复盘。月度 / 季度复盘记录、目标完成率与问题归因。',
      when: '每个月底、每个季度末。',
      first: '发起一次复盘：写清期间、结论、问题与改进项。',
      create: 'review.new', createText: '发起第一次复盘'
    },
    plan: {
      what: '项目计划。阶段划分、里程碑、依赖关系。',
      when: '项目立项之后、开工之前。',
      first: '建项目时勾上「同时创建标准阶段」，五个阶段和对应里程碑会按起止日期自动铺好，之后逐个调整即可。',
      create: 'project.new', createText: '建项目并生成阶段'
    },
    tasks: {
      what: '任务管理。列表与看板两种视图，看板卡片可以直接拖着换状态。',
      when: '阶段拆完之后，把活儿拆到人头上。',
      first: '建一条任务：挂到项目和阶段上，写清负责人、工时与截止日。',
      create: 'task.new', createText: '建第一条任务'
    },
    progress: {
      what: '进度跟踪。甘特图、延期分析、阻塞项。',
      when: '每天早会前扫一眼。',
      first: '这页是算出来的，不用手填。先把项目阶段和任务建起来，甘特图就有内容了。',
      create: 'task.new', createText: '先建任务'
    },
    resources: {
      what: '资源协调。人员安排、工时负载、跨部门协同事项。',
      when: '发现进度推不动，多半是人不够或者人重了。',
      first: '负载来自成员的「周可用工时」与任务工时。先把成员录全、任务派到人。',
      create: 'member.new', createText: '先补齐成员'
    },
    changes: {
      what: '需求变更。变更申请、影响评估、审批流。',
      when: '需求已经定稿又要改的时候——走这里，不要口头改。',
      first: '提一条变更申请：说明原因、影响范围与审批人。',
      create: 'change.new', createText: '提第一条变更'
    },
    delivery: {
      what: '交付管理。交付物清单、验收记录、文档归档。',
      when: '每产出一份文档 / 部署包 / 测试报告就登记一次。',
      first: '登记一个交付物：写清类型、负责人与计划交付日。',
      create: 'delivery.new', createText: '登记第一个交付物'
    },
    reports: {
      what: '周报月报。自动汇总本期的进度、风险与下期计划，可导出 Word。',
      when: '每周五 / 每月末。',
      first: '生成一份周报——它会自动把当前项目的任务完成数、延期数、风险数填进去，你只需要补充亮点与下期计划。',
      create: 'report.new', createText: '生成第一份周报'
    },
    guide: {
      what: '上手与数据。你现在在的地方：上手清单、功能地图、数据备份与导入。',
      when: '不知道下一步做什么、或者想备份 / 迁移数据的时候。',
      first: '', go: '', goText: ''
    }
  };

  function tipOf(mod) { return TIP[mod] || null; }

  /* 模块 → 它主要承载的集合。用来判断「这个模块整体是空的」还是
     「只是当前口径（产品线 / 项目）下没数据」——两种情况该说的话完全不同。 */
  var COUNT_MAP = {
    requirements: 'requirements', releases: 'releases', collab: 'projects',
    meetings: 'meetings', risks: 'risks', trace: 'traces', todos: 'todos',
    roadmap: 'lines', feedback: 'feedbacks', team: 'members', bizreview: 'reviews',
    plan: 'phases', tasks: 'tasks', progress: 'tasks', resources: 'allocs',
    changes: 'changes', delivery: 'deliverables', reports: 'reports',
    analytics: 'metrics'
  };
  function countOf(mod) {
    var k = COUNT_MAP[mod];
    if (!k) return null;
    return (S.DB[k] || []).length;
  }

  function realMemberCount() {
    return (S.DB.members || []).filter(function (m) {
      return m && m.id !== 'M01' && m.id !== 'M_DIRECTOR' && m.id !== 'M_PM';
    }).length;
  }

  /* ============================================================
   * 二、上手清单
   * done 全部由真实数据推导，不需要你手动打钩
   * ========================================================== */
  function steps() {
    var db = S.DB, cnt = DATA.counts(db), flags = DATA.setupFlags();
    var org = S.org();
    var all = [
      {
        k: 'org', title: '填组织抬头和你的名字',
        desc: '组织名会出现在顶栏、Word 导出封面和打印页眉；你的名字会作为默认负责人和留痕操作人。',
        done: !!(org.name && org.name !== '我的组织' && S.me().name),
        act: { type: 'fn', fn: editOrg, text: '去填写' },
        roles: ['director', 'pm']
      },
      {
        k: 'line', title: '建第一条产品线',
        desc: '最外层容器。项目、需求、版本、经营指标都挂在产品线下。',
        done: cnt.lines > 0, cur: cnt.lines,
        act: { type: 'create', k: 'line.new', text: '建产品线' },
        roles: ['director']
      },
      {
        k: 'project', title: '建第一个项目',
        desc: '项目经理视角的口径单位。建的时候顺手勾上「创建标准阶段」。',
        done: cnt.projects > 0, cur: cnt.projects,
        act: { type: 'create', k: 'project.new', text: '建项目' },
        roles: ['director', 'pm']
      },
      {
        k: 'member', title: '把常打交道的人录进成员表',
        desc: '所有「负责人 / 处理人」下拉框都取自这里。录人在前，填单在后。（成员表里默认已经有「你自己」一条）',
        done: realMemberCount() > 0, cur: realMemberCount(),
        act: { type: 'create', k: 'member.new', text: '添加成员' },
        roles: ['director']
      },
      {
        k: 'req', title: '录第一条需求',
        desc: '写清标题、归属、业务价值与预估人日——后两项决定它在四象限里的位置。',
        done: cnt.requirements > 0, cur: cnt.requirements,
        act: { type: 'create', k: 'req.new', text: '录需求' },
        roles: ['director', 'pm']
      },
      {
        k: 'release', title: '排第一个版本',
        desc: '把需求打包成一次发布，填好四个窗口日期，再回需求池把需求挂上去。',
        done: cnt.releases > 0, cur: cnt.releases,
        act: { type: 'create', k: 'release.new', text: '排版本' },
        roles: ['director']
      },
      {
        k: 'task', title: '拆第一批任务',
        desc: '任务派到人、写上工时和截止日，甘特图和负载图才算得出来。',
        done: cnt.tasks > 0, cur: cnt.tasks,
        act: { type: 'create', k: 'task.new', text: '建任务' },
        roles: ['pm']
      },
      {
        k: 'risk', title: '登记一条风险或记一次会议',
        desc: '风险和会议纪要是这个工作台真正省事的地方——高危风险会自动上首页，会上的 Action 会自动进跟踪列表。',
        done: cnt.risks > 0 || cnt.meetings > 0,
        act: { type: 'create', k: 'risk.new', text: '登记风险' },
        roles: ['director', 'pm']
      },
      {
        k: 'backup', title: '导出一份备份',
        desc: '数据只存在这台电脑的浏览器里。清缓存 / 换电脑之前记得导出 JSON。',
        done: !!flags.backup,
        act: { type: 'fn', fn: function () { DATA.exportJSON(); DATA.markStep('backup'); Shell.route(); }, text: '导出备份' },
        roles: ['director', 'pm']
      }
    ];
    var role = S.role();
    return all.filter(function (s) { return s.roles.indexOf(role) >= 0; });
  }

  function progress() {
    var ss = steps();
    var done = ss.filter(function (s) { return s.done; }).length;
    return { done: done, total: ss.length, pct: U.pct(done, ss.length) };
  }

  /* 上手清单卡片。compact=true 时用在首页，只显示未完成的前 4 条 */
  function setupCard(compact) {
    var ss = steps(), pg = progress();
    var show = compact ? ss.filter(function (s) { return !s.done; }).slice(0, 4) : ss;
    var body = '<div class="gd-prog"><div class="gd-prog-bar"><i style="width:' + pg.pct + '%"></i></div>' +
      '<span class="gd-prog-t">' + pg.done + ' / ' + pg.total + ' 步已完成</span></div>' +
      '<div class="gd-steps">' + show.map(function (s, i) {
        var idx = ss.indexOf(s) + 1;
        return '<div class="gd-step' + (s.done ? ' done' : '') + '">' +
          '<div class="gs-n">' + (s.done ? '✓' : idx) + '</div>' +
          '<div class="gs-b"><div class="gs-t">' + E(s.title) +
          (s.cur ? ' <span class="gs-c">已有 ' + s.cur + ' 条</span>' : '') + '</div>' +
          '<div class="gs-d">' + E(s.desc) + '</div></div>' +
          '<div class="gs-a">' + actBtn(s) + '</div></div>';
      }).join('') + '</div>';
    if (compact && !show.length) {
      body = '<div class="gd-prog"><div class="gd-prog-bar"><i style="width:100%"></i></div>' +
        '<span class="gd-prog-t">' + pg.total + ' 步全部完成</span></div>' +
        '<div class="gd-allset">上手清单已走完，这张卡片不再占用首页空间了。' +
        '<a data-go="guide/start">随时回看 →</a></div>';
    }
    return UI.card({
      title: '上手清单', ico: '◎',
      sub: '按顺序走一遍，工作台就跑起来了',
      extra: compact ? '<a class="lnk" data-go="guide/start">全部步骤 →</a>' : '',
      body: body, cls: 'gd-card'
    });
  }

  function actBtn(s) {
    if (s.done) return '<span class="gs-ok">已完成</span>';
    if (s.act.type === 'create') return '<button class="btn-sm btn-primary" data-create="' + E(s.act.k) + '">' + E(s.act.text) + '</button>';
    return '<button class="btn-sm" data-gfn="' + E(s.k) + '">' + E(s.act.text) + '</button>';
  }
  /* setupCard 里 type:'fn' 的按钮需要在渲染后绑定 */
  function bindSetup(root) {
    if (!root) return;
    var map = {};
    steps().forEach(function (s) { if (s.act.type === 'fn') map[s.k] = s.act.fn; });
    root.querySelectorAll('[data-gfn]').forEach(function (b) {
      b.addEventListener('click', function () {
        var f = map[b.getAttribute('data-gfn')];
        if (f) f();
      });
    });
  }

  function editOrg() {
    var o = S.org(), m = S.me();
    UI.formModal({
      title: '组织与我', one: true,
      tip: '组织名影响顶栏、Word 导出封面与打印页眉；你的名字会作为默认负责人、留痕操作人与导出署名。都不影响已有业务数据的内容。',
      okText: '保存',
      fields: [
        { k: 'name', label: '公司 / 组织名称', req: true, val: o.name === '我的组织' ? '' : o.name, placeholder: '填你所在公司或组织的名字' },
        { k: 'bu', label: '事业部 / 团队', val: o.bu, placeholder: '可留空' },
        { k: 'me', label: '你的名字', val: m.name, placeholder: '填你自己的名字，顶栏和导出署名会用它' }
      ],
      onSubmit: function (d) {
        S.setOrg(d.name, d.bu, d.me);
        Shell.paintOrg();
        Shell.paintRole();          // 顶栏头像与姓名跟着改
        UI.toast('已保存', 'ok');
      }
    });
  }

  /* ============================================================
   * 三、教学式空态
   * 取代「当前口径下暂无数据」这种什么也没说的提示
   * ========================================================== */
  function emptyFor(mod, extraMsg) {
    var t = tipOf(mod);
    if (!t) return UI.empty(extraMsg || '暂无数据');
    var act = '';
    if (t.create) act = '<button class="btn-primary" data-create="' + E(t.create) + '">＋ ' + E(t.createText) + '</button>';
    else if (t.go) act = '<button class="btn-primary" data-go="' + E(t.go) + '">' + E(t.goText) + '</button>';
    return '<div class="gd-empty">' +
      '<div class="ge-ico">' + E((C.MOD[mod] || {}).ico || '◎') + '</div>' +
      '<div class="ge-t">' + E((C.MOD[mod] || {}).label || '') + '还是空的</div>' +
      (extraMsg ? '<div class="ge-x">' + E(extraMsg) + '</div>' : '') +
      '<div class="ge-dl">' +
      '<div class="ge-r"><b>这是什么</b><span>' + E(t.what) + '</span></div>' +
      '<div class="ge-r"><b>什么时候用</b><span>' + E(t.when) + '</span></div>' +
      '<div class="ge-r"><b>第一步</b><span>' + E(t.first) + '</span></div>' +
      '</div>' +
      (act ? '<div class="ge-a">' + act + '</div>' : '') +
      '<div class="ge-f">不确定从哪开始？<a data-go="guide/start">看上手清单</a>　·　' +
      '<a data-go="guide/map">看功能地图</a></div>' +
      '</div>';
  }

  /* ============================================================
   * 四、首次打开的欢迎弹窗
   * ========================================================== */
  function welcome() {
    /* 清单是按角色过滤的（总监 8 步 / PM 6 步），所以这段话不能写死步数，
       否则总监会被告知有一步「派任务」，而他的清单里根本没有这一条。 */
    var ss = steps();
    var walk = ss.map(function (s) { return s.title; }).join(' → ');

    UI.modal({
      title: '欢迎使用产品管理工作台', wide: true, maskClose: false,
      body:
        '<div class="gd-wel">' +
        '<p class="gw-lead">这是一套<b>给你自己用的</b>产品与项目管理工作台。' +
        '纯本地运行，不联网、不上传，所有数据只存在这台电脑的浏览器里。' +
        '现在里面<b>一条数据都没有</b>——都由你自己录。</p>' +
        UI.sec('两个角色，一套数据', UI.dl([
          ['产品总监视角', '口径 = 产品线。看规划、版本节奏、经营数据、风险全景。'],
          ['项目经理视角', '口径 = 单个项目。看阶段、任务、甘特、阻塞与交付。'],
          ['怎么切', '右上角一键切换。<b>底层数据完全是同一份</b>，切角色只换看法，不换数据。']
        ])) +
        UI.sec('接下来怎么做', UI.dl([
          ['跟着上手清单走', '你这个角色一共 ' + ss.length + ' 步：' + E(walk) + '。'],
          ['每一步都有入口', '清单上每条右边就是那一步的按钮，点了直接开表单，不用自己找页面。'],
          ['先做哪一步都行', '清单只是建议顺序，完成状态是根据你实际录的数据自动打勾的。']
        ])) +
        UI.notice('warn', '<b>数据存在浏览器本地，请定期导出备份。</b>' +
          '清除浏览器数据、换电脑、换浏览器都会丢。左侧「上手与数据 → 数据管理」里一键导出 JSON，换机器时导回来即可。') +
        '</div>',
      foot: '<button class="btn-primary" data-gowelcome>开始上手</button>',
      /* UI.modal 的 onOpen 收到的是 handle：{el, close, body} */
      onOpen: function (h) {
        h.el.querySelector('[data-gowelcome]').addEventListener('click', function () {
          DATA.markSeen();
          h.close();
          Shell.go('guide', 'start');
        });
      }
    });
  }

  /* 启动钩子：只在第一次打开时弹欢迎 */
  function boot() {
    if (DATA.seen()) return;
    DATA.markSeen();
    setTimeout(welcome, 260);
  }

  return {
    TIP: TIP, tipOf: tipOf, COUNT_MAP: COUNT_MAP, countOf: countOf,
    steps: steps, progress: progress, setupCard: setupCard, bindSetup: bindSetup,
    editOrg: editOrg, emptyFor: emptyFor,
    welcome: welcome, boot: boot
  };
})();
