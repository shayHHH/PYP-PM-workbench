/* ==========================================================================
   02-seed · 种子数据
   全部用固定种子的伪随机生成，刷新页面数据不变；标题/文案来自人工候选池，
   保证像真实企业数据而不是 lorem ipsum。
   ========================================================================== */
window.SEED = (function () {
  'use strict';
  var R = U.rng(20260809);
  function r() { return R(); }
  function ri(a, b) { return a + Math.floor(r() * (b - a + 1)); }
  function rp(arr) { return arr[Math.floor(r() * arr.length) % arr.length]; }
  /* rp 对空数组返回 undefined，紧接着取 .id 会直接抛错并让整个 SEED 构建失败。
     rpo 仍照常消费一次随机数（保证种子序列稳定），空集时回落到 fb。 */
  function rpo(arr, fb) {
    var x = rp(arr || []);
    return x === undefined ? (fb || {}) : x;
  }
  function rb(p) { return r() < p; }
  function ds(y, m, d) { return U.fmtDate(new Date(y, m - 1, d), 'YYYY-MM-DD'); }
  var TODAY = new Date(2026, 7, 9);
  function off(n) { return U.fmtDate(U.addDay(TODAY, n), 'YYYY-MM-DD'); }
  function offT(n, h, mi) { return U.fmtDate(U.addDay(TODAY, n), 'YYYY-MM-DD') + ' ' + U.pad(h) + ':' + U.pad(mi); }

  /* ============ 产品线 ============ */
  var lines = [
    {
      id: 'L01', name: '智慧供应链云', code: 'SCM Cloud', owner: '李知远', pm: '陈项深',
      stage: '成长期', started: '2024-03', desc: '面向制造与零售企业的供应链协同 SaaS，覆盖计划、采购、库存、履约全链路。',
      goal: '2026 年 ARR 突破 8000 万，头部客户续约率 ≥ 92%',
      budget: 2400, used: 1580, headcount: 34, health: '中'
    },
    {
      id: 'L02', name: '企业协同办公', code: 'TeamSpace', owner: '李知远', pm: '苏亦宁',
      stage: '成熟期', started: '2023-01', desc: '一体化办公协同平台，含文档、审批、会议、IM，是集团内部与外部客户的统一入口。',
      goal: '日活突破 45 万，移动端占比提升至 60%',
      budget: 1800, used: 1210, headcount: 28, health: '低'
    },
    {
      id: 'L03', name: '数据智能平台', code: 'DataMind', owner: '李知远', pm: '周砚',
      stage: '成长期', started: '2024-09', desc: '企业级数据中台，提供实时数仓、指标平台与自助 BI 能力。',
      goal: '接入业务系统 30+，指标复用率 ≥ 70%',
      budget: 2100, used: 1465, headcount: 26, health: '高'
    },
    {
      id: 'L04', name: '客户增长中台', code: 'GrowthHub', owner: '李知远', pm: '何延',
      stage: '探索期', started: '2025-06', desc: '面向 B2B 客户运营的增长中台，含客户旅程编排、触达、会员与积分体系。',
      goal: '完成 3 家标杆客户交付，验证可复制性',
      budget: 1200, used: 760, headcount: 18, health: '中'
    }
  ];

  /* ============ 成员 ============ */
  var MEM = [
    ['M01', '李知远', '产品部', '产品总监', 'director'], ['M02', '陈项深', '产品部', '高级项目经理', 'pm'],
    ['M03', '苏亦宁', '产品部', '项目经理', 'pm'], ['M04', '周砚', '产品部', '项目经理', 'pm'],
    ['M05', '何延', '产品部', '项目经理', 'pm'], ['M06', '林知微', '产品部', '高级产品经理', 'po'],
    ['M07', '许清和', '产品部', '产品经理', 'po'], ['M08', '沈亦白', '产品部', '产品经理', 'po'],
    ['M09', '顾南舟', '设计部', '设计负责人', 'ux'], ['M10', '叶芷', '设计部', '交互设计师', 'ux'],
    ['M11', '陆则', '研发中心', '前端负责人', 'fe'], ['M12', '范一舟', '研发中心', '前端工程师', 'fe'],
    ['M13', '孟星野', '研发中心', '后端架构师', 'be'], ['M14', '邱临', '研发中心', '后端工程师', 'be'],
    ['M15', '韩叙', '研发中心', '后端工程师', 'be'], ['M16', '于潼', '测试部', '测试负责人', 'qa'],
    ['M17', '罗知遇', '测试部', '测试工程师', 'qa'], ['M18', '钟离白', '数据部', '数据分析师', 'da'],
    ['M19', '姜晚', '数据部', '数据工程师', 'de'], ['M20', '方屿', '运维部', 'SRE 工程师', 'ops'],
    ['M21', '莫辞', '市场部', '产品市场经理', 'mkt'], ['M22', '温以宁', '客户成功部', '客户成功经理', 'cs'],
    ['M23', '裴听', '法务合规', '合规专员', 'legal'], ['M24', '简越', '研发中心', '移动端负责人', 'fe']
  ];
  var members = MEM.map(function (m, i) {
    var load = ri(45, 128);
    return {
      id: m[0], name: m[1], dept: m[2], title: m[3], func: m[4],
      loadPct: load, capacity: 40, allocHours: Math.round(40 * load / 100),
      efficiency: +(0.72 + r() * 0.4).toFixed(2),
      taskDone: ri(8, 42), taskOpen: ri(1, 11), taskDelay: rb(.35) ? ri(1, 4) : 0,
      onlineDays: ri(60, 900), email: 'user' + (i + 1) + '@xinghe.com',
      skills: [], projects: []
    };
  });
  var memBy = U.by(members, 'name');
  function who(func) {
    var c = members.filter(function (m) { return m.func === func; });
    return rp(c.length ? c : members).name;
  }

  /* ============ 项目 ============ */
  var PRJ = [
    ['P01', '供应链协同 2.0', 'L01', '进行中', '陈项深', '2026-03-02', '2026-11-20', 0.58,
      '打通上下游供应商协同，交付供应商门户、协同计划与对账三大能力，支撑 2026 年头部客户续约。'],
    ['P02', '智能补货算法升级', 'L01', '风险中', '陈项深', '2026-05-11', '2026-09-30', 0.41,
      '将补货模型从规则引擎升级为机器学习预测，目标缺货率下降 30%，当前受数据回补进度阻塞。'],
    ['P03', 'TeamSpace 移动端重构', 'L02', '进行中', '苏亦宁', '2026-04-06', '2026-10-30', 0.63,
      '基于新框架重构移动端，解决启动慢、离线不可用等历史问题，目标移动端占比提升到 60%。'],
    ['P04', '协同文档协作增强', 'L02', '待发布', '苏亦宁', '2026-02-16', '2026-08-21', 0.92,
      '文档多人实时协作、评论与版本树能力，已进入待发布阶段，等待灰度窗口。'],
    ['P05', 'DataMind 实时数仓', 'L03', '进行中', '周砚', '2026-01-12', '2026-12-18', 0.47,
      '构建流批一体实时数仓，替换现有 T+1 链路，支撑实时指标与实时风控场景。'],
    ['P06', '指标平台自助分析', 'L03', '规划中', '周砚', '2026-09-01', '2027-02-27', 0.06,
      '面向业务方的自助取数与看板搭建能力，目前处于方案评审阶段。'],
    ['P07', 'GrowthHub 旅程编排', 'L04', '进行中', '何延', '2026-03-23', '2026-11-06', 0.52,
      '客户旅程可视化编排与自动化触达，首批 3 家标杆客户共创中。'],
    ['P08', '会员积分体系重构', 'L04', '已完成', '何延', '2025-11-03', '2026-06-26', 1.0,
      '积分规则引擎与账户体系重构，已于 6 月完成全量上线并通过验收。']
  ];
  var projects = PRJ.map(function (p) {
    var line = lines.filter(function (l) { return l.id === p[2]; })[0];
    return {
      id: p[0], name: p[1], lineId: p[2], lineName: line.name, status: p[3],
      pm: p[4], start: p[5], end: p[6], progress: p[7], desc: p[8],
      sponsor: '李知远', budget: ri(180, 620), used: 0, members: ri(7, 16),
      health: p[3] === '风险中' ? '高' : (p[3] === '待发布' ? '中' : rp(['低', '中', '中'])),
      customer: rp(['华瑞制造', '中远物流', '普林零售', '锦江商贸', '恒信集团'])
    };
  });
  projects.forEach(function (p) { p.used = Math.round(p.budget * (p.progress * 0.9 + r() * 0.15)); });
  var projBy = U.by(projects, 'id');

  /* ============ 版本 ============ */
  var REL = [
    ['R01', 'V2.4.0 供应商门户', 'L01', 'P01', '功能版本', '已发布', '2026-05-08', '2026-05-22'],
    ['R02', 'V2.5.0 协同计划', 'L01', 'P01', '功能版本', '已发布', '2026-07-03', '2026-07-10'],
    ['R03', 'V2.6.0 在线对账', 'L01', 'P01', '测试中', '2026-08-21', ''],
    ['R04', 'V2.7.0 供应商评分', 'L01', 'P01', '规划中', '2026-10-16', ''],
    ['R05', 'V1.2.0 补货模型 Beta', 'L01', 'P02', '功能版本', '开发中', '2026-09-11', ''],
    ['R06', 'V3.0.0 移动端重构', 'L02', 'P03', '大版本', '测试中', '2026-08-28', ''],
    ['R07', 'V3.0.1 移动端体验优化', 'L02', 'P03', '优化版本', '规划中', '2026-10-09', ''],
    ['R08', 'V2.9.3 文档协作增强', 'L02', 'P04', '功能版本', '待发布', '2026-08-14', ''],
    ['R09', 'V2.9.2 文档评论修复', 'L02', 'P04', '热修复', '已发布', '2026-06-19', '2026-06-19'],
    ['R10', 'V1.5.0 实时数仓一期', 'L03', 'P05', '大版本', '已发布', '2026-06-05', '2026-06-12'],
    ['R11', 'V1.6.0 实时指标服务', 'L03', 'P05', '功能版本', '开发中', '2026-09-25', ''],
    ['R12', 'V1.7.0 流批一体调度', 'L03', 'P05', '规划中', '2026-11-27', ''],
    ['R13', 'V0.9.0 旅程编排 Beta', 'L04', 'P07', '功能版本', '需求冻结', '2026-08-30', ''],
    ['R14', 'V1.0.0 旅程编排 GA', 'L04', 'P07', '大版本', '规划中', '2026-11-06', ''],
    ['R15', 'V2.0.0 积分体系重构', 'L04', 'P08', '大版本', '已发布', '2026-06-26', '2026-06-26'],
    ['R16', 'V2.3.5 供应链热修复', 'L01', 'P01', '热修复', '已回滚', '2026-04-17', '2026-04-17']
  ];
  var releases = REL.map(function (v) {
    var type, status, plan, real;
    if (v.length === 8) { type = v[4]; status = v[5]; plan = v[6]; real = v[7]; }
    else { type = v[4] === '测试中' || v[4] === '开发中' || v[4] === '规划中' || v[4] === '待发布' || v[4] === '需求冻结' ? '功能版本' : v[4]; status = v[4]; plan = v[5]; real = v[6] || ''; }
    // 修正解析：统一按索引取
    type = v[4]; status = v[5]; plan = v[6]; real = v[7] || '';
    if (['规划中', '需求冻结', '开发中', '测试中', '待发布', '已发布', '已回滚'].indexOf(type) >= 0) {
      // 少一列的情况：type 位置其实是 status
      status = type; plan = v[5]; real = v[6] || '';
      type = status === '热修复' ? '热修复' : '功能版本';
    }
    var p = projBy[v[3]];
    var prog = status === '已发布' ? 1 : (status === '待发布' ? .96 : (status === '测试中' ? .82
      : (status === '开发中' ? ri(35, 68) / 100 : (status === '需求冻结' ? .18 : (status === '已回滚' ? 1 : ri(3, 12) / 100)))));
    return {
      id: v[0], name: v[1], lineId: v[2], lineName: lines.filter(function (l) { return l.id === v[2]; })[0].name,
      projectId: v[3], projectName: p ? p.name : '', type: type, status: status,
      freezeDate: U.fmtDate(U.addDay(plan, -21)), devStart: U.fmtDate(U.addDay(plan, -45)),
      testDate: U.fmtDate(U.addDay(plan, -12)), planDate: plan, realDate: real,
      owner: p ? p.pm : '陈项深', po: rp(['林知微', '许清和', '沈亦白']),
      progress: +prog.toFixed(2), reqCount: 0, bugCount: ri(2, 26), blockCount: rb(.3) ? ri(1, 3) : 0,
      delayDays: real ? U.dayDiff(plan, real) : 0,
      risk: status === '已回滚' ? '高' : rp(['低', '低', '中', '高']),
      scope: '', note: ''
    };
  });
  // 手工修正 R03/R05/R06/R08/R11/R13 的类型与状态（上面通用解析容易走偏）
  var fix = {
    R03: ['功能版本', '测试中'], R05: ['功能版本', '开发中'], R06: ['大版本', '测试中'],
    R07: ['优化版本', '规划中'], R08: ['功能版本', '待发布'], R11: ['功能版本', '开发中'],
    R12: ['功能版本', '规划中'], R13: ['功能版本', '需求冻结'], R14: ['大版本', '规划中'],
    R04: ['功能版本', '规划中'], R16: ['热修复', '已回滚'], R01: ['功能版本', '已发布'],
    R02: ['功能版本', '已发布'], R09: ['热修复', '已发布'], R10: ['大版本', '已发布'], R15: ['大版本', '已发布']
  };
  releases.forEach(function (x) { if (fix[x.id]) { x.type = fix[x.id][0]; x.status = fix[x.id][1]; } });
  releases.forEach(function (x) {
    x.scope = { R01: '供应商注册、资质审核、协同看板', R02: '协同计划发布、滚动预测、异常提醒', R03: '对账单生成、争议处理、账期管理', R04: '评分模型、评分卡、供应商分级', R05: '补货预测模型 Beta、模型监控面板', R06: '全量页面重构、离线包、启动优化', R07: '手势交互、深色模式、性能调优', R08: '实时协作、评论 @、版本树', R09: '评论丢失缺陷修复', R10: '实时接入层、Kafka 链路、实时明细层', R11: '实时指标定义、指标服务 API', R12: '流批一体调度、血缘追踪', R13: '旅程画布、节点编排、触达通道', R14: '旅程模板市场、效果归因', R15: '积分账户、规则引擎、对账', R16: '库存同步补丁（已回滚）' }[x.id] || '';
  });
  var relBy = U.by(releases, 'id');

  /* ============ 需求 ============ */
  var REQ_T = {
    L01: ['供应商在线注册与资质自助上传', '协同计划滚动预测发布', '采购订单变更协同确认', '在线对账单自动生成', '对账争议在线处理流程',
      '供应商绩效评分卡', '库存周转看板', '寻源比价流程线上化', '供应商分级管理', '到货预约与月台调度',
      '异常订单预警推送', '供应链协同移动端消息', '批量导入历史采购数据', '多币种结算支持', '供应商资质到期提醒'],
    L02: ['移动端启动性能优化', '文档多人实时协作', '文档评论与 @ 提醒', '文档版本树与回滚', '离线草稿自动同步',
      '审批流可视化配置', '会议室智能推荐', 'IM 消息已读回执', '深色模式适配', '移动端手势快捷操作',
      '工作台自定义卡片', '外部协作者受控访问', '大文件分片上传', '全文检索能力升级', '组织架构同步优化'],
    L03: ['实时接入层多源适配', '实时明细层建模规范', '指标口径统一管理', '指标服务 API 网关', '数据血缘可视化',
      '流批一体调度引擎', '自助取数拖拽建模', '看板搭建器', '数据质量监控告警', '慢查询自动诊断',
      '权限行列级管控', '离线任务重跑编排', '实时大屏组件库', '指标异动归因分析', '数据资产地图'],
    L04: ['客户旅程画布编排', '触达通道统一接入', '旅程节点条件分支', '人群圈选与预估', '触达频次疲劳控制',
      '旅程效果归因分析', '积分规则引擎重构', '积分账户与对账', '会员等级权益配置', '旅程模板市场',
      '实时事件触发器', 'A/B 实验能力', '客户标签体系打通', '触达内容素材库', '旅程审批与灰度']
  };
  var requirements = [];
  var rqi = 0;
  Object.keys(REQ_T).forEach(function (lid) {
    REQ_T[lid].forEach(function (title, idx) {
      rqi++;
      var line = lines.filter(function (l) { return l.id === lid; })[0];
      var prjs = projects.filter(function (p) { return p.lineId === lid; });
      var prj = rp(prjs);
      var rels = releases.filter(function (x) { return x.lineId === lid; });
      var rel = rb(.82) ? rp(rels) : null;
      var st;
      if (rel && rel.status === '已发布') st = rb(.88) ? '已上线' : '已关闭';
      else if (rel && rel.status === '测试中') st = rp(['测试中', '测试中', '开发中']);
      else if (rel && rel.status === '待发布') st = '待发布';
      else if (rel && rel.status === '开发中') st = rp(['开发中', '开发中', '设计中']);
      else if (rel && rel.status === '需求冻结') st = rp(['排期中', '已评审']);
      else st = rp(['待评审', '待评审', '已评审', '排期中', '已驳回']);
      var created = off(-ri(20, 210));
      var pri = rp(['P0', 'P1', 'P1', 'P2', 'P2', 'P2', 'P3']);
      var prog = { '待评审': 0, '已评审': .08, '排期中': .15, '设计中': .32, '开发中': ri(40, 75) / 100, '测试中': ri(80, 92) / 100, '待发布': .96, '已上线': 1, '已驳回': 0, '已关闭': 0 }[st];
      requirements.push({
        id: 'REQ-' + U.pad(rqi) + (rqi < 10 ? '' : ''),
        title: title, lineId: lid, lineName: line.name,
        projectId: prj.id, projectName: prj.name,
        releaseId: rel ? rel.id : '', releaseName: rel ? rel.name : '',
        type: rp(C.DICT.reqType), source: rp(C.DICT.reqSource), status: st, priority: pri,
        value: ri(3, 10), effort: ri(3, 45), roi: 0,
        owner: rp(['林知微', '许清和', '沈亦白']), proposer: rp(['温以宁', '莫辞', '李知远', '客户·华瑞制造', '销售·东区']),
        createAt: created, reviewAt: st === '待评审' ? '' : off(-ri(5, 190)),
        onlineAt: st === '已上线' && rel ? rel.realDate : '',
        due: rel ? rel.planDate : off(ri(20, 120)),
        progress: +(prog || 0).toFixed(2),
        prdVer: st === '待评审' ? '' : 'V' + ri(1, 3) + '.' + ri(0, 4),
        prdArchived: ['已上线', '待发布', '测试中', '已关闭'].indexOf(st) >= 0,
        changeCount: rb(.28) ? ri(1, 3) : 0,
        tags: [rp(['核心', '客户承诺', '合规', '体验', '性能', '技术债'])],
        desc: '围绕「' + title + '」，覆盖端到端流程与异常场景，需同步更新对应 PRD 与验收标准。',
        acceptance: [
          '主流程可在 3 步内完成，成功率 ≥ 99%',
          '异常场景有明确提示与兜底路径',
          '关键操作留痕，可按操作人与时间检索'
        ],
        cycleDays: ri(9, 62)
      });
    });
  });
  requirements.forEach(function (q) { q.roi = +(q.value * 10 / Math.max(q.effort, 1)).toFixed(1); });
  releases.forEach(function (rel) {
    rel.reqCount = requirements.filter(function (q) { return q.releaseId === rel.id; }).length;
  });

  /* ============ 阶段 / 里程碑 ============ */
  var PHASE_TPL = ['需求调研', '方案设计', '开发实现', '联调测试', '灰度验证', '上线交付'];
  var phases = [], milestones = [];
  projects.forEach(function (p) {
    var total = U.dayDiff(p.start, p.end);
    var w = [0.14, 0.16, 0.34, 0.18, 0.09, 0.09], acc = 0;
    PHASE_TPL.forEach(function (nm, i) {
      var s = U.addDay(p.start, Math.round(total * acc));
      acc += w[i];
      var e = U.addDay(p.start, Math.round(total * acc) - 1);
      var st, pr;
      var passed = U.dayDiff(e, TODAY) >= 0, started = U.dayDiff(s, TODAY) >= 0;
      if (p.status === '已完成') { st = '已完成'; pr = 1; }
      else if (passed) { st = rb(.86) ? '已完成' : '进行中'; pr = st === '已完成' ? 1 : ri(72, 94) / 100; }
      else if (started) { st = '进行中'; pr = ri(28, 78) / 100; }
      else { st = '待开始'; pr = 0; }
      if (p.status === '风险中' && st === '进行中') pr = ri(18, 44) / 100;
      phases.push({
        id: p.id + '-PH' + (i + 1), projectId: p.id, projectName: p.name, name: nm, order: i + 1,
        start: U.fmtDate(s), end: U.fmtDate(e), status: st, progress: +pr.toFixed(2),
        owner: i < 2 ? rp(['林知微', '许清和']) : (i === 2 ? rp(['孟星野', '陆则']) : (i === 3 ? '于潼' : p.pm)),
        goal: {
          '需求调研': '完成业务调研与需求清单，输出需求规格说明',
          '方案设计': '完成产品方案、交互稿与技术方案评审',
          '开发实现': '完成全部功能开发并自测通过',
          '联调测试': '完成系统联调、回归与性能测试',
          '灰度验证': '完成灰度放量与线上指标验证',
          '上线交付': '完成全量发布、文档归档与客户验收'
        }[nm],
        deps: i === 0 ? [] : [p.id + '-PH' + i],
        taskCount: 0
      });
      milestones.push({
        id: p.id + '-MS' + (i + 1), projectId: p.id, projectName: p.name, phaseId: p.id + '-PH' + (i + 1),
        name: nm + '完成', date: U.fmtDate(e), owner: p.pm,
        status: st === '已完成' ? (rb(.14) ? '已延期完成' : '已完成') : (passed ? '已延期' : (started ? '进行中' : '未开始')),
        criteria: '产出物通过评审并归档，无 P0/P1 遗留',
        deliverables: ri(2, 5)
      });
    });
  });
  var phaseBy = U.by(phases, 'id');

  /* ============ 任务 ============ */
  var TASK_T = {
    '需求调研': ['业务流程调研', '竞品功能拆解', '客户访谈纪要整理', '需求清单评审', '价值与优先级评估'],
    '方案设计': ['产品方案撰写', '交互原型设计', '视觉稿输出', '技术方案评审', '接口协议定义', '数据库模型设计'],
    '开发实现': ['前端页面开发', '后端接口开发', '权限体系改造', '定时任务实现', '第三方对接联调', '埋点方案落地', '性能优化改造', '历史数据迁移脚本'],
    '联调测试': ['接口联调', '功能用例执行', '回归测试', '性能压测', '兼容性测试', '缺陷修复'],
    '灰度验证': ['灰度方案制定', '灰度放量执行', '线上指标监控', '灰度问题处置'],
    '上线交付': ['发布计划确认', '生产环境发布', '交付文档归档', '客户培训与验收']
  };
  var tasks = [], tid = 0;
  phases.forEach(function (ph) {
    var n = ph.name === '开发实现' ? ri(5, 8) : ri(3, 5);
    var pool = TASK_T[ph.name];
    for (var i = 0; i < n; i++) {
      tid++;
      var st, pr;
      if (ph.status === '已完成') { st = rb(.94) ? '已完成' : '已取消'; }
      else if (ph.status === '进行中') { st = rp(['已完成', '进行中', '进行中', '待开始', '待评审', '已阻塞']); }
      else { st = '待开始'; }
      pr = st === '已完成' ? 1 : (st === '待评审' ? .9 : (st === '进行中' ? ri(20, 80) / 100 : (st === '已阻塞' ? ri(25, 60) / 100 : 0)));
      var s = U.addDay(ph.start, ri(0, Math.max(1, U.dayDiff(ph.start, ph.end) - 4)));
      var dur = ri(2, 12);
      var due = U.addDay(s, dur);
      var overdue = st !== '已完成' && st !== '已取消' && U.dayDiff(due, TODAY) > 0;
      var fn = pool[i % pool.length];
      var type = /前端|页面|交互|视觉/.test(fn) ? (/交互|视觉/.test(fn) ? '设计' : '前端')
        : (/接口|后端|数据库|脚本|定时|权限|性能/.test(fn) ? '后端'
          : (/测试|用例|回归|压测|兼容|缺陷/.test(fn) ? '测试'
            : (/埋点|指标|数据/.test(fn) ? '数据' : (/发布|环境/.test(fn) ? '运维' : (/文档|培训/.test(fn) ? '文档' : '产品')))));
      var ownerFunc = { '前端': 'fe', '后端': 'be', '测试': 'qa', '设计': 'ux', '数据': 'da', '运维': 'ops', '文档': 'po', '产品': 'po' }[type];
      tasks.push({
        id: 'T' + U.pad(tid) + (tid < 100 ? '' : ''),
        title: fn + ' · ' + ph.projectName.slice(0, 6),
        projectId: ph.projectId, projectName: ph.projectName, phaseId: ph.id, phaseName: ph.name,
        type: type, status: overdue && st !== '已阻塞' ? st : st,
        priority: rp(['P0', 'P1', 'P1', 'P2', 'P2', 'P3']),
        owner: who(ownerFunc), dept: { '前端': '研发中心', '后端': '研发中心', '测试': '测试部', '设计': '设计部', '数据': '数据部', '运维': '运维部', '文档': '产品部', '产品': '产品部' }[type],
        start: U.fmtDate(s), due: U.fmtDate(due),
        doneAt: st === '已完成' ? U.fmtDate(U.addDay(due, ri(-3, 4))) : '',
        estHours: dur * 6, realHours: st === '已完成' ? dur * 6 + ri(-8, 20) : Math.round(dur * 6 * pr),
        progress: +pr.toFixed(2),
        overdue: overdue, delayDays: overdue ? U.dayDiff(due, TODAY) : 0,
        blockReason: st === '已阻塞' ? rp(['依赖上游接口未就绪', '等待客户确认方案', '测试环境不可用', '关键人力被抽调', '第三方资质审批未通过']) : '',
        deps: [], reqId: '', tags: [],
        comments: [], attachCount: rb(.4) ? ri(1, 4) : 0
      });
    }
    ph.taskCount = tasks.filter(function (t) { return t.phaseId === ph.id; }).length;
  });
  // 任务关联需求
  tasks.forEach(function (t) {
    var cand = requirements.filter(function (q) { return q.projectId === t.projectId; });
    if (cand.length && rb(.62)) { var q = rp(cand); t.reqId = q.id; t.reqTitle = q.title; }
  });
  // 任务评论
  var CMT = ['接口字段已同步给前端，见附件。', '这里和上游确认过，按方案 B 执行。', '今天完成 60%，明天可以提测。',
    '阻塞已升级给研发负责人，预计明天解除。', '测试环境数据已补齐，可以开始验证。', '与客户确认后调整了默认值。'];
  tasks.forEach(function (t) {
    var n = rb(.45) ? ri(1, 3) : 0;
    for (var i = 0; i < n; i++) {
      t.comments.push({ by: rp(members).name, at: offT(-ri(1, 30), ri(9, 19), rp([0, 15, 30, 45])), text: rp(CMT) });
    }
  });

  /* ============ 风险 ============ */
  var RISK_T = [
    ['补货模型训练数据回补延期，影响算法上线', '进度风险', '高', 'P02'],
    ['核心后端工程师被抽调支援集团项目', '资源风险', '高', 'P01'],
    ['客户对对账口径提出新诉求，可能引发范围蔓延', '需求风险', '中', 'P01'],
    ['移动端新框架在低端机型上存在兼容性缺陷', '技术风险', '高', 'P03'],
    ['第三方短信通道资质审核未通过', '外部依赖', '中', 'P07'],
    ['实时数仓压测未达 SLA，延迟 P99 超标', '质量风险', '高', 'P05'],
    ['个保法合规评审结论尚未出具', '合规风险', '中', 'P07'],
    ['文档协作灰度窗口与集团封网期冲突', '进度风险', '中', 'P04'],
    ['测试环境资源不足导致回归排队', '资源风险', '低', 'P03'],
    ['上游 ERP 接口变更未提前通知', '外部依赖', '高', 'P01'],
    ['指标口径与财务报表存在差异', '质量风险', '中', 'P05'],
    ['旅程编排引擎并发能力未经验证', '技术风险', '中', 'P07'],
    ['客户方项目负责人变更，决策链路重建', '外部依赖', '中', 'P01'],
    ['前端组件库升级引入回归缺陷', '质量风险', '低', 'P03'],
    ['数据部人力在 Q4 存在跨项目冲突', '资源风险', '中', 'P05'],
    ['需求变更累计已超基线 15%', '需求风险', '高', 'P02'],
    ['灰度指标监控缺失，问题发现滞后', '质量风险', '中', 'P04'],
    ['积分对账逻辑与财务系统未闭环', '技术风险', '低', 'P08'],
    ['自助分析方案尚未通过架构评审', '技术风险', '中', 'P06'],
    ['标杆客户交付节点前置两周', '进度风险', '高', 'P07'],
    ['离线包体积超出应用商店限制', '技术风险', '中', 'P03'],
    ['供应商门户账号体系与客户 SSO 未打通', '外部依赖', '中', 'P01'],
    ['实时链路故障演练尚未开展', '质量风险', '低', 'P05'],
    ['旅程模板缺少法务合规话术审核', '合规风险', '低', 'P07']
  ];
  var risks = RISK_T.map(function (x, i) {
    var p = projBy[x[3]];
    var st = rp(['待评估', '跟进中', '跟进中', '跟进中', '已缓解', '已关闭', '已升级']);
    if (x[2] === '高' && rb(.4)) st = '已升级';
    var found = off(-ri(3, 90));
    var dueAt = off(ri(-12, 40));
    return {
      id: 'RK' + U.pad(i + 1), title: x[0], type: x[1], level: x[2],
      projectId: x[3], projectName: p.name, lineId: p.lineId, lineName: p.lineName,
      status: st, owner: rb(.5) ? p.pm : rp(members).name,
      foundAt: found, dueAt: dueAt, overdue: U.dayDiff(dueAt, TODAY) > 0 && ['已缓解', '已关闭'].indexOf(st) < 0,
      prob: rp(['高', '中', '中', '低']), impact: x[2],
      impactDesc: rp(['可能导致里程碑延期 1-3 周', '影响客户交付承诺', '影响线上稳定性与口碑', '可能造成返工成本上升', '影响验收与回款节奏']),
      response: rp(['规避', '减轻', '转移', '接受']),
      plan: rp(['已制定专项跟进计划，每周同步进展', '拆解为 3 个缓解动作，已分配负责人', '已升级至事业群周会，等待资源决策', '与客户对齐后调整交付范围', '已启动备选技术方案预研']),
      escalated: st === '已升级', escalateTo: st === '已升级' ? '事业群管理会' : '',
      updates: [], score: (x[2] === '高' ? 3 : x[2] === '中' ? 2 : 1) * ri(1, 3)
    };
  });
  risks.forEach(function (rk) {
    var n = ri(1, 3);
    for (var i = 0; i < n; i++) {
      rk.updates.push({
        at: off(-ri(1, 40)), by: rk.owner,
        text: rp(['已与相关方对齐，风险等级维持不变。', '缓解动作已完成 2/3，预计下周收敛。',
          '影响面扩大，建议升级处理。', '已获得资源支持，风险下调。', '等待外部反馈，暂无进展。'])
      });
    }
    rk.updates = U.sortBy(rk.updates, 'at', true);
  });

  /* ============ 问题清单 ============ */
  var ISSUE_T = ['灰度用户反馈消息重复推送', '对账单金额与 ERP 存在 0.02 元差异', '移动端冷启动超过 3 秒',
    '文档协作偶发光标错位', '实时指标延迟突增至 40 秒', '旅程节点保存失败', '积分扣减未生成流水',
    '供应商列表分页错乱', '导出 Excel 中文乱码', '权限变更未实时生效', '大文件上传中断无法续传',
    '看板筛选条件刷新后丢失', '定时任务重复执行', '短信触达送达率下降', '登录态偶发失效', '数据血缘图渲染卡顿',
    '测试环境数据被覆盖', '接口超时未做降级'];
  var issues = ISSUE_T.map(function (t, i) {
    var p = rp(projects);
    var st = rp(['待处理', '处理中', '处理中', '待验证', '已解决', '已关闭']);
    var due = off(ri(-8, 25));
    return {
      id: 'IS' + U.pad(i + 1), title: t, projectId: p.id, projectName: p.name,
      lineId: p.lineId, lineName: p.lineName, status: st,
      priority: rp(['P0', 'P1', 'P1', 'P2', 'P2', 'P3']),
      owner: rp(members).name, source: rp(['线上反馈', '测试发现', '监控告警', '客户报障', '内部自查']),
      foundAt: off(-ri(1, 45)), dueAt: due,
      overdue: U.dayDiff(due, TODAY) > 0 && ['已解决', '已关闭'].indexOf(st) < 0,
      resolution: ['已解决', '已关闭'].indexOf(st) >= 0 ? rp(['已修复并回归通过', '已通过配置规避', '已在最新版本修复']) : '',
      relatedRisk: rb(.3) ? rp(risks).id : ''
    };
  });

  /* ============ 会议纪要 ============ */
  var MEET_T = [
    ['V2.6.0 在线对账需求评审', '需求评审', 'P01', -3],
    ['供应链协同 2.0 项目周会', '项目周会', 'P01', -2],
    ['补货算法数据回补方案讨论', '技术方案', 'P02', -5],
    ['Q3 版本节奏对齐会', '版本规划', '', -8],
    ['移动端重构灰度方案评审', '技术方案', 'P03', -6],
    ['TeamSpace 项目周会', '项目周会', 'P03', -2],
    ['文档协作上线窗口协调', '跨部门协同', 'P04', -4],
    ['实时数仓压测结果复盘', '风险复盘', 'P05', -7],
    ['DataMind 项目周会', '项目周会', 'P05', -1],
    ['旅程编排标杆客户共创会', '跨部门协同', 'P07', -9],
    ['7 月经营例会', '经营例会', '', -11],
    ['积分体系重构验收会', '验收会议', 'P08', -44],
    ['自助分析方案架构评审', '技术方案', 'P06', -13],
    ['Q3 风险专项复盘', '风险复盘', '', -15],
    ['V2.5.0 版本复盘会', '风险复盘', 'P01', -30]
  ];
  var meetings = [], actions = [], aid = 0;
  MEET_T.forEach(function (m, i) {
    var p = m[2] ? projBy[m[2]] : null;
    var att = [];
    var n = ri(5, 9);
    var pool = members.slice();
    for (var k = 0; k < n; k++) att.push(pool.splice(Math.floor(r() * pool.length), 1)[0].name);
    var mid = 'MT' + U.pad(i + 1);
    var meet = {
      id: mid, title: m[0], type: m[1],
      projectId: m[2], projectName: p ? p.name : '（跨项目）',
      lineId: p ? p.lineId : '', lineName: p ? p.lineName : '（多产品线）',
      date: off(m[3]), time: rp(['10:00-11:30', '14:00-15:30', '15:30-17:00', '09:30-10:30']),
      place: rp(['A 座 12F 会议室 1201', '线上 · 腾讯会议', 'B 座 8F 洽谈区', '线上 + 客户现场']),
      host: p ? p.pm : '李知远', attendees: att, absent: rb(.3) ? [rp(members).name] : [],
      agenda: [], content: '', decisions: [], actionIds: [], hasMinutes: true
    };
    meet.agenda = {
      '需求评审': ['需求背景与目标同步', '功能范围逐条评审', '优先级与排期确认', '风险与依赖识别'],
      '项目周会': ['上周进展回顾', '本周计划对齐', '风险与阻塞同步', 'Action Item 跟进'],
      '技术方案': ['方案背景说明', '备选方案对比', '技术选型决策', '落地排期'],
      '版本规划': ['各产品线版本节奏同步', '资源冲突识别', '上线窗口确认'],
      '跨部门协同': ['协同事项说明', '各方诉求对齐', '责任边界划分', '时间节点确认'],
      '风险复盘': ['问题回顾', '根因分析', '改进措施', '责任与时限'],
      '经营例会': ['核心指标回顾', '目标完成情况', '重点问题', '下阶段方向'],
      '验收会议': ['交付物清单核对', '验收标准逐项确认', '遗留问题登记', '验收结论']
    }[m[1]] || ['议题同步'];
    meet.content = '会议围绕「' + m[0] + '」展开，' + meet.attendees.length + ' 人参会。' +
      '各方对议程逐项讨论，明确了决策项与后续动作，会后同步至相关干系人。';
    var dn = ri(1, 3);
    var DEC = ['按方案 A 推进，暂不扩大本期范围。', '优先级调整为 P1，纳入下个版本。',
      '灰度窗口顺延一周，避开集团封网期。', '由研发中心补充压测报告后再决定是否上线。',
      '风险升级至事业群周会跟进。', '需求范围维持基线，新增诉求走变更流程。',
      '同意验收通过，遗留问题在下版本修复。', '资源由数据部临时支援 2 人 · 2 周。'];
    for (var d = 0; d < dn; d++) meet.decisions.push({ text: rp(DEC), by: meet.host });
    var an = ri(2, 4);
    for (var a = 0; a < an; a++) {
      aid++;
      var due = off(m[3] + ri(3, 21));
      var ast = U.dayDiff(due, TODAY) > 0 ? rp(['已完成', '已完成', '已逾期', '进行中']) : rp(['待开始', '进行中', '进行中', '已完成']);
      actions.push({
        id: 'AI' + U.pad(aid), meetingId: mid, meetingTitle: m[0],
        content: rp(['补充压测报告并同步结论', '与客户确认对账口径并回传纪要', '输出灰度方案 V2 并评审',
          '梳理受影响需求清单', '协调测试环境资源', '更新 PRD 并归档', '提交变更申请走审批',
          '完成接口联调并出具报告', '整理风险缓解动作并分配责任人', '准备验收材料与演示环境']),
        owner: rp(meet.attendees), due: due, status: ast,
        projectId: m[2], projectName: p ? p.name : '（跨项目）',
        overdue: ast === '已逾期', note: ''
      });
      meet.actionIds.push('AI' + U.pad(aid));
    }
    meetings.push(meet);
  });

  /* ============ 用户反馈 ============ */
  var FB_T = [
    ['对账单希望支持按供应商批量导出', 'L01', '重点客户'], ['供应商门户登录流程太长', 'L01', '部分用户'],
    ['希望增加采购订单变更的短信提醒', 'L01', '重点客户'], ['库存看板加载慢', 'L01', '全量用户'],
    ['补货建议缺少解释性说明', 'L01', '部分用户'], ['移动端启动太慢，经常白屏', 'L02', '全量用户'],
    ['文档协作时偶尔丢失最新编辑', 'L02', '重点客户'], ['希望支持深色模式', 'L02', '部分用户'],
    ['审批流配置太复杂，需要培训', 'L02', '部分用户'], ['外部协作者权限不好控制', 'L02', '重点客户'],
    ['全文检索结果不准确', 'L02', '全量用户'], ['希望支持离线查看文档', 'L02', '部分用户'],
    ['指标口径在不同看板不一致', 'L03', '重点客户'], ['自助取数门槛高，业务方用不起来', 'L03', '全量用户'],
    ['实时大屏偶尔数据跳变', 'L03', '单一客户'], ['数据血缘图看不清上下游', 'L03', '部分用户'],
    ['希望支持行列级权限', 'L03', '重点客户'], ['慢查询没有告警', 'L03', '部分用户'],
    ['旅程编排保存后节点顺序错乱', 'L04', '单一客户'], ['触达频次控制不生效', 'L04', '重点客户'],
    ['积分到账延迟', 'L04', '全量用户'], ['希望有旅程模板可以直接用', 'L04', '部分用户'],
    ['人群圈选预估人数不准', 'L04', '部分用户'], ['缺少 A/B 实验能力', 'L04', '重点客户'],
    ['会员等级权益配置不灵活', 'L04', '部分用户'], ['希望旅程效果能归因到具体节点', 'L04', '重点客户'],
    ['导出的 Excel 中文乱码', 'L01', '全量用户'], ['希望供应商评分可自定义权重', 'L01', '重点客户'],
    ['消息通知太多，希望能分类', 'L02', '全量用户'], ['组织架构同步有延迟', 'L02', '部分用户'],
    ['指标异动没有归因提示', 'L03', '重点客户'], ['看板搭建器组件太少', 'L03', '部分用户'],
    ['触达内容缺少素材库', 'L04', '部分用户'], ['旅程审批流程缺失', 'L04', '重点客户'],
    ['希望支持多币种结算', 'L01', '单一客户'], ['到货预约经常约不上', 'L01', '部分用户'],
    ['IM 消息已读状态不准', 'L02', '全量用户'], ['离线任务重跑要人工操作', 'L03', '部分用户'],
    ['积分对账要人工核对', 'L04', '重点客户'], ['缺少客户标签打通', 'L04', '重点客户']
  ];
  var CLUSTER = ['性能与稳定性', '易用性与上手成本', '功能缺失', '数据准确性', '权限与安全', '集成与打通'];
  var feedbacks = FB_T.map(function (f, i) {
    var line = lines.filter(function (l) { return l.id === f[1]; })[0];
    var st = rp(['待分类', '待评估', '待评估', '已纳入需求', '已纳入需求', '暂不处理', '已解决']);
    var cl = /慢|白屏|延迟|跳变|加载/.test(f[0]) ? '性能与稳定性'
      : /复杂|门槛|培训|看不清|不好控制/.test(f[0]) ? '易用性与上手成本'
        : /希望|缺少|支持/.test(f[0]) ? '功能缺失'
          : /不准|不一致|乱码|错乱|丢失|不生效/.test(f[0]) ? '数据准确性'
            : /权限|安全/.test(f[0]) ? '权限与安全' : '集成与打通';
    return {
      id: 'FB' + U.pad(i + 1), title: f[0], lineId: f[1], lineName: line.name,
      source: rp(C.DICT.fbSource), status: st, impact: f[2],
      customer: rp(['华瑞制造', '中远物流', '普林零售', '锦江商贸', '恒信集团', '多客户']),
      createAt: off(-ri(2, 150)), count: f[2] === '全量用户' ? ri(20, 180) : (f[2] === '重点客户' ? ri(3, 24) : ri(1, 9)),
      cluster: cl, tags: [cl, rp(['体验', '功能', '性能', '合规', '集成'])],
      linkedReq: st === '已纳入需求' ? rpo(requirements.filter(function (q) { return q.lineId === f[1]; }), { id: '' }).id : '',
      handler: rp(['温以宁', '林知微', '许清和', '沈亦白']),
      reply: st === '已解决' ? '已在最新版本优化，已回访客户确认。' : (st === '暂不处理' ? '当前季度不排期，纳入 backlog 观察。' : ''),
      nps: ri(2, 10)
    };
  });

  /* ============ 需求变更 ============ */
  var changes = [];
  for (var ci = 0; ci < 14; ci++) {
    var q = rpo(requirements.filter(function (x) { return ['已评审', '排期中', '设计中', '开发中', '测试中'].indexOf(x.status) >= 0; }), requirements[0]);
    var p = projBy[q.projectId];
    var st = rp(['草稿', '待审批', '待审批', '评估中', '已批准', '已批准', '已驳回', '已实施']);
    var applyAt = off(-ri(1, 70));
    changes.push({
      id: 'CG' + U.pad(ci + 1),
      title: rp(['新增', '调整', '取消', '拆分']) + '「' + U.ellip(q.title, 14) + '」' + rp(['的字段范围', '的交互流程', '的上线时间', '的验收标准']),
      reqId: q.id, reqTitle: q.title, projectId: q.projectId, projectName: q.projectName,
      lineId: q.lineId, lineName: q.lineName, releaseId: q.releaseId,
      reason: rp(C.DICT.changeReason), status: st,
      applicant: rp(['林知微', '许清和', '沈亦白', '温以宁']), applyAt: applyAt,
      impactScope: rp(['仅本需求内部调整', '影响同版本 2 个需求', '影响下游 1 个接口', '影响测试用例与验收标准', '影响客户交付承诺']),
      impactDays: ri(0, 12), impactCost: ri(0, 18), impactRisk: rp(['低', '中', '中', '高']),
      approver: p.pm, approveAt: ['已批准', '已驳回', '已实施'].indexOf(st) >= 0 ? off(-ri(0, 60)) : '',
      opinion: st === '已驳回' ? '本期范围已冻结，建议下个版本处理。' : (st === '已批准' ? '同意变更，排期顺延 1 周。' : ''),
      history: [
        { at: applyAt, by: '申请人', text: '提交变更申请' },
        { at: off(-ri(0, 60)), by: '产品负责人', text: '完成影响评估' }
      ]
    });
  }

  /* ============ 交付物 ============ */
  var DELIV_T = [
    ['产品需求文档 PRD', '产品文档'], ['交互原型与视觉稿', '设计稿'], ['技术方案说明书', '产品文档'],
    ['接口文档', '产品文档'], ['测试用例与测试报告', '测试报告'], ['部署包与发布说明', '部署包'],
    ['运营配置手册', '运营手册'], ['客户培训材料', '培训材料'], ['数据字典与指标口径', '数据报表'],
    ['上线验收报告', '产品文档'], ['源码交付清单', '代码交付'], ['压测报告', '测试报告']
  ];
  var deliverables = [];
  projects.forEach(function (p) {
    var n = p.status === '已完成' ? 8 : ri(3, 7);
    for (var i = 0; i < n; i++) {
      var d = DELIV_T[i % DELIV_T.length];
      var st = p.status === '已完成' ? '已归档'
        : rp(['未开始', '制作中', '制作中', '待验收', '验收中', '已验收', '已归档', '验收不通过']);
      var plan = off(ri(-60, 60));
      deliverables.push({
        id: 'DV' + U.pad(deliverables.length + 1), name: d[0], type: d[1],
        projectId: p.id, projectName: p.name, lineId: p.lineId, lineName: p.lineName,
        releaseId: rb(.6) ? rpo(releases.filter(function (x) { return x.projectId === p.id; }), { id: '' }).id : '',
        status: st, owner: rp(members).name, version: 'V' + ri(1, 3) + '.' + ri(0, 6),
        planDate: plan, realDate: ['已验收', '已归档'].indexOf(st) >= 0 ? U.fmtDate(U.addDay(plan, ri(-2, 6))) : '',
        acceptBy: ['已验收', '已归档'].indexOf(st) >= 0 ? rp(['客户·华瑞制造', '客户·中远物流', '内部·李知远', '内部·于潼']) : '',
        acceptAt: ['已验收', '已归档'].indexOf(st) >= 0 ? U.fmtDate(U.addDay(plan, ri(0, 9))) : '',
        acceptResult: st === '验收不通过' ? '文档缺少异常场景说明，需补充后重新提交' : (['已验收', '已归档'].indexOf(st) >= 0 ? '验收通过，无遗留问题' : ''),
        docLink: '/archive/' + p.id + '/' + (i + 1), size: ri(120, 8600) + ' KB',
        archived: st === '已归档'
      });
    }
  });

  /* ============ 业务指标 ============ */
  function series(base, n, drift, vol, seedShift) {
    var arr = [], v = base;
    for (var i = n - 1; i >= 0; i--) {
      v = Math.max(1, v * (1 + drift + (r() - 0.5) * vol));
      arr.push({ date: off(-i * 7), value: Math.round(v) });
    }
    return arr;
  }
  var METRICS = [
    { key: 'arr', name: 'ARR 年度经常性收入', unit: '万元', target: 8000, fmt: 'k' },
    { key: 'mau', name: '月活跃用户', unit: '人', target: 450000, fmt: 'k' },
    { key: 'renew', name: '客户续约率', unit: '%', target: 92, fmt: 'p' },
    { key: 'nps', name: 'NPS 净推荐值', unit: '', target: 45, fmt: 'n' },
    { key: 'ticket', name: '客户工单量', unit: '件', target: 300, fmt: 'n', lowerBetter: true },
    { key: 'sla', name: '线上可用性', unit: '%', target: 99.9, fmt: 'p' }
  ];
  var metrics = [];
  METRICS.forEach(function (m) {
    metrics.push({
      key: m.key, name: m.name, unit: m.unit, target: m.target, fmt: m.fmt,
      lowerBetter: !!m.lowerBetter, lineId: '',
      series: series(m.key === 'arr' ? 5200 : m.key === 'mau' ? 328000 : m.key === 'renew' ? 88
        : m.key === 'nps' ? 38 : m.key === 'ticket' ? 420 : 99.6,
        26, m.key === 'ticket' ? -0.006 : 0.008, m.key === 'sla' ? 0.002 : 0.05)
    });
    lines.forEach(function (l) {
      metrics.push({
        key: m.key, name: m.name, unit: m.unit, target: m.target, fmt: m.fmt,
        lowerBetter: !!m.lowerBetter, lineId: l.id,
        series: series((m.key === 'arr' ? 1300 : m.key === 'mau' ? 82000 : m.key === 'renew' ? 87
          : m.key === 'nps' ? 36 : m.key === 'ticket' ? 105 : 99.5) * (0.7 + r() * 0.7),
          26, 0.008, m.key === 'sla' ? 0.002 : 0.06)
      });
    });
  });
  /* 漏斗 / 留存 */
  var funnel = [
    { name: '访问产品页', value: 128400 }, { name: '注册试用', value: 42600 },
    { name: '完成引导', value: 28900 }, { name: '产生首次价值', value: 16800 },
    { name: '付费转化', value: 5240 }, { name: '续费/扩容', value: 2180 }
  ];
  var retention = [];
  for (var w = 0; w < 8; w++) {
    var row = { cohort: U.fmtDate(U.addDay(TODAY, -7 * (8 - w)), 'MM-DD') + ' 周', size: ri(800, 2600), cells: [] };
    var base = 100;
    for (var d2 = 0; d2 < 8 - w; d2++) {
      base = d2 === 0 ? 100 : base * (0.72 + r() * 0.2);
      row.cells.push(+base.toFixed(1));
    }
    retention.push(row);
  }

  /* ============ 产品规划（路线图 / OKR）============ */
  var QUARTERS = ['2026Q1', '2026Q2', '2026Q3', '2026Q4', '2027Q1'];
  var RM_T = {
    L01: [['供应商门户上线', '2026Q2'], ['协同计划能力', '2026Q2'], ['在线对账', '2026Q3'], ['供应商评分', '2026Q4'], ['智能补货 GA', '2026Q4'], ['多币种与全球化', '2027Q1']],
    L02: [['文档协作增强', '2026Q3'], ['移动端重构', '2026Q3'], ['移动端体验优化', '2026Q4'], ['审批流可视化', '2026Q4'], ['AI 写作助手', '2027Q1'], ['组织同步优化', '2026Q1']],
    L03: [['实时数仓一期', '2026Q2'], ['实时指标服务', '2026Q3'], ['流批一体调度', '2026Q4'], ['自助分析平台', '2027Q1'], ['数据资产地图', '2026Q4'], ['指标口径治理', '2026Q1']],
    L04: [['积分体系重构', '2026Q2'], ['旅程编排 Beta', '2026Q3'], ['旅程编排 GA', '2026Q4'], ['A/B 实验能力', '2027Q1'], ['标签体系打通', '2026Q4'], ['触达通道扩展', '2026Q3']]
  };
  var roadmap = [];
  Object.keys(RM_T).forEach(function (lid) {
    var line = lines.filter(function (l) { return l.id === lid; })[0];
    RM_T[lid].forEach(function (x, i) {
      var q = x[1];
      var qi = QUARTERS.indexOf(q), cur = QUARTERS.indexOf('2026Q3');
      var st = qi < cur ? '已完成' : (qi === cur ? rp(['进行中', '进行中', '风险中']) : (qi === cur + 1 ? '规划中' : '规划中'));
      roadmap.push({
        id: 'RM' + lid.slice(1) + U.pad(i + 1), lineId: lid, lineName: line.name,
        title: x[0], quarter: q, status: st,
        progress: st === '已完成' ? 1 : (st === '进行中' ? ri(30, 78) / 100 : (st === '风险中' ? ri(15, 45) / 100 : ri(0, 10) / 100)),
        owner: line.pm, type: rp(['战略必做', '客户承诺', '体验优化', '技术投入']),
        goal: rp(['支撑头部客户续约', '提升活跃与留存', '降低运维与人力成本', '打开新客户场景', '偿还关键技术债']),
        kpi: rp(['续约率 +4pt', 'DAU +12%', '工单量 -25%', '交付周期 -30%', '缺货率 -30%', '指标复用率 70%']),
        value: ri(5, 10), effort: ri(20, 160), priority: rp(['P0', 'P1', 'P1', 'P2']),
        relatedReleases: releases.filter(function (rr) { return rr.lineId === lid; }).slice(0, 2).map(function (rr) { return rr.id; })
      });
    });
  });
  /* 年度/季度目标 */
  var okrs = [];
  lines.forEach(function (l) {
    ['2026Q2', '2026Q3', '2026Q4'].forEach(function (q, qi) {
      var n = ri(2, 3);
      for (var i = 0; i < n; i++) {
        var target = ri(60, 100), actual = qi === 0 ? ri(55, 105) : (qi === 1 ? ri(30, 85) : ri(0, 30));
        okrs.push({
          id: 'OKR' + l.id.slice(1) + q.slice(-2) + (i + 1), lineId: l.id, lineName: l.name, quarter: q,
          objective: rp(['提升头部客户续约与扩容', '打通端到端协同链路', '把实时能力做成默认选项',
            '让业务方自助用起来', '把交付周期压到 6 周内', '建立可复制的标杆交付方法']),
          kr: rp(['续约率达到 92%', '交付周期缩短 30%', '指标复用率达到 70%', 'DAU 提升至 45 万',
            '标杆客户交付 3 家', '线上 P0 事故 0 起', '需求平均流转周期 ≤ 21 天']),
          owner: l.pm, target: target, actual: actual, unit: '%',
          rate: U.pct(actual, target), status: qi === 0 ? '已结束' : (qi === 1 ? '进行中' : '未开始'),
          value: rp(['营收增长', '客户留存', '效率提升', '成本优化', '战略卡位'])
        });
      }
    });
  });

  /* ============ 经营复盘 ============ */
  var reviews = [];
  [['2026-05', '月度复盘'], ['2026-06', '月度复盘'], ['2026-07', '月度复盘'], ['2026Q2', '季度复盘'],
  ['V2.5.0', '版本复盘'], ['补货算法专项', '专项复盘']].forEach(function (x, i) {
    reviews.push({
      id: 'RV' + U.pad(i + 1), title: x[0] + ' ' + x[1], type: x[1], period: x[0],
      lineId: rb(.5) ? rp(lines).id : '', owner: '李知远',
      date: off(-ri(6, 80)), status: rp(['已完成', '已完成', '进行中']),
      goalRate: ri(62, 108),
      goals: [
        { name: 'ARR 目标', target: 660, actual: ri(520, 720), unit: '万' },
        { name: '版本按期率', target: 90, actual: ri(64, 96), unit: '%' },
        { name: '需求交付量', target: 28, actual: ri(18, 34), unit: '个' },
        { name: '线上事故', target: 0, actual: ri(0, 2), unit: '起', lowerBetter: true }
      ],
      issues: ['版本按期率低于目标，主要集中在依赖外部接口的需求',
        '需求变更率偏高，前期调研深度不足',
        '测试资源在版本集中期出现排队'],
      causes: [
        { issue: '版本延期', cause: '上游接口变更未提前同步，缺少接口契约管理', type: '流程' },
        { issue: '需求变更多', cause: '客户方决策链路长，需求确认环节缺少书面确认', type: '协同' },
        { issue: '测试排队', cause: '测试环境与人力未按版本节奏提前预留', type: '资源' }
      ],
      actions: [
        { text: '建立接口契约登记与变更通知机制', owner: '孟星野', due: off(ri(10, 40)), status: '进行中' },
        { text: '需求确认引入客户书面签字环节', owner: '林知微', due: off(ri(5, 30)), status: '待开始' },
        { text: '按版本节奏提前 2 周锁定测试资源', owner: '于潼', due: off(ri(3, 25)), status: '已完成' }
      ],
      summary: '整体目标完成度 ' + ri(62, 108) + '%，收入与活跃指标符合预期，交付按期率是本期最大短板，' +
        '已定位到接口契约与需求确认两个流程缺口，改进动作已分配到人。'
    });
  });

  /* ============ 周报月报 ============ */
  var reports = [];
  for (var wi = 0; wi < 8; wi++) {
    var p2 = rp(projects.filter(function (x) { return x.status !== '已完成'; }));
    var start = U.addDay(TODAY, -7 * (wi + 1) - ((TODAY.getDay() + 6) % 7));
    reports.push({
      id: 'RP' + U.pad(wi + 1), type: wi < 6 ? '周报' : '月报',
      period: wi < 6 ? U.weekOf(start) : U.monthOf(U.addDay(TODAY, -30 * (wi - 5))),
      periodText: wi < 6 ? U.fmtDate(start, 'MM-DD') + ' ~ ' + U.fmtDate(U.addDay(start, 6), 'MM-DD')
        : U.fmtDate(U.addDay(TODAY, -30 * (wi - 5)), 'YYYY 年 MM 月'),
      projectId: p2.id, projectName: p2.name, author: p2.pm,
      createAt: U.fmtDate(U.addDay(start, 5)), status: wi === 0 ? '草稿' : '已提交',
      progress: ri(35, 92), planProgress: ri(40, 95),
      doneCount: ri(6, 22), openCount: ri(4, 18), delayCount: ri(0, 5), riskCount: ri(0, 4),
      highlights: ['完成 ' + ri(3, 9) + ' 个需求的开发与提测', '版本 ' + rp(releases).name + ' 进入测试阶段', '解决 ' + ri(2, 8) + ' 个线上问题'],
      risks: ['关键人力在下周存在跨项目冲突', '上游接口联调时间存在不确定性'],
      nextPlan: ['完成回归测试并出具测试报告', '推进灰度方案评审', '跟进 ' + ri(2, 5) + ' 项客户确认事项'],
      summary: '本期整体推进符合预期，交付节奏可控；需重点关注资源冲突与外部依赖两项风险。'
    });
  }

  /* ============ 跨部门协同 ============ */
  var cross = [];
  var CROSS_T = ['申请测试环境扩容', '协调数据部支援 2 人', '法务合规话术审核', '市场部配合上线宣发',
    '客户成功部安排客户培训', '运维部配合灰度发布窗口', '财务口径对齐', '安全部渗透测试排期',
    '采购部第三方通道签约', '设计部支援视觉走查', '数据部提供历史数据回补', '测试部提前介入用例评审',
    '法务合规个保法评估', '运维部生产权限开通'];
  CROSS_T.forEach(function (t, i) {
    var p = rp(projects);
    var st = rp(['待处理', '处理中', '处理中', '已解决', '已关闭']);
    var due = off(ri(-10, 30));
    cross.push({
      id: 'CX' + U.pad(i + 1), title: t, projectId: p.id, projectName: p.name,
      fromDept: '产品部', toDept: rp(C.DICT.dept.filter(function (d) { return d !== '产品部'; })),
      status: st, owner: rp(members).name, requester: p.pm,
      requestAt: off(-ri(1, 40)), dueAt: due,
      overdue: U.dayDiff(due, TODAY) > 0 && ['已解决', '已关闭'].indexOf(st) < 0,
      priority: rp(['P0', 'P1', 'P2', 'P2']),
      result: ['已解决', '已关闭'].indexOf(st) >= 0 ? rp(['已支持到位', '已按期完成', '已提供替代方案']) : ''
    });
  });

  /* ============ 工作留痕 ============ */
  var traces = [];
  function pushTrace(t) { traces.push(t); }
  requirements.slice(0, 26).forEach(function (q, i) {
    pushTrace({
      id: 'TR' + U.pad(traces.length + 1), time: offT(-ri(1, 60), ri(9, 20), rp([0, 12, 27, 41, 55])),
      type: '需求变动', title: '需求「' + U.ellip(q.title, 16) + '」状态更新为 ' + q.status,
      desc: '由 ' + q.owner + ' 操作，关联版本 ' + (q.releaseName || '未关联'),
      actor: q.owner, projectId: q.projectId, projectName: q.projectName,
      lineId: q.lineId, lineName: q.lineName, refType: 'requirement', refId: q.id
    });
  });
  releases.filter(function (x) { return x.realDate; }).forEach(function (rel) {
    pushTrace({
      id: 'TR' + U.pad(traces.length + 1), time: rel.realDate + ' ' + rp(['20:30', '22:00', '23:15', '02:00']),
      type: '版本发布', title: '版本 ' + rel.name + ' ' + (rel.status === '已回滚' ? '发布后回滚' : '正式发布'),
      desc: '包含 ' + rel.reqCount + ' 个需求，发布负责人 ' + rel.owner,
      actor: rel.owner, projectId: rel.projectId, projectName: rel.projectName,
      lineId: rel.lineId, lineName: rel.lineName, refType: 'release', refId: rel.id
    });
  });
  tasks.filter(function (t) { return t.doneAt; }).slice(0, 30).forEach(function (t) {
    pushTrace({
      id: 'TR' + U.pad(traces.length + 1), time: t.doneAt + ' ' + U.pad(ri(9, 20)) + ':' + rp(['05', '18', '33', '47']),
      type: '任务流转', title: '任务「' + U.ellip(t.title, 18) + '」已完成',
      desc: '负责人 ' + t.owner + '，实际工时 ' + t.realHours + 'h（预估 ' + t.estHours + 'h）',
      actor: t.owner, projectId: t.projectId, projectName: t.projectName,
      lineId: projBy[t.projectId].lineId, lineName: projBy[t.projectId].lineName, refType: 'task', refId: t.id
    });
  });
  risks.slice(0, 16).forEach(function (rk) {
    pushTrace({
      id: 'TR' + U.pad(traces.length + 1), time: rk.foundAt + ' ' + U.pad(ri(9, 19)) + ':' + rp(['10', '25', '40']),
      type: '风险处置', title: '风险「' + U.ellip(rk.title, 16) + '」' + (rk.escalated ? '已升级' : '登记并跟进'),
      desc: '等级 ' + rk.level + '，负责人 ' + rk.owner + '，应对策略：' + rk.response,
      actor: rk.owner, projectId: rk.projectId, projectName: rk.projectName,
      lineId: rk.lineId, lineName: rk.lineName, refType: 'risk', refId: rk.id
    });
  });
  meetings.forEach(function (m) {
    m.decisions.forEach(function (d, di) {
      pushTrace({
        id: 'TR' + U.pad(traces.length + 1), time: m.date + ' ' + m.time.split('-')[1],
        type: '会议决策', title: '会议「' + U.ellip(m.title, 16) + '」决策：' + U.ellip(d.text, 22),
        desc: '主持人 ' + m.host + '，参会 ' + m.attendees.length + ' 人',
        actor: m.host, projectId: m.projectId, projectName: m.projectName,
        lineId: m.lineId, lineName: m.lineName, refType: 'meeting', refId: m.id
      });
    });
  });
  changes.forEach(function (cg) {
    pushTrace({
      id: 'TR' + U.pad(traces.length + 1), time: cg.applyAt + ' ' + U.pad(ri(9, 18)) + ':' + rp(['08', '22', '36']),
      type: '变更审批', title: '变更「' + U.ellip(cg.title, 18) + '」' + cg.status,
      desc: '申请人 ' + cg.applicant + '，影响工期 ' + cg.impactDays + ' 天',
      actor: cg.applicant, projectId: cg.projectId, projectName: cg.projectName,
      lineId: cg.lineId, lineName: cg.lineName, refType: 'change', refId: cg.id
    });
  });
  deliverables.filter(function (d) { return d.acceptAt; }).slice(0, 18).forEach(function (d) {
    pushTrace({
      id: 'TR' + U.pad(traces.length + 1), time: d.acceptAt + ' ' + U.pad(ri(10, 18)) + ':' + rp(['00', '30']),
      type: '交付验收', title: '交付物「' + d.name + '」验收' + (d.status === '验收不通过' ? '未通过' : '通过'),
      desc: '验收人 ' + d.acceptBy + '，版本 ' + d.version,
      actor: d.owner, projectId: d.projectId, projectName: d.projectName,
      lineId: d.lineId, lineName: d.lineName, refType: 'deliverable', refId: d.id
    });
  });
  roadmap.slice(0, 10).forEach(function (rm) {
    pushTrace({
      id: 'TR' + U.pad(traces.length + 1), time: off(-ri(10, 120)) + ' ' + U.pad(ri(9, 18)) + ':00',
      type: '规划调整', title: '规划项「' + rm.title + '」排入 ' + rm.quarter,
      desc: '负责人 ' + rm.owner + '，目标：' + rm.goal,
      actor: '李知远', projectId: '', projectName: '（规划）',
      lineId: rm.lineId, lineName: rm.lineName, refType: 'roadmap', refId: rm.id
    });
  });
  traces = U.sortBy(traces, 'time', true);

  /* ============ 待办 / 笔记 ============ */
  var todos = [];
  var TODO_D = ['确认 V2.6.0 上线窗口', '审阅补货算法技术方案', '回复客户对账口径疑问', '评审 Q4 产品规划初稿',
    '与研发中心确认人力支援', '整理 7 月经营复盘材料', '批复 2 项需求变更申请', '确认移动端灰度放量比例',
    '跟进合规评审结论', '准备事业群周会汇报'];
  var TODO_P = ['更新项目周报', '跟进 3 项逾期任务', '协调测试环境资源', '确认里程碑延期影响',
    '登记新风险并分配负责人', '整理会议 Action Item', '提交交付物验收材料', '与客户确认验收时间',
    '梳理下周资源排期', '跟进阻塞事项解除'];
  TODO_D.forEach(function (t, i) {
    var due = off(ri(-3, 12));
    todos.push({
      id: 'TD' + U.pad(i + 1), title: t, role: 'director',
      priority: rp(['P0', 'P1', 'P1', 'P2']), due: due,
      status: rp(['待开始', '待开始', '进行中', '已完成']),
      overdue: U.dayDiff(due, TODAY) > 0, from: rp(['系统提醒', '会议 Action', '手动创建', '风险升级']),
      refType: rp(['release', 'risk', 'meeting', 'requirement']), refId: '',
      note: '', remind: rb(.4), owner: '李知远'
    });
  });
  TODO_P.forEach(function (t, i) {
    var due = off(ri(-2, 10));
    todos.push({
      id: 'TD' + U.pad(i + 11), title: t, role: 'pm',
      priority: rp(['P0', 'P1', 'P1', 'P2', 'P2']), due: due,
      status: rp(['待开始', '进行中', '进行中', '已完成']),
      overdue: U.dayDiff(due, TODAY) > 0, from: rp(['系统提醒', '会议 Action', '手动创建']),
      refType: rp(['task', 'risk', 'meeting', 'delivery']), refId: '',
      note: '', remind: rb(.4), owner: '陈项深'
    });
  });
  todos.forEach(function (t) { if (t.status === '已完成') t.overdue = false; });

  var notes = [
    { id: 'NT01', title: '与华瑞制造的对账口径要点', content: '1. 按月结算，账期 T+30\n2. 差异容忍度 0.01 元\n3. 争议单需 5 个工作日内响应\n4. 客户希望支持批量导出（已转需求 REQ-04）', updateAt: off(-3), tags: ['客户', '对账'] },
    { id: 'NT02', title: 'Q4 规划思考', content: '优先级判断：\n- 客户承诺 > 战略卡位 > 技术债\n- 供应链线要保续约，移动端要保活跃\n- DataMind 自助分析是明年的增长点，Q4 先做方案\n\n资源缺口主要在数据部，需要提前和集团要人。', updateAt: off(-6), tags: ['规划', 'OKR'] },
    { id: 'NT03', title: '版本延期的三个共性原因', content: '复盘了近 6 个版本：\n1. 上游接口契约不稳定（4/6）\n2. 需求确认没有书面留痕（3/6）\n3. 测试资源集中期排队（3/6）\n\n前两条已经有改进动作，第三条要靠版本节奏错峰。', updateAt: off(-12), tags: ['复盘', '流程'] },
    { id: 'NT04', title: '本周待确认清单', content: '- 移动端灰度比例：10% 还是 20%？\n- 对账争议流程是否需要客户侧审批？\n- 数据部支援能否延长到 Q4？', updateAt: off(-1), tags: ['待确认'] }
  ];

  /* ============ 提醒 ============ */
  var notices = [];
  risks.filter(function (x) { return x.level === '高' && ['已缓解', '已关闭'].indexOf(x.status) < 0; }).slice(0, 4).forEach(function (rk) {
    notices.push({ type: 'risk', tone: 'danger', title: '高风险待处理：' + U.ellip(rk.title, 20), time: rk.foundAt, ref: rk.id, mod: 'risks' });
  });
  actions.filter(function (a) { return a.status === '已逾期'; }).slice(0, 3).forEach(function (a) {
    notices.push({ type: 'action', tone: 'warn', title: 'Action 逾期：' + U.ellip(a.content, 20), time: a.due, ref: a.id, mod: 'meetings' });
  });
  releases.filter(function (x) { return x.status === '待发布'; }).forEach(function (rel) {
    notices.push({ type: 'release', tone: 'info', title: '版本待发布：' + rel.name + '（' + rel.planDate + '）', time: rel.planDate, ref: rel.id, mod: 'releases' });
  });
  changes.filter(function (c2) { return c2.status === '待审批'; }).slice(0, 3).forEach(function (c2) {
    notices.push({ type: 'change', tone: 'warn', title: '变更待审批：' + U.ellip(c2.title, 20), time: c2.applyAt, ref: c2.id, mod: 'changes' });
  });

  /* ============ 成员项目关联 / 工时分配 ============ */
  var allocs = [];
  members.forEach(function (m) {
    var n = m.func === 'director' ? 4 : ri(1, 3);
    var pool = projects.filter(function (p) { return p.status !== '已完成'; }).slice();
    for (var i = 0; i < n && pool.length; i++) {
      var p = pool.splice(Math.floor(r() * pool.length), 1)[0];
      m.projects.push(p.id);
      for (var w2 = 0; w2 < 6; w2++) {
        allocs.push({
          memberId: m.id, memberName: m.name, dept: m.dept,
          projectId: p.id, projectName: p.name,
          weekStart: U.fmtDate(U.addDay(U.weekRange(TODAY)[0], 7 * (w2 - 2))),
          hours: ri(4, 26)
        });
      }
    }
  });
  members.forEach(function (m) {
    var h = U.sum(allocs.filter(function (a) {
      return a.memberId === m.id && a.weekStart === U.fmtDate(U.weekRange(TODAY)[0]);
    }), 'hours');
    m.weekHours = h;
    m.loadPct = Math.round(h / 40 * 100);
    m.conflict = m.loadPct > 100;
  });

  return {
    TODAY: TODAY,
    lines: lines, projects: projects, members: members, releases: releases,
    requirements: requirements, phases: phases, milestones: milestones, tasks: tasks,
    risks: risks, issues: issues, meetings: meetings, actions: actions,
    feedbacks: feedbacks, changes: changes, deliverables: deliverables,
    metrics: metrics, funnel: funnel, retention: retention,
    roadmap: roadmap, okrs: okrs, reviews: reviews, reports: reports,
    cross: cross, traces: traces, todos: todos, notes: notes, notices: notices,
    allocs: allocs, quarters: QUARTERS
  };
})();
