/* Stock quick cards: the shared data for the sectors sheet (and the map links to it).
   One entry per stock, updated by Claude after each quarterly report.
   rev: total revenue when segments include intersegment sales.
   seg: revenue by segment [name, $M] for the quarter.
   g: revenue growth YoY %, fcf: free cash flow margin % (null = negative), roic: return on capital % (null = negative),
   pe: forward P/E (null = no profit). warn: short warnings shown only when they matter.
   out: where the quarter's revenue went, $M: cost (cost of revenue), opex (R&D, sales, admin), other (interest, tax, other), net (net profit; negative = loss). */
var CARDS = {
  LMT: { q: "רבעון 3, 2026",
    seg: [["מטוסים (F‑35)", 8214], ["טילים ובקרת אש", 4501], ["מסוקים ומערכות", 4511], ["חלל", 3485]],
    g: 11, fcf: 10, roic: 25, pe: 19, warn: [],
    out: { cost: 18268, opex: 0, other: 598, net: 1845 },
    take: "הביקוש לטילי יירוט (PAC‑3) מושך את הצמיחה. צבר הזמנות שיא של 292 מיליארד דולר." },
  NOC: { q: "רבעון 3, 2026",
    seg: [["מטוסים (B‑21)", 3575], ["מערכות משימה", 3155], ["חלל", 2749], ["מערכות הגנה", 2307]],
    g: 7, fcf: 7.5, roic: 13, pe: 19, warn: [],
    rev: 11122, out: { cost: 8775, opex: 1079, other: 144, net: 1124 },
    take: "צמיחה איטית יותר, אבל צבר שיא של 110 מיליארד דולר והמפציץ B‑21 נכנס לייצור." },
  RKLB: { q: "רבעון 3, 2026",
    seg: [["מערכות חלל", 214.8], ["שיגורים", 53.1]],
    g: 73, fcf: null, roic: null, pe: null, warn: [["דילול", "מכרה מניות ב־2.4B$ ברבעון, החלק של כל משקיע בחברה קטן"]],
    out: { cost: 177.7, opex: 169.3, other: 0.5, net: -79.7 },
    take: "צומחת מהר מאוד אבל עדיין מפסידה. טיל Neutron נדחה ל־2027, ועסקת Iridium תוסיף חוב." },
  ESLT: { q: "רבעון 3, 2026",
    seg: [["יבשה ותחמושת", 758.7], ["אווירונאוטיקה", 498.9], ["מודיעין ול״א", 449.7], ["פעילות בארה״ב", 446.7], ["פיקוד ושליטה וסייבר", 269.7]],
    g: 17, fcf: 5, roic: 12, pe: 40, warn: [],
    rev: 2252.1, out: { cost: 1681.5, opex: 338.1, other: 54.6, net: 177.9 },
    take: "צמיחה חזקה וצבר שיא של 33 מיליארד דולר, 74% ממנו מחו״ל. המחיר כבר יקר מאוד." }
};

/* ===== Photonics, Nov 2026. FCF and ROIC here are rough estimates (~). ===== */
Object.assign(CARDS, {
  COHR: { q: "רבעון 1, שנת כספים 2027", rev: 2370.3,
    seg: [["דאטה סנטר ותקשורת", 1951.7], ["תעשייה", 418.6]],
    g: 50, fcf: null, roic: 10, pe: 21, warn: [["דילול", "מספר המניות עלה בכ־6% בשנה"]],
    out: { net: 384.7 },
    take: "82% מההכנסות מדאטה סנטרים, שצמחו 79%. משקיעה כבד במפעלים (776M$ ברבעון), ולכן התזרים שלילי כרגע." },
  LITE: { q: "רבעון 1, שנת כספים 2027", rev: 1262.6,
    seg: [["רכיבים", 754.2], ["מערכות", 508.4]],
    g: 137, fcf: 20, roic: 25, pe: 45, warn: [["בתהליך רכישה", "Marvell קונה אותה תמורת 4.5 מניות Marvell לכל מניה. המחיר זז עם Marvell"]],
    out: { net: 360.3 },
    take: "ההכנסות יותר מהוכפלו בשנה, עם שולי רווח גבוהים מאוד. בפועל היא כבר מניה של Marvell עד סגירת העסקה." },
  FN: { q: "רבעון 1, שנת כספים 2027", rev: 1474.5,
    seg: [["דאטה סנטר", 777], ["תשתיות תקשורת", 444], ["רכב, תעשייה ואחר", 253.5]],
    g: 51, fcf: 0, roic: 18, pe: 17, warn: [],
    out: { net: 103.5 },
    take: "קבלנית הייצור של עולם האופטיקה. צמיחה של 51%, ומכפיל נמוך מהממוצע שלה. השקעות בקיבולת מורידות את התזרים." },
  CIEN: { q: "רבעון 3, שנת כספים 2026", rev: 1670,
    seg: [["רשתות אופטיות", 1190], ["תוכנה ושירותים", 310], ["ניתוב ומיתוג", 170]],
    g: 37, fcf: 12, roic: 12, pe: 36, warn: [],
    out: { net: 266.4 },
    take: "צבר הזמנות שצפוי לעבור 10 מיליארד דולר. שני לקוחות הם 42% מההכנסות, ומגבלות אספקה מאטות." },
  GLW: { q: "רבעון 3, 2026", rev: 4855,
    seg: [["תקשורת אופטית", 2379], ["זכוכית", 1506], ["רכב", 470], ["סולארי", 436], ["מדעי החיים", 290]],
    g: 18, fcf: 12, roic: 10, pe: 30, warn: [],
    out: { net: 680 },
    take: "האופטיקה כבר כמעט חצי מהמכירות וצמחה 44%. שאר העסקים איטיים, והמכפיל גבוה בהרבה מהממוצע שלה." },
  AAOI: { q: "רבעון 3, 2026", rev: 269.9,
    seg: [["דאטה סנטר", 155.6], ["כבלים (CATV)", 110.9], ["אחר", 3.4]],
    g: 127, fcf: null, roic: null, pe: 24, warn: [["דילול", "מספר המניות עלה בכ־39% בשנה"], ["ריכוזיות", "3 לקוחות הם 92% מההכנסות"]],
    out: { net: 6.3 },
    take: "צמיחה מהירה מאוד, אבל רק עכשיו עברה לרווח קטן, והוא מגיע מהכנסות מימון ולא מהפעילות." }
});

/* ===== Memory & storage, Nov 2026. ROIC rough estimates (~). ===== */
Object.assign(CARDS, {
  MU: { q: "רבעון 4, שנת כספים 2026", rev: 54229,
    seg: [["דאטה סנטר (ליבה)", 18002], ["ענן ו־HBM", 16283], ["מובייל, רכב ואחר", 19938]],
    g: 379, fcf: 61, roic: 60, pe: 6, warn: [["מחזוריות", "בזיכרון מכפיל נמוך מאוד מסמן לפעמים שיא רווחים, לפני ירידת מחירים"]],
    out: { net: 37701 },
    take: "רבעון שיא בכל מדד, עם 68 מיליארד דולר מזומן נטו. השאלה היחידה היא כמה זמן מחירי הזיכרון יישארו גבוהים." },
  SNDK: { q: "רבעון 1, שנת כספים 2027", rev: 11031,
    seg: [["Edge (מחשבים וטלפונים)", 5832], ["דאטה סנטר", 4802], ["צרכנים", 397]],
    g: 378, fcf: 50, roic: 60, pe: 7, warn: [["מחזוריות", "בזיכרון מכפיל נמוך מאוד מסמן לפעמים שיא רווחים, לפני ירידת מחירים"]],
    out: { net: 8101 },
    take: "הדאטה סנטר קפץ מ־12% ל־44% מההכנסות בשנה. קונה מניות בחזרה בהיקף גדול, ומחצית מהייצור כבר סגור בחוזים." },
  WDC: { q: "רבעון 1, שנת כספים 2027", rev: 4381,
    seg: [["ענן", 3855], ["לקוחות וצרכנים", 526]],
    g: 55, fcf: 31, roic: 35, pe: 22, warn: [],
    out: { net: 1779 },
    take: "כוננים קשיחים בנפח גבוה לענן, 88% מההכנסות. שולי רווח של כמעט 50% ותזרים חזק, ומעלה דיבידנד." },
  STX: { q: "רבעון 1, שנת כספים 2027", rev: 4233,
    seg: [["דאטה סנטר", 3449], ["Edge IoT", 784]],
    g: 61, fcf: 35, roic: 35, pe: 25, warn: [],
    out: { net: 1761 },
    take: "תזרים חופשי שיא, ומחזירה חוב במהירות. רוב הקיבולת כבר מוקצית ללקוחות עד 2028." }
});

/* Traffic light per test: G / Y / R */
var CARD_TESTS = [
  { k: "g", l: "צמיחה", f: function (v) { return v >= 10 ? "G" : v >= 5 ? "Y" : "R"; }, v: function (v) { return (v > 0 ? "+" : "") + v + "%"; } },
  { k: "fcf", l: "תזרים חופשי", f: function (v) { return v == null ? "R" : v >= 8 ? "G" : v >= 0 ? "Y" : "R"; }, v: function (v) { return v == null ? "שלילי" : "~" + v + "%"; } },
  { k: "roic", l: "תשואה על ההון", f: function (v) { return v == null ? "R" : v >= 15 ? "G" : v >= 8 ? "Y" : "R"; }, v: function (v) { return v == null ? "שלילית" : "~" + v + "%"; } },
  { k: "pe", l: "מכפיל רווח", f: function (v) { return v == null ? "R" : v < 20 ? "G" : v < 35 ? "Y" : "R"; }, v: function (v) { return v == null ? "אין רווח" : "~" + v; } }
];

/* Score: green 2, yellow 1, red 0. 6+ worth researching, 4-5 borderline, else not now. */
function cardVerdict(c) {
  var L = CARD_TESTS.map(function (t) { return t.f(c[t.k]); });
  var pts = L.reduce(function (a, x) { return a + (x === "G" ? 2 : x === "Y" ? 1 : 0); }, 0);
  var v = pts >= 6 ? ["G", "שווה לחקור"] : pts >= 4 ? ["Y", "גבולי"] : ["R", "לא עכשיו"];
  return { lights: L, cls: v[0], label: v[1], greens: L.filter(function (x) { return x === "G"; }).length };
}
