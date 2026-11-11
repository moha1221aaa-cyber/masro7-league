/* تبويب التوقعات في الدوري (11 نوفمبر 2026): نفس نظام البث، الفائز أو التعادل بدون نتيجة، ونفس مكان الحفظ،
   وترتيب الموسم من league/predBoard، والتوقعات القديمة بالأرقام تنقرا فائز أو تعادل. node tests/harness/tabpred.mjs */
import { serve, FakeDB, seed, launch, device, until, sleep, liveDoc } from "./harness.mjs";

const srv = await serve(Number(process.env.HARNESS_PORT) || 8801);
let ok = true;
const check = (name, v, extra) => { if (!v) ok = false; console.log((v ? "PASS " : "FAIL ") + name + (extra !== undefined ? " " + JSON.stringify(extra) : "")); };
const browser = await launch({ wav: "silence.wav" });
const db = new FakeDB(30);
seed(db, "intro", { sceneAt: Date.now() - 3000, status: "scheduled", startAt: Date.now() + 3600000 });
/* توقع قديم بالأرقام لمواجهة خلصت (سعد 3-1 خالد في الجولة 1)، وترتيب موسم جاهز */
db.docs.set("predictions/u_fan_r1_سعد_خالد", { ver: 1, data: { userId: "u_fan", matchId: "r1_سعد_خالد", s1: 2, s2: 0 } });
db.docs.set("league/predBoard", { ver: 1, data: { u: { u_fan: { n: "مشاهد", p: 3, c: 1, a: 1 }, u_x: { n: "سارة", p: 9, c: 3, a: 3 } }, k: ["r1_سعد_خالد"] } });
const fan = await device(browser, db, "fan", {});
try {
    await fan.evaluate(() => showTab(null, "predictions"));
    check("التبويب: ثلاث أزرار لكل مواجهة قادمة (بدون خانات أرقام)", !!await until(() => fan.evaluate(() => !!document.querySelector("#predictionContent .prediction-picks button") && !document.querySelector("#predictionContent input[type=number]") && [...document.querySelector("#predictionContent .prediction-picks").children].map(b => b.textContent.trim()).join("|") === "سعد|تعادل|فهد"), 8000));
    check("مجموعك ومركزك فوق (من ترتيب الموسم)", !!await until(() => fan.evaluate(() => /3/.test(document.querySelector(".pr-tab-me")?.textContent || "") && /المركز 2/.test(document.querySelector(".pr-tab-me").textContent)), 6000));
    check("التوقع القديم بالأرقام يطلع فائز (سعد) +3", await fan.evaluate(() => /توقعك: سعد/.test(document.getElementById("predictionContent").textContent) && /\+3 نقاط/.test(document.getElementById("predictionContent").textContent)));
    await fan.evaluate(() => [...document.querySelectorAll("#predictionContent .prediction-picks button")].find(b => b.textContent.trim() === "تعادل").click());
    const p = await until(() => db.data("predictions/u_fan_r2_سعد_فهد"), 5000);
    check("التعادل انحفظ بنفس مكان البث ووقته", p && p.w === 0 && p.tw && p.matchId === "r2_سعد_فهد", p);
    check("الزر صار مختار", !!await until(() => fan.evaluate(() => [...document.querySelectorAll("#predictionContent .prediction-picks button.on")].some(b => b.textContent.trim() === "تعادل")), 4000));
    /* البث يبدأ: نفس التوقع مختار في صفحة "جاهز" */
    const d = liveDoc(db); d.status = "live"; d.scene = "intro"; db.write({ op: "set", path: "room/main/liveMatches/round_2", data: d });
    await fan.evaluate(() => openLiveScreen("round_2"));
    check("في البث: نفس التوقع (تعادل) مختار", !!await until(() => fan.evaluate(() => (document.querySelector(".st-predbtns .on") || {}).textContent === "تعادل"), 8000));
    /* البث بدأ المواجهة: التبويب يقفلها */
    const d2 = liveDoc(db); d2.scene = "talk"; db.write({ op: "set", path: "room/main/liveMatches/round_2", data: d2 });
    await sleep(800);
    await fan.evaluate(() => closeLiveScreen(true)); await sleep(400);
    await fan.evaluate(() => { showTab(null, "predictions"); renderPredictions(); });
    check("المواجهة بدأت في البث: التبويب يقفل توقعها", !!await until(() => fan.evaluate(() => { const c = [...document.querySelectorAll("#predictionContent .prediction-match")].find(x => /سعد/.test(x.textContent) && /فهد/.test(x.textContent)); return c && c.classList.contains("locked") && [...c.querySelectorAll("button")].every(b => b.disabled); }), 5000));
    await fan.evaluate(() => switchPredictionTab("ranking"));
    check("الترتيب: ترتيب الموسم (سارة 9 أول، وأنت 3)", !!await until(() => fan.evaluate(() => { const c = document.querySelectorAll("#rankingContent .user-card"); return c.length === 2 && /سارة/.test(c[0].textContent) && /9/.test(c[0].textContent) && c[1].classList.contains("is-me"); }), 6000));
    check("إحصائيات الملف من ترتيب الموسم", await fan.evaluate(() => { const s = getUserPredictionStats("u_fan"); return s.rank === 2 && s.points === 3 && s.correct === 1 && s.total === 1; }));
    const errs = fan.__logs.filter(l => /PAGEERROR/.test(l)); check("no page errors", !errs.length, errs.slice(0, 3));
} catch (e) { ok = false; console.log(e.stack || e); }
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
