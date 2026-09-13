# Premium UI (Frappe & ERPNext v15)

A modern, SaaS-grade UI customization app for **Frappe Framework v15** and **ERPNext v15**. Designed with the visual elegance of Stripe Dashboard, Linear, and Notion, **Premium UI** elevates your ERP experience with clean white surfaces, subtle blue accents, 12–16px border radii, soft layered shadows, and an intelligent dynamic business overview header.

> **Zero Core Modification**: Built strictly using standard Frappe hooks, modular CSS, defensive JavaScript, and whitelisted backend APIs. Your ERPNext core files, DocTypes, business logic, workflows, and database schema remain 100% untouched.

---

## 🎨 Visual Design System

| Element | Specification | Visual Representation |
| :--- | :--- | :--- |
| **Primary Color** | `#2563EB` | Deep Royal Blue (Actions, Highlights) |
| **Primary Dark** | `#1D4ED8` | Active & Hover States |
| **Primary Soft** | `#EAF1FF` | Active Sidebar Background, Subtle Accents |
| **Background** | `#F5F7FB` | Soft Slate Canvas (Reduces visual fatigue) |
| **Surface** | `#FFFFFF` | Crisp White Cards, Modals, and Forms |
| **Text Primary** | `#172033` | High-contrast enterprise slate |
| **Text Secondary**| `#667085` | Subtitles, labels, and table headers |
| **Borders** | `#E7EBF2` | Delicate 1px dividers |
| **Success** | `#16A34A` | Paid / Completed / Submitted status |
| **Warning** | `#F59E0B` | Pending / Draft / Unpaid status |
| **Danger** | `#DC2626` | Overdue / Cancelled status |
| **Info** | `#0EA5E9` | Informational badges and active orders |

### Native Dark Mode
Fully integrated with Frappe v15 theme engine (`[data-theme="dark"]`):
- Background: `#0F172A`
- Surface: `#111827`
- Cards: `#1E293B`
- Borders: `#334155`
- Text: `#F8FAFC`

---

## 🏗️ Architecture & Features

```
premium_ui/
├── pyproject.toml               # Modern Python/Frappe build metadata
├── setup.py                     # Backward-compatible setuptools definition
├── license.txt                  # MIT License
├── README.md                    # Detailed documentation
├── .gitignore                   # Standard Frappe/Python ignores
├── premium_ui/
│   ├── __init__.py              # Version declaration (0.1.0)
│   ├── hooks.py                 # Asset hooks for Desk (CSS & JS)
│   ├── modules.txt              # Frappe module registration
│   ├── patches.txt              # Standard patch manifest
│   ├── api/
│   │   ├── __init__.py
│   │   └── dashboard.py         # Permission-aware real business KPI queries
│   └── public/
│       ├── css/
│       │   ├── premium.css      # Design tokens, navbar, sidebar, layout
│       │   ├── components.css   # Buttons, inputs, tables, forms, pills
│       │   ├── dashboard.css    # KPI grid, quick actions, greetings
│       │   └── responsive.css   # Tablet and mobile breakpoints
│       ├── js/
│       │   ├── premium.js       # Global lifecycle & route observer
│       │   ├── navigation.js    # Navbar search hint & active sidebar cues
│       │   └── dashboard.js     # Live dynamic KPI rendering & greeting
│       └── images/              # Static assets (.gitkeep)
└── public/                      # Asset mirror for universal Frappe compatibility
```

### Key Highlights
1. **Dynamic Business Overview**:
   - Time-aware personalized greeting (*"Good morning, Robin 👋"*).
   - **4 Primary KPIs**: Total Sales, Receivable, Payable, Net Operating Balance.
   - **4 Secondary KPIs**: Orders, Customers, Stock Value, Pending Invoices.
   - **Real Data Only**: Queries submitted ERPNext records (`tabSales Invoice`, `tabPurchase Invoice`, `tabSales Order`) with period-over-period percentage trends (current month vs. previous month). Respects company filters and strict user permissions.
2. **Quick Actions Grid**:
   - One-click shortcuts to create a Sales Invoice, Customer, Sales Order, Payment Entry, Quotation, or Delivery Note using native Frappe dialogs.
3. **Recent Activity Stream**:
   - Instant overview of recent submitted invoices and orders with live status pills and direct routing.
4. **Defensive JavaScript**:
   - Zero console errors, no aggressive DOM polling, and no monkey-patching of core routing or save mechanics.

---

## 🚀 Installation on Standard Bench

For a standard Frappe Bench instance (or inside an interactive bench shell):

### 1. Fetch the App
```bash
cd /home/frappe/frappe-bench
bench get-app https://github.com/codenexora/premium_ui.git
# Or if installing from a local path:
# bench get-app /path/to/premium_ui
```

### 2. Install Dependencies
```bash
bench setup requirements
```

### 3. Build Static Assets
```bash
bench build --app premium_ui
```

### 4. Install on your Site
```bash
bench --site erpnext.codenexora.xyz install-app premium_ui
```

### 5. Clear Cache & Migrate
```bash
bench --site erpnext.codenexora.xyz migrate
bench --site erpnext.codenexora.xyz clear-cache
```

### 6. Restart Services
```bash
bench restart
```

---

## 🗑️ Safe Uninstallation

If you ever want to revert to the default Frappe Desk:

```bash
# 1. Uninstall app from the site (removes hooks and site association)
bench --site erpnext.codenexora.xyz uninstall-app premium_ui

# 2. Rebuild core assets
bench build

# 3. Clear cache
bench --site erpnext.codenexora.xyz clear-cache

# 4. (Optional) Remove app from bench
bench remove-app premium_ui

# 5. Restart bench
bench restart
```

---

## 🐳 Docker & Coolify Production Deployment Guide

When running ERPNext in Docker on Coolify, understanding container filesystem persistence is critical.

### The Persistence Reality in Docker Compose
In standard `frappe_docker` / Coolify setups:
- **Persistent Data**:
  - `sites` volume (`/home/frappe/frappe-bench/sites`): Contains your database credentials, site config, uploaded files, and public site assets.
  - MariaDB / PostgreSQL container: Stores all database records.
  - Redis containers: Store queue and cache states.
- **Non-Persistent (Ephemeral) Data**:
  - The container's application root (`/home/frappe/frappe-bench/apps/`): Contains the Python packages and code of Frappe, ERPNext, and other apps.
- **What happens after Docker container recreation?**
  - If you run `bench get-app` inside an existing container via `docker exec`, the code is stored in the container's ephemeral write layer. **When Coolify redeploys or restarts the container from its image, ephemeral changes are reset and the app code is wiped.**

### Recommended Solution: Production Custom Docker Image

To permanently include `premium_ui` on Coolify across all redeploys, build a custom Docker image that bakes `premium_ui` into the bench image.

#### Step 1: Create a `Containerfile` / `Dockerfile`
Create a custom Dockerfile in your deployment repository:

```dockerfile
ARG FRAPPE_VERSION=v15.120.1
ARG ERPNEXT_VERSION=v15.121.2
FROM frappe/erpnext:${ERPNEXT_VERSION}

USER frappe

# Install premium_ui into the bench apps directory
RUN bench get-app https://github.com/codenexora/premium_ui.git --resolve-deps

# Build the assets during image creation
RUN bench build --app premium_ui
```

#### Step 2: Configure Coolify Docker Compose
In your Coolify application stack, point the `backend`, `frontend`, and `websocket` services to use your custom built image instead of the raw upstream image:

```yaml
services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile
    image: my-registry/erpnext-custom:v15
    volumes:
      - sites:/home/frappe/frappe-bench/sites
    # ... other configurations
```

#### Step 3: One-Time Site Activation
Once Coolify deploys the new image, execute the one-time installation on your site:
```bash
docker exec -it <erpnext-backend-container-id> bench --site erpnext.codenexora.xyz install-app premium_ui
docker exec -it <erpnext-backend-container-id> bench --site erpnext.codenexora.xyz clear-cache
```
Now, subsequent deployments, container recreations, or rolling updates will retain `premium_ui` permanently!

---

## 🔒 Security & Performance

- **Zero Monkey-Patching**: Never alters core Frappe routing or desk event loops.
- **Strict Permission Checking**: Every backend KPI query strictly checks `frappe.has_permission(doctype, "read")`. Users only see data their role has access to.
- **Cached & Non-blocking**: Asset requests are served via standard Frappe asset symlinks (`/assets/premium_ui/...`) with HTTP caching headers.

---

## 📄 License

MIT © [Codenexora](https://codenexora.xyz)

