/* Stock quick cards: the shared data for the sectors sheet (and the map links to it).
   One entry per stock, updated by Claude after each quarterly report.
   seg: revenue by segment [name, $M] for the quarter.
   g: revenue growth YoY %, fcf: free cash flow margin % (null = negative), roic: return on capital % (null = negative),
   pe: forward P/E (null = no profit). warn: short warnings shown only when they matter. */
var CARDS = {
  LMT: { q: "רבעון 3, 2026",
    seg: [["מטוסים (F‑35)", 8214], ["טילים ובקרת אש", 4501], ["מסוקים ומערכות", 4511], ["חלל", 3485]],
    g: 11, fcf: 10, roic: 25, pe: 19, warn: [],
    take: "הביקוש לטילי יירוט (PAC‑3) מושך את הצמיחה. צבר הזמנות שיא של 292 מיליארד דולר." },
  NOC: { q: "רבעון 3, 2026",
    seg: [["מטוסים (B‑21)", 3575], ["מערכות משימה", 3155], ["חלל", 2749], ["מערכות הגנה", 2307]],
    g: 7, fcf: 7.5, roic: 13, pe: 19, warn: [],
    take: "צמיחה איטית יותר, אבל צבר שיא של 110 מיליארד דולר והמפציץ B‑21 נכנס לייצור." },
  RKLB: { q: "רבעון 3, 2026",
    seg: [["מערכות חלל", 214.8], ["שיגורים", 53.1]],
    g: 73, fcf: null, roic: null, pe: null, warn: ["דילול: מכרה מניות ב־2.4B$ ברבעון"],
    take: "צומחת מהר מאוד אבל עדיין מפסידה. טיל Neutron נדחה ל־2027, ועסקת Iridium תוסיף חוב." },
  ESLT: { q: "רבעון 3, 2026",
    seg: [["יבשה ותחמושת", 758.7], ["אווירונאוטיקה", 498.9], ["מודיעין ול״א", 449.7], ["פעילות בארה״ב", 446.7], ["פיקוד ושליטה וסייבר", 269.7]],
    g: 17, fcf: 5, roic: 12, pe: 40, warn: [],
    take: "צמיחה חזקה וצבר שיא של 33 מיליארד דולר, 74% ממנו מחו״ל. המחיר כבר יקר מאוד." }
};

/* Traffic light per test: G / Y / R */
var CARD_TESTS = [
  { k: "g", l: "צמיחה בהכנסות", f: function (v) { return v >= 10 ? "G" : v >= 5 ? "Y" : "R"; }, v: function (v) { return (v > 0 ? "+" : "") + v + "%"; } },
  { k: "fcf", l: "תזרים חופשי מההכנסות", f: function (v) { return v == null ? "R" : v >= 8 ? "G" : v >= 0 ? "Y" : "R"; }, v: function (v) { return v == null ? "שלילי" : "~" + v + "%"; } },
  { k: "roic", l: "תשואה על ההון", f: function (v) { return v == null ? "R" : v >= 15 ? "G" : v >= 8 ? "Y" : "R"; }, v: function (v) { return v == null ? "שלילית" : "~" + v + "%"; } },
  { k: "pe", l: "מכפיל רווח עתידי", f: function (v) { return v == null ? "R" : v < 20 ? "G" : v < 35 ? "Y" : "R"; }, v: function (v) { return v == null ? "אין רווח" : "~" + v; } }
];

/* Score: green 2, yellow 1, red 0. 6+ worth researching, 4-5 borderline, else not now. */
function cardVerdict(c) {
  var L = CARD_TESTS.map(function (t) { return t.f(c[t.k]); });
  var pts = L.reduce(function (a, x) { return a + (x === "G" ? 2 : x === "Y" ? 1 : 0); }, 0);
  var v = pts >= 6 ? ["G", "שווה לחקור"] : pts >= 4 ? ["Y", "גבולי"] : ["R", "לא עכשיו"];
  return { lights: L, cls: v[0], label: v[1], greens: L.filter(function (x) { return x === "G"; }).length };
}
