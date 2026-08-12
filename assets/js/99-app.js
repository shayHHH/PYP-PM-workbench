/* ============================================================
 * 99-app.js  启动与快捷新建
 * 注册 C.CREATE 里全部 11 个快捷新建表单，然后启动 Shell。
 * 新建对象写入内存态 DB（S.add），自动生成留痕，刷新即还原。
 * ========================================================== */
(function () {
  'use strict';

  var D = C.DICT;

  function today() { return U.fmtDate(new Date(), 'YYYY-MM-DD'); }
  function plus(n) { return U.fmtDate(U.addDay(new Date(), n), 'YYYY-MM-DD'); }
  function memberOpts() { return S.members().map(function (m) { return m.name; }); }
  function lineOpts() {
    return S.DB.lines.map(function (l) { return { v: l.id, t: l.name }; });
  }
  function projectOpts() {
    return S.projectsInScope().map(function (p) { return { v: p.id, t: p.name }; });
  }
  /* 一个项目只属于一条产品线。凡是表单里同时有「所属产品线 + 归属项目」的，
     项目下拉必须按选中的线过滤——否则同一个项目会出现在任意产品线下面。
     配合 UI.formModal 的 depends / optsFor 使用。 */
  function projectOptsOfLine(lineId) {
    return S.DB.projects
      .filter(function (p) { return !lineId || p.lineId === lineId; })
      .map(function (p) { return { v: p.id, t: p.name }; });
  }
  /* 表单里「所属产品线」的默认选中：当前口径 → 当前项目所属线 → 第一条线。
     空库时返回 ''，此时下拉本身也是空的，会被上手引导拦在「先建产品线」那一步。 */
  function defLineId() {
    return S.state.lineId || (S.curProject() || {}).lineId || (S.DB.lines[0] || {}).id || '';
  }
  function releaseOpts(lineId) {
    return S.DB.releases
      .filter(function (r) { return !lineId || r.lineId === lineId; })
      .map(function (r) { return { v: r.id, t: r.name }; });
  }
  function reqOpts() {
    return S.reqs('all')
      .filter(function (q) { return !C.isTerminal(q.status); })
      .slice(0, 60)
      .map(function (q) { return { v: q.id, t: q.id + ' · ' + U.ellip(q.title, 18) }; });
  }
  function nameOf(list, id, key) {
    var it = (list || []).filter(function (x) { return x.id === id; })[0];
    return it ? it[key || 'name'] : '';
  }
  /* 项目 → 产品线联动填充 */
  function ctxOfProject(pid) {
    var p = S.projBy(pid) || S.curProject() || {};
    return {
      projectId: p.id || '', projectName: p.name || '',
      lineId: p.lineId || '', lineName: p.lineName || ''
    };
  }
  function ctxOfLine(lid) {
    var l = S.lineBy(lid) || {};
    return { lineId: l.id || '', lineName: l.name || '' };
  }
  /* 新建成功后的统一收尾 */
  function done(msg, mod, sub, id) {
    UI.toast(msg, 'ok');
    Shell.paintNotice();
    if (mod) Shell.go(mod, sub || '', id || '');
  }

  /* ================= 需求 ================= */
  Shell.onCreate('req.new', function () {
    var defLine = defLineId();
    UI.formModal({
      title: '新建需求',
      wide: true,
      tip: '需求创建后进入「待评审」状态，可在需求池中继续完善 PRD 与验收标准。',
      okText: '创建需求',
      fields: [
        { k: 'title', label: '需求标题', type: 'text', req: true, full: true, placeholder: '一句话说明要解决的问题' },
        { k: 'lineId', label: '所属产品线', type: 'select', req: true, opts: lineOpts(), val: defLine },
        { k: 'projectId', label: '归属项目', type: 'select', req: true, opts: projectOptsOfLine(defLine),
          val: S.state.projectId, depends: 'lineId', optsFor: projectOptsOfLine },
        { k: 'type', label: '需求类型', type: 'select', req: true, opts: D.reqType, val: '新功能' },
        { k: 'source', label: '需求来源', type: 'select', req: true, opts: D.reqSource, val: '内部规划' },
        {
          k: 'priority', label: S.isDirector() ? '优先级' : '建议优先级', type: 'select', req: true,
          opts: D.priority, val: 'P1',
          hint: S.isDirector() ? '' : '最终优先级由产品总监评审时确认'
        },
        { k: 'owner', label: '产品负责人', type: 'select', req: true, opts: memberOpts(), val: S.roleObj().user.name },
        { k: 'value', label: '业务价值（1-10）', type: 'number', val: 5, min: 1, max: 10, help: 'valueScore' },
        { k: 'effort', label: '预估人日', type: 'number', val: 10, min: 1, help: 'effortScore', hint: '用于价值-成本四象限' },
        { k: 'releaseId', label: '目标版本', type: 'select', opts: releaseOpts(), emptyText: '（暂不排期）' },
        { k: 'due', label: '期望交付日', type: 'date', val: plus(30) },
        { k: 'desc', label: '需求描述', type: 'textarea', full: true, rows: 3, placeholder: '业务背景、目标用户、核心流程与异常场景' },
        { k: 'acceptance', label: '验收标准', type: 'textarea', full: true, rows: 3, placeholder: '每行一条，将逐条归档到 PRD' }
      ],
      onSubmit: function (d) {
        var pc = ctxOfProject(d.projectId);
        var lc = ctxOfLine(d.lineId);
        var value = U.num(d.value, 7), effort = Math.max(U.num(d.effort, 10), 1);
        var obj = {
          id: U.uid('REQ'), title: d.title,
          /* 产品线以「所选项目」为准反推：项目只属于一条线，这是唯一归属。
             下拉即使被绕过（旧数据、导入），也不会存出「项目和产品线对不上」的记录。 */
          lineId: pc.lineId || lc.lineId, lineName: pc.lineName || lc.lineName,
          projectId: pc.projectId, projectName: pc.projectName,
          releaseId: d.releaseId || '', releaseName: nameOf(S.DB.releases, d.releaseId),
          type: d.type, source: d.source, status: '待评审', priority: d.priority,
          value: value, effort: effort, roi: +(value * 10 / effort).toFixed(1),
          owner: d.owner, proposer: S.roleObj().user.name,
          createAt: today(), reviewAt: '', onlineAt: '', due: d.due || plus(30),
          progress: 0, prdVer: '', prdArchived: false, changeCount: 0,
          tags: ['新建'], desc: d.desc || '',
          acceptance: (d.acceptance || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean),
          cycleDays: 0, isNew: true
        };
        S.add('requirements', obj);
        done('需求 ' + obj.id + ' 已创建', 'requirements', 'pool', obj.id);
      }
    });
  });

  /* ================= 指标数据 =================
     数据分析模块围绕 C.METRIC_SLOTS 里固定的 6 个 key 组织看板与达标判断，
     所以这里不是「随便新建一个指标」，而是往某个槽位 + 某个口径里填一周的数：
       · 该槽位 + 该口径第一次录 → 建一条指标记录（名称 / 单位 / 目标由你定）
       · 已经有了 → 追加或覆盖这一周的数值，名称与目标同步更新
     口径 lineId 为空表示全公司汇总；13-analytics 找不到产品线序列时会回落到它。 */
  Shell.onCreate('metric.new', function () {
    /* 同一 key 在不同产品线下是不同记录，lineId:'' 是全公司口径 */
    function findMetric(key, lineId) {
      return S.DB.metrics.filter(function (m) {
        return m.key === key && (m.lineId || '') === (lineId || '');
      })[0] || null;
    }
    /* 权限对齐 PERM_NOTE['analytics.pm']：ARR / MAU / 续约率是经营级指标，
       只有产品总监能看能录；项目经理只能录交付质量类的 NPS / 工单 / 可用性。 */
    var PM_ONLY = ['nps', 'ticket', 'sla'];
    var slots = C.METRIC_SLOTS.filter(function (s) {
      return S.isDirector() || PM_ONLY.indexOf(s.key) >= 0;
    });
    var defKey = slots[0].key;
    var defLine = S.isDirector() ? (S.state.lineId || '') : ((S.curProject() || {}).lineId || '');

    function fieldsFor(key, lineId) {
      var slot = C.slotOf(key) || slots[0];
      var cur = findMetric(key, lineId);
      return [
        {
          k: 'key', label: '指标', type: 'select', req: true, val: key,
          opts: slots.map(function (s) {
            var has = findMetric(s.key, lineId);
            return { v: s.key, t: s.name + (has ? '（已有 ' + (has.series || []).length + ' 周数据）' : '（未录入）') };
          }),
          hint: '换指标后请重新打开本窗口，名称与目标会按所选指标带出'
        },
        {
          k: 'lineId', label: '统计口径', type: 'select', val: lineId,
          opts: lineOpts(), emptyText: '（全公司汇总）',
          hint: '按产品线分别录，趋势页才能做多线对比；只录汇总口径也能用'
        },
        {
          k: 'name', label: '指标名称', req: true, full: true,
          val: (cur && cur.name) || slot.name,
          placeholder: '按你们内部的叫法写，看板和导出都用这个名字'
        },
        { k: 'unit', label: '单位', val: cur ? cur.unit : slot.unit, placeholder: '如 万元 / 人 / % ，无单位可留空' },
        {
          k: 'fmt', label: '数值格式', type: 'select', val: (cur && cur.fmt) || slot.fmt,
          opts: [
            { v: 'n', t: '普通数字（1234）' },
            { v: 'k', t: '大数缩写（1.2万）' },
            { v: 'p', t: '百分比（92.5%）' }
          ]
        },
        {
          k: 'target', label: '目标值', type: 'number', req: true,
          val: cur ? cur.target : '',
          hint: '达标 / 未达标、达成率都按它算，填你们真实的考核目标'
        },
        {
          k: 'lowerBetter', label: '越小越好', type: 'select', val: (cur ? cur.lowerBetter : slot.lowerBetter) ? '1' : '0',
          opts: [{ v: '0', t: '否 —— 越大越好' }, { v: '1', t: '是 —— 如工单量、故障数' }]
        },
        {
          k: 'date', label: '统计周截止日', type: 'date', req: true, val: today(),
          hint: '按周录，同一天再录一次会覆盖当天的值'
        },
        { k: 'value', label: '本期数值', type: 'number', req: true, placeholder: '这一周的实际值' }
      ];
    }

    UI.formModal({
      title: '录入指标数据', wide: true,
      tip: '指标按「周」记录：选一个指标槽位与统计口径，填目标值和这一周的实际值。攒够两周以上，趋势图和环比才有意义。',
      okText: '保存数据',
      fields: fieldsFor(defKey, defLine),
      onSubmit: function (d) {
        var lineId = d.lineId || '';
        var slot = C.slotOf(d.key) || slots[0];
        var date = d.date || today();
        var val = U.num(d.value, 0);
        var m = findMetric(d.key, lineId);
        var patch = {
          name: d.name || slot.name,
          unit: d.unit === undefined ? slot.unit : d.unit,
          fmt: d.fmt || slot.fmt,
          target: U.num(d.target, 0),
          lowerBetter: d.lowerBetter === '1' || d.lowerBetter === true
        };
        if (!m) {
          m = Object.assign({
            id: U.uid('MT'), key: d.key, lineId: lineId,
            lineName: lineId ? nameOf(S.DB.lines, lineId) : '全公司',
            series: []
          }, patch);
          m.series = [{ date: date, value: val }];
          S.add('metrics', m);
        } else {
          var series = (m.series || []).filter(function (x) { return x.date !== date; });
          series.push({ date: date, value: val });
          /* 折线按时间顺序画，乱序录入也要保证图是对的 */
          series.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
          patch.series = series;
          if (!m.id) m.id = U.uid('MT');   /* 兼容早期没有 id 的记录 */
          S.update('metrics', m.id, patch);
        }
        done(patch.name + ' · ' + U.fmtMD(date) + ' 数据已保存', 'analytics', 'kpi');
      }
    });
  });

  /* ================= 任务 ================= */
  Shell.onCreate('task.new', function () {
    var pid = S.state.projectId;
    var phs = S.DB.phases.filter(function (x) { return x.projectId === pid; })
      .map(function (x) { return { v: x.id, t: x.name }; });
    UI.formModal({
      title: '新建任务',
      wide: true,
      tip: '任务归属当前项目「' + U.esc((S.curProject() || {}).name || '') + '」，创建后可在看板中拖拽流转。',
      okText: '创建任务',
      fields: [
        { k: 'title', label: '任务标题', type: 'text', req: true, full: true, placeholder: '动词 + 对象，例如「完成对账单导出接口」' },
        { k: 'phaseId', label: '所属阶段', type: 'select', opts: phs, emptyText: '（未指定阶段）' },
        { k: 'type', label: '任务类型', type: 'select', req: true, opts: D.taskType, val: '后端' },
        { k: 'priority', label: '优先级', type: 'select', req: true, opts: D.priority, val: 'P1' },
        { k: 'status', label: '初始状态', type: 'select', req: true, opts: D.taskStatus, val: '待开始' },
        { k: 'owner', label: '负责人', type: 'select', req: true, opts: memberOpts() },
        { k: 'dept', label: '所属部门', type: 'select', req: true, opts: D.dept, val: '研发中心' },
        { k: 'start', label: '开始日期', type: 'date', req: true, val: today() },
        { k: 'due', label: '截止日期', type: 'date', req: true, val: plus(7) },
        { k: 'estHours', label: '预估工时（小时）', type: 'number', val: 24, min: 1 },
        { k: 'reqId', label: '关联需求', type: 'select', opts: reqOpts(), emptyText: '（不关联）' },
        { k: 'note', label: '任务说明', type: 'textarea', full: true, rows: 3 }
      ],
      onSubmit: function (d) {
        var pc = ctxOfProject(pid);
        var ph = S.DB.phases.filter(function (x) { return x.id === d.phaseId; })[0];
        var overdue = U.dayDiff(d.due, new Date()) > 0 && d.status !== '已完成';
        var obj = {
          id: U.uid('T'), title: d.title,
          projectId: pc.projectId, projectName: pc.projectName,
          phaseId: d.phaseId || '', phaseName: ph ? ph.name : '',
          type: d.type, status: d.status, priority: d.priority,
          owner: d.owner, dept: d.dept,
          start: d.start, due: d.due, doneAt: d.status === '已完成' ? today() : '',
          estHours: U.num(d.estHours, 24), realHours: 0,
          progress: d.status === '已完成' ? 1 : 0,
          overdue: overdue, delayDays: overdue ? U.dayDiff(d.due, new Date()) : 0,
          blockReason: d.status === '已阻塞' ? '待补充阻塞原因' : '',
          deps: [], reqId: d.reqId || '', reqTitle: nameOf(S.DB.requirements, d.reqId, 'title'),
          tags: [], comments: [], attachCount: 0, note: d.note || '', isNew: true
        };
        S.add('tasks', obj);
        done('任务 ' + obj.id + ' 已创建', 'tasks', 'list', obj.id);
      }
    });
  });

  /* ================= 会议纪要 ================= */
  Shell.onCreate('meeting.new', function () {
    UI.formModal({
      title: '新建会议纪要',
      wide: true,
      tip: '决策项与 Action Item 每行一条；Action 支持「内容 | 负责人 | 截止日」格式。',
      okText: '保存纪要',
      fields: [
        { k: 'title', label: '会议主题', type: 'text', req: true, full: true },
        { k: 'type', label: '会议类型', type: 'select', req: true, opts: D.meetType, val: '项目周会' },
        { k: 'projectId', label: '关联项目', type: 'select', opts: projectOpts(), val: S.state.projectId, emptyText: '（跨项目）' },
        { k: 'date', label: '会议日期', type: 'date', req: true, val: today() },
        { k: 'time', label: '会议时间', type: 'text', req: true, val: '14:00-15:30' },
        { k: 'place', label: '会议地点', type: 'text', val: '线上 · 腾讯会议' },
        { k: 'host', label: '主持人', type: 'select', req: true, opts: memberOpts(), val: S.roleObj().user.name },
        { k: 'attendees', label: '参会人', type: 'text', full: true, req: true, placeholder: '多个姓名用顿号或逗号分隔' },
        { k: 'agenda', label: '会议议程', type: 'textarea', full: true, rows: 3, placeholder: '每行一条议题' },
        { k: 'content', label: '会议内容', type: 'textarea', full: true, rows: 3 },
        { k: 'decisions', label: '决策项', type: 'textarea', full: true, rows: 3, placeholder: '每行一条决策' },
        { k: 'actions', label: 'Action Item', type: 'textarea', full: true, rows: 3, placeholder: '补充压测报告 | 孟星野 | ' + plus(7) }
      ],
      onSubmit: function (d) {
        var pc = ctxOfProject(d.projectId);
        var mid = U.uid('MT');
        var lines = function (s) { return (s || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean); };
        var actionIds = [];
        lines(d.actions).forEach(function (row) {
          var p = row.split('|').map(function (x) { return x.trim(); });
          var aid = U.uid('AI');
          var due = p[2] || plus(7);
          S.DB.actions.unshift({
            id: aid, meetingId: mid, meetingTitle: d.title,
            content: p[0], owner: p[1] || d.host, due: due, status: '待开始',
            projectId: pc.projectId, projectName: pc.projectName || '（跨项目）',
            overdue: U.dayDiff(due, new Date()) > 0, note: '', isNew: true
          });
          actionIds.push(aid);
        });
        var obj = {
          id: mid, title: d.title, type: d.type,
          projectId: pc.projectId, projectName: pc.projectName || '（跨项目）',
          lineId: pc.lineId, lineName: pc.lineName || '（多产品线）',
          date: d.date, time: d.time, place: d.place || '',
          host: d.host,
          attendees: (d.attendees || '').split(/[、,，;；\s]+/).filter(Boolean),
          absent: [], agenda: lines(d.agenda), content: d.content || '',
          decisions: lines(d.decisions).map(function (t) { return { text: t, by: d.host }; }),
          actionIds: actionIds, hasMinutes: true, isNew: true
        };
        S.add('meetings', obj);
        done('会议纪要 ' + obj.id + ' 已保存', 'meetings', 'list', obj.id);
      }
    });
  });

  /* ================= 风险登记 ================= */
  Shell.onCreate('risk.new', function () {
    UI.formModal({
      title: '登记风险',
      wide: true,
      tip: '等级为「高」的风险会立即出现在侧栏徽标与提醒中心。',
      okText: '登记风险',
      fields: [
        { k: 'title', label: '风险描述', type: 'text', req: true, full: true, placeholder: '现象 + 可能后果' },
        { k: 'type', label: '风险类型', type: 'select', req: true, opts: D.riskType, val: '进度风险' },
        { k: 'level', label: '风险等级', type: 'radio', req: true, opts: D.riskLevel, val: '中' },
        { k: 'prob', label: '发生概率', type: 'select', req: true, opts: D.riskLevel, val: '中' },
        { k: 'projectId', label: '关联项目', type: 'select', req: true, opts: projectOpts(), val: S.state.projectId },
        { k: 'owner', label: '责任人', type: 'select', req: true, opts: memberOpts() },
        { k: 'dueAt', label: '处理时限', type: 'date', req: true, val: plus(14) },
        { k: 'response', label: '应对策略', type: 'select', req: true, opts: ['规避', '减轻', '转移', '接受'], val: '减轻' },
        { k: 'impactDesc', label: '影响说明', type: 'textarea', full: true, rows: 2 },
        { k: 'plan', label: '缓解计划', type: 'textarea', full: true, rows: 3 }
      ],
      onSubmit: function (d) {
        var pc = ctxOfProject(d.projectId);
        var lv = d.level || '中';
        var obj = {
          id: U.uid('RK'), title: d.title, type: d.type, level: lv,
          projectId: pc.projectId, projectName: pc.projectName,
          lineId: pc.lineId, lineName: pc.lineName,
          status: '待评估', owner: d.owner,
          foundAt: today(), dueAt: d.dueAt,
          overdue: U.dayDiff(d.dueAt, new Date()) > 0,
          prob: d.prob, impact: lv, impactDesc: d.impactDesc || '',
          response: d.response, plan: d.plan || '',
          escalated: false, escalateTo: '',
          updates: [{ at: today(), by: S.roleObj().user.name, text: '风险登记，等待评估。' }],
          score: (lv === '高' ? 3 : lv === '中' ? 2 : 1) * 2, isNew: true
        };
        S.add('risks', obj);
        done('风险 ' + obj.id + ' 已登记', 'risks', 'ledger', obj.id);
      }
    });
  });

  /* ================= 版本计划 ================= */
  Shell.onCreate('release.new', function () {
    var defLine = defLineId();
    UI.formModal({
      title: '新建版本计划',
      wide: true,
      tip: '版本节奏由产品总监统一把控，创建后可在「发布时间线」中查看窗口冲突。',
      okText: '创建版本',
      fields: [
        { k: 'name', label: '版本名称', type: 'text', req: true, full: true, placeholder: '例如：供应链协同 V2.6.0' },
        { k: 'lineId', label: '所属产品线', type: 'select', req: true, opts: lineOpts(), val: defLine },
        { k: 'projectId', label: '归属项目', type: 'select', req: true, opts: projectOptsOfLine(defLine),
          val: S.state.projectId, depends: 'lineId', optsFor: projectOptsOfLine },
        { k: 'type', label: '版本类型', type: 'select', req: true, opts: D.relType, val: '功能版本' },
        { k: 'status', label: '当前状态', type: 'select', req: true, opts: D.relStatus, val: '规划中' },
        { k: 'owner', label: '版本负责人', type: 'select', req: true, opts: memberOpts() },
        { k: 'freezeDate', label: '需求冻结日', type: 'date', req: true, val: plus(14) },
        { k: 'planDate', label: '计划上线日', type: 'date', req: true, val: plus(30) },
        { k: 'scope', label: '版本范围', type: 'textarea', full: true, rows: 2, placeholder: '本版本包含的主要能力，逗号分隔' },
        { k: 'note', label: '备注', type: 'textarea', full: true, rows: 2 }
      ],
      onSubmit: function (d) {
        var pc = ctxOfProject(d.projectId);
        var lc = ctxOfLine(d.lineId);
        var obj = {
          id: U.uid('R'), name: d.name,
          lineId: lc.lineId, lineName: lc.lineName,
          projectId: pc.projectId, projectName: pc.projectName,
          type: d.type, status: d.status, owner: d.owner,
          freezeDate: d.freezeDate, planDate: d.planDate, realDate: '',
          progress: 0, reqCount: 0, bugCount: 0, blockCount: 0, delayDays: 0,
          risk: '低', scope: d.scope || '', note: d.note || '', isNew: true
        };
        S.add('releases', obj);
        done('版本 ' + obj.name + ' 已创建', 'releases', 'plan', obj.id);
      }
    });
  });

  /* ================= 规划项（路线图）================= */
  Shell.onCreate('roadmap.new', function () {
    var qs = ['2026Q1', '2026Q2', '2026Q3', '2026Q4', '2027Q1', '2027Q2'];
    UI.formModal({
      title: '新增规划项',
      wide: true,
      tip: '规划项会落在路线图对应季度的产品线泳道上。',
      okText: '加入路线图',
      fields: [
        { k: 'title', label: '规划项名称', type: 'text', req: true, full: true },
        { k: 'lineId', label: '所属产品线', type: 'select', req: true, opts: lineOpts(), val: defLineId() },
        { k: 'quarter', label: '目标季度', type: 'select', req: true, opts: qs, val: '2026Q4' },
        { k: 'type', label: '规划类型', type: 'select', req: true, opts: ['战略必做', '客户承诺', '体验优化', '技术投入'], val: '战略必做' },
        { k: 'priority', label: '优先级', type: 'select', req: true, opts: D.priority, val: 'P1' },
        { k: 'owner', label: '负责人', type: 'select', req: true, opts: memberOpts() },
        { k: 'value', label: '战略价值（1-10）', type: 'number', val: 5, min: 1, max: 10, help: 'valueScore' },
        { k: 'effort', label: '预估投入（人日）', type: 'number', val: 60, min: 1, help: 'effortScore' },
        { k: 'goal', label: '业务目标', type: 'text', full: true, placeholder: '例如：支撑头部客户续约' },
        { k: 'kpi', label: '衡量指标', type: 'text', full: true, placeholder: '例如：续约率 +4pt' }
      ],
      onSubmit: function (d) {
        var lc = ctxOfLine(d.lineId);
        var obj = {
          id: U.uid('RM'), lineId: lc.lineId, lineName: lc.lineName,
          title: d.title, quarter: d.quarter, status: '规划中', progress: 0,
          owner: d.owner, type: d.type, goal: d.goal || '', kpi: d.kpi || '',
          value: U.num(d.value, 8), effort: U.num(d.effort, 60), priority: d.priority,
          relatedReleases: [], isNew: true
        };
        S.add('roadmap', obj);
        done('规划项已加入 ' + d.quarter + ' 路线图', 'roadmap', 'map', obj.id);
      }
    });
  });

  /* ================= 经营复盘 ================= */
  Shell.onCreate('review.new', function () {
    UI.formModal({
      title: '发起复盘',
      wide: true,
      tip: '复盘创建后会自动带入本期目标达成数据，问题与归因可继续补充。',
      okText: '发起复盘',
      fields: [
        { k: 'type', label: '复盘类型', type: 'select', req: true, opts: D.reviewType, val: '月度复盘' },
        { k: 'period', label: '复盘周期', type: 'text', req: true, val: U.fmtDate(new Date(), 'YYYY-MM'), hint: '如 2026-08 / 2026Q3 / V2.6.0' },
        { k: 'lineId', label: '产品线范围', type: 'select', opts: lineOpts(), val: S.state.lineId, emptyText: '（全部产品线）' },
        { k: 'owner', label: '复盘负责人', type: 'select', req: true, opts: memberOpts(), val: S.roleObj().user.name },
        { k: 'date', label: '复盘日期', type: 'date', req: true, val: today() },
        { k: 'issues', label: '待复盘问题', type: 'textarea', full: true, rows: 3, placeholder: '每行一条问题' },
        { k: 'summary', label: '复盘结论', type: 'textarea', full: true, rows: 3 }
      ],
      onSubmit: function (d) {
        var lc = ctxOfLine(d.lineId);
        var rels = S.releaseOnTime('line');
        var flow = S.reqFlow('line');
        var obj = {
          id: U.uid('RV'), title: d.period + ' ' + d.type, type: d.type, period: d.period,
          lineId: lc.lineId, lineName: lc.lineName, owner: d.owner,
          date: d.date, status: '进行中', goalRate: rels.rate,
          goals: [
            { name: 'ARR 目标', target: 660, actual: 0, unit: '万' },
            { name: '版本按期率', target: 90, actual: rels.rate, unit: '%' },
            { name: '需求交付量', target: 28, actual: flow.throughput, unit: '个' },
            { name: '线上事故', target: 0, actual: 0, unit: '起', lowerBetter: true }
          ],
          issues: (d.issues || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean),
          causes: [], actions: [], summary: d.summary || '', isNew: true
        };
        S.add('reviews', obj);
        done('复盘 ' + obj.title + ' 已发起', 'bizreview', 'list', obj.id);
      }
    });
  });

  /* ================= 变更申请 ================= */
  Shell.onCreate('change.new', function () {
    UI.formModal({
      title: '提交变更申请',
      wide: true,
      tip: '变更提交后进入「待审批」，审批人默认取当前项目的项目经理。',
      okText: '提交申请',
      fields: [
        { k: 'reqId', label: '关联需求', type: 'select', req: true, opts: reqOpts() },
        { k: 'title', label: '变更标题', type: 'text', req: true, full: true, placeholder: '例如：调整「对账单导出」的字段范围' },
        { k: 'reason', label: '变更原因', type: 'select', req: true, opts: D.changeReason, val: '客户新增诉求' },
        { k: 'applicant', label: '申请人', type: 'select', req: true, opts: memberOpts(), val: S.roleObj().user.name },
        { k: 'impactDays', label: '工期影响（天）', type: 'number', val: 3, min: 0 },
        { k: 'impactCost', label: '成本影响（人日）', type: 'number', val: 5, min: 0 },
        { k: 'impactRisk', label: '风险影响', type: 'select', req: true, opts: D.riskLevel, val: '中' },
        { k: 'impactScope', label: '影响范围', type: 'select', req: true, opts: ['仅本需求内部调整', '影响同版本 2 个需求', '影响下游 1 个接口', '影响测试用例与验收标准', '影响客户交付承诺'], val: '仅本需求内部调整' },
        { k: 'detail', label: '变更说明', type: 'textarea', full: true, rows: 3 }
      ],
      onSubmit: function (d) {
        var q = S.reqBy(d.reqId) || {};
        var p = S.projBy(q.projectId) || S.curProject() || {};
        var obj = {
          id: U.uid('CG'), title: d.title,
          reqId: q.id || '', reqTitle: q.title || '',
          projectId: q.projectId || p.id, projectName: q.projectName || p.name,
          lineId: q.lineId || p.lineId, lineName: q.lineName || p.lineName,
          releaseId: q.releaseId || '',
          reason: d.reason, status: '待审批',
          applicant: d.applicant, applyAt: today(),
          impactScope: d.impactScope,
          impactDays: U.num(d.impactDays, 0), impactCost: U.num(d.impactCost, 0), impactRisk: d.impactRisk,
          approver: p.pm || S.roleObj().user.name, approveAt: '', opinion: '',
          detail: d.detail || '',
          history: [{ at: today(), by: d.applicant, text: '提交变更申请' }],
          isNew: true
        };
        S.add('changes', obj);
        done('变更 ' + obj.id + ' 已提交审批', 'changes', 'list', obj.id);
      }
    });
  });

  /* ================= 交付物 ================= */
  Shell.onCreate('delivery.new', function () {
    UI.formModal({
      title: '登记交付物',
      wide: true,
      tip: '交付物验收通过后可一键归档，归档记录进入「工作留痕」。',
      okText: '登记交付物',
      fields: [
        { k: 'name', label: '交付物名称', type: 'text', req: true, full: true },
        { k: 'type', label: '交付物类型', type: 'select', req: true, opts: D.deliverType, val: '产品文档' },
        { k: 'projectId', label: '归属项目', type: 'select', req: true, opts: projectOpts(), val: S.state.projectId },
        { k: 'status', label: '当前状态', type: 'select', req: true, opts: D.deliverStatus, val: '未开始' },
        { k: 'owner', label: '负责人', type: 'select', req: true, opts: memberOpts() },
        { k: 'version', label: '版本号', type: 'text', val: 'V1.0' },
        { k: 'planDate', label: '计划交付日', type: 'date', req: true, val: plus(14) },
        { k: 'releaseId', label: '关联版本', type: 'select', opts: releaseOpts(), emptyText: '（不关联）' },
        { k: 'docLink', label: '文档位置', type: 'text', full: true, placeholder: '/archive/...' }
      ],
      onSubmit: function (d) {
        var pc = ctxOfProject(d.projectId);
        var obj = {
          id: U.uid('DV'), name: d.name, type: d.type,
          projectId: pc.projectId, projectName: pc.projectName,
          lineId: pc.lineId, lineName: pc.lineName,
          releaseId: d.releaseId || '', status: d.status, owner: d.owner,
          version: d.version || 'V1.0', planDate: d.planDate, realDate: '',
          acceptBy: '', acceptAt: '', acceptResult: '',
          docLink: d.docLink || ('/archive/' + pc.projectId + '/new'), size: '—',
          archived: false, isNew: true
        };
        S.add('deliverables', obj);
        done('交付物 ' + obj.id + ' 已登记', 'delivery', 'items', obj.id);
      }
    });
  });

  /* ================= 周报 / 月报 ================= */
  Shell.onCreate('report.new', function () {
    var pid = S.state.projectId;
    var st = S.projectStat(pid);
    var wr = U.weekRange(new Date());
    var doneTasks = S.tasks().filter(function (t) { return t.status === '已完成' && U.inRange(t.doneAt, wr[0], wr[1]); });
    var hi = doneTasks.slice(0, 5).map(function (t) { return '完成「' + t.title + '」'; });
    var rk = S.risks('project').filter(function (r) { return ['已缓解', '已关闭'].indexOf(r.status) < 0; });
    UI.formModal({
      title: '生成周报',
      wide: true,
      tip: '亮点、风险与下周计划已按当前项目数据自动汇总，可直接编辑后保存。',
      okText: '生成周报',
      fields: [
        { k: 'type', label: '报告类型', type: 'radio', req: true, opts: ['周报', '月报'], val: '周报' },
        { k: 'periodText', label: '报告周期', type: 'text', req: true, val: U.fmtDate(wr[0], 'MM-DD') + ' ~ ' + U.fmtDate(wr[1], 'MM-DD') },
        { k: 'author', label: '编写人', type: 'select', req: true, opts: memberOpts(), val: S.roleObj().user.name },
        { k: 'progress', label: '实际进度（%）', type: 'number', req: true, val: Math.round(st.progress * 100), min: 0, max: 100 },
        { k: 'planProgress', label: '计划进度（%）', type: 'number', req: true, val: Math.min(100, Math.round(st.progress * 100) + 5), min: 0, max: 100 },
        { k: 'highlights', label: '本期亮点', type: 'textarea', full: true, rows: 4, val: hi.join('\n') || '本期无已完成任务' },
        { k: 'risks', label: '风险与问题', type: 'textarea', full: true, rows: 3, val: rk.slice(0, 4).map(function (r) { return '[' + r.level + '] ' + r.title; }).join('\n') },
        { k: 'nextPlan', label: '下期计划', type: 'textarea', full: true, rows: 3, placeholder: '每行一条' },
        { k: 'summary', label: '总体结论', type: 'textarea', full: true, rows: 2 }
      ],
      onSubmit: function (d) {
        var pc = ctxOfProject(pid);
        var lines = function (s) { return (s || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean); };
        var obj = {
          id: U.uid('RP'), type: d.type,
          period: d.type === '周报' ? U.weekOf(wr[0]) : U.monthOf(new Date()),
          periodText: d.periodText,
          projectId: pc.projectId, projectName: pc.projectName, author: d.author,
          createAt: today(), status: '草稿',
          progress: U.num(d.progress, 0), planProgress: U.num(d.planProgress, 0),
          doneCount: st.taskDone, openCount: st.taskOpen,
          delayCount: st.taskDelay, riskCount: st.riskOpen,
          highlights: lines(d.highlights), risks: lines(d.risks), nextPlan: lines(d.nextPlan),
          summary: d.summary || '', isNew: true
        };
        S.add('reports', obj);
        done(d.type + ' ' + obj.id + ' 已生成', 'reports', d.type === '周报' ? 'weekly' : 'monthly', obj.id);
      }
    });
  });

  /* ================= 待办 ================= */
  Shell.onCreate('todo.new', function () {
    UI.formModal({
      title: '新增待办',
      tip: '待办仅属于当前角色视角，切换角色后看到的是另一份清单。',
      okText: '添加待办',
      fields: [
        { k: 'title', label: '待办事项', type: 'text', req: true, full: true },
        { k: 'priority', label: '优先级', type: 'select', req: true, opts: D.priority, val: 'P1' },
        { k: 'due', label: '截止日期', type: 'date', req: true, val: plus(3) },
        { k: 'remind', label: '到期提醒', type: 'radio', opts: [{ v: '1', t: '开启' }, { v: '', t: '关闭' }], val: '1' },
        { k: 'note', label: '备注', type: 'textarea', full: true, rows: 2 }
      ],
      onSubmit: function (d) {
        var obj = {
          id: U.uid('TD'), title: d.title, role: S.role(),
          priority: d.priority, due: d.due, status: '待开始',
          overdue: U.dayDiff(d.due, new Date()) > 0,
          from: '手动创建', refType: '', refId: '',
          note: d.note || '', remind: !!d.remind,
          owner: S.roleObj().user.name, isNew: true
        };
        S.add('todos', obj);   // 走 S.add 才会落本地存储
        done('待办已添加', 'todos', 'mine', obj.id);
      }
    });
  });

  /* ================= 骨架对象：产品线 / 项目 / 成员 =================
     空库时这三样必须能建出来，否则一条需求都挂不上去。
     它们不参与随机生成，全部由你手填。 */

  function padN(n, w) { var s = String(n); while (s.length < (w || 2)) s = '0' + s; return s; }
  function nextId(coll, prefix, width) {
    var max = 0;
    (S.DB[coll] || []).forEach(function (x) {
      var m = String(x.id || '').match(new RegExp('^' + prefix + '(\\d+)$'));
      if (m) max = Math.max(max, +m[1]);
    });
    return prefix + padN(max + 1, width || 2);
  }

  /* ---- 产品线 ---- */
  Shell.onCreate('line.new', function () {
    UI.formModal({
      title: '新建产品线', wide: true,
      tip: '产品线是最外层的容器：项目、需求、版本、经营指标都归属到某一条产品线。空库时请先建它。',
      okText: '创建产品线',
      fields: [
        { k: 'name', label: '产品线名称', type: 'text', req: true, placeholder: '如：智慧供应链云' },
        { k: 'code', label: '英文代号', type: 'text', placeholder: '如：SCM Cloud', hint: '用于图表与导出时的简称，可留空' },
        { k: 'owner', label: '产品负责人', type: 'select', req: true, opts: memberOpts(), val: S.roleObj().user.name },
        { k: 'pm', label: '项目负责人', type: 'select', opts: memberOpts(), emptyText: '（暂未指定）' },
        { k: 'stage', label: '所处阶段', type: 'select', req: true, opts: ['探索期', '成长期', '成熟期', '衰退期'], val: '成长期' },
        { k: 'started', label: '启动时间', type: 'text', placeholder: 'YYYY-MM', val: U.fmtDate(new Date(), 'YYYY-MM') },
        { k: 'headcount', label: '投入人数', type: 'number', val: 0, min: 0 },
        { k: 'budget', label: '年度预算（万元）', type: 'number', val: 0, min: 0 },
        { k: 'used', label: '已使用预算（万元）', type: 'number', val: 0, min: 0 },
        /* 健康度不给填：它由 S.lineStat 按「未闭环风险」实时算出来。
           新建时一条风险都还没有，必然是「低」，给个输入框只会让人误以为能定。 */
        { k: 'health', label: '健康度（风险等级）', type: 'static', help: 'lineHealth',
          html: '<span class="light light-g">低风险</span><span class="muted" style="margin-left:8px">自动计算 · 新建时还没有风险，登记风险后会自动变化</span>' },
        { k: 'goal', label: '年度目标', type: 'textarea', full: true, rows: 2, placeholder: '一句可量化的目标，如：ARR 突破 8000 万，头部客户续约率 ≥ 92%' },
        { k: 'desc', label: '产品线简介', type: 'textarea', full: true, rows: 3, placeholder: '面向谁、解决什么问题、覆盖哪些能力' }
      ],
      onSubmit: function (d) {
        var obj = {
          id: nextId('lines', 'L'), name: d.name, code: d.code || '',
          owner: d.owner, pm: d.pm || d.owner, stage: d.stage,
          started: d.started || U.fmtDate(new Date(), 'YYYY-MM'),
          desc: d.desc || '', goal: d.goal || '',
          budget: U.num(d.budget, 0), used: U.num(d.used, 0),
          /* 不写 health：由 S.lineStat 实时算，存一份就是第二真相源 */
          headcount: U.num(d.headcount, 0), isNew: true
        };
        S.add('lines', obj);
        S.setLine(obj.id);
        done('产品线「' + obj.name + '」已创建，口径已切到它', 'roadmap', 'lines', obj.id);
      }
    });
  });

  /* ---- 项目 ---- */
  Shell.onCreate('project.new', function () {
    if (!S.DB.lines.length) {
      UI.confirm('还没有任何产品线，项目必须挂在产品线下。要先去建一条产品线吗？', function () {
        Shell.create('line.new');
      }, { title: '先建产品线', okText: '去建产品线' });
      return;
    }
    var PH = ['需求调研', '方案设计', '开发实现', '联调测试', '上线交付'];
    UI.formModal({
      title: '新建项目', wide: true,
      tip: '项目是项目经理视角的口径单位：任务、阶段、里程碑、交付物、周报都归属到某一个项目。',
      okText: '创建项目',
      fields: [
        { k: 'name', label: '项目名称', type: 'text', req: true, full: true, placeholder: '如：供应链协同 2.0' },
        { k: 'lineId', label: '所属产品线', type: 'select', req: true, opts: lineOpts(), val: S.state.lineId || S.DB.lines[0].id },
        { k: 'pm', label: '项目经理', type: 'select', req: true, opts: memberOpts(), val: S.isPM() ? S.roleObj().user.name : '' },
        { k: 'sponsor', label: '项目发起人', type: 'select', opts: memberOpts(), emptyText: '（暂未指定）' },
        { k: 'status', label: '项目状态', type: 'select', req: true, opts: D.projStatus, val: '规划中' },
        { k: 'start', label: '开始日期', type: 'date', req: true, val: today() },
        { k: 'end', label: '计划结束日期', type: 'date', req: true, val: plus(90) },
        { k: 'members', label: '团队规模（人）', type: 'number', val: 0, min: 0 },
        { k: 'budget', label: '项目预算（万元）', type: 'number', val: 0, min: 0 },
        { k: 'customer', label: '主要客户 / 干系人', type: 'text', placeholder: '可留空' },
        { k: 'desc', label: '项目目标', type: 'textarea', full: true, rows: 3, placeholder: '这个项目要交付什么、成功的判定标准是什么' },
        {
          k: 'phases', label: '同时创建标准阶段', type: 'radio',
          opts: [{ v: '1', t: '创建（' + PH.join(' / ') + '）' }, { v: '', t: '暂不创建' }], val: '1',
          full: true, hint: '阶段会按开始/结束日期均分，之后可在「项目计划 → 阶段划分」里逐个调整'
        }
      ],
      onSubmit: function (d) {
        var lc = ctxOfLine(d.lineId);
        var obj = {
          id: nextId('projects', 'P'), name: d.name,
          lineId: lc.lineId, lineName: lc.lineName,
          status: d.status, pm: d.pm, sponsor: d.sponsor || d.pm,
          start: d.start, end: d.end, progress: 0, desc: d.desc || '',
          budget: U.num(d.budget, 0), used: 0, members: U.num(d.members, 0),
          health: '低', customer: d.customer || '', isNew: true
        };
        S.add('projects', obj);
        if (d.phases) makePhases(obj, PH);
        S.setProject(obj.id);
        done('项目「' + obj.name + '」已创建，口径已切到它', 'collab', 'board', obj.id);
      }
    });
  });

  /* 按项目起止日期均分出标准阶段与同名里程碑（只有骨架，进度全部为 0） */
  function makePhases(p, names) {
    var span = Math.max(U.dayDiff(p.start, p.end), names.length);
    var seg = Math.floor(span / names.length);
    names.forEach(function (nm, i) {
      var s = U.fmtDate(U.addDay(p.start, i * seg), 'YYYY-MM-DD');
      var e = U.fmtDate(U.addDay(p.start, i === names.length - 1 ? span : (i + 1) * seg - 1), 'YYYY-MM-DD');
      S.DB.phases.push({
        id: p.id + '-PH' + (i + 1), projectId: p.id, projectName: p.name, name: nm, order: i + 1,
        start: s, end: e, status: '未开始', progress: 0, owner: p.pm,
        goal: '', deps: i === 0 ? [] : [p.id + '-PH' + i]
      });
      S.DB.milestones.push({
        id: p.id + '-MS' + (i + 1), projectId: p.id, projectName: p.name,
        phaseId: p.id + '-PH' + (i + 1), name: nm + '完成', date: e, owner: p.pm,
        status: '未开始', criteria: '', deliverables: 0
      });
    });
    S.persist();
  }

  /* ---- 成员 ---- */
  Shell.onCreate('member.new', function () {
    UI.formModal({
      title: '添加成员', wide: true,
      tip: '成员表是所有「负责人 / 处理人」下拉框的数据源。先把常打交道的人录进来，后面填单会快很多。',
      okText: '添加成员',
      fields: [
        { k: 'name', label: '姓名', type: 'text', req: true },
        { k: 'dept', label: '部门', type: 'text', placeholder: '如：研发中心' },
        { k: 'title', label: '职位', type: 'text', placeholder: '如：后端工程师' },
        {
          k: 'func', label: '职能', type: 'select', req: true, val: 'be',
          opts: [
            { v: 'director', t: '产品总监' }, { v: 'pm', t: '项目经理' }, { v: 'po', t: '产品经理' },
            { v: 'ux', t: '设计' }, { v: 'fe', t: '前端' }, { v: 'be', t: '后端' },
            { v: 'qa', t: '测试' }, { v: 'da', t: '数据分析' }, { v: 'de', t: '数据工程' },
            { v: 'ops', t: '运维' }, { v: 'mkt', t: '市场' }, { v: 'cs', t: '客户成功' }, { v: 'legal', t: '法务合规' }
          ]
        },
        { k: 'capacity', label: '周可用工时', type: 'number', val: 40, min: 1, hint: '用于「资源协调 → 工时负载」计算超载' },
        { k: 'email', label: '邮箱', type: 'text', placeholder: '可留空' }
      ],
      onSubmit: function (d) {
        if (S.memBy(d.name)) { UI.toast('已存在同名成员「' + d.name + '」', 'err'); return; }
        var obj = {
          id: nextId('members', 'M'), name: d.name, dept: d.dept || '', title: d.title || '',
          func: d.func, loadPct: 0, capacity: U.num(d.capacity, 40), allocHours: 0,
          efficiency: 1, taskDone: 0, taskOpen: 0, taskDelay: 0, onlineDays: 0,
          email: d.email || '', skills: [], projects: [], weekHours: 0, conflict: false, isNew: true
        };
        S.add('members', obj);
        done('成员「' + obj.name + '」已添加', 'team', 'members', obj.id);
      }
    });
  });

  /* ================= 启动 ================= */
  function boot() {
    try {
      document.body.setAttribute('data-role', S.role());
      Shell.init();
      if (window.G && G.boot) G.boot();
      setTimeout(function () {
        var c = document.getElementById('content');
        if (c && !c.innerHTML.trim() && window.Shell && Shell.route) Shell.route();
      }, 1000);
    } catch (err) {
      var el = document.getElementById('content');
      if (el) {
        el.innerHTML = '<div style="padding:24px;color:#991b1b;background:#fff;border:1px solid #fecaca;margin:24px;border-radius:8px">' +
          '<b>工作台启动失败</b><br><br>' +
          '<code>' + U.esc(err && err.message ? err.message : String(err)) + '</code>' +
          '</div>';
      }
      if (window.console) console.error(err);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
