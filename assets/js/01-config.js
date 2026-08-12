/* ==========================================================================
   01-config · 角色、导航、字典、权限
   这个文件是整个系统的"宪法"：谁能看到什么、什么状态叫什么、什么颜色代表什么。
   所有模块只读这里，不自己定义状态串。
   ========================================================================== */
window.C = (function () {
  'use strict';

  /* ============ 组织 ============ */
  /* 这里只是占位默认值。真实的组织名 / 你的名字都存在本地库里，
     由「上手引导 → 组织与我」写入，03-store 启动时会覆盖这两个值。 */
  var ORG = { name: '我的组织', bu: '' };

  /* ============ 角色 ============ */
  var ROLES = {
    director: {
      key: 'director', name: '产品总监', short: '总监', ico: '◈',
      user: { name: '我', title: '产品总监' },
      home: 'dashboard',
      scope: 'line',            // 数据口径：跨产品线
      slogan: '多产品线全局视角 · 规划、节奏、经营与风险',
      /* 首页快捷操作 */
      quick: [
        { k: 'req.new', label: '新建需求', ico: '＋' },
        { k: 'roadmap.new', label: '新增规划项', ico: '◈' },
        { k: 'release.new', label: '版本计划', ico: '⬢' },
        { k: 'meeting.new', label: '会议纪要', ico: '▤' },
        { k: 'risk.new', label: '风险登记', ico: '⚠' },
        { k: 'review.new', label: '发起复盘', ico: '⟳' }
      ]
    },
    pm: {
      key: 'pm', name: '项目经理', short: '项管', ico: '◆',
      user: { name: '我', title: '项目经理' },
      home: 'dashboard',
      scope: 'project',         // 数据口径：单项目
      slogan: '单项目执行视角 · 计划、任务、风险与交付',
      quick: [
        { k: 'task.new', label: '新建任务', ico: '＋' },
        { k: 'meeting.new', label: '会议纪要', ico: '▤' },
        { k: 'risk.new', label: '风险登记', ico: '⚠' },
        { k: 'change.new', label: '变更申请', ico: '⇄' },
        { k: 'delivery.new', label: '登记交付物', ico: '⬓' },
        { k: 'report.new', label: '生成周报', ico: '▦' }
      ]
    }
  };

  /* ============ 导航（公共 + 角色增强）============ */
  /* roles 缺省 = 两个角色都可见 */
  var NAV = [
    {
      group: '公共模块', items: [
        {
          key: 'dashboard', label: '仪表盘', ico: '▣',
          subs: [{ key: 'main', label: '工作台首页' }]
        },
        {
          key: 'requirements', label: '需求管理', ico: '☰',
          subs: [
            { key: 'pool', label: '需求池' },
            { key: 'priority', label: '优先级管理' },
            { key: 'flow', label: '状态流转' },
            { key: 'prd', label: 'PRD 归档' }
          ]
        },
        {
          key: 'releases', label: '版本管理', ico: '⬢',
          subs: [
            { key: 'plan', label: '版本计划' },
            { key: 'timeline', label: '发布时间线' },
            { key: 'compare', label: '版本对比' },
            { key: 'retro', label: '版本复盘' }
          ]
        },
        {
          key: 'analytics', label: '数据分析', ico: '◔',
          subs: [
            { key: 'kpi', label: '核心指标看板' },
            { key: 'trend', label: '趋势分析' },
            { key: 'funnel', label: '漏斗与转化' },
            { key: 'retention', label: '留存分析' }
          ]
        },
        {
          key: 'collab', label: '项目协同', ico: '⇌',
          subs: [
            { key: 'board', label: '协同看板' },
            { key: 'cross', label: '跨部门事项' },
            { key: 'stream', label: '协同动态' }
          ]
        },
        {
          key: 'meetings', label: '会议纪要', ico: '▤',
          subs: [
            { key: 'list', label: '会议列表' },
            { key: 'actions', label: 'Action Item' }
          ]
        },
        {
          key: 'risks', label: '风险预警', ico: '⚠',
          subs: [
            { key: 'ledger', label: '风险台账' },
            { key: 'issues', label: '问题清单' },
            { key: 'trend', label: '趋势统计' }
          ]
        },
        {
          key: 'trace', label: '工作留痕', ico: '◷',
          subs: [
            { key: 'timeline', label: '时间轴' },
            { key: 'stats', label: '类型统计' }
          ]
        },
        {
          key: 'todos', label: '待办中心', ico: '✓',
          subs: [
            { key: 'mine', label: '我的待办' },
            { key: 'notes', label: '个人笔记' }
          ]
        },
        {
          key: 'guide', label: '上手与数据', ico: '◎',
          subs: [
            { key: 'start', label: '上手引导' },
            { key: 'map', label: '功能地图' },
            { key: 'data', label: '数据管理' }
          ]
        }
      ]
    },
    {
      group: '产品总监', roleLabel: '总监', roles: ['director'], items: [
        {
          key: 'exchange', label: '分发与汇报', ico: '⇅',
          subs: [
            { key: 'dispatch', label: '分发项目包' },
            { key: 'inbox', label: '团队汇报' }
          ]
        },
        {
          key: 'roadmap', label: '产品规划', ico: '◈',
          subs: [
            { key: 'lines', label: '产品线管理' },
            { key: 'map', label: '路线图' },
            { key: 'okr', label: '年度/季度规划' },
            { key: 'compare', label: '多产品线对比' }
          ]
        },
        {
          key: 'feedback', label: '用户反馈', ico: '☷',
          subs: [
            { key: 'ledger', label: '反馈台账' },
            { key: 'cluster', label: '问题聚类' },
            { key: 'tags', label: '标签管理' }
          ]
        },
        {
          key: 'team', label: '团队管理', ico: '☗',
          subs: [
            { key: 'members', label: '成员列表' },
            { key: 'load', label: '团队负载' },
            { key: 'efficiency', label: '协同效率' }
          ]
        },
        {
          key: 'bizreview', label: '经营复盘', ico: '⟳',
          subs: [
            { key: 'list', label: '复盘记录' },
            { key: 'goal', label: '目标完成率' },
            { key: 'cause', label: '问题归因' }
          ]
        }
      ]
    },
    {
      group: '项目经理', roleLabel: '项管', roles: ['pm'], items: [
        {
          key: 'myreport', label: '我的汇报', ico: '⇅',
          subs: [{ key: 'mine', label: '导入与周报导出' }]
        },
        {
          key: 'plan', label: '项目计划', ico: '◫',
          subs: [
            { key: 'phases', label: '阶段划分' },
            { key: 'milestones', label: '里程碑' },
            { key: 'deps', label: '依赖关系' }
          ]
        },
        {
          key: 'tasks', label: '任务管理', ico: '☑',
          subs: [
            { key: 'list', label: '任务列表' },
            { key: 'kanban', label: '看板视图' }
          ]
        },
        {
          key: 'progress', label: '进度跟踪', ico: '▤',
          subs: [
            { key: 'gantt', label: '甘特图' },
            { key: 'delay', label: '延期分析' },
            { key: 'blocked', label: '阻塞项' }
          ]
        },
        {
          key: 'resources', label: '资源协调', ico: '☖',
          subs: [
            { key: 'alloc', label: '人员安排' },
            { key: 'load', label: '工时负载' },
            { key: 'cross', label: '跨部门协同' }
          ]
        },
        {
          key: 'changes', label: '需求变更', ico: '⇄',
          subs: [
            { key: 'list', label: '变更申请' },
            { key: 'impact', label: '影响评估' }
          ]
        },
        {
          key: 'delivery', label: '交付管理', ico: '⬓',
          subs: [
            { key: 'items', label: '交付物清单' },
            { key: 'accept', label: '验收记录' },
            { key: 'archive', label: '文档归档' }
          ]
        },
        {
          key: 'reports', label: '周报月报', ico: '▦',
          subs: [
            { key: 'weekly', label: '周报' },
            { key: 'monthly', label: '月报' }
          ]
        }
      ]
    }
  ];

  /* 模块索引：key -> {label, ico, subs, group, roles} */
  var MOD = {};
  NAV.forEach(function (g) {
    g.items.forEach(function (it) {
      MOD[it.key] = Object.assign({}, it, { group: g.group, roles: g.roles || null });
    });
  });

  function navFor(role) {
    return NAV.map(function (g) {
      if (g.roles && g.roles.indexOf(role) < 0) return null;
      return g;
    }).filter(Boolean);
  }
  function canSee(modKey, role) {
    var m = MOD[modKey];
    if (!m) return false;
    return !m.roles || m.roles.indexOf(role) >= 0;
  }

  /* ============ 权限矩阵 ============
     full = 可增删改  |  limited = 受限编辑（部分操作需走审批）
     scoped = 只读且口径收敛  |  none = 不可见
     只有"角色重点不同"的模块才在这里列出差异，其余默认 full。 */
  var PERM = {
    /* 需求：总监定优先级 / 决策；PM 只能提变更，不能直接改优先级 */
    requirements: { director: 'full', pm: 'limited' },
    /* 版本：总监定节奏；PM 看计划、报进度 */
    releases: { director: 'full', pm: 'limited' },
    /* 数据分析：总监全量口径；PM 只看本项目相关口径 */
    analytics: { director: 'full', pm: 'scoped' },
    /* 角色独占 */
    exchange: { director: 'full', pm: 'none' },
    myreport: { director: 'none', pm: 'full' },
    roadmap: { director: 'full', pm: 'none' },
    feedback: { director: 'full', pm: 'none' },
    team: { director: 'full', pm: 'none' },
    bizreview: { director: 'full', pm: 'none' },
    plan: { director: 'none', pm: 'full' },
    tasks: { director: 'none', pm: 'full' },
    progress: { director: 'none', pm: 'full' },
    resources: { director: 'none', pm: 'full' },
    changes: { director: 'none', pm: 'full' },
    delivery: { director: 'none', pm: 'full' },
    reports: { director: 'none', pm: 'full' }
  };
  /* limited 的具体含义，写在这里方便页面直接查 */
  var PERM_NOTE = {
    'requirements.pm': '项目经理可查看与推进需求状态，但调整优先级、关闭 / 驳回需求、指派目标版本均需通过「需求变更」走审批。',
    'requirements.director': '产品总监可直接调整优先级、状态与版本归属。',
    'releases.pm': '项目经理可维护本项目的版本进度、缺陷与阻塞并推进状态；版本类型、归属与四个窗口日期（开发启动 / 需求冻结 / 提测 / 计划上线）由产品总监排期。',
    'analytics.pm': '漏斗与留存已收敛到当前项目关联的版本与需求；核心指标按当前项目所属产品线口径展示，ARR / MAU / 续约率等经营指标仅产品总监可见。'
  };
  function permOf(modKey, role) {
    var p = PERM[modKey];
    if (!p) return 'full';
    return p[role] || 'full';
  }
  function canEdit(modKey, role) {
    var p = permOf(modKey, role);
    return p === 'full' || p === 'limited';
  }

  /* ============ 字段帮助 ============
     给表单字段挂「？」用。任何字段加 help:'键名' 就会在标签后出现问号，
     点开是下面这段内容。写在这里而不是散在各表单里，是为了同一个概念
     （比如价值评分）在需求表单和规划表单里说的是同一套话。 */
  var HELP = {
    valueScore: {
      title: '战略价值怎么打分',
      html:
        '<p class="hp-lead">这个数唯一的用途是<b>被投入除一下去排序</b>：ROI = 价值 × 10 ÷ 人日，' +
        '同时决定它落在「价值-成本四象限」的哪一格（<b>分界线在 5 分</b>）。<br>' +
        '所以要追求的不是"打得准"，是<b>可比、稳定、能拉开差距</b>——绝对值没意义，序才有意义。</p>' +

        '<h4>别问"重不重要"，问"不做会怎样"</h4>' +
        '<p>问重要性，答案永远是重要，所有人都给 8 分，最后全挤在高价值区，' +
        '四象限失效，ROI 排序退化成"谁投入小谁靠前"。</p>' +
        '<p>沿三条线判断，取最高的那条：</p>' +
        '<ol class="hp-ol">' +
        '<li><b>不做的代价</b> —— 丢客户、踩合规，还是只是不够好</li>' +
        '<li><b>可替代性</b> —— 有没有临时方案能顶过去</li>' +
        '<li><b>战略杠杆</b> —— 做完之后后面的事是否变容易（平台能力 vs 一次性功能）</li>' +
        '</ol>' +

        '<h4>锚定表</h4>' +
        '<p class="hp-note">分数要能跨季度、跨产品线比，就得把刻度钉死。</p>' +
        '<table class="hp-tb"><thead><tr><th style="width:52px">分</th><th>判据</th><th style="width:34%">例子</th></tr></thead><tbody>' +
        '<tr><td><b>10</b></td><td>不做业务就开不了张，或触合规红线</td><td>KYC 主体建档、监管要求的留痕</td></tr>' +
        '<tr><td><b>8</b></td><td>直接决定头部客户签约 / 续约</td><td>客户承诺的入金链路能力</td></tr>' +
        '<tr><td><b>5</b></td><td>有明确收益，但能延一个季度，且有临时方案</td><td>对账自动化（现在人工也能对）</td></tr>' +
        '<tr><td><b>3</b></td><td>体验 / 效率改善，没有它业务照常</td><td>列表页加筛选项</td></tr>' +
        '<tr><td><b>1</b></td><td>内部便利，可有可无</td><td>导出格式微调</td></tr>' +
        '</tbody></table>' +
        '<p class="hp-note">5 分是四象限的分界线，所以真正要判断的只有一件事：<b>在不在 5 以上</b>。' +
        '7 还是 8 不值得纠结。</p>' +

        '<h4>三条纪律</h4>' +
        '<ol class="hp-ol">' +
        '<li><b>横向比，别凭空拍。</b>新增时把它和已有的排一排，问"它该排在谁前面"，再反推分数。凭空给分一定通胀。</li>' +
        '<li><b>9-10 分要有配额。</b>一个季度最多 1~2 个 10 分，多了就等于没有。</li>' +
        '<li><b>别和「优先级」重复。</b>优先级回答"先做哪个"，价值回答"值多少"。两者冲突才有信息：' +
        '线上问题常常是 <b>P0 但价值只有 3</b>（不做会炸，但做完也不产生新价值）。' +
        '如果你发现优先级和价值总是同涨同跌，说明其中一个没在起作用。</li>' +
        '</ol>' +
        '<p class="hp-note">同理，别让「规划类型」替你打分——选了"战略必做"就自动给 10，' +
        '这个字段就成了类型的复读机，不提供任何新信息。</p>'
    },
    lineHealth: {
      title: '产品线健康度是怎么来的',
      html:
        '<p class="hp-lead">这个值<b>不是手填的，是算出来的</b>——它只看这条产品线下' +
        '<b>还没闭环的风险</b>（状态不是「已缓解」「已关闭」的那些）。</p>' +
        '<table class="hp-tb"><thead><tr><th style="width:70px">健康度</th><th>触发条件</th></tr></thead><tbody>' +
        '<tr><td><b>高</b></td><td>未闭环风险中，<b>等级为「高」的有 2 条或以上</b></td></tr>' +
        '<tr><td><b>中</b></td><td>未闭环风险<b>合计 3 条或以上</b>（但高危不足 2 条）</td></tr>' +
        '<tr><td><b>低</b></td><td>以上都不满足</td></tr>' +
        '</tbody></table>' +
        '<h4>想让它变绿，去处理风险</h4>' +
        '<p>到「风险预警」把对应风险的状态推到<b>已缓解</b>或<b>已关闭</b>，这里会立刻跟着变。' +
        '反过来说，一条风险都没登记的产品线，健康度<b>必然是「低」</b>——那说明的是' +
        '"没人登记风险"，不一定说明真的健康。</p>' +
        '<p class="hp-note">首页「高危风险线」那张卡统计的也是这个值，口径完全一致。</p>'
    },
    effortScore: {
      title: '预估投入怎么填',
      html:
        '<p class="hp-lead">填<b>人日</b>（一个人干一天 = 1）。它是 ROI 的分母，也是四象限的横轴。</p>' +
        '<ul class="hp-ul">' +
        '<li>填<b>总量</b>，不是工期。3 个人干 10 天 = 30 人日，不是 10。</li>' +
        '<li>包含设计、开发、测试、联调的<b>全部投入</b>，只填开发会让 ROI 系统性虚高。</li>' +
        '<li>拿不准时<b>宁可往大了填</b>。低估投入会把它推进"优先交付"格，挤掉真正该先做的。</li>' +
        '<li>横轴是<b>相对当前最大值</b>缩放的——加一条投入巨大的项，会把其它项整体挤向左边，这是正常的。</li>' +
        '</ul>'
    }
  };
  function help(k) { return HELP[k] || null; }

  /* ============ 字典 · 状态 ============ */
  var DICT = {
    /* 项目状态 */
    projStatus: ['规划中', '进行中', '待发布', '风险中', '已完成', '已暂停'],
    /* 需求状态（状态机顺序即流转顺序）*/
    reqStatus: ['待评审', '已评审', '排期中', '设计中', '开发中', '测试中', '待发布', '已上线', '已驳回', '已关闭'],
    reqType: ['新功能', '体验优化', '技术优化', '缺陷修复', '合规要求', '运营支撑'],
    reqSource: ['客户提出', '销售反馈', '数据洞察', '竞品对标', '内部规划', '合规监管'],
    /* 版本状态 */
    relStatus: ['规划中', '需求冻结', '开发中', '测试中', '待发布', '已发布', '已回滚'],
    relType: ['大版本', '功能版本', '优化版本', '热修复'],
    /* 任务 */
    taskStatus: ['待开始', '进行中', '待评审', '已完成', '已阻塞', '已取消'],
    taskType: ['产品', '设计', '前端', '后端', '测试', '数据', '运维', '文档'],
    /* 风险 */
    riskLevel: ['高', '中', '低'],
    riskStatus: ['待评估', '跟进中', '已缓解', '已关闭', '已升级'],
    riskType: ['进度风险', '资源风险', '需求风险', '技术风险', '外部依赖', '质量风险', '合规风险'],
    /* 问题 */
    issueStatus: ['待处理', '处理中', '待验证', '已解决', '已关闭'],
    /* 变更 */
    changeStatus: ['草稿', '待审批', '评估中', '已批准', '已驳回', '已实施'],
    changeReason: ['客户新增诉求', '业务策略调整', '技术方案变更', '合规要求变化', '前期需求遗漏', '资源不足'],
    /* 交付 */
    deliverStatus: ['未开始', '制作中', '待验收', '验收中', '已验收', '已归档', '验收不通过'],
    deliverType: ['产品文档', '设计稿', '代码交付', '测试报告', '部署包', '运营手册', '培训材料', '数据报表'],
    /* 会议 */
    meetType: ['需求评审', '版本规划', '项目周会', '技术方案', '风险复盘', '跨部门协同', '经营例会', '验收会议'],
    actionStatus: ['待开始', '进行中', '已完成', '已逾期', '已取消'],
    /* 反馈 */
    fbSource: ['客户工单', 'NPS 调研', '销售转达', '应用商店', '社群反馈', '客服记录', '用户访谈'],
    fbStatus: ['待分类', '待评估', '已纳入需求', '暂不处理', '已解决'],
    fbImpact: ['全量用户', '重点客户', '部分用户', '单一客户'],
    /* 优先级 */
    priority: ['P0', 'P1', 'P2', 'P3'],
    /* 部门 */
    dept: ['产品部', '设计部', '研发中心', '测试部', '数据部', '运维部', '市场部', '客户成功部', '法务合规'],
    /* 留痕类型 */
    traceType: ['需求变动', '版本发布', '任务流转', '风险处置', '会议决策', '变更审批', '交付验收', '规划调整'],
    /* 复盘类型 */
    reviewType: ['月度复盘', '季度复盘', '版本复盘', '专项复盘']
  };

  /* ============ 字典 · 色调 ============ */
  var TONE = {
    /* 通用状态 -> tag class 后缀 */
    status: {
      '规划中': 'plan', '进行中': 'doing', '待发布': 'warn', '风险中': 'danger',
      '已完成': 'done', '已暂停': 'idle',
      '待评审': 'plan', '已评审': 'cyan', '排期中': 'plan', '设计中': 'cyan',
      '开发中': 'doing', '测试中': 'warn', '已上线': 'done', '已驳回': 'danger', '已关闭': 'idle',
      '需求冻结': 'plan', '已发布': 'done', '已回滚': 'danger',
      '待开始': 'idle', '已阻塞': 'danger', '已取消': 'idle',
      '待评估': 'plan', '跟进中': 'doing', '已缓解': 'done', '已升级': 'danger',
      '待处理': 'warn', '处理中': 'doing', '待验证': 'cyan', '已解决': 'done',
      '草稿': 'idle', '待审批': 'warn', '评估中': 'doing', '已批准': 'done', '已实施': 'done',
      '未开始': 'idle', '制作中': 'doing', '待验收': 'warn', '验收中': 'doing',
      '已验收': 'done', '已归档': 'idle', '验收不通过': 'danger',
      '已逾期': 'danger',
      '待分类': 'idle', '已纳入需求': 'done', '暂不处理': 'idle'
    },
    level: { '高': 'danger', '中': 'warn', '低': 'done' },
    light: { '高': 'r', '中': 'y', '低': 'g' },
    reqType: {
      '新功能': 'doing', '体验优化': 'cyan', '技术优化': 'plan',
      '缺陷修复': 'danger', '合规要求': 'warn', '运营支撑': 'plain'
    },
    relType: { '大版本': 'plan', '功能版本': 'doing', '优化版本': 'cyan', '热修复': 'danger' },
    taskType: {
      '产品': 'plan', '设计': 'cyan', '前端': 'doing', '后端': 'doing',
      '测试': 'warn', '数据': 'plain', '运维': 'plain', '文档': 'plain'
    },
    traceType: {
      '需求变动': 'doing', '版本发布': 'done', '任务流转': 'plain', '风险处置': 'danger',
      '会议决策': 'plan', '变更审批': 'warn', '交付验收': 'cyan', '规划调整': 'accent'
    }
  };
  function tone(map, v) { return (TONE[map] && TONE[map][v]) || 'plain'; }

  /* 状态是否"终态" */
  var TERMINAL = ['已上线', '已关闭', '已驳回', '已完成', '已取消', '已发布', '已解决', '已归档', '已验收', '已实施', '暂不处理'];
  function isTerminal(s) { return TERMINAL.indexOf(s) >= 0; }
  /* 状态是否"异常" */
  var BAD = ['已阻塞', '风险中', '已回滚', '已驳回', '已逾期', '验收不通过', '已升级'];
  function isBad(s) { return BAD.indexOf(s) >= 0; }

  /* ============ 快捷新建（全局 + 首页共用）============ */
  var CREATE = [
    /* 下面三条是「骨架对象」：空库时必须先有产品线 → 项目 → 成员，
       其它一切（需求 / 版本 / 任务 / 风险）才挂得上去。 */
    { k: 'line.new', label: '产品线', ico: '◈', mod: 'roadmap', roles: ['director'], base: true },
    { k: 'project.new', label: '项目', ico: '◫', mod: 'collab', roles: ['director', 'pm'], base: true },
    { k: 'member.new', label: '成员', ico: '☗', mod: 'team', roles: ['director'], base: true },
    { k: 'req.new', label: '需求', ico: '☰', mod: 'requirements', roles: ['director', 'pm'] },
    { k: 'metric.new', label: '指标数据', ico: '◉', mod: 'analytics', roles: ['director', 'pm'] },
    { k: 'task.new', label: '任务', ico: '☑', mod: 'tasks', roles: ['pm'] },
    { k: 'meeting.new', label: '会议纪要', ico: '▤', mod: 'meetings', roles: ['director', 'pm'] },
    { k: 'risk.new', label: '风险登记', ico: '⚠', mod: 'risks', roles: ['director', 'pm'] },
    { k: 'release.new', label: '版本计划', ico: '⬢', mod: 'releases', roles: ['director'] },
    { k: 'roadmap.new', label: '规划项', ico: '◈', mod: 'roadmap', roles: ['director'] },
    { k: 'review.new', label: '经营复盘', ico: '⟳', mod: 'bizreview', roles: ['director'] },
    { k: 'change.new', label: '变更申请', ico: '⇄', mod: 'changes', roles: ['pm'] },
    { k: 'delivery.new', label: '交付物', ico: '⬓', mod: 'delivery', roles: ['pm'] },
    { k: 'report.new', label: '周报', ico: '▦', mod: 'reports', roles: ['pm'] },
    { k: 'todo.new', label: '待办', ico: '✓', mod: 'todos', roles: ['director', 'pm'] }
  ];
  function createFor(role) {
    return CREATE.filter(function (c) { return c.roles.indexOf(role) >= 0; });
  }

  /* ============ 指标槽位 ============
     数据分析模块围绕固定的 6 个 key 组织看板 / 趋势 / 达标判断，
     所以指标不是任意新建的，而是往这 6 个槽位里填你自己的数。
     下面的名称 / 单位 / 格式只是「建议默认值」，录入时可以全部改掉；
     目标值必须你自己填，这里不预设任何数字。
       fmt: k=千分位缩写(1.2万)  p=百分比  n=普通数字
       lowerBetter: 越小越好（工单量这类） */
  var METRIC_SLOTS = [
    { key: 'arr', name: '年度经常性收入 ARR', unit: '万元', fmt: 'k' },
    { key: 'mau', name: '月活跃用户', unit: '人', fmt: 'k' },
    { key: 'renew', name: '客户续约率', unit: '%', fmt: 'p' },
    { key: 'nps', name: 'NPS 净推荐值', unit: '', fmt: 'n' },
    { key: 'ticket', name: '客户工单量', unit: '件', fmt: 'n', lowerBetter: true },
    { key: 'sla', name: '线上可用性', unit: '%', fmt: 'p' }
  ];
  function slotOf(key) {
    return METRIC_SLOTS.filter(function (s) { return s.key === key; })[0] || null;
  }

  /* ============ 角色默认视图偏好 ============
     切换角色不改数据，只改这里：默认页、默认排序、默认筛选、列可见性。 */
  var VIEW = {
    director: {
      requirements: { sort: 'value', desc: true, cols: ['line', 'value', 'roi'], filter: {}, note: '按业务价值降序，突出高价值需求' },
      releases: { sort: 'planDate', desc: false, cols: ['line', 'scope'], filter: {}, note: '按计划上线日期升序，关注版本节奏' },
      risks: { sort: 'level', desc: false, cols: ['line', 'impact'], filter: { level: '高' }, note: '默认只看高等级风险' },
      meetings: { sort: 'date', desc: true, cols: ['decisions'], filter: { type: '' }, note: '突出决策项' },
      analytics: { dim: 'line', note: '按产品线维度聚合' },
      trace: { filter: { type: '' }, note: '关注规划调整与版本发布' },
      todos: { sort: 'priority', desc: false, note: '按优先级排序' }
    },
    pm: {
      requirements: { sort: 'due', desc: false, cols: ['release', 'owner', 'progress'], filter: {}, note: '按交付时间升序，突出本项目待办' },
      releases: { sort: 'planDate', desc: false, cols: ['progress', 'blocked'], filter: {}, note: '突出进度与阻塞' },
      risks: { sort: 'due', desc: false, cols: ['owner', 'action'], filter: {}, note: '按处理时限排序，全等级可见' },
      meetings: { sort: 'date', desc: true, cols: ['actions'], filter: {}, note: '突出 Action Item' },
      analytics: { dim: 'release', note: '按版本维度聚合' },
      trace: { filter: { type: '' }, note: '关注任务流转与交付验收' },
      todos: { sort: 'due', desc: false, note: '按截止时间排序' }
    }
  };
  function viewOf(role, mod) { return (VIEW[role] && VIEW[role][mod]) || {}; }

  /* ============ 首页区块编排 ============
     仪表盘按这个清单渲染，改顺序就是改首页。 */
  var HOME = {
    director: {
      metrics: ['lines', 'projects', 'pendingReleases', 'criticalRisks', 'reqThroughput', 'onTimeRate'],
      blocks: [
        'lineProgress',    // 各产品线进度对比
        'reqFlow',         // 需求流转效率
        'bizTrend',        // 核心业务指标趋势
        'weekFocus',       // 本周重点事项
        'riskLatest',      // 最新风险
        'decisionLatest'   // 最新决策
      ]
    },
    pm: {
      metrics: ['projProgress', 'milestoneRate', 'openTasks', 'delayTasks', 'projRisks', 'blockers'],
      blocks: [
        'phaseProgress',   // 当前项目阶段进度
        'weekDelivery',    // 本周交付节点
        'todayTodo',       // 今日待办
        'taskBoard',       // 任务概览
        'blockList',       // 阻塞事项
        'actionItems'      // 最近会议 Action Item
      ]
    }
  };

  return {
    ORG: ORG, ROLES: ROLES, NAV: NAV, MOD: MOD, DICT: DICT, TONE: TONE,
    PERM: PERM, PERM_NOTE: PERM_NOTE, CREATE: CREATE, VIEW: VIEW, HOME: HOME,
    HELP: HELP, help: help,
    navFor: navFor, canSee: canSee, permOf: permOf, canEdit: canEdit,
    tone: tone, isTerminal: isTerminal, isBad: isBad,
    createFor: createFor, viewOf: viewOf,
    METRIC_SLOTS: METRIC_SLOTS, slotOf: slotOf
  };
})();
