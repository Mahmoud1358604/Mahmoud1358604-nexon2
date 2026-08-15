/* Admin dashboard logic — GitHub-backed (see js/github-api.js).
   Every publish commits properties.json / partners.json (+ any uploaded
   media) straight to the repo, so the public site updates automatically. */
(function(){
  const FEATURE_OPTIONS = [
    "مصعد","مطبخ مجهز","تكييف مركزي","تكييف","أمن وحراسة","جراج خاص",
    "حديقة خاصة","روف خاص","بلكونة","مفروشة بالكامل","إنترنت","عداد كهرباء مستقل"
  ];

  let _units = [];
  let _unitsSha = null;
  let _partners = [];
  let _partnersSha = null;
  let _pendingUnitFiles = [];   // File[] chosen in the unit form, not yet uploaded
  let _pendingPartnerFile = null;

  function toast(msg){
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), 2600);
  }

  function setBusy(btn, busy, busyLabel){
    if (!btn) return;
    if (busy) { btn._label = btn.textContent; btn.textContent = busyLabel || "جارِ الحفظ..."; btn.disabled = true; }
    else { btn.textContent = btn._label || btn.textContent; btn.disabled = false; }
  }

  /* ---------------- Auth (GitHub creds gate) ---------------- */
  function initAuth(){
    const loginView = document.getElementById("loginView");
    const dashView = document.getElementById("dashView");
    const creds = getCreds();

    document.getElementById("clearCredsBtn").addEventListener("click", () => {
      clearCreds();
      toast("اتمسحت البيانات من الجهاز ده");
      document.getElementById("loginOwner").value = "";
      document.getElementById("loginRepo").value = "";
      document.getElementById("loginToken").value = "";
    });

    if (creds.token && creds.owner && creds.repo) {
      document.getElementById("loginOwner").value = creds.owner;
      document.getElementById("loginRepo").value = creds.repo;
    }

    if (creds.token && creds.owner && creds.repo && sessionStorage.getItem("nexon_admin_session") === "1") {
      loginView.style.display = "none";
      dashView.style.display = "block";
      initDashboard();
      return;
    }

    loginView.style.display = "flex";
    dashView.style.display = "none";

    document.getElementById("loginForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = document.getElementById("loginError");
      const btn = document.getElementById("loginBtn");
      err.textContent = "";
      const owner = document.getElementById("loginOwner").value.trim();
      const repo = document.getElementById("loginRepo").value.trim();
      const tokenField = document.getElementById("loginToken").value.trim();
      const token = tokenField || creds.token || "";
      const remember = document.getElementById("loginRemember").checked;

      if (!owner || !repo || !token) {
        err.textContent = "من فضلك املأ اسم المستخدم واسم المستودع ومفتاح الدخول";
        return;
      }

      setCreds({ owner, repo, token });
      setBusy(btn, true, "جارِ التحقق...");
      try {
        await ghVerifyAccess();
        sessionStorage.setItem("nexon_admin_session", "1");
        if (!remember) {
          // still needed for this tab's session — but strip on next full load
          sessionStorage.setItem("nexon_admin_forget_on_close", "1");
        }
        location.reload();
      } catch (ex) {
        err.textContent = friendlyError(ex);
        setBusy(btn, false);
      }
    });
  }

  function logout(){
    sessionStorage.removeItem("nexon_admin_session");
    if (sessionStorage.getItem("nexon_admin_forget_on_close") === "1") clearCreds();
    location.reload();
  }

  /* ---------------- Load data from GitHub ---------------- */
  async function loadAll(){
    const note = document.getElementById("connNote");
    note.textContent = `متصل بمستودع ${esc(getCreds().owner)}/${esc(getCreds().repo)} — أي حفظ هيتنشر على الموقع مباشرة`;
    note.className = "admin-note ok";
    try {
      const [u, p] = await Promise.all([
        ghGetFile("properties.json"),
        ghGetFileOptional("partners.json")
      ]);
      _units = JSON.parse(u.content || "[]");
      _unitsSha = u.sha;
      _partners = JSON.parse(p.content || "[]");
      _partnersSha = p.sha;
    } catch (ex) {
      note.textContent = friendlyError(ex);
      note.className = "admin-note error";
      throw ex;
    }
  }

  /* ---------------- Units: render ---------------- */
  function renderStats(){
    const counts = { available: 0, reserved: 0, sold: 0 };
    _units.forEach(u => counts[u.status] = (counts[u.status]||0) + 1);
    document.getElementById("statTotal").textContent = _units.length;
    document.getElementById("statAvailable").textContent = counts.available || 0;
    document.getElementById("statReserved").textContent = counts.reserved || 0;
    document.getElementById("statSold").textContent = counts.sold || 0;
  }

  function renderTable(){
    const tbody = document.getElementById("unitsTableBody");
    if(!_units.length){
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:30px">لا توجد وحدات بعد — ابدأ بإضافة وحدة جديدة</td></tr>`;
      return;
    }
    tbody.innerHTML = _units.map(u => `
      <tr>
        <td><img class="row-thumb" src="${esc(u.images[0]||'')}" alt=""></td>
        <td>${esc(u.title)}</td>
        <td>${esc(NexonDataFmt(u))}</td>
        <td>${u.listingType === "rent" ? "إيجار" : "بيع"}</td>
        <td><span class="status-pill ${esc(u.status)}">${esc(statusLabel(u.status))}</span></td>
        <td>${esc(u.area)} م² · ${esc(u.bedrooms)} غرف</td>
        <td>
          <div class="row-actions">
            <button class="btn btn-ghost btn-sm" data-cycle="${esc(u.id)}" title="تغيير الحالة">تبديل الحالة</button>
            <button class="btn btn-ghost btn-sm" data-edit="${esc(u.id)}">تعديل</button>
            <button class="btn btn-danger btn-sm" data-delete="${esc(u.id)}">حذف</button>
          </div>
        </td>
      </tr>
    `).join("");

    tbody.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => openModal(b.dataset.edit)));
    tbody.querySelectorAll("[data-cycle]").forEach(b => b.addEventListener("click", () => cycleStatus(b.dataset.cycle)));
    tbody.querySelectorAll("[data-delete]").forEach(b => b.addEventListener("click", () => deleteUnit(b.dataset.delete)));
  }

  function statusLabel(s){ return { available: "متاح", reserved: "محجوز", sold: "تم البيع" }[s] || s; }
  function NexonDataFmt(u){
    const num = Number(u.price).toLocaleString("ar-EG");
    return u.priceUnit ? `${num} ج.م / ${u.priceUnit}` : `${num} ج.م`;
  }
  function esc(s){
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
    }[c]));
  }

  async function cycleStatus(id){
    const unit = _units.find(u => u.id === id);
    if (!unit) return;
    const order = ["available","reserved","sold"];
    unit.status = order[(order.indexOf(unit.status)+1) % order.length];
    try {
      await publishUnits(`تحديث حالة: ${unit.title}`);
      renderStats(); renderTable();
      toast("اتغيرت الحالة إلى: " + statusLabel(unit.status));
    } catch (ex) { toast(friendlyError(ex)); await loadAll(); renderStats(); renderTable(); }
  }

  async function deleteUnit(id){
    const unit = _units.find(u => u.id === id);
    if (!unit) return;
    if (!confirm(`متأكد إنك عايز تحذف "${unit.title}"؟`)) return;
    const prev = _units.slice();
    _units = _units.filter(u => u.id !== id);
    try {
      await publishUnits(`حذف وحدة: ${unit.title}`);
      renderStats(); renderTable();
      toast("تم حذف الوحدة");
    } catch (ex) {
      _units = prev;
      toast(friendlyError(ex));
    }
  }

  /* ---------------- Modal / form ---------------- */
  function featureCheckboxesHtml(selected){
    return FEATURE_OPTIONS.map(f => `
      <label class="checkbox-item">
        <input type="checkbox" value="${esc(f)}" ${selected.includes(f) ? "checked" : ""}>
        ${esc(f)}
      </label>`).join("");
  }

  function openModal(id){
    const unit = id ? _units.find(u => u.id === id) : null;
    _pendingUnitFiles = [];
    const overlay = document.getElementById("modalOverlay");
    document.getElementById("modalTitle").textContent = unit ? "تعديل الوحدة" : "إضافة وحدة جديدة";
    document.getElementById("f_id").value = unit ? unit.id : "";
    document.getElementById("f_title").value = unit ? unit.title : "";
    document.getElementById("f_status").value = unit ? unit.status : "available";
    document.getElementById("f_listingType").value = unit ? unit.listingType : "rent";
    document.getElementById("f_price").value = unit ? unit.price : "";
    document.getElementById("f_priceUnit").value = unit ? unit.priceUnit : "شهريا";
    document.getElementById("f_category").value = unit ? unit.category : "شقة سكنية";
    document.getElementById("f_area").value = unit ? unit.area : "";
    document.getElementById("f_bedrooms").value = unit ? unit.bedrooms : "";
    document.getElementById("f_bathrooms").value = unit ? unit.bathrooms : "";
    document.getElementById("f_floor").value = unit ? unit.floor : "";
    document.getElementById("f_age").value = unit ? unit.age : "جديد";
    document.getElementById("f_location").value = unit ? unit.location : "القاهرة الجديدة — التجمع الخامس";
    document.getElementById("f_description").value = unit ? unit.description : "";
    document.getElementById("f_images").value = unit && unit.images ? unit.images.join("\n") : "";
    document.getElementById("f_imageFiles").value = "";
    document.getElementById("unitImagesPreview").innerHTML = (unit && unit.images ? unit.images : [])
      .map(src => `<img src="${esc(src)}">`).join("");
    document.getElementById("featureCheckboxes").innerHTML = featureCheckboxesHtml(unit ? unit.features : []);
    document.getElementById("formError").textContent = "";
    overlay.classList.add("open");
  }

  function closeModal(){
    document.getElementById("modalOverlay").classList.remove("open");
  }

  async function publishUnits(message){
    const res = await ghPutFile("properties.json", JSON.stringify(_units, null, 2), _unitsSha, message);
    _unitsSha = res.content.sha;
  }

  async function saveForm(e){
    e.preventDefault();
    const err = document.getElementById("formError");
    const btn = document.getElementById("unitSubmitBtn") || e.submitter;
    err.textContent = "";
    const title = document.getElementById("f_title").value.trim();
    const price = document.getElementById("f_price").value;
    const area = document.getElementById("f_area").value;
    const imagesRaw = document.getElementById("f_images").value.trim();

    if(!title || !price || !area){
      err.textContent = "من فضلك املأ العنوان والسعر والمساحة على الأقل";
      return;
    }

    const idField = document.getElementById("f_id").value;
    const id = idField || ("u" + Date.now());
    const manualImages = imagesRaw ? imagesRaw.split("\n").map(s => s.trim()).filter(Boolean) : [];

    setBusy(btn, true, _pendingUnitFiles.length ? "جارِ رفع الصور..." : "جارِ الحفظ...");
    setUploadInProgress(true);
    try {
      let uploadedPaths = [];
      if (_pendingUnitFiles.length) {
        const files = [];
        for (let i = 0; i < _pendingUnitFiles.length; i++){
          const f = _pendingUnitFiles[i];
          if (f.size > 8 * 1024 * 1024) throw new Error(`الصورة "${f.name}" حجمها كبير جدًا (الحد الأقصى 8MB)`);
          const ext = (f.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g,"") || "jpg";
          const path = `assets/properties/image-${id}-${i+1}.${ext}`;
          const base64 = await fileToBase64(f);
          files.push({ path, base64 });
          uploadedPaths.push(path);
        }
        await ghCommitFiles(files, `رفع صور للوحدة: ${title}`);
      }

      const images = [...uploadedPaths, ...manualImages];
      if (!images.length) images.push("assets/properties/unit-1.svg");

      const features = Array.from(document.querySelectorAll("#featureCheckboxes input:checked")).map(i => i.value);

      const unit = {
        id, title,
        status: document.getElementById("f_status").value,
        listingType: document.getElementById("f_listingType").value,
        price: Number(price),
        priceUnit: document.getElementById("f_priceUnit").value.trim(),
        category: document.getElementById("f_category").value.trim() || "شقة سكنية",
        area: Number(area),
        bedrooms: Number(document.getElementById("f_bedrooms").value || 0),
        bathrooms: Number(document.getElementById("f_bathrooms").value || 0),
        floor: document.getElementById("f_floor").value.trim(),
        age: document.getElementById("f_age").value.trim(),
        location: document.getElementById("f_location").value.trim(),
        description: document.getElementById("f_description").value.trim(),
        features, images
      };

      const existingIdx = _units.findIndex(u => u.id === id);
      if (existingIdx >= 0) _units[existingIdx] = unit; else _units.push(unit);

      await publishUnits(idField ? `تحديث وحدة: ${title}` : `إضافة وحدة: ${title}`);
      closeModal();
      renderStats(); renderTable();
      toast(idField ? "تم حفظ التعديلات ونشرها" : "تمت إضافة الوحدة ونشرها");
    } catch (ex) {
      err.textContent = friendlyError(ex);
    } finally {
      setUploadInProgress(false);
      setBusy(btn, false);
    }
  }

  /* ---------------- Partners ---------------- */
  function renderPartnersList(){
    const list = document.getElementById("partnersList");
    if (!_partners.length) {
      list.innerHTML = `<p style="color:var(--text-muted); font-size:13.5px;">لا يوجد مكاتب شريكة بعد</p>`;
      return;
    }
    list.innerHTML = _partners.map(p => `
      <div class="mini-row">
        <img src="${esc(p.logo)}" alt="">
        <div class="info"><b>${esc(p.name)}</b><span>${esc(p.location || p.info || "")}</span></div>
        <div class="actions">
          <button class="btn btn-danger btn-sm" data-del-partner="${esc(p.id)}">حذف</button>
        </div>
      </div>`).join("");
    list.querySelectorAll("[data-del-partner]").forEach(b => b.addEventListener("click", () => deletePartner(b.dataset.delPartner)));
  }

  async function publishPartners(message){
    const res = await ghPutFile("partners.json", JSON.stringify(_partners, null, 2), _partnersSha, message);
    _partnersSha = res.content.sha;
  }

  async function deletePartner(id){
    const p = _partners.find(x => x.id === id);
    if (!p) return;
    if (!confirm(`متأكد إنك عايز تحذف "${p.name}"؟`)) return;
    const prev = _partners.slice();
    _partners = _partners.filter(x => x.id !== id);
    try {
      await publishPartners(`حذف مكتب شريك: ${p.name}`);
      renderPartnersList();
      toast("تم حذف المكتب");
    } catch (ex) { _partners = prev; toast(friendlyError(ex)); }
  }

  function openPartnerModal(){
    document.getElementById("partnerForm").reset();
    document.getElementById("partnerLogoPreview").innerHTML = "";
    document.getElementById("partnerFormError").textContent = "";
    _pendingPartnerFile = null;
    document.getElementById("partnerModalOverlay").classList.add("open");
  }

  async function savePartnerForm(e){
    e.preventDefault();
    const err = document.getElementById("partnerFormError");
    const btn = document.getElementById("partnerSubmitBtn");
    err.textContent = "";
    const name = document.getElementById("p_name").value.trim();
    if (!name) { err.textContent = "من فضلك اكتب اسم المكتب"; return; }
    if (!_pendingPartnerFile) { err.textContent = "من فضلك ارفع لوجو المكتب"; return; }
    if (_pendingPartnerFile.size > 4 * 1024 * 1024) { err.textContent = "حجم اللوجو كبير جدًا (الحد الأقصى 4MB)"; return; }

    setBusy(btn, true, "جارِ الرفع...");
    setUploadInProgress(true);
    try {
      const id = "b" + Date.now();
      const ext = (_pendingPartnerFile.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g,"") || "png";
      const path = `assets/partners/partner-logo-${id}.${ext}`;
      const base64 = await fileToBase64(_pendingPartnerFile);
      await ghCommitFiles([{ path, base64 }], `رفع لوجو مكتب شريك: ${name}`);

      const partner = {
        id, name,
        location: document.getElementById("p_location").value.trim(),
        info: document.getElementById("p_info").value.trim(),
        logo: path
      };
      _partners.push(partner);
      await publishPartners(`إضافة مكتب شريك: ${name}`);
      document.getElementById("partnerModalOverlay").classList.remove("open");
      renderPartnersList();
      toast("تمت إضافة المكتب ونشره");
    } catch (ex) {
      err.textContent = friendlyError(ex);
    } finally {
      setUploadInProgress(false);
      setBusy(btn, false);
    }
  }

  /* ---------------- Cleanup dead media ---------------- */
  let _cleanupCandidates = [];

  async function scanCleanup(){
    const status = document.getElementById("cleanupStatus");
    const result = document.getElementById("cleanupResult");
    const btn = document.getElementById("btnScanCleanup");
    status.textContent = "";
    setBusy(btn, true, "جارِ الفحص...");
    try {
      const [refs, allFiles] = await Promise.all([
        buildReferencedMediaSet(),
        ghListRootFilesRecursiveAssets()
      ]);
      _cleanupCandidates = allFiles.filter(f => isManagedMediaName(f.name.split("/").pop()) && !refs.has(f.path));
      if (!_cleanupCandidates.length) {
        result.innerHTML = `<p style="color:var(--text-muted)">مفيش ملفات ميتة دلوقتي 👍</p>`;
        document.getElementById("btnDeleteCleanup").style.display = "none";
      } else {
        result.innerHTML = _cleanupCandidates.map(f => `
          <label><input type="checkbox" value="${esc(f.path)}" checked> ${esc(f.path)}</label>
        `).join("");
        document.getElementById("btnDeleteCleanup").style.display = "";
      }
    } catch (ex) {
      status.textContent = friendlyError(ex);
    } finally {
      setBusy(btn, false);
    }
  }

  /* root cleanup helper needs to look inside assets/properties and assets/partners,
     not just repo root — small wrapper around ghListRootFiles for those subfolders */
  async function ghListRootFilesRecursiveAssets(){
    const out = [];
    for (const dir of ["assets/properties", "assets/partners"]) {
      try {
        const res = await fetchWithRetry(`${repoBase()}/contents/${dir}`, { headers: ghHeaders() });
        if (res.status === 404) continue;
        if (!res.ok) throw new Error(`تعذر قراءة ${dir} (${res.status})`);
        const data = await res.json();
        if (Array.isArray(data)) data.filter(f => f.type === "file").forEach(f => out.push(f));
      } catch (ex) { throw ex; }
    }
    return out;
  }

  async function confirmDeleteCleanup(){
    const checked = Array.from(document.querySelectorAll("#cleanupResult input:checked")).map(i => i.value);
    if (!checked.length) return;
    if (!confirm(`متأكد إنك عايز تحذف ${checked.length} ملف نهائيًا؟ الخطوة دي مش قابلة للتراجع`)) return;
    const status = document.getElementById("cleanupStatus");
    const btn = document.getElementById("btnDeleteCleanup");
    setBusy(btn, true, "جارِ الحذف...");
    let failed = 0;
    for (const path of checked) {
      const file = _cleanupCandidates.find(f => f.path === path);
      if (!file) continue;
      try { await ghDeleteFile(path, file.sha, `حذف ملف غير مستخدم: ${path}`); }
      catch (ex) { failed++; }
    }
    setBusy(btn, false);
    status.textContent = failed ? `اتحذف الباقي، وفشل حذف ${failed} ملف` : "تم حذف الملفات المحددة";
    await scanCleanup();
  }

  /* ---------------- Export ---------------- */
  function exportData(){
    const blob = new Blob([JSON.stringify(_units, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "nexon-units-backup.json";
    a.click();
    toast("تم تصدير نسخة احتياطية");
  }

  /* ---------------- Init ---------------- */
  async function initDashboard(){
    try { await loadAll(); }
    catch (ex) { return; }
    renderStats();
    renderTable();
    renderPartnersList();

    document.getElementById("btnAddUnit").addEventListener("click", () => openModal(null));
    document.getElementById("btnLogout").addEventListener("click", logout);
    document.getElementById("btnRefresh").addEventListener("click", async () => {
      await loadAll(); renderStats(); renderTable(); renderPartnersList(); toast("تم التحديث");
    });
    document.getElementById("modalClose").addEventListener("click", closeModal);
    document.getElementById("modalOverlay").addEventListener("click", e => { if(e.target.id === "modalOverlay") closeModal(); });
    document.getElementById("unitForm").addEventListener("submit", saveForm);
    document.getElementById("f_imageFiles").addEventListener("change", e => {
      _pendingUnitFiles = Array.from(e.target.files || []);
      const preview = document.getElementById("unitImagesPreview");
      preview.innerHTML = "";
      _pendingUnitFiles.forEach(f => {
        const img = document.createElement("img");
        img.src = URL.createObjectURL(f);
        preview.appendChild(img);
      });
    });
    document.getElementById("btnExport").addEventListener("click", exportData);

    document.getElementById("btnAddPartner").addEventListener("click", openPartnerModal);
    document.getElementById("partnerModalClose").addEventListener("click", () => document.getElementById("partnerModalOverlay").classList.remove("open"));
    document.getElementById("partnerModalOverlay").addEventListener("click", e => { if(e.target.id === "partnerModalOverlay") e.currentTarget.classList.remove("open"); });
    document.getElementById("partnerForm").addEventListener("submit", savePartnerForm);
    document.getElementById("p_logo").addEventListener("change", e => {
      _pendingPartnerFile = e.target.files[0] || null;
      const preview = document.getElementById("partnerLogoPreview");
      preview.innerHTML = "";
      if (_pendingPartnerFile) {
        const img = document.createElement("img");
        img.src = URL.createObjectURL(_pendingPartnerFile);
        preview.appendChild(img);
      }
    });

    document.getElementById("btnScanCleanup").addEventListener("click", scanCleanup);
    document.getElementById("btnDeleteCleanup").addEventListener("click", confirmDeleteCleanup);
  }

  document.addEventListener("DOMContentLoaded", initAuth);
})();
