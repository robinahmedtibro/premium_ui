import frappe
from frappe import _
from frappe.utils import (
    get_first_day,
    get_last_day,
    add_months,
    nowdate,
    flt,
    cint,
    fmt_money,
)


def _get_default_company(company=None):
    if company and frappe.db.exists("Company", company):
        return company

    user_company = frappe.defaults.get_user_default("Company")
    if user_company and frappe.db.exists("Company", user_company):
        return user_company

    global_company = frappe.db.get_single_value("Global Defaults", "default_company")
    if global_company and frappe.db.exists("Company", global_company):
        return global_company

    first_company = frappe.get_all("Company", limit=1, pluck="name")
    if first_company:
        return first_company[0]

    return None


def _format_currency_value(val, currency=""):
    """
    Format large numbers into human-readable compact format (e.g. 12.5K, 1.2M, or standard formatted money)
    """
    val = flt(val)
    abs_val = abs(val)

    if abs_val >= 10000000:
        compact_val = f"{val / 10000000:.2f} Cr"
    elif abs_val >= 100000:
        compact_val = f"{val / 100000:.2f} L"
    elif abs_val >= 1000:
        compact_val = f"{val / 1000:.1f} K"
    else:
        compact_val = f"{val:,.2f}"

    currency_symbol = frappe.db.get_value("Currency", currency, "symbol") if currency else ""
    symbol = currency_symbol or currency or ""
    formatted_short = f"{symbol} {compact_val}".strip()
    formatted_full = fmt_money(val, currency=currency)

    return {
        "raw": val,
        "formatted": formatted_short,
        "formatted_full": formatted_full,
        "currency": currency,
        "symbol": symbol,
    }


def _calc_trend(current, previous):
    """
    Safely calculates percentage change between current and previous values.
    """
    curr = flt(current)
    prev = flt(previous)

    if prev > 0:
        diff_pct = round(((curr - prev) / prev) * 100, 1)
        direction = "up" if diff_pct >= 0 else "down"
        is_positive = diff_pct >= 0
    elif prev == 0 and curr > 0:
        diff_pct = 100.0
        direction = "up"
        is_positive = True
    elif prev == 0 and curr == 0:
        diff_pct = 0.0
        direction = "neutral"
        is_positive = True
    else:
        diff_pct = 0.0
        direction = "neutral"
        is_positive = True

    return {
        "percentage": abs(diff_pct),
        "direction": direction,
        "is_positive": is_positive,
        "label": f"{'↑' if direction == 'up' else ('↓' if direction == 'down' else '—')} {abs(diff_pct)}%",
    }


def _get_sum(doctype, sum_field, filters):
    """
    Safely computes SUM of a numeric column across doctype records with parameters.
    Compatible with Frappe v15 database layer, avoiding get_value fieldname sanitizer issues.
    """
    conditions = []
    values = {}
    idx = 0

    for key, val in filters.items():
        if isinstance(val, (list, tuple)) and len(val) == 2 and str(val[0]).lower() == "between":
            start_k = f"start_{idx}"
            end_k = f"end_{idx}"
            conditions.append(f"`{key}` BETWEEN %({start_k})s AND %({end_k})s")
            values[start_k] = val[1][0]
            values[end_k] = val[1][1]
        elif isinstance(val, (list, tuple)) and len(val) == 2:
            op, target = val
            k = f"cond_{idx}"
            conditions.append(f"`{key}` {op} %({k})s")
            values[k] = target
        else:
            k = f"cond_{idx}"
            conditions.append(f"`{key}` = %({k})s")
            values[k] = val
        idx += 1

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    query = f"SELECT SUM(`{sum_field}`) FROM `tab{doctype}` {where_clause}"
    res = frappe.db.sql(query, values)
    if res and res[0] and res[0][0] is not None:
        return flt(res[0][0])
    return 0.0


@frappe.whitelist()
def get_business_kpis(company=None):
    """
    Fetches real business KPIs respecting user permissions and company.
    Calculates actual period-over-period performance (current month vs previous month).
    Returns real data or null states if doctype/permissions are absent.
    """
    target_company = _get_default_company(company)
    currency = ""
    if target_company:
        currency = frappe.get_cached_value("Company", target_company, "default_currency") or ""

    today = nowdate()
    curr_month_start = get_first_day(today)
    curr_month_end = today

    # Previous period: start of last month to the same day in last month
    prev_month_start = get_first_day(add_months(today, -1))
    prev_month_end = add_months(today, -1)

    result = {
        "company": target_company,
        "currency": currency,
        "period": {
            "current_start": curr_month_start,
            "current_end": curr_month_end,
            "previous_start": prev_month_start,
            "previous_end": prev_month_end,
        },
        "kpis": {},
        "erpnext_installed": True,
    }

    # Verify if ERPNext DocTypes exist in the database
    if not frappe.db.exists("DocType", "Sales Invoice"):
        result["erpnext_installed"] = False
        return result

    # -------------------------------------------------------------
    # 1. TOTAL SALES (Current month vs Previous month)
    # -------------------------------------------------------------
    if frappe.has_permission("Sales Invoice", "read"):
        filters_curr = {
            "docstatus": 1,
            "posting_date": ["between", [curr_month_start, curr_month_end]],
        }
        filters_prev = {
            "docstatus": 1,
            "posting_date": ["between", [prev_month_start, prev_month_end]],
        }
        if target_company:
            filters_curr["company"] = target_company
            filters_prev["company"] = target_company

        curr_sales = _get_sum("Sales Invoice", "base_grand_total", filters_curr)
        prev_sales = _get_sum("Sales Invoice", "base_grand_total", filters_prev)

        result["kpis"]["total_sales"] = {
            "title": _("Total Sales"),
            "has_permission": True,
            **_format_currency_value(curr_sales, currency),
            "trend": _calc_trend(curr_sales, prev_sales),
            "trend_context": _("vs previous month"),
        }
    else:
        result["kpis"]["total_sales"] = {"has_permission": False, "title": _("Total Sales")}

    # -------------------------------------------------------------
    # 2. TOTAL RECEIVABLE (Outstanding amount from Sales Invoices)
    # -------------------------------------------------------------
    if frappe.has_permission("Sales Invoice", "read"):
        recv_filters = {
            "docstatus": 1,
            "outstanding_amount": [">", 0],
        }
        if target_company:
            recv_filters["company"] = target_company

        total_receivable = _get_sum("Sales Invoice", "outstanding_amount", recv_filters)
        open_inv_count = cint(frappe.db.count("Sales Invoice", recv_filters))

        result["kpis"]["receivable"] = {
            "title": _("Receivable"),
            "has_permission": True,
            **_format_currency_value(total_receivable, currency),
            "trend": {
                "percentage": open_inv_count,
                "direction": "neutral",
                "is_positive": True,
                "label": f"{open_inv_count} {_('invoices')}",
            },
            "trend_context": _("awaiting payment"),
        }
    else:
        result["kpis"]["receivable"] = {"has_permission": False, "title": _("Receivable")}

    # -------------------------------------------------------------
    # 3. TOTAL PAYABLE (Outstanding amount to suppliers)
    # -------------------------------------------------------------
    if frappe.db.exists("DocType", "Purchase Invoice") and frappe.has_permission("Purchase Invoice", "read"):
        pay_filters = {
            "docstatus": 1,
            "outstanding_amount": [">", 0],
        }
        if target_company:
            pay_filters["company"] = target_company

        total_payable = _get_sum("Purchase Invoice", "outstanding_amount", pay_filters)
        open_bills_count = cint(frappe.db.count("Purchase Invoice", pay_filters))

        result["kpis"]["payable"] = {
            "title": _("Payable"),
            "has_permission": True,
            **_format_currency_value(total_payable, currency),
            "trend": {
                "percentage": open_bills_count,
                "direction": "neutral",
                "is_positive": True,
                "label": f"{open_bills_count} {_('bills')}",
            },
            "trend_context": _("due to vendors"),
        }
    else:
        result["kpis"]["payable"] = {"has_permission": False, "title": _("Payable")}

    # -------------------------------------------------------------
    # 4. NET PROFIT / MARGIN (Sales minus Purchases current month)
    # -------------------------------------------------------------
    if frappe.has_permission("Sales Invoice", "read") and frappe.has_permission("Purchase Invoice", "read"):
        curr_purchases_filters = {
            "docstatus": 1,
            "posting_date": ["between", [curr_month_start, curr_month_end]],
        }
        prev_purchases_filters = {
            "docstatus": 1,
            "posting_date": ["between", [prev_month_start, prev_month_end]],
        }
        if target_company:
            curr_purchases_filters["company"] = target_company
            prev_purchases_filters["company"] = target_company

        curr_purchases = _get_sum("Purchase Invoice", "base_grand_total", curr_purchases_filters)
        prev_purchases = _get_sum("Purchase Invoice", "base_grand_total", prev_purchases_filters)

        curr_net = (result["kpis"].get("total_sales", {}).get("raw", 0)) - curr_purchases
        prev_net = prev_sales - prev_purchases

        net_trend = _calc_trend(curr_net, prev_net)

        result["kpis"]["net_profit"] = {
            "title": _("Net Operating Balance"),
            "has_permission": True,
            **_format_currency_value(curr_net, currency),
            "trend": net_trend,
            "trend_context": _("revenue minus purchases"),
        }
    else:
        result["kpis"]["net_profit"] = {"has_permission": False, "title": _("Net Operating Balance")}

    # -------------------------------------------------------------
    # SECOND ROW KPIS:
    # 5. Orders (Sales Orders current month)
    # -------------------------------------------------------------
    if frappe.db.exists("DocType", "Sales Order") and frappe.has_permission("Sales Order", "read"):
        order_filters = {
            "docstatus": 1,
            "transaction_date": ["between", [curr_month_start, curr_month_end]],
        }
        if target_company:
            order_filters["company"] = target_company

        orders_count = cint(frappe.db.count("Sales Order", order_filters))
        orders_val = _get_sum("Sales Order", "base_grand_total", order_filters)

        result["kpis"]["orders"] = {
            "title": _("Orders"),
            "has_permission": True,
            "raw": orders_count,
            "formatted": str(orders_count),
            "sub_value": _format_currency_value(orders_val, currency)["formatted"],
            "trend": {"label": _("This Month"), "direction": "neutral", "is_positive": True},
            "trend_context": _("submitted sales orders"),
        }
    else:
        result["kpis"]["orders"] = {"has_permission": False, "title": _("Orders")}

    # -------------------------------------------------------------
    # 6. Customers (Total active customers)
    # -------------------------------------------------------------
    if frappe.db.exists("DocType", "Customer") and frappe.has_permission("Customer", "read"):
        cust_filters = {"disabled": 0}
        total_customers = cint(frappe.db.count("Customer", cust_filters))

        result["kpis"]["customers"] = {
            "title": _("Customers"),
            "has_permission": True,
            "raw": total_customers,
            "formatted": f"{total_customers:,}",
            "trend": {"label": _("Active"), "direction": "neutral", "is_positive": True},
            "trend_context": _("active customer accounts"),
        }
    else:
        result["kpis"]["customers"] = {"has_permission": False, "title": _("Customers")}

    # -------------------------------------------------------------
    # 7. Stock Value (Valuation of warehouse stock)
    # -------------------------------------------------------------
    if frappe.db.exists("DocType", "Bin") and frappe.has_permission("Bin", "read"):
        stock_val = _get_sum("Bin", "stock_value", {})
        result["kpis"]["stock_value"] = {
            "title": _("Stock Value"),
            "has_permission": True,
            **_format_currency_value(stock_val, currency),
            "trend": {"label": _("On Hand"), "direction": "neutral", "is_positive": True},
            "trend_context": _("total warehouse inventory"),
        }
    else:
        result["kpis"]["stock_value"] = {"has_permission": False, "title": _("Stock Value")}

    # -------------------------------------------------------------
    # 8. Pending Invoices (Unpaid or Overdue invoices)
    # -------------------------------------------------------------
    if frappe.has_permission("Sales Invoice", "read"):
        pending_filters = {
            "docstatus": 1,
            "outstanding_amount": [">", 0],
        }
        if target_company:
            pending_filters["company"] = target_company

        pending_count = cint(frappe.db.count("Sales Invoice", pending_filters))

        result["kpis"]["pending_invoices"] = {
            "title": _("Pending Invoices"),
            "has_permission": True,
            "raw": pending_count,
            "formatted": str(pending_count),
            "trend": {
                "label": _("Unpaid"),
                "direction": "warning" if pending_count > 0 else "neutral",
                "is_positive": pending_count == 0,
            },
            "trend_context": _("requiring settlement"),
        }
    else:
        result["kpis"]["pending_invoices"] = {"has_permission": False, "title": _("Pending Invoices")}

    return result


@frappe.whitelist()
def get_recent_transactions(company=None, limit=5):
    """
    Fetches real recent submitted transactions for the active dashboard user.
    Strictly checks permissions for Sales Invoices, Sales Orders, and Payments.
    """
    limit = cint(limit) or 5
    target_company = _get_default_company(company)

    data = {
        "invoices": [],
        "orders": [],
        "payments": [],
    }

    # 1. Recent Sales Invoices
    if frappe.db.exists("DocType", "Sales Invoice") and frappe.has_permission("Sales Invoice", "read"):
        inv_filters = {"docstatus": 1}
        if target_company:
            inv_filters["company"] = target_company

        invoices = frappe.get_all(
            "Sales Invoice",
            filters=inv_filters,
            fields=["name", "customer_name", "posting_date", "grand_total", "outstanding_amount", "status", "currency"],
            order_by="posting_date desc, creation desc",
            limit=limit,
        )
        for inv in invoices:
            inv["formatted_total"] = fmt_money(flt(inv.get("grand_total")), currency=inv.get("currency"))
            inv["formatted_outstanding"] = fmt_money(flt(inv.get("outstanding_amount")), currency=inv.get("currency"))
        data["invoices"] = invoices

    # 2. Recent Sales Orders
    if frappe.db.exists("DocType", "Sales Order") and frappe.has_permission("Sales Order", "read"):
        so_filters = {"docstatus": 1}
        if target_company:
            so_filters["company"] = target_company

        orders = frappe.get_all(
            "Sales Order",
            filters=so_filters,
            fields=["name", "customer_name", "transaction_date", "grand_total", "status", "currency"],
            order_by="transaction_date desc, creation desc",
            limit=limit,
        )
        for order in orders:
            order["formatted_total"] = fmt_money(flt(order.get("grand_total")), currency=order.get("currency"))
        data["orders"] = orders

    # 3. Recent Payment Entries
    if frappe.db.exists("DocType", "Payment Entry") and frappe.has_permission("Payment Entry", "read"):
        pe_filters = {"docstatus": 1}
        if target_company:
            pe_filters["company"] = target_company

        payments = frappe.get_all(
            "Payment Entry",
            filters=pe_filters,
            fields=["name", "party_name", "payment_type", "posting_date", "paid_amount", "paid_from_account_currency"],
            order_by="posting_date desc, creation desc",
            limit=limit,
        )
        for pay in payments:
            curr = pay.get("paid_from_account_currency")
            pay["formatted_amount"] = fmt_money(flt(pay.get("paid_amount")), currency=curr)
        data["payments"] = payments

    return data
