/* Homepage logic: render stats + filterable units grid */
(function(){
  function esc(s){
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
    }[c]));
  }
  const ICONS = {
    bed: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6"/><path d="M3 18v2"/><path d="M21 18v2"/><path d="M3 12V8a1 1 0 0 1 1-1h6v5"/></svg>`,
    bath: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-2.5 1V12"/><path d="M4 12h17v2a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-2Z"/><path d="M8 21v-2"/><path d="M16 21v-2"/></svg>`,
    area: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M9 21V9h12"/></svg>`,
    pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`
  };

  function unitCard(u){
    const statusLabel = NexonData.statusLabel(u.status);
    const typeBadge = u.listingType === "rent" ? '<span class="badge rent">للإيجار</span>' : '<span class="badge rent" style="background:var(--accent-strong)">للبيع</span>';
    return `
    <a class="card" href="property.html?id=${encodeURIComponent(u.id)}">
      <div class="card-media">
        <img src="${esc(u.images[0])}" alt="${esc(u.title)}" loading="lazy">
        <div class="card-badges">
          <span class="badge ${esc(u.status)}">${esc(statusLabel)}</span>
          ${typeBadge}
        </div>
      </div>
      <div class="card-body">
        <div class="card-price">${esc(NexonData.formatPrice(u))}</div>
        <div class="card-title">${esc(u.title)}</div>
        <div class="card-specs">
          <span>${ICONS.bed}${esc(u.bedrooms)} غرف</span>
          <span>${ICONS.bath}${esc(u.bathrooms)} حمام</span>
          <span>${ICONS.area}${esc(u.area)} م²</span>
        </div>
        <div class="card-location">${ICONS.pin}${esc(u.location)}</div>
      </div>
    </a>`;
  }

  function render(filter){
    const grid = document.getElementById("unitsGrid");
    const units = NexonData.getUnits();
    const filtered = filter === "all" ? units : units.filter(u => u.status === filter);
    if(!filtered.length){
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        <h3>لا توجد وحدات في هذا التصنيف حاليًا</h3>
        <p>جرّب تصنيفًا آخر أو تواصل معنا مباشرة لمعرفة أحدث المتاح.</p>
      </div>`;
      return;
    }
    grid.innerHTML = filtered.map(unitCard).join("");
  }

  function renderStats(){
    const units = NexonData.getUnits();
    const available = units.filter(u => u.status === "available").length;
    document.querySelectorAll("[data-stat-total]").forEach(el => el.textContent = units.length);
    document.querySelectorAll("[data-stat-available]").forEach(el => el.textContent = available);
  }

  function renderHeroBg(){
    const units = NexonData.getUnits();
    const bg = document.getElementById("heroBg");
    if (bg && units.length && units[0].images && units[0].images[0]) {
      bg.src = units[0].images[0];
    }
  }

  function renderPartners(){
    const partners = NexonData.getPartners();
    const strip = document.getElementById("partnersStrip");
    const grid = document.getElementById("partnersGrid");
    if (!strip || !grid || !partners.length) return;
    grid.innerHTML = partners.map(p => `
      <div class="partner-item" title="${esc(p.info || "")}">
        <img src="${esc(p.logo)}" alt="${esc(p.name)}" loading="lazy">
        <span>${esc(p.name)}</span>
      </div>`).join("");
    strip.style.display = "";
  }

  document.addEventListener("DOMContentLoaded", async () => {
    await NexonData.init();
    renderHeroBg();
    renderStats();
    renderPartners();
    render("all");
    document.querySelectorAll(".chip[data-filter]").forEach(chip => {
      chip.addEventListener("click", () => {
        document.querySelectorAll(".chip[data-filter]").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        render(chip.dataset.filter);
      });
    });
  });
})();
