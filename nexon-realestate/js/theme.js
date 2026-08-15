/* Theme (light/dark) + mobile nav toggle — shared across all pages */
(function(){
  const THEME_KEY = "nexon_theme";

  function applyTheme(theme){
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }

  function initTheme(){
    const saved = localStorage.getItem(THEME_KEY);
    const preferDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(saved || (preferDark ? "dark" : "light"));
  }

  function bindThemeToggle(){
    document.querySelectorAll("[data-theme-toggle]").forEach(btn => {
      btn.addEventListener("click", () => {
        const current = document.documentElement.getAttribute("data-theme");
        applyTheme(current === "dark" ? "light" : "dark");
      });
    });
  }

  function bindNavToggle(){
    const toggle = document.querySelector("[data-nav-toggle]");
    const nav = document.querySelector("[data-main-nav]");
    if(!toggle || !nav) return;
    toggle.addEventListener("click", () => nav.classList.toggle("open"));
    nav.querySelectorAll("a").forEach(a => a.addEventListener("click", () => nav.classList.remove("open")));
  }

  initTheme();
  document.addEventListener("DOMContentLoaded", () => {
    bindThemeToggle();
    bindNavToggle();
  });
})();
