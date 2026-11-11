/* التوقعات (11 نوفمبر 2026، طلب محمد): نفس نظام البث بالضبط (js/broadcast/predict.js):
   المشاهد يختار فائز المواجهة أو التعادل (بدون إدخال نتيجة)، والتوقعات في نفس المكان predictions/<uid>_<المواجهة>،
   فاللي يتوقعه هنا يطلع في البث، واللي يتوقعه في البث يطلع هنا. النقاط: الفائز صح 3، وفائز كل فقرة صح 1 (في البث)،
   وكل توقعات المواجهة صح نقطتين زيادة. الترتيب ترتيب الموسم من league/predBoard (يحسبه جهاز المنظم).
   التوقعات القديمة (نتيجة بالأرقام) تنقرا كفائز أو تعادل. */

function loadPredictions() {
if(!firebaseDB || !currentUser) return;
prEnsure();
predictions = PR.mine;
renderPredictions();
renderRankingUI();
}

/* مواجهة الدوري بصيغة التوقعات (النتيجة، وفائزين الفقرات ولحظات القفل من البث لو انلعبت فيه) */
function prMatchOf(m) {
const key = getMatchId(m);
const r = (PR.res && PR.res.k && PR.res.k[key]) || {};
return { s1: m.s1, s2: m.s2, sw: r.sw || null, lk: r.lk || null };
}
function calculatePredictionPoints(pred, match) {
if(!pred || !match || match.s1 === "" || match.s2 === "") return 0;
return prScore(pred, prMatchOf(match)).pts;
}

/* التوقع ينقفل لو المواجهة لها نتيجة، أو بدأت في بث مباشر */
function prTabLocked(m) {
if(m.s1 !== "" && m.s2 !== "") return true;
const key = getMatchId(m);
if(typeof liveMatchesCache === "undefined") return false;
return Object.keys(liveMatchesCache).some(id => {
const d = liveMatchesCache[id];
if(!d || d.status !== "live" || d.rehearsal || id === "__replay") return false;
return (d.order || []).some((o, i) => prBcKey(d, i) === key && (o.state === "done" || (i === d.cur && d.scene !== "intro") || ((d.lks || {})[i] || {}).w));
});
}
function prTabPick(matchId, v) {
if(!currentUser) return uiAlert("سجّل دخول من تبويب الحساب عشان تتوقع");
const m = matches.find(x => getMatchId(x) === matchId);
if(m && prTabLocked(m)) return roomToast("التوقع انقفل: المواجهة بدأت", "lock");
prSave(matchId, "w", v).then(ok => { if(ok) roomToast("انحفظ توقعك", "check"); });
}

function renderPredictions() {
let container = document.getElementById("predictionContent");
if(!container) return;

if(!currentUser) {
container.innerHTML = `
<div class="account-box">
<h3><svg class="ic" aria-hidden="true"><use href="#i-lock"/></svg> توقع نتائج المواجهات</h3>
<p class="login-message">سجّل دخول من تبويب "الحساب" عشان تتوقع وتجمع نقاط في ترتيب الموسم</p>
<button onclick="showTab(null, 'accountTab')"><svg class="ic" aria-hidden="true"><use href="#i-rocket"/></svg> الذهاب لتسجيل الدخول</button>
</div>
`;
return;
}
predictions = PR.mine;

let upcomingMatches = matches.filter(m => m.s1 === "" || m.s2 === "");
let completedMatches = matches.filter(m => m.s1 !== "" && m.s2 !== "");
const me = prMyRow(currentUser.uid);

let html = `<div class="pr-tab-me">🎯 <b>${me.p}</b> نقطة${me.rank ? ` · المركز ${me.rank}` : ""}<small>الفائز صح ${PR_PTS.w} · فائز الفقرة في البث ${PR_PTS.g} · كلها صح +${PR_PTS.bonus}</small></div>`;

if(upcomingMatches.length > 0) {
html += `<h3 style="text-align:center; color:#60a5fa; margin:10px 0;"><svg class="ic" aria-hidden="true"><use href="#i-ball"/></svg> المواجهات القادمة للتوقع</h3>`;
upcomingMatches.forEach(m => {
let matchId = getMatchId(m);
let pick = prPick(predictions[matchId], "w");
let locked = prTabLocked(m);
let av1 = getPlayerAvatar(m.p1.name);
let av2 = getPlayerAvatar(m.p2.name);
const btn = (v, label) => `<button class="${pick === v ? "on" : ""}" ${locked ? "disabled" : ""} onclick="prTabPick(${jsArg(matchId)}, ${v})">${label}</button>`;

html += `
<div class="prediction-match ${locked ? "locked" : ""}">
<div class="prediction-round">جولة ${m.round}${locked ? ` · ${ic("lock")} انقفل` : ""}</div>
<div class="prediction-teams-box">
<div class="prediction-player">
<img loading="lazy" decoding="async" src="${safeSrc(av1.url)}" class="prediction-player-img" alt="">
<div class="prediction-player-name">${escapeHTML(m.p1.name)}</div>
</div>
<div class="prediction-vs">ضد</div>
<div class="prediction-player">
<img loading="lazy" decoding="async" src="${safeSrc(av2.url)}" class="prediction-player-img" alt="">
<div class="prediction-player-name">${escapeHTML(m.p2.name)}</div>
</div>
</div>
<div class="prediction-picks">${btn(1, escapeHTML(m.p1.name))}${btn(0, "تعادل")}${btn(2, escapeHTML(m.p2.name))}</div>
</div>
`;
});
} else {
html += `<div style="text-align:center; padding:20px; color:#94a3b8;">لا توجد مواجهات قادمة للتوقع حالياً</div>`;
}

if(completedMatches.length > 0) {
let done = "";
completedMatches.forEach(m => {
let matchId = getMatchId(m);
let pred = predictions[matchId];
if(!pred) return;
const sc = prScore(pred, prMatchOf(m));
const pick = prPick(pred, "w");
const pickTxt = pick === 1 ? m.p1.name : (pick === 2 ? m.p2.name : (pick === 0 ? "تعادل" : "—"));
let av1 = getPlayerAvatar(m.p1.name);
let av2 = getPlayerAvatar(m.p2.name);
let ptsColor = sc.pts >= PR_PTS.w ? "#4ade80" : (sc.pts > 0 ? "#38bdf8" : "#f87171");
done += `
<div class="prediction-match" style="border-color:#475569;">
<div class="prediction-round">جولة ${m.round} (انتهت)</div>
<div class="prediction-teams-box">
<div class="prediction-player">
<img loading="lazy" decoding="async" src="${safeSrc(av1.url)}" class="prediction-player-img" alt="">
<div class="prediction-player-name">${escapeHTML(m.p1.name)}</div>
</div>
<div style="text-align:center;">
<div style="font-size:16px; font-weight:bold; color:white;">${m.s1} : ${m.s2}</div>
<div style="font-size:11px; color:#94a3b8; margin-top:2px;">توقعك: ${escapeHTML(pickTxt)}</div>
</div>
<div class="prediction-player">
<img loading="lazy" decoding="async" src="${safeSrc(av2.url)}" class="prediction-player-img" alt="">
<div class="prediction-player-name">${escapeHTML(m.p2.name)}</div>
</div>
</div>
<div class="prediction-points" style="color:${ptsColor};">+${sc.pts} نقاط${sc.all > 1 ? ` <small>(${sc.ok} من ${sc.all} صح)</small>` : ""}</div>
</div>
`;
});
if(done) html += `<h3 style="text-align:center; color:#facc15; margin:20px 0 10px;"><svg class="ic" aria-hidden="true"><use href="#i-clipboard"/></svg> نتائج توقعاتك السابقة</h3>` + done;
}

container.innerHTML = html;
}

function switchPredictionTab(tab) {
document.querySelectorAll(".prediction-tab").forEach(t => t.classList.remove("active"));
document.querySelectorAll(".prediction-page").forEach(p => p.classList.remove("active"));

if(tab === 'predict') {
document.querySelectorAll(".prediction-tab")[0].classList.add("active");
document.getElementById("predictPage").classList.add("active");
} else {
document.querySelectorAll(".prediction-tab")[1].classList.add("active");
document.getElementById("rankingPage").classList.add("active");
ensurePredictionRanking();
renderRankingUI();
}
}

function startPredictionRanking() {
if(!firebaseDB) return;

usersRankingListener = firebaseDB.collection("users").onSnapshot(snapshot => {
cachedUsersData = {};
snapshot.forEach(doc => {
cachedUsersData[doc.id] = thumbUser(doc.data());
});
if (typeof bcDeferPage === "function") { tableStats(); bcDeferPage("users", () => { renderRankingUI(); table(); }); }
else { renderRankingUI(); table(); }
});

}

/* ترتيب الموسم وثيقة وحدة (league/predBoard)، بدل ما كل زائر يقرا توقعات الكل */
let predsRankingWaiters = [];
function ensurePredictionRanking(onReady) {
if(typeof prEnsure === "function") prEnsure();
if(PR.board) return true;
if(onReady) predsRankingWaiters.push(onReady);
const t = setInterval(() => {
if(!PR.board) return;
clearInterval(t);
const w = predsRankingWaiters; predsRankingWaiters = [];
w.forEach(f => { try { f(); } catch(e) {} });
renderRankingUI();
}, 400);
setTimeout(() => clearInterval(t), 15000);
return false;
}

function getPredictionRankingList() {
return prRank(PR.board).map(x => {
const u = cachedUsersData[x.uid] || {};
return { uid: x.uid, name: u.name || u.displayName || x.n || "مستخدم", photoURL: u.photoURL || "", points: x.p, correct: x.c, total: x.a };
});
}

function renderRankingUI() {
let container = document.getElementById("rankingContent");
if(!container) return;

let list = getPredictionRankingList();

if(list.length === 0) {
container.innerHTML = `<div class="empty-ranking">لا يوجد متنافسون في التوقعات حالياً</div>`;
return;
}

let html = `<div class="ranking-cards-container">`;

list.forEach((item, index) => {
let isMe = (currentUser && item.uid === currentUser.uid);
let rank = index + 1;
let rankClass = rank === 1 ? "rank-1" : (rank === 2 ? "rank-2" : (rank === 3 ? "rank-3" : ""));
let rankBadge = rank === 1 ? ic("medal","m1") : (rank === 2 ? ic("medal","m2") : (rank === 3 ? ic("medal","m3") : rank));

let avatarSrc = cdnThumb(item.photoURL) || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name.charAt(0))}&background=2563eb&color=fff&bold=true`;

html += `
<div class="user-card ${isMe ? 'is-me' : ''}" onclick="openUserProfile(${jsArg(item.uid)}, '')">
<div class="user-card-rank ${rankClass}">${rankBadge}</div>
<div class="user-card-profile">
<div class="user-card-avatar">
<img loading="lazy" decoding="async" src="${safeSrc(avatarSrc)}" alt="">
</div>
<div class="user-card-info">
<div class="user-card-name">
${escapeHTML(item.name)} ${isMe ? '<span class="user-me-badge">أنت</span>' : ''}
</div>
<div class="user-card-stats">توقعات صحيحة: ${item.correct} من ${item.total}</div>
</div>
</div>
<div class="user-card-score">
<div class="user-card-points">${item.points}</div>
<div class="user-card-points-label">نقطة</div>
</div>
</div>
`;
});

html += `</div>`;
container.innerHTML = html;
}

function getUserPredictionStats(targetUid) {
const r = prMyRow(targetUid);
return { rank: r.rank || "-", points: r.p || 0, correct: r.c || 0, total: r.a || 0, exact: 0 };
}
