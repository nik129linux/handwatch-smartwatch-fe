/* ==========================================================================
   wear.test.js — the Wear OS app, checked without an emulator.
   Builds the APK with wear/build.sh, then:
     - asserts out/hand-hygiene-wear.apk exists and is signed;
     - reads the resource table with `aapt2 dump resources` and proves every
       string key exists in BOTH locales (default = Spanish, values-en);
     - reads the string pool with `aapt2 dump strings`;
     - greps the Java for hardcoded user-visible string literals;
     - asserts no button is smaller than 48dp.
   ========================================================================== */

'use strict';

var assert = require('assert');
var child = require('child_process');
var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..');
var WEAR = path.join(ROOT, 'wear');
var APK = path.join(WEAR, 'out', 'hand-hygiene-wear.apk');
var SDK = process.env.ANDROID_SDK || path.join(process.env.HOME || '', 'Android', 'sdk');
var BUILD_TOOLS = path.join(SDK, 'build-tools', '35.0.0');
var AAPT2 = path.join(BUILD_TOOLS, 'aapt2');
var APKSIGNER = path.join(BUILD_TOOLS, 'apksigner');

var pass = 0;
function ok(name) {
  pass += 1;
  console.log('  ok  ' + name);
}

function sh(cmd, args, opts) {
  return child.execFileSync(cmd, args, Object.assign({
    cwd: WEAR, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024
  }, opts || {}));
}

if (!fs.existsSync(AAPT2)) {
  console.log('wear.test: Android build-tools not found at ' + BUILD_TOOLS + ' — skipping');
  process.exit(0);
}

/* ---------------------------------------------------------------- build */

console.log('wear: building the APK');
['out', 'gen', 'obj'].forEach(function (dir) {
  fs.rmSync(path.join(WEAR, dir), { recursive: true, force: true });
});
sh(path.join(WEAR, 'build.sh'), [], { stdio: 'pipe' });
assert.ok(fs.existsSync(APK), 'build.sh must produce out/hand-hygiene-wear.apk');
ok('build.sh builds out/hand-hygiene-wear.apk from scratch');

if (fs.existsSync(APKSIGNER)) {
  sh(APKSIGNER, ['verify', APK]);
  ok('the APK verifies with apksigner');
}

/* ----------------------------------------------------------- resources */

var dump = sh(AAPT2, ['dump', 'resources', APK]);
assert.ok(/Package name=co\.ucc\.handhygiene\.wear/.test(dump),
  'the package must be co.ucc.handhygiene.wear');
ok('package name is co.ucc.handhygiene.wear');

var resources = {};
var current = null;
dump.split('\n').forEach(function (line) {
  var head = line.match(/^\s+resource 0x[0-9a-f]+ string\/(\S+)\s*$/);
  if (head) {
    current = head[1];
    resources[current] = {};
    return;
  }
  if (!current) return;
  var value = line.match(/^\s+\((en)?\)\s+"(.*)"\s*$/);
  if (value) {
    var config = value[1] || 'default';
    resources[current][config] = value[2].replace(/\\"/g, '"');
    return;
  }
  if (/^\s+resource 0x/.test(line)) current = null;
});

var keys = Object.keys(resources).sort();
assert.ok(keys.length >= 20, 'expected the full string table, found ' + keys.length);
ok('aapt2 dump resources exposes ' + keys.length + ' string keys');

var missing = [];
keys.forEach(function (key) {
  var entry = resources[key];
  var es = entry.default;
  var en = entry.en;
  if (es === undefined || es === '') missing.push(key + ' (default/es)');
  if (en === undefined || en === '') missing.push(key + ' (en)');
});
assert.deepStrictEqual(missing, [], 'missing locale values: ' + missing.join(', '));
ok('every string key has a Spanish default and an English value');

/* The copy the brief names, verbatim, on the Spanish side. */
[
  '¿Te lavaste?',
  'Sí, me lavé',
  'No alcancé',
  'Anotado. Gracias.',
  'Momentos',
  'Ya lo hice',
  'Te aviso con vibración.',
  'Si dudo, te pregunto.',
  'Solo tú lo ves.'
].forEach(function (copy) {
  var found = keys.some(function (key) { return resources[key].default === copy; });
  assert.ok(found, 'Spanish copy missing from the default locale: ' + copy);
});
ok('the desktop copy is present in the Spanish default locale');

var englishHome = keys.some(function (key) { return resources[key].en === 'Moments'; });
var spanishHome = keys.some(function (key) { return resources[key].default === 'Momentos'; });
assert.ok(englishHome && spanishHome, 'Home must read Momentos / Moments');
ok('Home is localized (Momentos / Moments)');

/* aapt2 dump strings must show both languages in the APK string pool. */
var pool = sh(AAPT2, ['dump', 'strings', APK]);
assert.ok(pool.indexOf('Momentos') !== -1, 'aapt2 dump strings must include "Momentos"');
assert.ok(pool.indexOf('Moments') !== -1, 'aapt2 dump strings must include "Moments"');
assert.ok(pool.indexOf('¿Te lavaste?') !== -1, 'aapt2 dump strings must include "¿Te lavaste?"');
ok('aapt2 dump strings contains both locales');

/* ------------------------------------------------------------ java grep */

var srcDir = path.join(WEAR, 'src');
var javaFiles = [];
(function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
    var full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.java')) javaFiles.push(full);
  });
})(srcDir);
assert.ok(javaFiles.length >= 5, 'expected the wear sources, found ' + javaFiles.length);

/* A user-visible literal is a quoted string with two or more letters and a
   space, or any literal handed straight to a widget/label call. Keys, tags
   and log payloads ("yes", "lang", "answer=yes") are neither. */
var literalProblems = [];
javaFiles.forEach(function (file) {
  var lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach(function (line, index) {
    var where = path.relative(WEAR, file) + ':' + (index + 1);
    var literals = line.match(/"[^"]*"/g) || [];
    var directCall = /(?:setText|setContentDescription|setTitle|setHint|makeText)\s*\(/.test(line);
    literals.forEach(function (quoted) {
      var text = quoted.slice(1, -1);
      var hasLetters = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,}/.test(text);
      var spaced = hasLetters && /\s/.test(text);
      if (spaced || (directCall && /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(text))) {
        literalProblems.push(where + ' -> "' + text + '"');
      }
    });
  });
});
assert.deepStrictEqual(literalProblems,
  [], 'hardcoded UI strings in Java (move them to res/values*/strings.xml):\n' +
    literalProblems.join('\n'));
ok('no hardcoded user-visible string literals in Java (' + javaFiles.length + ' files)');

/* -------------------------------------------------------- button sizes */

var smallButtons = [];
var buttonHeight = /set(?:Min|Minimum)Height\s*\(\s*(?:Ui\.)?dp\(\s*(\d+)\s*\)/g;
javaFiles.forEach(function (file) {
  var text = fs.readFileSync(file, 'utf8');
  var match;
  while ((match = buttonHeight.exec(text))) {
    if (Number(match[1]) < 48) {
      smallButtons.push(path.relative(WEAR, file) + ' -> ' + match[1] + 'dp');
    }
  }
  /* the old AlertActivity used 44dp pills; no trace of that may remain */
  var dpLiterals = text.match(/\b(?:4[0-7]|[1-3][0-9]|[0-9])dp\b/g) || [];
  dpLiterals.forEach(function (lit) {
    if (/setMin(?:imum)?Height/.test(text) && /^4[0-7]dp$/.test(lit)) {
      smallButtons.push(path.relative(WEAR, file) + ' -> literal ' + lit);
    }
  });
});
assert.deepStrictEqual(smallButtons, [],
  'buttons under 48dp (the minimum touch target):\n' + smallButtons.join('\n'));
ok('every setMin(imum)Height is at least 48dp');

/* The brief names the old 44dp alert pills; that token must be gone. */
var legacySizes = javaFiles.filter(function (file) {
  return /\bdp\(\s*(?:[0-9]|[1-3][0-9]|4[0-7])\s*\)/.test(fs.readFileSync(file, 'utf8')) &&
    /setMin(?:imum)?Height/.test(fs.readFileSync(file, 'utf8'));
});
assert.deepStrictEqual(legacySizes, [],
  'a button size below 48dp is still present in: ' + legacySizes.join(', '));
ok('no 48dp-below button size literals remain');

/* Every button built through Ui.pill gets that floor from one constant. */
var ui = fs.readFileSync(path.join(srcDir, 'co', 'ucc', 'handhygiene', 'wear', 'Ui.java'), 'utf8');
assert.ok(/MIN_TOUCH_DP\s*=\s*48/.test(ui), 'Ui.MIN_TOUCH_DP must be 48');
assert.ok(/Math\.max\(\s*MIN_TOUCH_DP/.test(ui), 'Ui.pill must clamp to MIN_TOUCH_DP');
ok('Ui.pill enforces the 48dp floor');

/* --------------------------------------------------------------- color */

/* Text contrast on the OLED black face must clear 4.5:1, and the accent
   may only come from colors.xml tokens (no hex in Java). */
function luminance(hex) {
  var value = hex.replace('#', '');
  if (value.length === 8) value = value.slice(2);
  var rgb = [0, 2, 4].map(function (i) {
    var channel = parseInt(value.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}
function contrast(a, b) {
  var la = luminance(a);
  var lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

var colorsXml = fs.readFileSync(path.join(WEAR, 'res', 'values', 'colors.xml'), 'utf8');
var palette = {};
(colorsXml.match(/<color name="([^"]+)">([^<]+)<\/color>/g) || []).forEach(function (row) {
  var m = row.match(/<color name="([^"]+)">([^<]+)<\/color>/);
  palette[m[1]] = m[2].trim();
});
['hh_black', 'hh_lime', 'hh_track', 'hh_text', 'hh_text_dim', 'hh_on_lime'].forEach(function (token) {
  assert.ok(palette[token], 'colors.xml must define ' + token);
});
[
  ['hh_text', 'hh_black'],
  ['hh_text_dim', 'hh_black'],
  ['hh_on_lime', 'hh_lime'],
  ['hh_text', 'hh_track']
].forEach(function (pair) {
  var ratio = contrast(palette[pair[0]], palette[pair[1]]);
  assert.ok(ratio >= 4.5, pair[0] + ' on ' + pair[1] + ' is only ' + ratio.toFixed(2) + ':1');
});
ok('every text token clears 4.5:1 on its background');

var hexInJava = javaFiles.filter(function (file) {
  return /0x[0-9a-fA-F]{6,8}|Color\.(?:rgb|argb|parseColor)|#[0-9a-fA-F]{6}/.test(
    fs.readFileSync(file, 'utf8'));
});
assert.deepStrictEqual(hexInJava, [],
  'raw colors in Java (use R.color tokens in res/values/colors.xml): ' + hexInJava.join(', '));
ok('no raw color values in Java');

/* --------------------------------------------------------------- done */

console.log('wear: ' + pass + ' checks passed');
