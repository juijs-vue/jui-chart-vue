// Port of legacy `src/icon/classic.js` ("chart.icon.classic", extend: null) - a flat
// `{iconName: '\uXXXX', ...}` codepoint map (Private-Use-Area glyphs from the bundled icomoon
// icon font - see this project's `public/fonts/icomoon.{eot,svg,ttf,woff}`, copied verbatim from
// `images/icon/`), byte-for-byte transcribed and mechanically verified key-for-key against the
// source (same verification approach used for the theme files).
//
// Registered under the same 'classic' name via `jui-graph-ts`'s `registerIcon(type, icons)` -
// matches `Builder.icon(key)`'s real lookup (`iconRegistry.get(this._options.icon.type)`) and
// `Builder.setup()`'s own default (`icon: { type: 'classic', path: null }`), so this is the type
// key actually looked up by default with no icon config needed at all. The font FILES themselves
// (`icon.path`) still need to be supplied by whoever configures a real `<Chart>` - see
// `Chart.vue`'s own header comment for the default wiring this project adds on top of that.
//
// **OPEN ISSUE, NOT FIXED - icon glyphs still render as "tofu" (missing-glyph boxes) in real
// Chromium, root cause unknown.** Every layer up to and including the browser's own font/CSS
// layer is independently confirmed correct: `chart.text()`'s `parseIconInText()` correctly
// resolves a `{key}` placeholder to this map's real codepoint (unit-tested), the font file is
// correctly served and successfully loads (`document.fonts` reports `status: "loaded"`, a real 200
// response, in Playwright/real Chromium), the resolved `font-family` CSS stack correctly includes
// `classic` on the text element (`getComputedStyle`), and exactly one correctly-content `@font-face`
// rule exists in `document.head` (`Builder.setVectorFontIcons()`'s own dedup guard, confirmed
// working). Despite all of that, the glyph still paints as tofu, not the real icon.
//
// An earlier investigation attributed this to `CSSStyleSheet.insertRule()`'s specific timing (vs.
// setting a `<style>`'s `.textContent` before appending it) and reported that switching techniques
// fixed it - `Builder.setVectorFontIcons()` was changed accordingly. **That diagnosis was WRONG,
// disproven by a later, more rigorous controlled A/B re-test**: `insertRule()` and the `.textContent`
// technique both painted the glyph correctly, OR both failed, depending on an unrelated artifact of
// the minimal reproduction's own HTML structure (not present in this project's real `index.html`) -
// the original "confirmed fix" was a confounded test, not a real fix. The `.textContent` change is
// kept (it's at worst neutral - same behavior, a more conventional stylesheet-construction API) but
// should NOT be read as having resolved glyph painting. The true root cause remains unknown and is
// not being actively investigated further for now - flagged as a known, open issue rather than
// something to keep silently re-attempting fixes for.
import { registerIcon } from 'jui-graph-ts'

/** `chart.icon.classic` - the default icon set's `{iconName: codepoint}` map, registered as
 * `"classic"` via `registerIcon()`. See this file's own header comment for provenance and a known,
 * open glyph-rendering issue (not fixed). */
export const classicIcons = {
  "chevron-left": "\ue90e",
  "iframe": "\ue9be",
  "textbox": "\ue9bf",
  "arrow5": "\ue905",
  "arrow7": "\ue900",
  "loveit2": "\ue901",
  "favorites2": "\ue902",
  "favorites1": "\ue903",
  "arrow6": "\ue904",
  "happy2": "\ue906",
  "unhappy2": "\ue907",
  "happy": "\ue908",
  "gear2": "\ue909",
  "expand": "\ue90a",
  "export": "\ue90b",
  "back": "\ue90c",
  "report-link": "\ue90d",
  "chevron-right": "\ue90f",
  "dot": "\ue910",
  "list1": "\ue911",
  "pause": "\ue912",
  "minus": "\ue913",
  "plus": "\ue914",
  "close": "\ue915",
  "tool2": "\ue916",
  "time": "\ue917",
  "check": "\ue918",
  "download": "\ue919",
  "upload": "\ue91a",
  "layout3": "\ue91b",
  "tool": "\ue91c",
  "screenshot": "\ue91d",
  "server": "\ue91e",
  "slider": "\ue91f",
  "statistics": "\ue920",
  "themes": "\ue921",
  "was": "\ue922",
  "realtime": "\ue923",
  "report2": "\ue924",
  "resize": "\ue925",
  "return": "\ue926",
  "label": "\ue927",
  "mail": "\ue928",
  "message": "\ue929",
  "monitoring": "\ue92a",
  "grip1": "\ue92b",
  "grip2": "\ue92c",
  "grip3": "\ue92d",
  "dashboard": "\ue92e",
  "domain": "\ue92f",
  "edit": "\ue930",
  "etc": "\ue931",
  "chart-candle": "\ue932",
  "chart-gauge": "\ue933",
  "arrow2": "\ue934",
  "arrow4": "\ue935",
  "bell": "\ue936",
  "info": "\ue937",
  "tumblr": "\ue938",
  "kakao": "\ue939",
  "googleplus2": "\ue93a",
  "close2": "\ue93b",
  "facebook2": "\ue93c",
  "github2": "\ue93d",
  "hierarchy": "\ue93e",
  "loveit": "\ue93f",
  "return2": "\ue940",
  "theme": "\ue941",
  "line-merge": "\ue942",
  "line-separate": "\ue943",
  "enter": "\ue944",
  "ws": "\ue945",
  "clip": "\ue946",
  "scissors": "\ue947",
  "topology": "\ue948",
  "equalizer": "\ue949",
  "idea": "\ue94a",
  "tag": "\ue94b",
  "all": "\ue94c",
  "cursor1": "\ue94d",
  "roundsquare": "\ue94e",
  "paintbucket": "\ue94f",
  "square": "\ue950",
  "circle": "\ue951",
  "eraser": "\ue952",
  "paintbrush": "\ue953",
  "pen": "\ue954",
  "eyedropper": "\ue955",
  "x-mark": "\ue956",
  "server2": "\ue957",
  "server1": "\ue958",
  "unhappy": "\ue959",
  "layout2": "\ue95a",
  "layout1": "\ue95b",
  "d": "\ue95c",
  "cursor": "\ue95d",
  "feed": "\ue95e",
  "filter": "\ue95f",
  "column": "\ue960",
  "analysis": "\ue961",
  "wireless": "\ue962",
  "network": "\ue963",
  "cloud": "\ue964",
  "checkbox": "\ue965",
  "checkbox2": "\ue966",
  "stop": "\ue967",
  "link2": "\ue968",
  "minus2": "\ue969",
  "more": "\ue96a",
  "zip": "\ue96b",
  "mobile": "\ue96c",
  "tablet": "\ue96d",
  "share2": "\ue96e",
  "caution3": "\ue96f",
  "lock": "\ue970",
  "script": "\ue971",
  "business": "\ue972",
  "build": "\ue973",
  "themes2": "\ue974",
  "pin": "\ue975",
  "template": "\ue976",
  "line-height": "\ue977",
  "outdent": "\ue978",
  "indent": "\ue979",
  "like": "\ue97a",
  "blogger": "\ue97b",
  "github": "\ue97c",
  "facebook": "\ue97d",
  "googleplus": "\ue97e",
  "share": "\ue97f",
  "twitter": "\ue980",
  "image": "\ue981",
  "refresh2": "\ue982",
  "connection": "\ue983",
  "analysis2": "\ue984",
  "chart-scatter": "\ue985",
  "chart-radar": "\ue986",
  "chart-area": "\ue987",
  "chart-column": "\ue988",
  "chart-bar": "\ue989",
  "chart-line": "\ue98a",
  "info-message": "\ue98b",
  "report": "\ue98c",
  "menu": "\ue98d",
  "report-build": "\ue98e",
  "jennifer-server": "\ue98f",
  "user": "\ue990",
  "rule": "\ue991",
  "profile": "\ue992",
  "device": "\ue993",
  "caution2": "\ue994",
  "db": "\ue995",
  "checkmark": "\ue996",
  "stoppage": "\ue997",
  "align-right": "\ue998",
  "caution": "\ue999",
  "loading": "\ue99a",
  "play": "\ue99b",
  "right": "\ue99c",
  "left": "\ue99d",
  "bold": "\ue99e",
  "chart": "\ue99f",
  "document": "\ue9a0",
  "link": "\ue9a1",
  "arrow3": "\ue9a2",
  "arrow1": "\ue9a3",
  "textcolor": "\ue9a4",
  "text": "\ue9a5",
  "refresh": "\ue9a6",
  "align-center": "\ue9a7",
  "align-left": "\ue9a8",
  "preview": "\ue9a9",
  "exit": "\ue9aa",
  "dashboardlist": "\ue9ab",
  "add-dir": "\ue9ac",
  "add-dir2": "\ue9ad",
  "calendar": "\ue9ae",
  "gear": "\ue9af",
  "help": "\ue9b0",
  "hide": "\ue9b1",
  "home": "\ue9b2",
  "html": "\ue9b3",
  "italic": "\ue9b4",
  "new-window": "\ue9b5",
  "orderedlist": "\ue9b6",
  "printer": "\ue9b7",
  "save": "\ue9b8",
  "search": "\ue9b9",
  "table": "\ue9ba",
  "trashcan": "\ue9bb",
  "underline": "\ue9bc",
  "unorderedlist": "\ue9bd"
} as const satisfies Record<string, string>

/** Every icon name available in the `'classic'` icon set (`chart.icon.classic`) - the valid
 * `{key}` placeholder names `chart.text()`'s `parseIconInText()` resolves against `classicIcons`'
 * own Private-Use-Area codepoints (see this file's own header comment for the font-file wiring
 * and the known glyph-rendering issue). */
export type ClassicIconName = keyof typeof classicIcons

registerIcon('classic', classicIcons)
