/* أصوات البث في الدوري (10 نوفمبر 2026): ثابتة، نفس اللي مختار في منصة فيكارو الثقافية، صوت واحد لكل حدث وبدون قائمة اختيار.
   node tests/harness/sfx.mjs */
import fs from "node:fs";
import { serve, FakeDB, seed, launch, device, until, sleep } from "./harness.mjs";

const srv = await serve(Number(process.env.HARNESS_PORT) || 8796);
let ok = true;
const check = (name, v, extra) => { if (!v) ok = false; console.log((v ? "PASS " : "FAIL ") + name + (extra !== undefined ? " " + JSON.stringify(extra) : "")); };
const FIX = { strike: "14", bad: "8", seg: "22", ok: "7", miss: "16", pass: "16", time: "9", spin: "9", h3: "64", h2: "62", round: "17", land: "67", h1: "62" };
const browser = await launch({ wav: "silence.wav" });
const db = new FakeDB(30);
seed(db, "playing", { seg: 1, phase: "buzz", qIndex: 0, qAt: Date.now(), deadline: Date.now() + 60000, ready1: true, ready2: true, hostSeen: Date.now() });
/* لو أحد كتب اختيار في القاعدة، الدوري ما ياخذه */
db.docs.set("room/main/liveDiag/_sfx", { ver: 1, data: { map: { h1: "3", ok: "5" } } });
const host = await device(browser, db, "host", {});
const fan = await device(browser, db, "fan", {});
try {
    const files = fs.readdirSync(new URL("../../audio/", import.meta.url)).filter(f => /^sx_/.test(f)).sort();
    const want = Object.entries(FIX).map(([k, n]) => `sx_${k}_${n}.mp3`).sort();
    check("في audio/ بس الأصوات الـ13 المختارة", JSON.stringify(files) === JSON.stringify(want), files.length);
    await until(() => fan.evaluate(() => typeof SFX_FIXED !== "undefined"), 8000);
    check("الاختيار الثابت نفس منصة الثقافة", await fan.evaluate(f => JSON.stringify(SFX_FIXED) === JSON.stringify(f) && SFX_EVENTS.every(e => sfxChosen(e.k) === f[e.k]), FIX));
    check("القائمة الجانبية ما فيها أصوات البث (للمنظم)", await host.evaluate(() => { const m = document.getElementById("sideMenu"); return !m || !/أصوات البث/.test(m.innerHTML); }));
    await host.evaluate(() => { try { sfxListen(); } catch (e) {} });
    await sleep(800);
    check("اختيار القاعدة ما يغيّر شي", await host.evaluate(f => SFX_EVENTS.every(e => sfxChosen(e.k) === f[e.k]), FIX));
    check("الأصوات الـ13 مع أصوات البث الأساسية (تتحمّل أول ما ينفتح البث)", await fan.evaluate(f => Object.entries(f).every(([k, n]) => CINE_CORE.includes("sx_" + k + "_" + n)), FIX));
    const loaded = await until(() => fan.evaluate(f => Object.entries(f).every(([k, n]) => !!CINE_BUF["sx_" + k + "_" + n]), FIX), 12000);
    check("كلها تحمّلت عند المشاهد", !!loaded);
    await fan.evaluate(() => { window.__played = []; const o = window.cinePlay; window.cinePlay = (id, v, x) => { window.__played.push(id); return o(id, v, x); }; });
    await fan.evaluate(() => SFX_EVENTS.forEach(e => { if (e.k !== "spin") SG_SFX[e.k](); }));
    const played = await fan.evaluate(() => window.__played);
    check("كل حدث يشغّل صوته المختار", Object.entries(FIX).filter(([k]) => k !== "spin").every(([k, n]) => played.includes("sx_" + k + "_" + n)), played);
    for (const [n, pg] of [["host", host], ["fan", fan]]) { const errs = pg.__logs.filter(l => /PAGEERROR/.test(l)); check(n + ": no page errors", !errs.length, errs.slice(0, 3)); }
} catch (e) { ok = false; console.log(e.stack || e); }
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
