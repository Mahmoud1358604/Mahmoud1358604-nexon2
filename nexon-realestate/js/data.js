/* ==========================================================================
   NEXON — Data layer (live)
   Public pages read properties.json / partners.json directly from the repo
   root (same pattern as the old NEX•ON site) — no GitHub token needed to
   read. Cache-busted so visitors always see the latest publish. Falls back
   to the last successfully loaded copy (localStorage), and if nothing has
   ever loaded, to a tiny demo dataset — so the site never shows a blank
   page on a flaky connection.
   ========================================================================== */

const CACHE_KEY_UNITS = "nexon_units_cache_v1";
const CACHE_KEY_PARTNERS = "nexon_partners_cache_v1";

/* Only ever shown if properties.json can't be reached AND there is no
   cached copy on this device yet. Real data always comes from properties.json. */
const DEFAULT_UNITS = [
  {
    id: "u1",
    title: "وحدة سكنية بإطلالة مفتوحة — الدور الثاني",
    status: "available",
    listingType: "rent",
    price: 6500,
    priceUnit: "شهريا",
    category: "شقة سكنية",
    area: 145,
    bedrooms: 3,
    bathrooms: 2,
    floor: "الثاني",
    age: "جديد",
    location: "القاهرة الجديدة — التجمع الخامس",
    description: "وحدة سكنية حديثة التشطيب بتصميم عصري وإضاءة طبيعية واسعة.",
    features: ["مصعد", "مطبخ مجهز", "تكييف مركزي", "أمن وحراسة"],
    images: ["assets/properties/unit-1.svg", "assets/properties/unit-2.svg"]
  }
];

let _units = null;
let _partners = null;

async function fetchJSON(path, fallbackCacheKey){
  try{
    const res = await fetch(`${path}?t=${Date.now()}`, { cache: "no-store" });
    if(!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    try{ localStorage.setItem(fallbackCacheKey, JSON.stringify(data)); }catch(e){}
    return data;
  }catch(e){
    try{
      const cached = localStorage.getItem(fallbackCacheKey);
      if(cached) return JSON.parse(cached);
    }catch(e2){}
    return null;
  }
}

const NexonData = {
  /* Must be awaited once (per page) before any of the sync getters below are used. */
  async init(){
    const [units, partners] = await Promise.all([
      fetchJSON("properties.json", CACHE_KEY_UNITS),
      fetchJSON("partners.json", CACHE_KEY_PARTNERS)
    ]);
    _units = Array.isArray(units) && units.length ? units : DEFAULT_UNITS.slice();
    _partners = Array.isArray(partners) ? partners : [];
    return { units: _units, partners: _partners };
  },
  getUnits(){
    return (_units || DEFAULT_UNITS).slice();
  },
  getUnit(id){
    return this.getUnits().find(u => u.id === id) || null;
  },
  getPartners(){
    return (_partners || []).slice();
  },
  statusLabel(status){
    return { available: "متاح", reserved: "محجوز", sold: "تم البيع" }[status] || status;
  },
  formatPrice(unit){
    const num = Number(unit.price).toLocaleString("ar-EG");
    return unit.priceUnit ? `${num} ج.م / ${unit.priceUnit}` : `${num} ج.م`;
  }
};
