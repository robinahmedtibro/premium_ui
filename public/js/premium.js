/**
 * Premium UI - Core Lifecycle Controller
 * Target: Frappe Framework & ERPNext v15
 * Author: Codenexora
 * License: MIT
 */

(function () {
  "use strict";

  // Prevent multiple initializations
  if (window.__premium_ui_initialized) return;
  window.__premium_ui_initialized = true;

  window.premium_ui = {
    version: "0.1.0",
    initialized: true,

    // Safe helper to check element existence
    exists: function (selector, context) {
      context = context || document;
      return context.querySelector(selector) !== null;
    },

    // Safe execution helper
    safeRun: function (fn, label) {
      try {
        fn();
      } catch (err) {
        console.warn(`[Premium UI] Non-critical warning in ${label || "module"}:`, err);
      }
    },

    // Initialize UI Enhancements
    init: function () {
      if (!window.frappe) return;

      document.body.classList.add("premium-ui-active");

      // Hook into Frappe route changes
      if (frappe.router && frappe.router.on) {
        frappe.router.on("change", () => {
          setTimeout(() => {
            premium_ui.onRouteChange();
          }, 60);
        });
      }

      // Initial route setup
      premium_ui.onRouteChange();
    },

    onRouteChange: function () {
      if (!window.frappe) return;
      const currentRoute = frappe.get_route ? frappe.get_route() : [];
      const routeType = currentRoute.length > 0 ? currentRoute[0] : "";

      // Trigger navigation polish
      if (window.premium_ui_nav && typeof window.premium_ui_nav.enhance === "function") {
        window.premium_ui_nav.enhance();
      }

      // Trigger workspace dashboard check
      if (window.premium_ui_dashboard && typeof window.premium_ui_dashboard.checkAndRender === "function") {
        window.premium_ui_dashboard.checkAndRender(routeType, currentRoute);
      }
    },
  };

  // Wait for Frappe app readiness
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      if (window.frappe && frappe.app) {
        premium_ui.init();
      } else {
        $(document).on("app_ready", function () {
          premium_ui.init();
        });
      }
    });
  } else {
    if (window.frappe && frappe.app) {
      premium_ui.init();
    } else {
      $(document).on("app_ready", function () {
        premium_ui.init();
      });
    }
  }
})();

