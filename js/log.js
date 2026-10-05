/* ==========================================================================
   log.js — the on-watch event log. Every detection the classifier makes
   lands here with a fixed schema:

     {id, ts, moment, outcome, corrected}

   `outcome` is one of done | confirmed | declined | unsure | silenced.
   There is NO person field, structurally: entries are built from a
   whitelist, so a name cannot be stored even by accident.
   Per-event detail older than 24 h is purged on load and hourly.
   Persistence: Electron userData/log.json via preload IPC when present,
   localStorage otherwise, so the app keeps working in a plain browser.
   Works as a plain <script> (window.Log) and under node (require).
   ========================================================================== */

var Log = (function () {
  'use strict';

  var KEY = 'handwatch.log.v1';
  var DAY_MS = 24 * 60 * 60 * 1000;
  var HOUR_MS = 60 * 60 * 1000;
  var OUTCOMES = ['done', 'confirmed', 'declined', 'unsure', 'silenced'];

  function uid() {
    return 'e' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  }

  function validOutcome(o) {
    return OUTCOMES.indexOf(o) !== -1 ? o : 'unsure';
  }

  /* Build an entry from a whitelist — unknown fields (a name, a bed
     assignment, anything) are dropped, never stored. */
  function entry(moment, outcome, corrected, ts) {
    return {
      id: uid(),
      ts: ts === undefined ? Date.now() : ts,
      moment: String(moment || 'before-patient'),
      outcome: validOutcome(outcome),
      corrected: !!corrected
    };
  }

  function purgeOld(list, now) {
    var cut = (now === undefined ? Date.now() : now) - DAY_MS;
    return list.filter(function (e) { return e && e.ts >= cut; });
  }

  function createStore(storage) {
    var events = [];

    function save() {
      try {
        var json = JSON.stringify(events);
        storage.write(json);
      } catch (e) { /* private mode, quota — the watch keeps going */ }
    }

    function load() {
      var raw = null;
      try { raw = storage.read(); } catch (e) { raw = null; }
      if (!raw) { events = []; return events; }
      try {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          /* re-whitelist on the way in, in case an old build wrote more */
          events = parsed.map(function (e) {
            return {
              id: String(e.id),
              ts: Number(e.ts) || 0,
              moment: String(e.moment || 'before-patient'),
              outcome: validOutcome(e.outcome),
              corrected: !!e.corrected
            };
          });
        }
      } catch (e) { events = []; }
      events = purgeOld(events);
      return events;
    }

    return {
      record: function (moment, outcome, corrected, ts) {
        var e = entry(moment, outcome, corrected, ts);
        events.push(e);
        save();
        return e;
      },
      list: function () { return events.slice(); },
      count: function () { return events.length; },
      correctedCount: function () {
        return events.filter(function (e) { return e.corrected; }).length;
      },
      remove: function (id) {
        var n = events.length;
        events = events.filter(function (e) { return e.id !== id; });
        if (events.length !== n) save();
        return events.length !== n;
      },
      clear: function () { events = []; save(); },
      purge: function (now) {
        var n = events.length;
        events = purgeOld(events, now);
        if (events.length !== n) save();
        return n - events.length;
      },
      load: load,
      save: save
    };
  }

  /* --- storage backends -------------------------------------------------- */

  function browserStorage() {
    return {
      read: function () {
        try { return window.localStorage.getItem(KEY); }
        catch (e) { return null; }
      },
      write: function (json) {
        try { window.localStorage.setItem(KEY, json); } catch (e) { /* keep going */ }
        /* Electron file copy, fire-and-forget: the in-memory list and
           localStorage are already correct, the file just follows. */
        try {
          if (window.__logAPI && window.__logAPI.save) window.__logAPI.save(json);
        } catch (e) { /* browser without preload — nothing to do */ }
      }
    };
  }

  var store = null;

  function mount() {
    store = createStore(browserStorage());
    store.load();
    store.purge();
    /* In Electron the file is the source of truth: pick it up when ready. */
    try {
      if (window.__logAPI && window.__logAPI.load) {
        window.__logAPI.load().then(function (raw) {
          if (!raw) return;
          try {
            var parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              var fresh = createStore({
                read: function () { return raw; },
                write: function () { }
              });
              fresh.load();
              var kept = fresh.list();
              store.clear();
              kept.forEach(function (e) {
                store.record(e.moment, e.outcome, e.corrected, e.ts);
              });
              store.purge();
              document.dispatchEvent(new CustomEvent('watch:log-sync'));
            }
          } catch (e) { /* corrupt file — keep the local copy */ }
        }).catch(function () { /* preload without a backend — keep going */ });
      }
    } catch (e) { /* plain browser — nothing to do */ }
    /* per-event detail older than 24 h goes away, checked hourly */
    try {
      if (typeof window !== 'undefined' && window.setInterval) {
        window.setInterval(function () { store.purge(); }, HOUR_MS);
      }
    } catch (e) { /* node — the test drives purge() by hand */ }
    return store;
  }

  function api() {
    if (!store) mount();
    return store;
  }

  return {
    KEY: KEY,
    DAY_MS: DAY_MS,
    OUTCOMES: OUTCOMES,
    createStore: createStore,
    mount: mount,
    record: function (m, o, c, t) { return api().record(m, o, c, t); },
    list: function () { return api().list(); },
    count: function () { return api().count(); },
    correctedCount: function () { return api().correctedCount(); },
    remove: function (id) { return api().remove(id); },
    clear: function () { return api().clear(); },
    purge: function (now) { return api().purge(now); },
    load: function () { return api().load(); }
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Log;
}
