/**
 * Premium UI - Dashboard & Workspace Controller
 * Dynamic Greetings, Real ERPNext KPIs, Quick Actions, Recent Transactions
 * Target: Frappe Framework & ERPNext v15
 * Author: Codenexora
 * License: MIT
 */

(function () {
  "use strict";

  const __ = window.__ || function (s) { return s; };

  window.premium_ui_dashboard = {
    cachedKPIs: null,
    cachedTransactions: null,
    isLoading: false,

    // Determines if current route is a desk workspace (specifically Home or general Workspace)
    isWorkspaceRoute: function (routeType, currentRoute) {
      if (!currentRoute || currentRoute.length === 0) return true;
      const primary = (currentRoute[0] || "").toLowerCase();
      const secondary = (currentRoute[1] || "").toLowerCase();

      if (primary === "" || primary === "workspace" || primary === "workspaces") {
        // Specifically prioritize Home workspace, or general workspaces
        return secondary === "home" || secondary === "" || primary === "workspace" || primary === "workspaces";
      }
      return false;
    },

    checkAndRender: function (routeType, currentRoute) {
      if (!this.isWorkspaceRoute(routeType, currentRoute)) {
        // If navigated away from workspace, remove or hide dashboard container
        const existingContainer = document.getElementById("pui-dashboard-root");
        if (existingContainer) {
          existingContainer.style.display = "none";
        }
        return;
      }

      // We are on a workspace route
      const workspaceTarget = document.querySelector(".workspace-page .layout-main-section, .workspace-page .body, .page-container .layout-main-section");
      if (!workspaceTarget) {
        // Retry shortly in case workspace DOM is still rendering
        setTimeout(() => {
          const retryTarget = document.querySelector(".workspace-page .layout-main-section, .workspace-page .body, .page-container .layout-main-section");
          if (retryTarget) {
            this.mountDashboard(retryTarget);
          }
        }, 150);
        return;
      }

      this.mountDashboard(workspaceTarget);
    },

    mountDashboard: function (targetEl) {
      let root = document.getElementById("pui-dashboard-root");
      if (!root) {
        root = document.createElement("div");
        root.id = "pui-dashboard-root";
        root.className = "pui-dashboard-container";
        targetEl.prepend(root);
      } else {
        root.style.display = "block";
        if (root.parentElement !== targetEl) {
          targetEl.prepend(root);
        }
      }

      // Initial render with current or skeleton state
      this.render(root);

      // Fetch fresh data if not yet loaded
      if (!this.cachedKPIs && !this.isLoading) {
        this.fetchData();
      }
    },

    getGreetingText: function () {
      const hour = new Date().getHours();
      let greeting = "Good morning";
      if (hour >= 12 && hour < 17) {
        greeting = "Good afternoon";
      } else if (hour >= 17) {
        greeting = "Good evening";
      }

      const userName = (frappe.session && frappe.session.user_fullname) || (frappe.user && frappe.user.full_name()) || "User";
      return `${greeting}, ${frappe.utils.escape_html(userName)} 👋`;
    },

    fetchData: function () {
      if (this.isLoading) return;
      this.isLoading = true;

      // Fetch KPIs
      frappe.call({
        method: "premium_ui.api.dashboard.get_business_kpis",
        callback: (r) => {
          this.isLoading = false;
          if (r && r.message) {
            this.cachedKPIs = r.message;
            const root = document.getElementById("pui-dashboard-root");
            if (root) this.render(root);
          }
        },
        error: () => {
          this.isLoading = false;
        },
      });

      // Fetch Recent Transactions
      frappe.call({
        method: "premium_ui.api.dashboard.get_recent_transactions",
        args: { limit: 5 },
        callback: (r) => {
          if (r && r.message) {
            this.cachedTransactions = r.message;
            const root = document.getElementById("pui-dashboard-root");
            if (root) this.render(root);
          }
        },
      });
    },

    render: function (container) {
      const greeting = this.getGreetingText();
      const kpis = this.cachedKPIs ? this.cachedKPIs.kpis : null;
      const company = this.cachedKPIs ? this.cachedKPIs.company : "";

      container.innerHTML = `
        <!-- Dashboard Header -->
        <div class="pui-dashboard-header">
          <div>
            <h1 class="pui-greeting-title">${greeting}</h1>
            <p class="pui-greeting-subtitle">${__("Here's your business overview for today.")}</p>
          </div>
          <div class="pui-header-actions">
            ${
              company
                ? `<div class="pui-company-badge">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 7v14M21 7v14M6 11h2M6 15h2M16 11h2M16 15h2M10 21V3h4v18"/></svg>
                    <span>${frappe.utils.escape_html(company)}</span>
                  </div>`
                : ""
            }
            <button class="pui-refresh-btn" id="pui-btn-refresh" title="${__("Refresh Overview")}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
            </button>
          </div>
        </div>

        <!-- Primary KPI Row -->
        <div class="pui-kpi-grid">
          ${this.renderKPICard(
            kpis ? kpis.total_sales : null,
            "Total Sales",
            `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 6v2M12 16v2"/></svg>`,
            "sales"
          )}
          ${this.renderKPICard(
            kpis ? kpis.receivable : null,
            "Receivable",
            `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
            "receivable"
          )}
          ${this.renderKPICard(
            kpis ? kpis.payable : null,
            "Payable",
            `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`,
            "payable"
          )}
          ${this.renderKPICard(
            kpis ? kpis.net_profit : null,
            "Net Operating Balance",
            `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
            "profit"
          )}
        </div>

        <!-- Secondary KPI Row -->
        <div class="pui-kpi-grid pui-secondary-row">
          ${this.renderSecondaryCard(kpis ? kpis.orders : null, "Orders", "shopping-bag")}
          ${this.renderSecondaryCard(kpis ? kpis.customers : null, "Customers", "users")}
          ${this.renderSecondaryCard(kpis ? kpis.stock_value : null, "Stock Value", "package")}
          ${this.renderSecondaryCard(kpis ? kpis.pending_invoices : null, "Pending Invoices", "clock")}
        </div>

        <!-- Quick Actions Grid -->
        <div class="pui-section-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          <span>${__("Quick Actions")}</span>
        </div>
        <div class="pui-quick-actions-grid">
          <div class="pui-quick-action-btn" data-action="new-sales-invoice">
            <span class="pui-quick-action-icon">📄</span>
            <span class="pui-quick-action-label">${__("+ Sales Invoice")}</span>
          </div>
          <div class="pui-quick-action-btn" data-action="new-customer">
            <span class="pui-quick-action-icon">👤</span>
            <span class="pui-quick-action-label">${__("+ Customer")}</span>
          </div>
          <div class="pui-quick-action-btn" data-action="new-sales-order">
            <span class="pui-quick-action-icon">📦</span>
            <span class="pui-quick-action-label">${__("+ Sales Order")}</span>
          </div>
          <div class="pui-quick-action-btn" data-action="new-payment-entry">
            <span class="pui-quick-action-icon">💳</span>
            <span class="pui-quick-action-label">${__("+ Payment Entry")}</span>
          </div>
          <div class="pui-quick-action-btn" data-action="new-quotation">
            <span class="pui-quick-action-icon">📝</span>
            <span class="pui-quick-action-label">${__("+ Quotation")}</span>
          </div>
          <div class="pui-quick-action-btn" data-action="new-delivery-note">
            <span class="pui-quick-action-icon">🚚</span>
            <span class="pui-quick-action-label">${__("+ Delivery Note")}</span>
          </div>
        </div>

        <!-- Recent Transactions -->
        ${this.renderRecentActivity()}
      `;

      // Attach Event Handlers
      this.attachEvents(container);
    },

    renderKPICard: function (metric, defaultTitle, iconSvg, typeClass) {
      if (!metric) {
        return `
          <div class="pui-kpi-card">
            <div class="pui-kpi-top">
              <span class="pui-kpi-label">${__(defaultTitle)}</span>
              <div class="pui-kpi-icon-wrap ${typeClass}">${iconSvg}</div>
            </div>
            <div class="pui-kpi-value">—</div>
            <div class="pui-kpi-bottom">
              <span class="pui-trend-pill neutral">${__("Loading...")}</span>
            </div>
          </div>
        `;
      }

      if (metric.has_permission === false) {
        return `
          <div class="pui-kpi-card">
            <div class="pui-kpi-top">
              <span class="pui-kpi-label">${__(metric.title || defaultTitle)}</span>
              <div class="pui-kpi-icon-wrap ${typeClass}">${iconSvg}</div>
            </div>
            <div class="pui-kpi-value" style="font-size: 16px; color: var(--pui-text-muted);">${__("Restricted")}</div>
            <div class="pui-kpi-bottom">
              <span class="pui-trend-pill neutral">${__("Permission required")}</span>
            </div>
          </div>
        `;
      }

      const trend = metric.trend || {};
      const trendDir = trend.direction || "neutral";
      const trendLabel = trend.label || "—";
      const trendClass = trendDir === "up" ? "up" : trendDir === "down" ? "down" : "neutral";

      return `
        <div class="pui-kpi-card">
          <div class="pui-kpi-top">
            <span class="pui-kpi-label">${frappe.utils.escape_html(metric.title || defaultTitle)}</span>
            <div class="pui-kpi-icon-wrap ${typeClass}">${iconSvg}</div>
          </div>
          <div class="pui-kpi-value" title="${frappe.utils.escape_html(metric.formatted_full || "")}">
            ${frappe.utils.escape_html(metric.formatted || "0")}
          </div>
          <div class="pui-kpi-bottom">
            <span class="pui-trend-pill ${trendClass}">${trendLabel}</span>
            <span>${frappe.utils.escape_html(metric.trend_context || "")}</span>
          </div>
        </div>
      `;
    },

    renderSecondaryCard: function (metric, defaultTitle) {
      if (!metric || metric.has_permission === false) {
        return `
          <div class="pui-kpi-card" style="padding: 16px;">
            <div class="pui-kpi-top" style="margin-bottom: 6px;">
              <span class="pui-kpi-label">${__(defaultTitle)}</span>
            </div>
            <div class="pui-kpi-value" style="font-size: 20px; margin-bottom: 4px;">—</div>
            <div class="pui-kpi-bottom">
              <span style="font-size: 11.5px; color: var(--pui-text-muted);">${metric && metric.has_permission === false ? __("Restricted") : __("Loading...")}</span>
            </div>
          </div>
        `;
      }

      return `
        <div class="pui-kpi-card" style="padding: 16px;">
          <div class="pui-kpi-top" style="margin-bottom: 6px;">
            <span class="pui-kpi-label">${frappe.utils.escape_html(metric.title || defaultTitle)}</span>
          </div>
          <div class="pui-kpi-value" style="font-size: 20px; margin-bottom: 4px;">
            ${frappe.utils.escape_html(metric.formatted || "0")}
          </div>
          <div class="pui-kpi-bottom">
            <span>${frappe.utils.escape_html(metric.trend_context || "")}</span>
          </div>
        </div>
      `;
    },

    renderRecentActivity: function () {
      const data = this.cachedTransactions;
      if (!data) return "";

      const hasInvoices = data.invoices && data.invoices.length > 0;
      const hasOrders = data.orders && data.orders.length > 0;

      if (!hasInvoices && !hasOrders) return "";

      return `
        <div class="pui-recent-activity-container">
          <!-- Recent Invoices -->
          <div class="pui-activity-card">
            <div class="pui-activity-card-header">
              <h3 class="pui-activity-card-title">${__("Recent Sales Invoices")}</h3>
              <a class="pui-activity-view-all" data-route="List/Sales Invoice">${__("View All →")}</a>
            </div>
            <div class="pui-activity-list">
              ${
                hasInvoices
                  ? data.invoices
                      .map(
                        (inv) => `
                    <div class="pui-activity-row" data-doctype="Sales Invoice" data-name="${frappe.utils.escape_html(inv.name)}">
                      <div class="pui-activity-info">
                        <span class="pui-activity-id">${frappe.utils.escape_html(inv.customer_name || inv.name)}</span>
                        <span class="pui-activity-meta">${frappe.utils.escape_html(inv.name)} • ${frappe.datetime.str_to_user(inv.posting_date)}</span>
                      </div>
                      <div class="pui-activity-value-wrap">
                        <span class="pui-activity-amount">${frappe.utils.escape_html(inv.formatted_total || "")}</span>
                        <span class="indicator-pill ${inv.outstanding_amount > 0 ? "orange" : "green"}">${inv.outstanding_amount > 0 ? __("Unpaid") : __("Paid")}</span>
                      </div>
                    </div>
                  `
                      )
                      .join("")
                  : `<div class="empty-state" style="padding: 20px;">${__("No recent invoices recorded")}</div>`
              }
            </div>
          </div>

          <!-- Recent Orders -->
          <div class="pui-activity-card">
            <div class="pui-activity-card-header">
              <h3 class="pui-activity-card-title">${__("Recent Sales Orders")}</h3>
              <a class="pui-activity-view-all" data-route="List/Sales Order">${__("View All →")}</a>
            </div>
            <div class="pui-activity-list">
              ${
                hasOrders
                  ? data.orders
                      .map(
                        (ord) => `
                    <div class="pui-activity-row" data-doctype="Sales Order" data-name="${frappe.utils.escape_html(ord.name)}">
                      <div class="pui-activity-info">
                        <span class="pui-activity-id">${frappe.utils.escape_html(ord.customer_name || ord.name)}</span>
                        <span class="pui-activity-meta">${frappe.utils.escape_html(ord.name)} • ${frappe.datetime.str_to_user(ord.transaction_date)}</span>
                      </div>
                      <div class="pui-activity-value-wrap">
                        <span class="pui-activity-amount">${frappe.utils.escape_html(ord.formatted_total || "")}</span>
                        <span class="indicator-pill blue">${frappe.utils.escape_html(ord.status || "Submitted")}</span>
                      </div>
                    </div>
                  `
                      )
                      .join("")
                  : `<div class="empty-state" style="padding: 20px;">${__("No recent orders recorded")}</div>`
              }
            </div>
          </div>
        </div>
      `;
    },

    attachEvents: function (container) {
      // Refresh Button
      const refreshBtn = container.querySelector("#pui-btn-refresh");
      if (refreshBtn) {
        refreshBtn.onclick = () => {
          this.cachedKPIs = null;
          this.cachedTransactions = null;
          this.render(container);
          this.fetchData();
        };
      }

      // Quick Actions
      container.querySelectorAll(".pui-quick-action-btn").forEach((btn) => {
        btn.onclick = () => {
          const action = btn.getAttribute("data-action");
          switch (action) {
            case "new-sales-invoice":
              frappe.new_doc("Sales Invoice");
              break;
            case "new-customer":
              frappe.new_doc("Customer");
              break;
            case "new-sales-order":
              frappe.new_doc("Sales Order");
              break;
            case "new-payment-entry":
              frappe.new_doc("Payment Entry");
              break;
            case "new-quotation":
              frappe.new_doc("Quotation");
              break;
            case "new-delivery-note":
              frappe.new_doc("Delivery Note");
              break;
          }
        };
      });

      // View All Links
      container.querySelectorAll(".pui-activity-view-all").forEach((link) => {
        link.onclick = (e) => {
          e.preventDefault();
          const route = link.getAttribute("data-route");
          if (route) frappe.set_route(route.split("/"));
        };
      });

      // Activity Row Clicks
      container.querySelectorAll(".pui-activity-row").forEach((row) => {
        row.onclick = () => {
          const doctype = row.getAttribute("data-doctype");
          const name = row.getAttribute("data-name");
          if (doctype && name) {
            frappe.set_route("Form", doctype, name);
          }
        };
      });
    },
  };
})();

