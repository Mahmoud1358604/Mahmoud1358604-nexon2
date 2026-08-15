/* Property detail page: read ?id= from URL and render unit data */
(function(){
  function esc(s){
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
    }[c]));
  }
  const CHECK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
  const PIN_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
  const INFO_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`;

  function statusNoteText(status){
    if(status === "available") return "هذه الوحدة متاحة حاليًا للحجز أو المعاينة.";
    if(status === "reserved") return "هذه الوحدة محجوزة حاليًا. تواصل معنا لمعرفة وحدات مشابهة متاحة.";
    return "تم بيع هذه الوحدة بالفعل. تواصل معنا لعرض وحدات مشابهة.";
  }

  function render(){
    const params = new URLSearchParams(location.search);
    const id = params.get("id");
    const unit = id ? NexonData.getUnit(id) : null;
    const root = document.getElementById("propertyRoot");

    if(!unit){
      root.innerHTML = `<div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
        <h3>لم يتم العثور على هذه الوحدة</h3>
        <p>ربما تم حذفها أو الرابط غير صحيح.</p>
        <a href="index.html" class="btn btn-primary" style="margin-top:16px">العودة للوحدات المتاحة</a>
      </div>`;
      document.title = "الوحدة غير موجودة — NEXON";
      return;
    }

    document.title = `${unit.title} — NEXON`;

    const thumbs = unit.images.slice(1, 4).map(src => `<img src="${esc(src)}" alt="${esc(unit.title)}">`).join("");

    root.innerHTML = `
      <div class="breadcrumbs">
        <a href="index.html">الرئيسية</a> / <a href="index.html#units">الوحدات</a> / <span>${esc(unit.title)}</span>
      </div>

      <div class="gallery">
        <div class="gallery-main"><img src="${esc(unit.images[0])}" alt="${esc(unit.title)}"></div>
        <div class="gallery-thumbs">${thumbs || `<img src="${esc(unit.images[0])}" alt="${esc(unit.title)}">`}</div>
      </div>

      <div class="detail-top">
        <div>
          <div class="detail-title">${esc(unit.title)}</div>
          <div class="detail-loc">${PIN_ICON}${esc(unit.location)}</div>
        </div>
        <div class="detail-price">${esc(NexonData.formatPrice(unit))}<br><small>${unit.listingType === "rent" ? "عرض للإيجار" : "عرض للبيع"}</small></div>
      </div>

      <div class="status-note">${INFO_ICON} ${statusNoteText(unit.status)}</div>

      <div class="cta-bar">
        <a href="https://wa.me/201000000000?text=${encodeURIComponent("مهتم بالوحدة: " + unit.title)}" target="_blank" rel="noopener" class="btn btn-whatsapp">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.29-1.39c1.44.79 3.06 1.2 4.71 1.2h.004c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.86 9.86 0 0 0 12.04 2z"/></svg>
          استفسر عن هذه الوحدة
        </a>
        <a href="tel:+201000000000" class="btn btn-outline">اتصل بنا</a>
      </div>

      <div class="panel">
        <h3>عن الوحدة</h3>
        <p>${esc(unit.description)}</p>
      </div>

      <div class="panel">
        <h3>تفاصيل الوحدة</h3>
        <div class="detail-table">
          <div><span>الفئة</span><b>${esc(unit.category)}</b></div>
          <div><span>المساحة</span><b>${esc(unit.area)} م²</b></div>
          <div><span>غرف النوم</span><b>${esc(unit.bedrooms)}</b></div>
          <div><span>دورات المياه</span><b>${esc(unit.bathrooms)}</b></div>
          <div><span>الدور</span><b>${esc(unit.floor)}</b></div>
          <div><span>حالة العقار</span><b>${esc(unit.age)}</b></div>
        </div>
      </div>

      <div class="panel">
        <h3>المميزات</h3>
        <ul class="feature-list">
          ${unit.features.map(f => `<li>${CHECK_ICON}${esc(f)}</li>`).join("")}
        </ul>
      </div>

      <div class="panel">
        <h3>الموقع</h3>
        <p>${esc(unit.location)} — بيانات الموقع التفصيلية والخريطة التفاعلية هتتضاف قريبًا.</p>
      </div>
    `;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    await NexonData.init();
    render();
  });
})();
