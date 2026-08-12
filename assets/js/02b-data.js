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
  var ROLE_SELF = {
    director: { id: 'M_DIRECTOR', fallback: '产品总监', func: 'director', title: '产品总监' },
    pm: { id: 'M_PM', fallback: '项目经理', func: 'pm', title: '项目经理' }
  };

  function today() { return new Date(); }

  /* 空库：结构与 SEED 一致，内容全空。
     唯一预置的是「你自己」——两个角色的账号必须存在于成员表，
     否则所有「负责人」下拉框都是空的，一条数据都建不出来。 */
  function blank() {
    var db = {
      TODAY: today(), quarters: quartersOf(today()),
      org: { name: '我的组织', bu: '' },
      me: { name: '' },                    // 兼容旧版导出；运行时以 meByRole 为准
      meByRole: {
        director: { name: '' },
        pm: { name: '' }
      }
    };
    COLLS.forEach(function (k) { db[k] = []; });
    db.members = selfMembers(db.meByRole);
    return db;
  }

  function roleName(meByRole, role) {
    var n = meByRole && meByRole[role] && meByRole[role].name;
    return String(n || '').trim();
  }
  function selfMember(role, name) {
    var def = ROLE_SELF[role];
    return {
      id: def.id, name: name || def.fallback, dept: '', title: def.title,
      func: def.func,
      loadPct: 0, capacity: 40, allocHours: 0, efficiency: 1,
      taskDone: 0, taskOpen: 0, taskDelay: 0, onlineDays: 0,
      email: '', skills: [], projects: [], weekHours: 0, conflict: false
    };
  }
  /* 两个登录角色各有自己的默认成员，避免共享同一个「我」。 */
  function selfMembers(meByRole) {
    return [
      selfMember('director', roleName(meByRole, 'director')),
      selfMember('pm', roleName(meByRole, 'pm'))
    ];
  }
  function ensureMeByRole(raw, db) {
    raw = raw || {};
    var legacyName = raw.me && typeof raw.me === 'object' ? String(raw.me.name || '').trim() : '';
    var m = raw.meByRole && typeof raw.meByRole === 'object' ? raw.meByRole : {};
    db.meByRole = {
      director: { name: String((m.director && m.director.name) || legacyName || '').trim() },
      pm: { name: String((m.pm && m.pm.name) || '').trim() }
    };
    db.me = { name: db.meByRole.director.name };
  }
  function ensureRoleMembers(db, rawMembers) {
    var out = [], seen = {};
    var directorSelf = selfMember('director', roleName(db.meByRole, 'director'));
    var pmSelf = selfMember('pm', roleName(db.meByRole, 'pm'));
    [directorSelf, pmSelf].forEach(function (m) { out.push(m); seen[m.id] = true; });
    (rawMembers || []).forEach(function (m) {
      if (!m || typeof m !== 'object') return;
      if (m.id === 'M01' || m.id === directorSelf.id || m.id === pmSelf.id) return;
      if (seen[m.id]) return;
      seen[m.id] = true;
      out.push(m);
    });
    db.members = out;
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
      ensureMeByRole(raw, db);
      ensureRoleMembers(db, Array.isArray(raw.members) ? raw.members : []);
    }
    return pack(db);
  }

  /* 只序列化集合与 org / me，不存 TODAY（它每次开机重算） */
  function pack(db) {
    var out = { org: db.org, me: db.me, meByRole: db.meByRole };
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
    var db = normalize(d);
    U.save(DB_KEY, db);
    if (window.CLOUD && CLOUD.queueSave) CLOUD.queueSave(db);
    var n = hit.reduce(function (s, k) { return s + d[k].length; }, 0);
    return { ok: true, msg: '已导入 ' + hit.length + ' 类共 ' + n + ' 条记录' };
  }

  function clearReal() {
    var db = blank();
    var payload = pack(db);
    U.save(DB_KEY, payload);
    if (window.CLOUD && CLOUD.queueSave) CLOUD.queueSave(payload);
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
