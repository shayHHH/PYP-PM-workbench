/* ==========================================================================
   02b-data · 本地数据仓与持久化
   --------------------------------------------------------------------------
   这是一个真实使用的工具，不是演示原型：

     · 开箱是一个空库，一条假数据都没有。
     · 你录进去的每一条东西立刻写进浏览器 localStorage（键名 pmw.db），
       刷新、关机、下次打开都还在。
     · 数据只存在你这台电脑的这个浏览器里，不上传任何服务器。
       换电脑 / 换浏览器要靠「数据管理」里的导出 JSON + 导入。

   注意 localStorage 会被「清除浏览数据」抹掉，所以导出备份是唯一的保险。
   ========================================================================== */
window.DATA = (function () {
  'use strict';

  var DB_KEY = 'db';             // 你的全部业务数据
  var SETUP_KEY = 'setupDone';   // 上手清单里被手动标记完成的步骤
  var SEEN_KEY = 'welcomeSeen';  // 是否看过首次引导

  /* 所有集合名。少一个键，对应模块取数时就会 undefined.filter 崩掉。 */
  var COLLS = [
    'lines', 'projects', 'members', 'releases', 'requirements',
    'phases', 'milestones', 'tasks', 'risks', 'issues',
    'meetings', 'actions', 'feedbacks', 'changes', 'deliverables',
    'metrics', 'funnel', 'retention', 'roadmap', 'okrs',
    'reviews', 'reports', 'cross', 'traces', 'todos',
    'notes', 'notices', 'allocs', 'submissions'
  ];

  function today() { return new Date(); }

  /* 空库：结构与 SEED 一致，内容全空。
     唯一预置的是「你自己」——两个角色的账号必须存在于成员表，
     否则所有「负责人」下拉框都是空的，一条数据都建不出来。 */
  function blank() {
    var db = {
      TODAY: today(), quarters: quartersOf(today()),
      org: { name: '我的组织', bu: '' },
      me: { name: '' }                     // 你的真实姓名，在「上手引导」里填
    };
    COLLS.forEach(function (k) { db[k] = []; });
    db.members = selfMembers();
    return db;
  }

  /* 成员表里必须至少有「你自己」一条，否则所有负责人下拉框都是空的，
     一条业务数据都建不出来。名字没填就先叫「我」，填了会同步改过来。 */
  function selfMembers(name) {
    return [{
      id: 'M01', name: name || '我', dept: '', title: '',
      func: 'pm',
      loadPct: 0, capacity: 40, allocHours: 0, efficiency: 1,
      taskDone: 0, taskOpen: 0, taskDelay: 0, onlineDays: 0,
      email: '', skills: [], projects: [], weekHours: 0, conflict: false
    }];
  }

  /* 以当前季度为中心，给出前后共 5 个季度标签 */
  function quartersOf(d) {
    var y = d.getFullYear(), q = Math.floor(d.getMonth() / 3) + 1, out = [];
    var yy = y, qq = q - 2;
    while (qq < 1) { qq += 4; yy -= 1; }
    for (var i = 0; i < 5; i++) {
      out.push(yy + 'Q' + qq);
      qq++; if (qq > 4) { qq = 1; yy++; }
    }
    return out;
  }

  function seen() { return !!U.load(SEEN_KEY, 0); }
  function markSeen() { U.save(SEEN_KEY, 1); }

  /* ============ 读写 ============ */
  function readReal() {
    var raw = U.load(DB_KEY, null);
    var db = normalize(raw);
    db.TODAY = today();
    db.quarters = quartersOf(today());
    return db;
  }

  function normalize(raw) {
    var db = blank();
    if (raw && typeof raw === 'object') {
      COLLS.forEach(function (k) {
        if (Array.isArray(raw[k])) db[k] = raw[k];
      });
      if (raw.org && typeof raw.org === 'object') db.org = raw.org;
      if (raw.me && typeof raw.me === 'object') db.me = raw.me;
      /* members 允许为空数组（用户自己删光了），但至少要有自己 */
      if (!db.members.length) db.members = selfMembers(db.me.name);
    }
    return pack(db);
  }

  /* 只序列化集合与 org / me，不存 TODAY（它每次开机重算） */
  function pack(db) {
    var out = { org: db.org, me: db.me };
    COLLS.forEach(function (k) { out[k] = db[k] || []; });
    return out;
  }

  var current = null;

  function load() {
    current = readReal();
    return current;
  }
  /* 每次增删改都会调用，写整库。数据量在几千条以内，整写足够快且最不容易出错。 */
  function save() {
    if (!current) return false;
    var payload = pack(current);
    U.save(DB_KEY, payload);
    if (window.CLOUD && CLOUD.queueSave) CLOUD.queueSave(payload);
    return true;
  }

  /* ============ 是否还是一张白纸 ============ */
  /* 判断依据只看「用户真正会录的东西」，不看 members（那是预置的自己） */
  var CORE = ['lines', 'projects', 'requirements', 'releases', 'tasks',
    'risks', 'meetings', 'feedbacks', 'roadmap', 'todos'];
  function isEmpty(db) {
    db = db || current || {};
    return !CORE.some(function (k) { return (db[k] || []).length > 0; });
  }
  function counts(db) {
    db = db || current || {};
    var o = {};
    COLLS.forEach(function (k) { o[k] = (db[k] || []).length; });
    return o;
  }

  /* ============ 备份：导出 / 导入 / 清空 ============ */
  function exportJSON() {
    var payload = {
      _app: '产品管理工作台', _ver: 1,
      _exportedAt: U.fmtDate(new Date(), 'YYYY-MM-DD HH:mm:ss'),
      data: pack(current || readReal())
    };
    U.exportJSON('工作台数据备份-' + U.fmtDate(new Date(), 'YYYYMMDD'), payload);
  }

  /* 返回 {ok, msg}；不直接 reload，由调用方确认后再刷新 */
  function importJSON(text) {
    var obj;
    try { obj = JSON.parse(text); }
    catch (e) { return { ok: false, msg: '不是合法的 JSON 文件：' + e.message }; }
    var d = obj && obj.data ? obj.data : obj;
    if (!d || typeof d !== 'object') return { ok: false, msg: '文件里没有找到数据对象' };
    var hit = COLLS.filter(function (k) { return Array.isArray(d[k]); });
    if (!hit.length) return { ok: false, msg: '文件里没有任何可识别的集合（lines / projects / requirements …）' };
    var db = blank();
    hit.forEach(function (k) { db[k] = d[k]; });
    if (d.org) db.org = d.org;
    if (d.me) db.me = d.me;
    if (!db.members.length) db.members = selfMembers(db.me.name);
    U.save(DB_KEY, pack(db));
    if (window.CLOUD && CLOUD.queueSave) CLOUD.queueSave(pack(db));
    var n = hit.reduce(function (s, k) { return s + d[k].length; }, 0);
    return { ok: true, msg: '已导入 ' + hit.length + ' 类共 ' + n + ' 条记录' };
  }

  function clearReal() {
    var db = blank();
    U.save(DB_KEY, pack(db));
    if (window.CLOUD && CLOUD.queueSave) CLOUD.queueSave(pack(db));
  }

  /* ============ 上手清单的手动完成标记 ============ */
  function setupFlags() { return U.load(SETUP_KEY, {}) || {}; }
  function markStep(k, on) {
    var f = setupFlags();
    if (on === false) delete f[k]; else f[k] = 1;
    U.save(SETUP_KEY, f);
  }

  return {
    COLLS: COLLS, CORE: CORE,
    blank: blank, normalize: normalize, load: load, save: save,
    seen: seen, markSeen: markSeen,
    isEmpty: isEmpty, counts: counts,
    exportJSON: exportJSON, importJSON: importJSON, clearReal: clearReal,
    setupFlags: setupFlags, markStep: markStep,
    quartersOf: quartersOf
  };
})();
