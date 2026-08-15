/* ==========================================================================
   NEXON — GitHub-backed admin layer (shared by admin.html)
   Ported from the NEX•ON admin panel: the same "protection" model — no
   server, no shared password. Whoever holds a valid GitHub Personal Access
   Token with write access to THIS repo can publish changes; everyone else
   can only read the public JSON files. All writes commit straight to the
   repo, so the public site (which reads properties.json/partners.json)
   updates automatically via GitHub Pages.
   ========================================================================== */
const API = "https://api.github.com";
const BRANCH = "main";
const CREDS_KEY = "nexon_admin_creds";

function esc(s){
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));
}

/* ---- turn any error (ours or GitHub's raw English messages) into Arabic ---- */
function friendlyError(err){
  const raw = (err && err.message) ? String(err.message) : String(err || "خطأ غير معروف");
  const map = [
    [/bad credentials/i, "مفتاح الدخول (Token) غلط أو منتهي الصلاحية. تأكد منه في إعدادات الدخول"],
    [/rate limit/i, "تجاوزت الحد المسموح من الطلبات على جيت هب مؤقتًا. استنى دقيقة وجرب تاني"],
    [/not accessible by (personal access token|integration)|resource not accessible/i, "مفتاح الدخول مالوش صلاحية كافية على المستودع ده. تأكد إنه معمول له Read and write على Contents"],
    [/bad\s*request/i, "الطلب فيه مشكلة، جرب تاني"],
    [/not found/i, "الملف أو المستودع مش موجود. تأكد من اسم المستخدم واسم المستودع"],
    [/sha wasn.?t (supplied|provided)|does not match|409/i, "حصل تعارض لأن البيانات اتغيرت في نفس الوقت. حدّث الصفحة وجرب من جديد"],
    [/exceeds the maximum|too large|payload too large|413/i, "حجم الملف كبير جدًا على الرفع"],
    [/failed to fetch|networkerror|load failed|network request failed/i, "تعذر الاتصال بالإنترنت. اتأكد من الشبكة وجرب تاني"],
    [/unprocessable|422/i, "البيانات المرسلة فيها مشكلة. تأكد من كل الحقول وجرب تاني"],
    [/forbidden|403/i, "الوصول ممنوع. تأكد من صلاحيات مفتاح الدخول"],
    [/انتهت المهلة|timeout/i, "العملية استغرقت وقت أطول من المتوقع. جرب تاني"]
  ];
  for (const [re, ar] of map) { if (re.test(raw)) return `${ar} (${raw})`; }
  if (/[\u0600-\u06FF]/.test(raw)) return raw;
  return "حصل خطأ غير متوقع: " + raw;
}

/* ---- retry transient network/server failures automatically ---- */
async function fetchWithRetry(url, opts, retries = 2, backoffMs = 1200){
  for (let attempt = 0; attempt <= retries; attempt++){
    try {
      const res = await fetch(url, opts);
      if (!res.ok && (res.status >= 500 || res.status === 429) && attempt < retries) {
        await new Promise(r => setTimeout(r, backoffMs * (attempt + 1)));
        continue;
      }
      return res;
    } catch (netErr) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, backoffMs * (attempt + 1)));
        continue;
      }
      throw netErr;
    }
  }
}

function withTimeout(promise, ms){
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("انتهت المهلة")), ms);
    promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

/* warn before leaving mid-upload so nothing is lost silently */
let uploadInProgress = false;
window.addEventListener("beforeunload", (e) => {
  if (uploadInProgress) { e.preventDefault(); e.returnValue = ""; }
});
function setUploadInProgress(v){ uploadInProgress = v; }

/* ---- credentials: token/owner/repo, on this device only ---- */
function loadCreds(){
  try{ return JSON.parse(localStorage.getItem(CREDS_KEY) || "null") || {}; }
  catch(e){ return {}; }
}
function saveCreds(creds){
  localStorage.setItem(CREDS_KEY, JSON.stringify(creds));
}
function clearCreds(){
  localStorage.removeItem(CREDS_KEY);
}

let _creds = loadCreds();
function getCreds(){ return _creds; }
function setCreds(c){ _creds = c; saveCreds(c); }

function ghHeaders(){
  return {
    "Authorization": "Bearer " + (_creds.token || "").trim(),
    "Accept": "application/vnd.github+json"
  };
}
function repoBase(){
  return `${API}/repos/${(_creds.owner||"").trim()}/${(_creds.repo||"").trim()}`;
}

async function ghGetFile(path){
  const res = await fetchWithRetry(`${repoBase()}/contents/${path}`, { headers: ghHeaders() });
  if (!res.ok) throw new Error(`تعذر تحميل ${path} (${res.status})`);
  const data = await res.json();
  const content = decodeURIComponent(escape(atob(data.content.replace(/\n/g,""))));
  return { content, sha: data.sha };
}
async function ghGetFileOptional(path){
  const res = await fetchWithRetry(`${repoBase()}/contents/${path}`, { headers: ghHeaders() });
  if (res.status === 404) return { content: "[]", sha: null };
  if (!res.ok) throw new Error(`تعذر تحميل ${path} (${res.status})`);
  const data = await res.json();
  const content = decodeURIComponent(escape(atob(data.content.replace(/\n/g,""))));
  return { content, sha: data.sha };
}
async function ghPutFile(path, contentStr, sha, message){
  const b64 = btoa(unescape(encodeURIComponent(contentStr)));
  const body = { message: message || `تحديث ${path}`, content: b64, branch: BRANCH };
  if (sha) body.sha = sha;
  const res = await fetchWithRetry(`${repoBase()}/contents/${path}`, {
    method: "PUT", headers: { ...ghHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    throw new Error(err.message || `فشل رفع ${path} (${res.status})`);
  }
  return res.json();
}

/* Git Data API (blob/tree/commit) — for binary files (images) and for
   committing several files atomically in a single commit. */
async function ghGetRef(branch){
  const res = await fetchWithRetry(`${repoBase()}/git/ref/heads/${branch}`, { headers: ghHeaders() });
  if (!res.ok) throw new Error(`تعذر قراءة الفرع (${res.status})`);
  return res.json();
}
async function ghGetCommit(sha){
  const res = await fetchWithRetry(`${repoBase()}/git/commits/${sha}`, { headers: ghHeaders() });
  if (!res.ok) throw new Error(`تعذر قراءة آخر تحديث (${res.status})`);
  return res.json();
}
async function ghCreateBlob(base64Content){
  const res = await fetchWithRetry(`${repoBase()}/git/blobs`, {
    method: "POST", headers: { ...ghHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ content: base64Content, encoding: "base64" })
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || `تعذر رفع الملف (${res.status})`); }
  return res.json();
}
async function ghCreateTree(baseTreeSha, entries){
  const res = await fetchWithRetry(`${repoBase()}/git/trees`, {
    method: "POST", headers: { ...ghHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ base_tree: baseTreeSha, tree: entries })
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || `تعذر بناء التحديث (${res.status})`); }
  return res.json();
}
async function ghCreateCommit(message, treeSha, parentSha){
  const res = await fetchWithRetry(`${repoBase()}/git/commits`, {
    method: "POST", headers: { ...ghHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ message, tree: treeSha, parents: [parentSha] })
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || `تعذر حفظ التحديث (${res.status})`); }
  return res.json();
}
async function ghUpdateRef(branch, commitSha){
  const res = await fetchWithRetry(`${repoBase()}/git/refs/heads/${branch}`, {
    method: "PATCH", headers: { ...ghHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ sha: commitSha })
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || `تعذر نشر التحديث (${res.status})`); }
  return res.json();
}
/* files: [{ path, base64 }] — all committed together, atomically */
async function ghCommitFiles(files, message, onProgress){
  const ref = await ghGetRef(BRANCH);
  const commit = await ghGetCommit(ref.object.sha);
  const entries = [];
  for (let i = 0; i < files.length; i++){
    if (onProgress) onProgress(i + 1, files.length);
    const blob = await ghCreateBlob(files[i].base64);
    entries.push({ path: files[i].path, mode: "100644", type: "blob", sha: blob.sha });
  }
  const tree = await ghCreateTree(commit.tree.sha, entries);
  const newCommit = await ghCreateCommit(message, tree.sha, ref.object.sha);
  await ghUpdateRef(BRANCH, newCommit.sha);
  return newCommit;
}
async function ghListRootFiles(){
  const res = await fetchWithRetry(`${repoBase()}/contents/`, { headers: ghHeaders() });
  if (!res.ok) throw new Error(`تعذر قراءة محتويات المستودع (${res.status})`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("رد غير متوقع من جيت هب أثناء قراءة المستودع");
  return data.filter(f => f.type === "file");
}
async function ghDeleteFile(path, sha, message){
  const res = await fetchWithRetry(`${repoBase()}/contents/${path}`, {
    method: "DELETE",
    headers: { ...ghHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ message, sha, branch: BRANCH })
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || `فشل حذف ${path} (${res.status})`); }
  return res.json();
}

function fileToBase64(file){
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/* A quick, cheap check that the token/owner/repo actually work before the
   user starts filling a whole form out. */
async function ghVerifyAccess(){
  const res = await fetchWithRetry(repoBase(), { headers: ghHeaders() });
  if (!res.ok) throw new Error(res.status === 404 ? "not found" : res.status === 401 ? "bad credentials" : `HTTP ${res.status}`);
  const data = await res.json();
  if (data.permissions && data.permissions.push === false) {
    throw new Error("resource not accessible by personal access token");
  }
  return data;
}

/* ---- managed media filenames (used by properties + partners) + dead-file cleanup ---- */
const MEDIA_NAME_PATTERNS = [
  /^image-u\d+-\d+\.[a-zA-Z0-9]+$/,      // property image: image-u12-1.jpg
  /^partner-logo-b\d+\.[a-zA-Z0-9]+$/    // partner logo: partner-logo-b1.png
];
function isManagedMediaName(name){
  return MEDIA_NAME_PATTERNS.some(re => re.test(name));
}
async function buildReferencedMediaSet(){
  const refs = new Set();
  let propsList;
  try {
    const { content } = await ghGetFile("properties.json");
    propsList = JSON.parse(content);
  } catch(e) {
    throw new Error("تعذر قراءة properties.json بأمان، فتوقفنا من غير ما نحذف حاجة: " + e.message);
  }
  propsList.forEach(p => { (p.images||[]).forEach(im => refs.add(im)); });

  let partnersList;
  try {
    const { content } = await ghGetFileOptional("partners.json");
    partnersList = JSON.parse(content || "[]");
  } catch(e) {
    throw new Error("تعذر قراءة partners.json بأمان، فتوقفنا من غير ما نحذف حاجة: " + e.message);
  }
  partnersList.forEach(p => { if (p.logo) refs.add(p.logo); });
  return refs;
}
