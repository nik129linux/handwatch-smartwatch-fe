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

/* -------------------------------------------------------- static layout */

/* The face is round, so layout is checked from the source (the brief's
   round-screen rules), not only from the APK:
     - a chip is never pinned to the bottom over a scroller;
     - every chip width comes from Ui's round-safe helpers, never from a raw
       MATCH_PARENT or a hardcoded pixel width. */
var ROUND_HELPER = /Ui\.(?:roundLp|roundWrapLp|wrapLp|roundSafeWidth|columnWidth|rowLp|halfLp|innerLp|fit)\s*\(/;

function javaText(file) {
  return fs.readFileSync(file, 'utf8');
}

function buttonNames(text) {
  var names = [];
  var re = /\bButton\s+(\w+)\s*=/g;
  var match;
  while ((match = re.exec(text))) names.push(match[1]);
  return names;
}

/* The expression that built the LayoutParams handed to addView(view, x):
   inline, a local variable, or a small helper method of the same file. */
function paramsSource(text, expression) {
  var expr = expression.trim();
  if (expr.indexOf('new ') === 0 || expr.indexOf('Ui.') === 0) return expr;
  var local = expr.match(/^(\w+)$/);
  if (local) {
    var assign = new RegExp('(?:LayoutParams\\s+)?' + local[1] + '\\s*=\\s*([^;]+);');
    var match = text.match(assign);
    return match ? match[1] : null;
  }
  var call = expr.match(/^(\w+)\s*\(/);
  if (call) {
    var method = text.match(new RegExp(
      'LayoutParams\\s+' + call[1] + '\\s*\\([^)]*\\)\\s*\\{([\\s\\S]{0,400})'));
    return method ? method[1] : null;
  }
  return null;
}

/* One statement per entry, so an inline `new LinearLayout.LayoutParams(...)`
   does not swallow the next line. */
function statements(text) {
  return text.split(';').map(function (chunk) { return chunk; });
}

var pinnedBottom = [];
var chipWidths = [];
javaFiles.forEach(function (file) {
  var text = javaText(file);
  var rel = path.relative(WEAR, file);
  var chips = buttonNames(text);
  var scrolls = /new ScrollView\(/.test(text);

  chips.forEach(function (name) {
    /* A chip added to the screen root lives outside the scroller: it is a
       footer, and on a 227dp face it lands on top of the list. */
    if (scrolls && new RegExp('\\broot\\.addView\\(\\s*' + name + '\\b').test(text)) {
      pinnedBottom.push(rel + ' -> root.addView(' + name + ')');
    }
  });
  if (scrolls && /Gravity\.BOTTOM|layout_gravity="bottom"|alignParentBottom/.test(text)) {
    pinnedBottom.push(rel + ' -> bottom gravity next to a ScrollView');
  }

  statements(text).forEach(function (statement) {
    var call = statement.match(/(\w+)\.addView\(\s*(\w+)\s*,\s*([\s\S]*?)\)\s*$/);
    if (!call) return;
    if (chips.indexOf(call[2]) === -1) return;
    var source = paramsSource(text, call[3]);
    if (source === null) {
      chipWidths.push(rel + ' -> ' + call[2] + ' has no traceable LayoutParams');
      return;
    }
    if (!ROUND_HELPER.test(source)) {
      chipWidths.push(rel + ' -> ' + call[2] + ' width from ' +
        source.replace(/\s+/g, ' ').trim().slice(0, 60));
    }
  });
});
assert.deepStrictEqual(pinnedBottom, [],
  'fixed bottom buttons over a scrolling screen (put the chip last in the list):\n' +
    pinnedBottom.join('\n'));
ok('no fixed bottom button sits over a scroll container');

assert.deepStrictEqual(chipWidths, [],
  'chip widths that bypass the round-safe helpers in Ui.java:\n' + chipWidths.join('\n'));
ok('every chip width comes from a round-safe helper');

/* Any activity that ships a chip must reference the helper. */
var pillScreens = javaFiles.filter(function (file) {
  return /Ui\.(?:pill|chip|textButton)\(/.test(javaText(file));
});
assert.ok(pillScreens.length >= 4, 'expected the pill screens, found ' + pillScreens.length);
var noHelper = pillScreens.filter(function (file) { return !ROUND_HELPER.test(javaText(file)); });
assert.deepStrictEqual(noHelper, [],
  'screens with pills but no round-safe width: ' +
    noHelper.map(function (f) { return path.relative(WEAR, f); }).join(', '));
ok('every screen with a pill uses the round-safe helper');

/* The close chips are the last row of their lists, and both lists pay half a
   viewport at the top and the bottom so the ends can reach the centre. */
[['SettingsActivity.java', 'close'], ['HelpActivity.java', 'back']].forEach(function (pair) {
  var text = javaText(path.join(srcDir, 'co', 'ucc', 'handhygiene', 'wear', pair[0]));
  assert.ok(new RegExp('content\\.addView\\(\\s*' + pair[1] + ',').test(text),
    pair[0] + ' must add its ' + pair[1] + ' chip to the scrolling list');
  assert.ok(/centerList\(\s*scroll\s*,\s*content\s*\)/.test(text),
    pair[0] + ' must centre its list with centerList(scroll, content)');
});
ok('Ajustes and Ayuda end their lists with the close chip');

/* The title is the first row of the scroller (Wear convention), not a fixed
   header: the list can scroll it away instead of sliding rows underneath. */
[['SettingsActivity.java', 'settings_title'], ['HelpActivity.java', 'help_title']].forEach(function (pair) {
  var text = javaText(path.join(srcDir, 'co', 'ucc', 'handhygiene', 'wear', pair[0]));
  assert.ok(new RegExp('Ui\\.text\\(this,\\s*str\\(R\\.string\\.' + pair[1] + '\\)').test(text),
    pair[0] + ' must build its title from Ui.text');
  var firstAdd = text.search(/content\.addView\(/);
  var titleAdd = text.search(/content\.addView\(\s*title\s*,/);
  assert.ok(titleAdd !== -1,
    pair[0] + ' must add its title to the scrolling content');
  assert.strictEqual(titleAdd, firstAdd,
    pair[0] + ' must add the title as the first row of the scroller (no content above it)');
  assert.ok(!/root\.addView\(\s*title\s*,/.test(text),
    pair[0] + ' must not pin the title above the scroller');
});
ok('Ajustes and Ayuda make the title the first row of the list');

/* The end of a list pays ~25% of the viewport so the last card can scroll to
   the middle and its rounded corners are never clipped; the top stays flush
   so the first row sits right under the title. */
var baseSource = javaText(path.join(srcDir, 'co', 'ucc', 'handhygiene', 'wear', 'BaseActivity.java'));
assert.ok(/LIST_END_FRACTION\s*=\s*0\.25f/.test(baseSource),
  'the list must pay 25% of the viewport at the end');
assert.ok(/content\.setPadding\(\s*0\s*,\s*0\s*,\s*0\s*,\s*end\s*\)/.test(baseSource),
  'centerList must leave the top flush and pad only the end');
ok('lists pad ~25% of the viewport at the end and none at the top');

/* The guide is one measured stack: the title is capped at two lines and
   auto-sizes down until the measured rows fit, so the dots cannot overlap
   it at 454 px or at 384 px. No hardcoded y offsets. */
var guide = javaText(path.join(srcDir, 'co', 'ucc', 'handhygiene', 'wear', 'GuideActivity.java'));
assert.ok(/setMaxLines\(\s*TITLE_LINES_MAX\s*\)/.test(guide),
  'the guide title must be capped at two lines');
assert.ok(/getMeasuredHeight\s*\(\s*\)/.test(guide) ||
  (/StaticLayout/.test(guide) && /\.getHeight\s*\(\s*\)/.test(guide)),
  'the guide must compute its spacing from measured text heights');
assert.ok(/chooseTitleSize\s*\(\s*\)/.test(guide),
  'the guide must choose the title size from measured text before layout');
assert.ok(/setTextSize\(\s*TypedValue\.COMPLEX_UNIT_SP/.test(guide),
  'the guide title must auto-size down to fit');
assert.ok(!/\b(?:SKIP|NEXT|TITLE|BODY|DOTS|COUNTER)_Y\s*=\s*0\.\d+f/.test(guide),
  'the guide must not place rows at a hardcoded y fraction');
assert.ok(!/\bsetY\s*\(|\bsetTranslationY\s*\(|\boffsetTopAndBottom\s*\(/.test(guide),
  'the guide must lay out by measurement, not by y offsets');
var guideRows = (guide.match(/stack\.addView\(/g) || []).length;
assert.ok(guideRows >= 6,
  'the guide rows must all be children of one measured stack, found ' + guideRows);
ok('the guide uses one measured stack with an auto-sized title');

/* Round geometry lives in one place: 80% cap, 12% edge inset, real chord. */
var uiSource = javaText(path.join(srcDir, 'co', 'ucc', 'handhygiene', 'wear', 'Ui.java'));
assert.ok(/MAX_WIDTH_FRACTION\s*=\s*0\.80f/.test(uiSource),
  'Ui.MAX_WIDTH_FRACTION must cap a chip at 80% of the face');
assert.ok(/EDGE_INSET_FRACTION\s*=\s*0\.12f/.test(uiSource),
  'Ui.EDGE_INSET_FRACTION must keep 12% side insets');
assert.ok(/chordWidth\s*\(\s*Context/.test(uiSource) &&
  /roundSafeWidth\s*\(\s*Context/.test(uiSource),
  'Ui must expose chordWidth() and roundSafeWidth()');
ok('Ui caps chips at the circle chord and 80% of the face');

/* Layout XML, if any is ever added, obeys the same rules. */
var xmlLayouts = [];
(function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
    var full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.xml') && /layout/.test(full)) xmlLayouts.push(full);
  });
})(path.join(WEAR, 'res'));

var xmlProblems = [];
xmlLayouts.forEach(function (file) {
  var text = fs.readFileSync(file, 'utf8');
  var scroller = /<(?:ScrollView|ListView|androidx\.wear\.widget\.WearableRecyclerView)/.test(text);
  if (!scroller) return;
  if (/layout_alignParentBottom|android:layout_gravity="bottom"|layout_gravity="bottom"/.test(text)) {
    xmlProblems.push(path.relative(WEAR, file) + ' -> bottom-pinned view next to a scroller');
  }
});
assert.deepStrictEqual(xmlProblems, [], xmlProblems.join('\n'));
ok('no layout XML pins a view to the bottom over a scroller (' + xmlLayouts.length + ' files)');

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
