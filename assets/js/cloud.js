/* ==========================================================================
   cloud · 访问码登录与 Supabase Edge Function 同步
   ========================================================================== */
window.CLOUD = (function () {
  'use strict';

  var CFG = {
    functionUrl: 'https://jtbcuxekwpglxygtrkgc.supabase.co/functions/v1/pmw-api',
    anonKey: 'sb_publishable__XbWTc0mtkD4hLMAjVk6_g_gvSu2-Oa'
  };

  var SESSION_KEY = 'pmw-cloud.session';
  var STATUS_KEY = 'pmw-cloud.status';
  var timer = null;
  var saving = false;
  var queued = null;

  function now() { return new Date().toISOString(); }
  function ready() { return /^https:\/\/.+\.supabase\.co\/functions\/v1\/pmw-api$/.test(CFG.functionUrl); }
  function prefix(role) { return role === 'pm' ? 'pmw-pm.' : 'pmw.'; }

  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch (e) { return null; }
  }
  function setSession(s) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s || null));
  }
  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }
  function setStatus(status, msg) {
    localStorage.setItem(STATUS_KEY, JSON.stringify({ status: status, msg: msg || '', at: now() }));
  }
  function normalizeData(data) {
    if (window.DATA && DATA.normalize) return DATA.normalize(data);
    return data || {};
  }

  function writeRoleCache(role, data) {
    localStorage.setItem(prefix(role) + 'db', JSON.stringify(normalizeData(data)));
  }

  function request(action, body) {
    if (!ready()) return Promise.reject(new Error('还没有配置 Supabase Function URL'));
    var headers = { 'Content-Type': 'application/json' };
    if (CFG.anonKey) {
      headers.apikey = CFG.anonKey;
      headers.Authorization = 'Bearer ' + CFG.anonKey;
    }
    return fetch(CFG.functionUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(Object.assign({ action: action }, body || {}))
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok || data.ok === false) throw new Error(data.msg || ('请求失败：' + res.status));
        return data;
      });
    });
  }

  function login(code) {
    return request('login', { code: String(code || '').trim() }).then(function (res) {
      var s = {
        token: res.token,
        role: res.role,
        workspaceId: res.workspaceId,
        workspaceName: res.workspaceName,
        version: res.version || 1,
        expiresAt: res.expiresAt,
        at: now()
      };
      setSession(s);
      writeRoleCache(res.role, res.data || {});
      setStatus('ok', '已登录并加载云端数据');
      return res;
    });
  }

  function load() {
    var s = getSession();
    if (!s || !s.token) return Promise.reject(new Error('未登录'));
    return request('load', { token: s.token }).then(function (res) {
      s.role = res.role || s.role;
      s.workspaceId = res.workspaceId || s.workspaceId;
      s.workspaceName = res.workspaceName || s.workspaceName;
      s.version = res.version || s.version || 1;
      setSession(s);
      writeRoleCache(s.role, res.data || {});
      setStatus('ok', '已加载云端数据');
      return res;
    });
  }

  function save(data) {
    var s = getSession();
    if (!s || !s.token) return Promise.resolve({ ok: false, skipped: true });
    if (saving) { queued = data; return Promise.resolve({ ok: false, queued: true }); }
    saving = true;
    setStatus('saving', '正在同步云端');
    return request('save', {
      token: s.token,
      version: s.version || 1,
      data: data || {}
    }).then(function (res) {
      s.version = res.version || s.version || 1;
      setSession(s);
      setStatus('ok', '云端已同步');
      return res;
    }).catch(function (err) {
      setStatus('err', err.message || '云端同步失败');
      throw err;
    }).finally(function () {
      saving = false;
      if (queued) {
        var next = queued;
        queued = null;
        save(next);
      }
    });
  }

  function queueSave(data) {
    clearTimeout(timer);
    timer = setTimeout(function () {
      save(data).catch(function (err) { console.warn('[cloud] save failed:', err.message || err); });
    }, 700);
  }

  function logout() {
    var s = getSession();
    clearSession();
    if (s && s.token) request('logout', { token: s.token }).catch(function () { });
  }

  function requireRole(role) {
    var s = getSession();
    if (!s || !s.token || s.role !== role) {
      location.replace('index.html');
      return null;
    }
    return s;
  }

  function refreshRole(role) {
    var s = requireRole(role);
    if (!s) return;
    load().then(function (res) {
      if ((res.version || 1) > (s.version || 1)) location.reload();
    }).catch(function (err) {
      setStatus('err', err.message || '云端加载失败');
    });
  }

  return {
    config: CFG,
    ready: ready,
    login: login,
    load: load,
    save: save,
    queueSave: queueSave,
    logout: logout,
    getSession: getSession,
    requireRole: requireRole,
    refreshRole: refreshRole
  };
})();
