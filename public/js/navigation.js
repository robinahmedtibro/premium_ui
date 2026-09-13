/**
 * Premium UI - Navigation & Header Enhancements
 * Target: Frappe Framework & ERPNext v15
 * Author: Codenexora
 * License: MIT
 */

(function () {
  "use strict";

  window.premium_ui_nav = {
    enhance: function () {
      this.enhanceNavbarSearch();
      this.enhanceSidebar();
    },

    // Add keyboard hint to search bar
    enhanceNavbarSearch: function () {
      const searchInputs = document.querySelectorAll(".navbar .search-bar, .navbar .input-search");
      searchInputs.forEach((input) => {
        if (!input.getAttribute("data-pui-enhanced")) {
          input.setAttribute("data-pui-enhanced", "true");
          const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
          const shortcut = isMac ? "⌘K" : "Ctrl+K";
          const currentPlaceholder = input.getAttribute("placeholder") || "Search";
          if (!currentPlaceholder.includes("Ctrl") && !currentPlaceholder.includes("⌘")) {
            input.setAttribute("placeholder", `${currentPlaceholder} (${shortcut})`);
          }
        }
      });
    },

    // Ensure active sidebar item has correct visual accent
    enhanceSidebar: function () {
      const sidebarLinks = document.querySelectorAll(".desk-sidebar .sidebar-item, .workspace-sidebar .sidebar-item");
      sidebarLinks.forEach((item) => {
        const link = item.querySelector("a");
        if (link && (item.classList.contains("selected") || link.classList.contains("active"))) {
          item.classList.add("pui-active-item");
        } else {
          item.classList.remove("pui-active-item");
        }
      });
    },
  };
})();

