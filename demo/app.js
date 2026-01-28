/**
 * BouncePlatform Admin App
 */

const App = {
    state: { page: 'dashboard', filters: { status: 'all', search: '' } },
    
    // API path - can be overridden before init()
    apiPath: typeof API_PATH !== 'undefined' ? API_PATH : 'api.php',
    
    async api(action, opts = {}) {
        const url = new URL(this.apiPath, location.href);
        url.searchParams.set('action', action);
        if (opts.id) url.searchParams.set('id', opts.id);
        if (opts.params) Object.entries(opts.params).forEach(([k,v]) => v && url.searchParams.set(k, v));
        
        const res = await fetch(url, {
            method: opts.method || 'GET',
            headers: { 'Content-Type': 'application/json' },
            body: opts.body ? JSON.stringify(opts.body) : undefined
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Request failed');
        return data;
    },
    
    fmt: {
        currency: n => '$' + (parseFloat(n) || 0).toFixed(2),
        date: d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
        dateTime: d => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '',
        phone: p => { if (!p) return ''; const c = ('' + p).replace(/\D/g, ''); return c.length === 10 ? `(${c.slice(0,3)}) ${c.slice(3,6)}-${c.slice(6)}` : p; },
        initials: n => (n || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2),
        name: c => c ? `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown' : 'Unknown'
    },
    
    debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; },
    
    toast(msg, type = 'info') {
        const c = document.getElementById('toastContainer');
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.textContent = msg;
        c.appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
    },
    
    openModal(title, html) {
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalBody').innerHTML = html;
        document.getElementById('modal').classList.add('open');
        lucide.createIcons();
    },
    
    openPanel(title, html) {
        document.getElementById('panelTitle').textContent = title;
        document.getElementById('panelContent').innerHTML = html;
        document.getElementById('slidePanel').classList.add('open');
        document.getElementById('panelOverlay').classList.add('open');
        lucide.createIcons();
    },
    
    pages: {
        async dashboard() {
            const d = await App.api('dashboard');
            return `
                <div class="stats-grid">
                    <div class="stat-card gradient">
                        <div class="stat-label">Today's Bookings</div>
                        <div class="stat-value">${d.stats.today_count}</div>
                        <div class="stat-sub">${d.stats.upcoming_count} upcoming this week</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Month Revenue</div>
                        <div class="stat-value">${App.fmt.currency(d.stats.month_revenue)}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Outstanding</div>
                        <div class="stat-value">${App.fmt.currency(d.stats.outstanding_balance)}</div>
                        <div class="stat-sub">${d.stats.outstanding_count} bookings</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Pending Waivers</div>
                        <div class="stat-value">${d.stats.pending_waivers}</div>
                    </div>
                </div>
                <div class="grid-2">
                    <div class="card">
                        <div class="card-header"><h3 class="card-title">Today's Schedule</h3></div>
                        <div class="card-body">
                            ${d.today.length === 0 ? '<p class="text-gray text-center">No bookings today</p>' : 
                              d.today.map(b => `<div class="item-card" onclick="viewBooking('${b.id}')">
                                <div class="item-details"><div class="item-name">${App.fmt.name(b.customer)}</div><div class="item-meta">${b.event_start}-${b.event_end}</div></div>
                                <span class="badge badge-${b.status}">${b.status}</span>
                              </div>`).join('')}
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-header"><h3 class="card-title">Upcoming This Week</h3></div>
                        <div class="card-body">
                            ${d.upcoming.length === 0 ? '<p class="text-gray text-center">No upcoming bookings</p>' :
                              d.upcoming.slice(0,5).map(b => `<div class="item-card" onclick="viewBooking('${b.id}')">
                                <div class="item-details"><div class="item-name">${App.fmt.name(b.customer)}</div><div class="item-meta">${App.fmt.date(b.event_date)}</div></div>
                                <span class="badge badge-${b.status}">${b.status}</span>
                              </div>`).join('')}
                        </div>
                    </div>
                </div>`;
        },
        
        async bookings() {
            const bookings = await App.api('bookings', { params: App.state.filters });
            return `
                <div class="filters-bar">
                    <div class="search-box"><i data-lucide="search"></i>
                        <input type="text" placeholder="Search..." value="${App.state.filters.search || ''}" oninput="App.filter('search', this.value)">
                    </div>
                    <div class="filter-tabs">
                        ${['all','pending','confirmed','delivered','completed'].map(s => 
                          `<button class="filter-tab ${App.state.filters.status === s ? 'active' : ''}" onclick="App.filter('status','${s}')">${s === 'all' ? 'All' : s.charAt(0).toUpperCase()+s.slice(1)}</button>`
                        ).join('')}
                    </div>
                </div>
                <div class="card"><div class="table-wrapper"><table class="table">
                    <thead><tr><th>Booking</th><th>Customer</th><th>Event Date</th><th>Total</th><th>Status</th><th>Payment</th></tr></thead>
                    <tbody>
                        ${bookings.length === 0 ? '<tr><td colspan="6" class="text-center text-gray">No bookings</td></tr>' :
                          bookings.map(b => `<tr onclick="viewBooking('${b.id}')">
                            <td><strong>${b.booking_number || b.id}</strong></td>
                            <td>${App.fmt.name(b.customer)}</td>
                            <td>${App.fmt.date(b.event_date)}<br><span class="text-xs text-gray">${b.event_start || ''}</span></td>
                            <td>${App.fmt.currency(b.total)}</td>
                            <td><span class="badge badge-${b.status}">${b.status}</span></td>
                            <td><span class="badge badge-${b.payment_status}">${b.payment_status}</span></td>
                          </tr>`).join('')}
                    </tbody>
                </table></div></div>`;
        },
        
        async customers() {
            const customers = await App.api('customers', { params: { search: App.state.filters.search } });
            return `
                <div class="filters-bar">
                    <div class="search-box"><i data-lucide="search"></i>
                        <input type="text" placeholder="Search..." value="${App.state.filters.search || ''}" oninput="App.filter('search', this.value)">
                    </div>
                    <button class="btn btn-primary" onclick="showCustomerForm()"><i data-lucide="plus"></i> Add Customer</button>
                </div>
                <div class="product-grid">
                    ${customers.map(c => `<div class="card" onclick="viewCustomer('${c.id}')" style="cursor:pointer">
                        <div class="card-body">
                            <div class="customer-header">
                                <div class="customer-avatar">${App.fmt.initials(App.fmt.name(c))}</div>
                                <div class="customer-info"><h3>${App.fmt.name(c)}</h3><div class="customer-contact">${c.email || 'No email'}</div></div>
                            </div>
                            <div class="flex justify-between text-sm mt-2"><span class="text-gray">${App.fmt.phone(c.phone)}</span><span class="text-gray">${c.city || ''}</span></div>
                        </div>
                    </div>`).join('')}
                </div>`;
        },
        
        async inventory() {
            const products = await App.api('products', { params: { search: App.state.filters.search, category: App.state.filters.category } });
            return `
                <div class="filters-bar">
                    <div class="search-box"><i data-lucide="search"></i>
                        <input type="text" placeholder="Search..." value="${App.state.filters.search || ''}" oninput="App.filter('search', this.value)">
                    </div>
                    <select class="filter-select" onchange="App.filter('category', this.value)">
                        <option value="all">All Categories</option>
                        <option value="bounce-house">Bounce Houses</option>
                        <option value="water-slide">Water Slides</option>
                        <option value="combo">Combos</option>
                        <option value="obstacle">Obstacle Courses</option>
                        <option value="concession">Concessions</option>
                    </select>
                    <button class="btn btn-primary" onclick="showProductForm()"><i data-lucide="plus"></i> Add Product</button>
                </div>
                <div class="product-grid">
                    ${products.map(p => `<div class="product-card" onclick="viewProduct('${p.id}')">
                        <div class="product-card-image">${p.emoji || '🎪'}</div>
                        <div class="product-card-body">
                            <div class="product-card-title">${p.name}</div>
                            <div class="product-card-category">${(p.category || '').replace('-', ' ')}</div>
                            <div class="product-card-footer">
                                <div class="product-card-price">${App.fmt.currency(p.daily_rate)}/day</div>
                                <div class="product-card-stock">${p.quantity || 0} in stock</div>
                            </div>
                        </div>
                    </div>`).join('')}
                </div>`;
        },
        
        async payments() {
            const payments = await App.api('payments');
            const bookings = await App.api('bookings');
            const outstanding = bookings.filter(b => (b.balance_due || 0) > 0 && b.status !== 'cancelled');
            return `
                <div class="grid-2">
                    <div class="card">
                        <div class="card-header"><h3 class="card-title">Outstanding Balances</h3></div>
                        <div class="card-body">
                            ${outstanding.length === 0 ? '<p class="text-gray text-center">All paid! 🎉</p>' :
                              outstanding.slice(0,10).map(b => `<div class="item-card">
                                <div class="item-details"><div class="item-name">${b.booking_number}</div><div class="item-meta">${App.fmt.name(b.customer)}</div></div>
                                <div><div class="text-danger font-bold">${App.fmt.currency(b.balance_due)}</div>
                                    <button class="btn btn-sm btn-success mt-1" onclick="showPaymentForm('${b.id}', ${b.balance_due})">Record</button>
                                </div>
                              </div>`).join('')}
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-header"><h3 class="card-title">Recent Payments</h3></div>
                        <div class="card-body">
                            ${payments.slice(0,10).map(p => `<div class="item-card">
                                <div class="item-details"><div class="item-name text-success">+${App.fmt.currency(p.amount)}</div><div class="item-meta">${p.method} • ${App.fmt.dateTime(p.created_at)}</div></div>
                            </div>`).join('')}
                        </div>
                    </div>
                </div>`;
        },
        
        async promos() {
            const promos = await App.api('promos');
            return `
                <div class="filters-bar">
                    <button class="btn btn-primary" onclick="showPromoForm()"><i data-lucide="plus"></i> Add Promo</button>
                </div>
                <div class="card"><div class="table-wrapper"><table class="table">
                    <thead><tr><th>Code</th><th>Discount</th><th>Min Order</th><th>Usage</th><th>Expires</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                        ${promos.map(p => `<tr>
                            <td><strong>${p.code}</strong></td>
                            <td>${p.discount_type === 'percent' ? p.discount_value + '%' : App.fmt.currency(p.discount_value)}</td>
                            <td>${App.fmt.currency(p.min_order || 0)}</td>
                            <td>${p.times_used || 0}${p.max_uses ? '/' + p.max_uses : ''}</td>
                            <td>${p.valid_until ? App.fmt.date(p.valid_until) : 'Never'}</td>
                            <td><span class="badge badge-${p.status === 'active' ? 'completed' : 'cancelled'}">${p.status}</span></td>
                            <td>
                                <button class="btn btn-sm btn-ghost" onclick="togglePromo('${p.id}', '${p.status === 'active' ? 'inactive' : 'active'}')">${p.status === 'active' ? 'Disable' : 'Enable'}</button>
                                <button class="btn btn-sm btn-ghost text-danger" onclick="deletePromo('${p.id}')">Delete</button>
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table></div></div>`;
        },
        
        async reports() {
            // Set default date range (this month)
            const today = new Date();
            const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const defaultFrom = App.state.reportFrom || firstOfMonth.toISOString().split('T')[0];
            const defaultTo = App.state.reportTo || today.toISOString().split('T')[0];
            
            App.state.reportFrom = defaultFrom;
            App.state.reportTo = defaultTo;
            
            return `
                <div class="report-controls">
                    <div class="report-date-range">
                        <div class="date-presets">
                            <button class="btn btn-sm btn-secondary" onclick="setReportRange('today')">Today</button>
                            <button class="btn btn-sm btn-secondary" onclick="setReportRange('week')">This Week</button>
                            <button class="btn btn-sm btn-secondary active" onclick="setReportRange('month')">This Month</button>
                            <button class="btn btn-sm btn-secondary" onclick="setReportRange('quarter')">This Quarter</button>
                            <button class="btn btn-sm btn-secondary" onclick="setReportRange('year')">This Year</button>
                            <button class="btn btn-sm btn-secondary" onclick="setReportRange('all')">All Time</button>
                        </div>
                        <div class="date-inputs">
                            <input type="date" class="form-input" id="reportFrom" value="${defaultFrom}" onchange="updateReportRange()">
                            <span class="text-gray">to</span>
                            <input type="date" class="form-input" id="reportTo" value="${defaultTo}" onchange="updateReportRange()">
                        </div>
                    </div>
                    <button class="btn btn-secondary" onclick="exportReports()"><i data-lucide="download"></i> Export Data</button>
                </div>
                
                <div class="report-tabs">
                    <button class="report-tab active" data-report="overview" onclick="showReport('overview')">📊 Overview</button>
                    <button class="report-tab" data-report="revenue" onclick="showReport('revenue')">💰 Revenue</button>
                    <button class="report-tab" data-report="bookings" onclick="showReport('bookings')">📅 Bookings</button>
                    <button class="report-tab" data-report="products" onclick="showReport('products')">📦 Products</button>
                    <button class="report-tab" data-report="customers" onclick="showReport('customers')">👥 Customers</button>
                    <button class="report-tab" data-report="operations" onclick="showReport('operations')">🚚 Operations</button>
                </div>
                
                <div id="reportContent" class="report-content">
                    <div class="loading"><div class="spinner"></div></div>
                </div>
            `;
        },
        
        async exports() {
            return `
                <div class="exports-header">
                    <p class="text-gray">Export your data to various formats and integrate with other tools</p>
                </div>
                
                <div class="exports-grid">
                    <!-- Data Exports -->
                    <div class="export-card">
                        <div class="export-icon">📊</div>
                        <h3>Excel / CSV Export</h3>
                        <p>Download your data as spreadsheets</p>
                        <div class="export-options">
                            <button class="btn btn-secondary btn-sm" onclick="exportData('bookings', 'csv')"><i data-lucide="calendar"></i> Bookings</button>
                            <button class="btn btn-secondary btn-sm" onclick="exportData('customers', 'csv')"><i data-lucide="users"></i> Customers</button>
                            <button class="btn btn-secondary btn-sm" onclick="exportData('products', 'csv')"><i data-lucide="package"></i> Products</button>
                            <button class="btn btn-secondary btn-sm" onclick="exportData('payments', 'csv')"><i data-lucide="credit-card"></i> Payments</button>
                            <button class="btn btn-secondary btn-sm" onclick="exportData('revenue', 'csv')"><i data-lucide="trending-up"></i> Revenue Report</button>
                        </div>
                        <div class="export-format-toggle">
                            <span class="text-sm text-gray">Format:</span>
                            <label><input type="radio" name="spreadsheetFormat" value="csv" checked> CSV</label>
                            <label><input type="radio" name="spreadsheetFormat" value="xlsx"> Excel (.xlsx)</label>
                        </div>
                    </div>
                    
                    <!-- QuickBooks -->
                    <div class="export-card">
                        <div class="export-icon">📗</div>
                        <h3>QuickBooks</h3>
                        <p>Export for QuickBooks Desktop & Online</p>
                        <div class="export-options">
                            <button class="btn btn-secondary btn-sm" onclick="exportQuickBooks('invoices')"><i data-lucide="file-text"></i> Invoices (IIF)</button>
                            <button class="btn btn-secondary btn-sm" onclick="exportQuickBooks('customers')"><i data-lucide="users"></i> Customers (IIF)</button>
                            <button class="btn btn-secondary btn-sm" onclick="exportQuickBooks('payments')"><i data-lucide="dollar-sign"></i> Payments (IIF)</button>
                        </div>
                        <div class="export-date-range">
                            <input type="date" class="form-input form-input-sm" id="qbFrom" value="${new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]}">
                            <span>to</span>
                            <input type="date" class="form-input form-input-sm" id="qbTo" value="${new Date().toISOString().split('T')[0]}">
                        </div>
                    </div>
                    
                    <!-- Calendar Sync -->
                    <div class="export-card">
                        <div class="export-icon">📅</div>
                        <h3>Calendar Sync</h3>
                        <p>Sync bookings to your calendar app</p>
                        <div class="export-options">
                            <button class="btn btn-secondary btn-sm" onclick="exportCalendar('ical')"><i data-lucide="calendar"></i> Download .ics File</button>
                            <button class="btn btn-secondary btn-sm" onclick="copyCalendarUrl()"><i data-lucide="link"></i> Copy Calendar URL</button>
                        </div>
                        <div class="calendar-url-display" id="calendarUrlDisplay" style="display:none">
                            <input type="text" class="form-input form-input-sm" readonly id="calendarUrl">
                            <p class="text-xs text-gray mt-1">Add this URL to Google Calendar, Apple Calendar, or Outlook</p>
                        </div>
                    </div>
                    
                    <!-- PDF Exports -->
                    <div class="export-card">
                        <div class="export-icon">📄</div>
                        <h3>PDF Documents</h3>
                        <p>Generate printable documents</p>
                        <div class="export-options">
                            <button class="btn btn-secondary btn-sm" onclick="exportPDF('invoice-batch')"><i data-lucide="file-text"></i> Invoices (Batch)</button>
                            <button class="btn btn-secondary btn-sm" onclick="exportPDF('revenue-report')"><i data-lucide="bar-chart-2"></i> Revenue Report</button>
                            <button class="btn btn-secondary btn-sm" onclick="exportPDF('delivery-schedule')"><i data-lucide="truck"></i> Delivery Schedule</button>
                            <button class="btn btn-secondary btn-sm" onclick="exportPDF('customer-list')"><i data-lucide="users"></i> Customer List</button>
                        </div>
                        <div class="export-date-range">
                            <input type="date" class="form-input form-input-sm" id="pdfFrom" value="${new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]}">
                            <span>to</span>
                            <input type="date" class="form-input form-input-sm" id="pdfTo" value="${new Date().toISOString().split('T')[0]}">
                        </div>
                    </div>
                    
                    <!-- Google Sheets -->
                    <div class="export-card">
                        <div class="export-icon">📊</div>
                        <h3>Google Sheets</h3>
                        <p>Export directly to Google Drive</p>
                        <div class="export-options">
                            <button class="btn btn-secondary btn-sm" onclick="exportGoogleSheets('bookings')"><i data-lucide="calendar"></i> Bookings</button>
                            <button class="btn btn-secondary btn-sm" onclick="exportGoogleSheets('customers')"><i data-lucide="users"></i> Customers</button>
                            <button class="btn btn-secondary btn-sm" onclick="exportGoogleSheets('revenue')"><i data-lucide="trending-up"></i> Revenue</button>
                        </div>
                        <p class="text-xs text-gray mt-2">Downloads CSV file formatted for Google Sheets import</p>
                    </div>
                    
                    <!-- Email Marketing -->
                    <div class="export-card">
                        <div class="export-icon">📧</div>
                        <h3>Email Marketing</h3>
                        <p>Export customer lists for email campaigns</p>
                        <div class="export-options">
                            <button class="btn btn-secondary btn-sm" onclick="exportMailingList('all')"><i data-lucide="users"></i> All Customers</button>
                            <button class="btn btn-secondary btn-sm" onclick="exportMailingList('recent')"><i data-lucide="clock"></i> Recent (90 days)</button>
                            <button class="btn btn-secondary btn-sm" onclick="exportMailingList('vip')"><i data-lucide="star"></i> VIP Customers</button>
                        </div>
                        <p class="text-xs text-gray mt-2">Mailchimp, Constant Contact, & other email tools compatible</p>
                    </div>
                    
                    <!-- Backup -->
                    <div class="export-card">
                        <div class="export-icon">💾</div>
                        <h3>Full Backup</h3>
                        <p>Download complete database backup</p>
                        <div class="export-options">
                            <button class="btn btn-primary btn-sm" onclick="exportFullBackup()"><i data-lucide="download"></i> Download Backup (JSON)</button>
                        </div>
                        <p class="text-xs text-gray mt-2">Includes all bookings, customers, products, settings</p>
                    </div>
                    
                    <!-- Zapier / Webhooks -->
                    <div class="export-card">
                        <div class="export-icon">🔗</div>
                        <h3>Zapier & Webhooks</h3>
                        <p>Connect to 5000+ apps automatically</p>
                        <div class="export-options">
                            <button class="btn btn-secondary btn-sm" onclick="showWebhookSetup()"><i data-lucide="settings"></i> Configure Webhooks</button>
                        </div>
                        <p class="text-xs text-gray mt-2">Trigger actions on new bookings, customers, payments</p>
                    </div>
                </div>
                
                <!-- Webhook Setup Modal Content -->
                <div id="webhookSetupContent" style="display:none">
                    <div class="form-group">
                        <label class="form-label">Webhook URL</label>
                        <input type="url" class="form-input" id="webhookUrl" placeholder="https://hooks.zapier.com/...">
                        <p class="text-xs text-gray mt-1">Get this URL from Zapier, Make.com, or your automation tool</p>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Trigger Events</label>
                        <div class="checkbox-group">
                            <label><input type="checkbox" name="webhookEvents" value="booking.created" checked> New Booking</label>
                            <label><input type="checkbox" name="webhookEvents" value="booking.updated"> Booking Updated</label>
                            <label><input type="checkbox" name="webhookEvents" value="payment.received" checked> Payment Received</label>
                            <label><input type="checkbox" name="webhookEvents" value="customer.created"> New Customer</label>
                        </div>
                    </div>
                    <button class="btn btn-primary" onclick="saveWebhookSettings()">Save Webhook Settings</button>
                </div>
            `;
        },
        
        async settings() {
            const s = await App.api('settings');
            const m = s.meta || {};
            const zones = s.zones || [];
            
            // Store zones globally for map access
            window._zones = zones;
            window._baseLocation = m.base_location || { lat: 41.1417, lng: -87.8792 }; // Bradley, IL default
            
            setTimeout(() => initZoneMap(), 100);
            
            return `
                <div class="grid-2">
                    <div>
                        <div class="card">
                            <div class="card-header"><h3 class="card-title">Business Settings</h3></div>
                            <div class="card-body">
                                <form onsubmit="saveSettings(event)">
                                    <div class="form-group"><label class="form-label">Business Name</label><input type="text" class="form-input" name="business_name" value="${m.business_name || ''}"></div>
                                    <div class="form-row">
                                        <div class="form-group"><label class="form-label">Phone</label><input type="tel" class="form-input" name="business_phone" value="${m.business_phone || ''}"></div>
                                        <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-input" name="business_email" value="${m.business_email || ''}"></div>
                                    </div>
                                    <div class="form-row">
                                        <div class="form-group"><label class="form-label">Tax Rate (%)</label><input type="number" step="0.01" class="form-input" name="tax_rate" value="${((m.tax_rate || 0) * 100).toFixed(2)}"></div>
                                        <div class="form-group"><label class="form-label">Deposit (%)</label><input type="number" step="1" class="form-input" name="deposit_percent" value="${m.deposit_percent || 25}"></div>
                                    </div>
                                    <button type="submit" class="btn btn-primary">Save Settings</button>
                                </form>
                            </div>
                        </div>
                        
                        <div class="card mt-4">
                            <div class="card-header">
                                <h3 class="card-title">Delivery Zones</h3>
                                <button class="btn btn-sm btn-primary" onclick="showZoneForm()"><i data-lucide="plus"></i> Add Zone</button>
                            </div>
                            <div class="card-body" id="zonesList">
                                ${zones.length === 0 ? '<p class="text-gray text-center">No zones configured</p>' :
                                  zones.map((z, i) => `
                                    <div class="zone-item" data-zone-id="${z.id}" onmouseenter="highlightZone('${z.id}')" onmouseleave="unhighlightZone('${z.id}')">
                                        <div class="zone-color" style="background:${z.color || getZoneColor(i)}"></div>
                                        <div class="zone-details">
                                            <div class="zone-name">${z.name}</div>
                                            <div class="zone-meta">${z.zip_codes?.length || 0} ZIP codes</div>
                                        </div>
                                        <div class="zone-fee">${z.delivery_fee === 0 ? 'FREE' : App.fmt.currency(z.delivery_fee)}</div>
                                        <div class="zone-actions">
                                            <button class="btn btn-sm btn-ghost" onclick="editZone('${z.id}')"><i data-lucide="edit-2"></i></button>
                                            <button class="btn btn-sm btn-ghost text-danger" onclick="deleteZone('${z.id}')"><i data-lucide="trash-2"></i></button>
                                        </div>
                                    </div>
                                  `).join('')}
                            </div>
                        </div>
                    </div>
                    
                    <div class="card" style="height: fit-content;">
                        <div class="card-header">
                            <h3 class="card-title">Service Area Map</h3>
                            <div class="map-tools">
                                <button class="btn btn-sm btn-secondary" onclick="centerMapOnBase()" title="Center on base location"><i data-lucide="home"></i></button>
                                <button class="btn btn-sm btn-secondary" onclick="setBaseLocation()" title="Set base location"><i data-lucide="map-pin"></i></button>
                            </div>
                        </div>
                        <div class="card-body" style="padding:0;">
                            <div id="zoneMap" style="height:500px;border-radius:0 0 12px 12px;"></div>
                        </div>
                    </div>
                </div>`;
        }
    },
    
    filter: function(key, val) {
        clearTimeout(this._filterTimeout);
        this._filterTimeout = setTimeout(() => {
            App.state.filters[key] = val;
            App.navigate(App.state.page);
        }, 300);
    },
    
    async navigate(page) {
        App.state.page = page;
        document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
        document.getElementById('pageTitle').textContent = page.charAt(0).toUpperCase() + page.slice(1);
        document.getElementById('pageContent').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
        
        try {
            const html = await App.pages[page]();
            document.getElementById('pageContent').innerHTML = html;
            lucide.createIcons();
            
            // Load report data if on reports page
            if (page === 'reports') {
                setTimeout(() => showReport('overview'), 100);
            }
        } catch (e) {
            document.getElementById('pageContent').innerHTML = `<div class="empty-state"><p>Error: ${e.message}</p></div>`;
        }
        
        location.hash = page;
    },
    
    init() {
        if (typeof API_PATH !== 'undefined') this.apiPath = API_PATH;
        lucide.createIcons();
        
        document.querySelectorAll('.nav-item[data-page]').forEach(el => {
            el.addEventListener('click', e => { e.preventDefault(); App.navigate(el.dataset.page); document.getElementById('sidebar').classList.remove('open'); });
        });
        
        document.getElementById('menuToggle').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
        document.getElementById('modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
        
        const hash = location.hash.slice(1) || 'dashboard';
        App.navigate(hash);
    }
};

// Global functions
function closeModal() { document.getElementById('modal').classList.remove('open'); }
function closePanel() { document.getElementById('slidePanel').classList.remove('open'); document.getElementById('panelOverlay').classList.remove('open'); }

async function viewBooking(id) {
    const b = await App.api('bookings', { id });
    App.openPanel(`Booking ${b.booking_number}`, `
        <div class="flex justify-between mb-3"><span class="badge badge-${b.status}">${b.status}</span><span class="badge badge-${b.payment_status}">${b.payment_status}</span></div>
        <div class="customer-header">
            <div class="customer-avatar">${App.fmt.initials(App.fmt.name(b.customer))}</div>
            <div class="customer-info"><h3>${App.fmt.name(b.customer)}</h3><div class="customer-contact">${b.customer?.email || ''}<br>${App.fmt.phone(b.customer?.phone)}</div></div>
        </div>
        <div class="detail-section mt-4">
            <div class="detail-section-title">Event</div>
            <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${App.fmt.date(b.event_date)}</span></div>
            <div class="detail-row"><span class="detail-label">Time</span><span class="detail-value">${b.event_start} - ${b.event_end}</span></div>
            <div class="detail-row"><span class="detail-label">Address</span><span class="detail-value">${b.delivery_address || 'N/A'}</span></div>
        </div>
        <div class="detail-section mt-4">
            <div class="detail-section-title">Items</div>
            ${(b.items || []).map(i => `<div class="item-card"><div class="item-details"><div class="item-name">${i.product_name}</div><div class="item-meta">Qty: ${i.quantity || 1}</div></div><div class="item-price">${App.fmt.currency(i.subtotal)}</div></div>`).join('')}
        </div>
        <div class="detail-section mt-4">
            <div class="detail-section-title">Payment</div>
            <div class="detail-row"><span class="detail-label">Subtotal</span><span class="detail-value">${App.fmt.currency(b.subtotal)}</span></div>
            <div class="detail-row"><span class="detail-label">Delivery</span><span class="detail-value">${App.fmt.currency(b.delivery_fee)}</span></div>
            <div class="detail-row"><span class="detail-label">Tax</span><span class="detail-value">${App.fmt.currency(b.tax)}</span></div>
            <div class="detail-row"><span class="detail-label font-bold">Total</span><span class="detail-value font-bold">${App.fmt.currency(b.total)}</span></div>
            <div class="detail-row"><span class="detail-label">Paid</span><span class="detail-value text-success">${App.fmt.currency(b.amount_paid)}</span></div>
            <div class="detail-row"><span class="detail-label ${b.balance_due > 0 ? 'text-danger' : ''}">Balance</span><span class="detail-value ${b.balance_due > 0 ? 'text-danger' : ''} font-bold">${App.fmt.currency(b.balance_due)}</span></div>
        </div>
        ${b.balance_due > 0 ? `<button class="btn btn-success btn-lg mt-4" style="width:100%" onclick="showPaymentForm('${b.id}', ${b.balance_due})"><i data-lucide="credit-card"></i> Record Payment</button>` : ''}
        <div class="mt-4">
            <div class="detail-section-title">Update Status</div>
            <div class="flex gap-2 flex-wrap">
                ${['pending','confirmed','delivered','completed','cancelled'].map(s => `<button class="btn btn-sm ${b.status === s ? 'btn-primary' : 'btn-secondary'}" onclick="updateBookingStatus('${b.id}','${s}')">${s}</button>`).join('')}
            </div>
        </div>
    `);
}

async function viewCustomer(id) {
    const c = await App.api('customers', { id });
    App.openPanel('Edit Customer', `
        <form id="editCustomerForm" onsubmit="saveCustomerInline(event, '${c.id}')">
            <div class="customer-header mb-4">
                <div class="customer-avatar">${App.fmt.initials(App.fmt.name(c))}</div>
                <div class="customer-info">
                    <div class="form-row" style="gap:0.5rem">
                        <input type="text" class="form-input" name="first_name" value="${c.first_name || ''}" placeholder="First" required style="font-weight:600">
                        <input type="text" class="form-input" name="last_name" value="${c.last_name || ''}" placeholder="Last" required style="font-weight:600">
                    </div>
                </div>
            </div>
            
            <div class="form-group">
                <label class="form-label">Email</label>
                <input type="email" class="form-input" name="email" value="${c.email || ''}" placeholder="email@example.com">
            </div>
            
            <div class="form-group">
                <label class="form-label">Phone</label>
                <input type="tel" class="form-input" name="phone" value="${c.phone || ''}" placeholder="(815) 555-0123">
            </div>
            
            <div class="form-group">
                <label class="form-label">Address</label>
                <input type="text" class="form-input" name="address" value="${c.address || ''}" placeholder="123 Main St">
            </div>
            
            <div class="form-row" style="grid-template-columns: 1fr 70px 90px;">
                <div class="form-group">
                    <label class="form-label">City</label>
                    <input type="text" class="form-input" name="city" value="${c.city || ''}" placeholder="Bradley">
                </div>
                <div class="form-group">
                    <label class="form-label">State</label>
                    <input type="text" class="form-input" name="state" value="${c.state || 'IL'}" placeholder="IL" maxlength="2" style="text-transform:uppercase">
                </div>
                <div class="form-group">
                    <label class="form-label">ZIP</label>
                    <input type="text" class="form-input" name="zip" value="${c.zip || ''}" placeholder="60915">
                </div>
            </div>
            
            <div class="form-group">
                <label class="form-label">Source</label>
                <select class="form-select" name="source">
                    <option value="website" ${c.source === 'website' ? 'selected' : ''}>Website</option>
                    <option value="google" ${c.source === 'google' ? 'selected' : ''}>Google</option>
                    <option value="facebook" ${c.source === 'facebook' ? 'selected' : ''}>Facebook</option>
                    <option value="referral" ${c.source === 'referral' ? 'selected' : ''}>Referral</option>
                    <option value="phone" ${c.source === 'phone' ? 'selected' : ''}>Phone</option>
                    <option value="repeat" ${c.source === 'repeat' ? 'selected' : ''}>Repeat Customer</option>
                </select>
            </div>
            
            <div class="form-group">
                <label class="form-label">Notes</label>
                <textarea class="form-textarea" name="notes" rows="2" placeholder="Internal notes about this customer...">${c.notes || ''}</textarea>
            </div>
            
            <div class="panel-actions">
                <button type="submit" class="btn btn-primary"><i data-lucide="check"></i> Save Changes</button>
                <button type="button" class="btn btn-danger" onclick="deleteCustomer('${c.id}')"><i data-lucide="trash-2"></i> Delete</button>
            </div>
        </form>
        
        ${(c.bookings || []).length > 0 ? `
        <div class="detail-section mt-4">
            <div class="detail-section-title">Bookings (${c.bookings.length})</div>
            ${c.bookings.slice(0,5).map(b => `<div class="item-card" onclick="viewBooking('${b.id}')"><div class="item-details"><div class="item-name">${b.booking_number}</div><div class="item-meta">${App.fmt.date(b.event_date)}</div></div><span class="badge badge-${b.status}">${b.status}</span></div>`).join('')}
        </div>` : ''}
    `);
}

async function saveCustomerInline(e, id) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    try {
        await App.api('customers', { method: 'PUT', id, body: data });
        App.toast('Customer saved!', 'success');
        App.navigate('customers');
    } catch (err) { App.toast('Error: ' + err.message, 'error'); }
}

async function deleteCustomer(id) {
    if (!confirm('Delete this customer? This cannot be undone.')) return;
    try {
        await App.api('customers', { method: 'DELETE', id });
        App.toast('Customer deleted!', 'success');
        closePanel();
        App.navigate('customers');
    } catch (err) { App.toast('Error: ' + err.message, 'error'); }
}

async function viewProduct(id) {
    const p = await App.api('products', { id });
    const emojis = ['🏰','🌴','⚽','👑','🏃','🧸','🎪','🎈','🎉','🌈','🦄','🚀','🍭','🍿'];
    App.openPanel('Edit Product', `
        <form id="editProductForm" onsubmit="saveProductInline(event, '${p.id}')">
            <div class="text-center mb-4">
                <select name="emoji" class="emoji-picker">${emojis.map(e => `<option value="${e}" ${p.emoji === e ? 'selected' : ''}>${e}</option>`).join('')}</select>
            </div>
            
            <div class="form-group">
                <label class="form-label">Name</label>
                <input type="text" class="form-input" name="name" value="${p.name || ''}" required>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Daily Rate</label>
                    <div class="input-with-prefix"><span>$</span><input type="number" step="0.01" class="form-input" name="daily_rate" value="${p.daily_rate || 0}" required></div>
                </div>
                <div class="form-group">
                    <label class="form-label">Deposit</label>
                    <div class="input-with-prefix"><span>$</span><input type="number" step="0.01" class="form-input" name="deposit_amount" value="${p.deposit_amount || 0}"></div>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Category</label>
                    <select class="form-select" name="category">
                        <option value="bounce-house" ${p.category === 'bounce-house' ? 'selected' : ''}>Bounce House</option>
                        <option value="water-slide" ${p.category === 'water-slide' ? 'selected' : ''}>Water Slide</option>
                        <option value="combo" ${p.category === 'combo' ? 'selected' : ''}>Combo</option>
                        <option value="obstacle" ${p.category === 'obstacle' ? 'selected' : ''}>Obstacle Course</option>
                        <option value="concession" ${p.category === 'concession' ? 'selected' : ''}>Concession</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Status</label>
                    <select class="form-select" name="status">
                        <option value="active" ${p.status === 'active' ? 'selected' : ''}>Active</option>
                        <option value="inactive" ${p.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                    </select>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Quantity</label>
                    <input type="number" class="form-input" name="quantity" value="${p.quantity || 1}">
                </div>
                <div class="form-group">
                    <label class="form-label">Sort Order</label>
                    <input type="number" class="form-input" name="sort_order" value="${p.sort_order || 99}">
                </div>
            </div>
            
            <div class="detail-section-title mt-4">Specs</div>
            <div class="form-group">
                <label class="form-label">Dimensions</label>
                <input type="text" class="form-input" name="dimensions" value="${p.dimensions || ''}" placeholder="e.g. 15'L x 15'W x 14'H">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Capacity</label>
                    <input type="text" class="form-input" name="capacity" value="${p.capacity || ''}" placeholder="e.g. 8-10 kids">
                </div>
                <div class="form-group">
                    <label class="form-label">Age Range</label>
                    <input type="text" class="form-input" name="age_range" value="${p.age_range || ''}" placeholder="e.g. 3-12 years">
                </div>
            </div>
            
            <div class="form-group">
                <label class="form-label">Description</label>
                <textarea class="form-textarea" name="description" rows="3">${p.description || ''}</textarea>
            </div>
            
            <div class="panel-actions">
                <button type="submit" class="btn btn-primary"><i data-lucide="check"></i> Save Changes</button>
                <button type="button" class="btn btn-danger" onclick="deleteProduct('${p.id}')"><i data-lucide="trash-2"></i> Delete</button>
            </div>
        </form>
    `);
}

async function saveProductInline(e, id) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    data.daily_rate = parseFloat(data.daily_rate) || 0;
    data.deposit_amount = parseFloat(data.deposit_amount) || 0;
    data.quantity = parseInt(data.quantity) || 1;
    data.sort_order = parseInt(data.sort_order) || 99;
    try {
        await App.api('products', { method: 'PUT', id, body: data });
        App.toast('Product saved!', 'success');
        App.navigate('inventory');
    } catch (err) { App.toast('Error: ' + err.message, 'error'); }
}

function showCustomerForm(id) {
    App.openModal(id ? 'Edit Customer' : 'New Customer', `
        <form onsubmit="saveCustomer(event${id ? ", '" + id + "'" : ''})">
            <div class="form-row">
                <div class="form-group"><label class="form-label">First Name *</label><input type="text" class="form-input" name="first_name" required></div>
                <div class="form-group"><label class="form-label">Last Name *</label><input type="text" class="form-input" name="last_name" required></div>
            </div>
            <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-input" name="email"></div>
            <div class="form-group"><label class="form-label">Phone</label><input type="tel" class="form-input" name="phone"></div>
            <div class="form-group"><label class="form-label">Address</label><input type="text" class="form-input" name="address"></div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">City</label><input type="text" class="form-input" name="city"></div>
                <div class="form-group"><label class="form-label">ZIP</label><input type="text" class="form-input" name="zip"></div>
            </div>
            <div class="form-group"><label class="form-label">Notes</label><textarea class="form-textarea" name="notes"></textarea></div>
            <div class="flex gap-2 justify-end mt-4">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Save</button>
            </div>
        </form>
    `);
}

function showProductForm(id) {
    const emojis = ['🏰','🌴','⚽','👑','🏃','🧸','🎪','🎈','🎉','🌈','🦄','🚀','🍭','🍿'];
    App.openModal(id ? 'Edit Product' : 'New Product', `
        <form onsubmit="saveProduct(event${id ? ", '" + id + "'" : ''})">
            <div class="form-group"><label class="form-label">Name *</label><input type="text" class="form-input" name="name" required></div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Category</label><select class="form-select" name="category"><option value="bounce-house">Bounce House</option><option value="water-slide">Water Slide</option><option value="combo">Combo</option><option value="obstacle">Obstacle</option><option value="concession">Concession</option></select></div>
                <div class="form-group"><label class="form-label">Emoji</label><select class="form-select" name="emoji">${emojis.map(e => `<option value="${e}">${e}</option>`).join('')}</select></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Daily Rate *</label><input type="number" step="0.01" class="form-input" name="daily_rate" required></div>
                <div class="form-group"><label class="form-label">Deposit</label><input type="number" step="0.01" class="form-input" name="deposit_amount"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Quantity</label><input type="number" class="form-input" name="quantity" value="1"></div>
                <div class="form-group"><label class="form-label">Status</label><select class="form-select" name="status"><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
            </div>
            <div class="form-group"><label class="form-label">Dimensions</label><input type="text" class="form-input" name="dimensions"></div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Capacity</label><input type="text" class="form-input" name="capacity"></div>
                <div class="form-group"><label class="form-label">Age Range</label><input type="text" class="form-input" name="age_range"></div>
            </div>
            <div class="form-group"><label class="form-label">Description</label><textarea class="form-textarea" name="description"></textarea></div>
            <div class="flex gap-2 justify-end mt-4">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Save</button>
            </div>
        </form>
    `);
}

function showPromoForm() {
    App.openModal('New Promo Code', `
        <form onsubmit="savePromo(event)">
            <div class="form-group"><label class="form-label">Code *</label><input type="text" class="form-input" name="code" required style="text-transform:uppercase"></div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Type</label><select class="form-select" name="discount_type"><option value="percent">Percentage</option><option value="flat">Flat Amount</option></select></div>
                <div class="form-group"><label class="form-label">Value *</label><input type="number" step="0.01" class="form-input" name="discount_value" required></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Min Order</label><input type="number" step="0.01" class="form-input" name="min_order" value="0"></div>
                <div class="form-group"><label class="form-label">Max Uses</label><input type="number" class="form-input" name="max_uses"></div>
            </div>
            <div class="form-group"><label class="form-label">Expires</label><input type="date" class="form-input" name="valid_until"></div>
            <div class="flex gap-2 justify-end mt-4">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Create</button>
            </div>
        </form>
    `);
}

function showPaymentForm(bookingId, balance) {
    App.openModal('Record Payment', `
        <form onsubmit="savePayment(event, '${bookingId}')">
            <p class="mb-3"><strong>Balance Due:</strong> <span class="text-danger">${App.fmt.currency(balance)}</span></p>
            <div class="form-group"><label class="form-label">Amount *</label><input type="number" step="0.01" class="form-input" name="amount" value="${balance}" required></div>
            <div class="form-group"><label class="form-label">Method</label><select class="form-select" name="method"><option value="card">Card</option><option value="cash">Cash</option><option value="check">Check</option><option value="venmo">Venmo</option><option value="zelle">Zelle</option></select></div>
            <div class="form-group"><label class="form-label">Reference</label><input type="text" class="form-input" name="reference"></div>
            <div class="flex gap-2 justify-end mt-4">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-success">Record Payment</button>
            </div>
        </form>
    `);
}

async function saveCustomer(e, id) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    try {
        await App.api('customers', id ? { method: 'PUT', id, body: data } : { method: 'POST', body: data });
        App.toast(id ? 'Customer updated!' : 'Customer created!', 'success');
        closeModal(); closePanel(); App.navigate('customers');
    } catch (err) { App.toast('Error: ' + err.message, 'error'); }
}

async function saveProduct(e, id) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    data.daily_rate = parseFloat(data.daily_rate);
    data.deposit_amount = parseFloat(data.deposit_amount) || 0;
    data.quantity = parseInt(data.quantity) || 1;
    try {
        await App.api('products', id ? { method: 'PUT', id, body: data } : { method: 'POST', body: data });
        App.toast(id ? 'Product updated!' : 'Product created!', 'success');
        closeModal(); closePanel(); App.navigate('inventory');
    } catch (err) { App.toast('Error: ' + err.message, 'error'); }
}

async function savePromo(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    data.discount_value = parseFloat(data.discount_value);
    data.min_order = parseFloat(data.min_order) || 0;
    data.max_uses = data.max_uses ? parseInt(data.max_uses) : null;
    try {
        await App.api('promos', { method: 'POST', body: data });
        App.toast('Promo created!', 'success');
        closeModal(); App.navigate('promos');
    } catch (err) { App.toast('Error: ' + err.message, 'error'); }
}

async function savePayment(e, bookingId) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    data.booking_id = bookingId;
    data.amount = parseFloat(data.amount);
    try {
        await App.api('payments', { method: 'POST', body: data });
        App.toast('Payment recorded!', 'success');
        closeModal(); closePanel(); App.navigate(App.state.page);
    } catch (err) { App.toast('Error: ' + err.message, 'error'); }
}

async function saveSettings(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    data.tax_rate = parseFloat(data.tax_rate) / 100;
    try {
        await App.api('settings', { method: 'PUT', body: data });
        App.toast('Settings saved!', 'success');
    } catch (err) { App.toast('Error: ' + err.message, 'error'); }
}

async function updateBookingStatus(id, status) {
    try {
        await App.api('bookings', { method: 'PUT', id, body: { status } });
        App.toast('Status updated!', 'success');
        viewBooking(id);
    } catch (err) { App.toast('Error: ' + err.message, 'error'); }
}

async function togglePromo(id, status) {
    try {
        await App.api('promos', { method: 'PUT', id, body: { status } });
        App.toast('Promo updated!', 'success');
        App.navigate('promos');
    } catch (err) { App.toast('Error: ' + err.message, 'error'); }
}

async function deletePromo(id) {
    if (!confirm('Delete this promo?')) return;
    try {
        await App.api('promos', { method: 'DELETE', id });
        App.toast('Promo deleted!', 'success');
        App.navigate('promos');
    } catch (err) { App.toast('Error: ' + err.message, 'error'); }
}

async function deleteProduct(id) {
    if (!confirm('Delete this product?')) return;
    try {
        await App.api('products', { method: 'DELETE', id });
        App.toast('Product deleted!', 'success');
        closePanel(); App.navigate('inventory');
    } catch (err) { App.toast('Error: ' + err.message, 'error'); }
}

// ============ Zone Management ============
let zoneMap = null;
let zoneLayers = {};
let drawingMode = false;
let currentDrawing = [];
let drawingLayer = null;
let baseMarker = null;

const ZONE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
function getZoneColor(index) { return ZONE_COLORS[index % ZONE_COLORS.length]; }

function initZoneMap() {
    if (zoneMap) { zoneMap.remove(); zoneMap = null; }
    
    const mapEl = document.getElementById('zoneMap');
    if (!mapEl) return;
    
    const base = window._baseLocation || { lat: 41.1417, lng: -87.8792 };
    
    zoneMap = L.map('zoneMap').setView([base.lat, base.lng], 11);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(zoneMap);
    
    // Add base location marker
    baseMarker = L.marker([base.lat, base.lng], {
        icon: L.divIcon({
            className: 'base-marker',
            html: '<div class="base-marker-icon">🏠</div>',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        })
    }).addTo(zoneMap).bindPopup('<b>Base Location</b><br>Your business location');
    
    // Draw existing zones
    const zones = window._zones || [];
    zones.forEach((zone, i) => {
        if (zone.polygon && zone.polygon.length > 0) {
            const color = zone.color || getZoneColor(i);
            const polygon = L.polygon(zone.polygon, {
                color: color,
                fillColor: color,
                fillOpacity: 0.2,
                weight: 2
            }).addTo(zoneMap);
            
            polygon.bindPopup(`<b>${zone.name}</b><br>${zone.delivery_fee === 0 ? 'FREE Delivery' : 'Delivery: ' + App.fmt.currency(zone.delivery_fee)}`);
            zoneLayers[zone.id] = polygon;
        }
    });
    
    // Fit map to zones if any exist
    if (Object.keys(zoneLayers).length > 0) {
        const group = L.featureGroup(Object.values(zoneLayers));
        zoneMap.fitBounds(group.getBounds().pad(0.1));
    }
}

function highlightZone(id) {
    if (zoneLayers[id]) {
        zoneLayers[id].setStyle({ weight: 4, fillOpacity: 0.4 });
    }
}

function unhighlightZone(id) {
    if (zoneLayers[id]) {
        zoneLayers[id].setStyle({ weight: 2, fillOpacity: 0.2 });
    }
}

function centerMapOnBase() {
    if (zoneMap && window._baseLocation) {
        zoneMap.setView([window._baseLocation.lat, window._baseLocation.lng], 12);
    }
}

function setBaseLocation() {
    App.toast('Click on the map to set your base location', 'info');
    zoneMap.once('click', async function(e) {
        const { lat, lng } = e.latlng;
        try {
            await App.api('settings', { 
                method: 'PUT', 
                body: { base_location: { lat, lng } }
            });
            window._baseLocation = { lat, lng };
            if (baseMarker) baseMarker.setLatLng([lat, lng]);
            App.toast('Base location updated!', 'success');
        } catch (err) {
            App.toast('Error: ' + err.message, 'error');
        }
    });
}

function showZoneForm(existingZone = null) {
    const zone = existingZone || {};
    const isEdit = !!zone.id;
    const colorOptions = ZONE_COLORS.map((c, i) => 
        `<label class="color-option ${zone.color === c ? 'selected' : ''}" style="background:${c}">
            <input type="radio" name="color" value="${c}" ${zone.color === c || (!zone.color && i === (window._zones?.length || 0) % ZONE_COLORS.length) ? 'checked' : ''}>
        </label>`
    ).join('');
    
    // Use custom large modal for zone editing
    const modal = document.getElementById('modal');
    const modalContent = modal.querySelector('.modal-content');
    modalContent.classList.add('modal-large');
    
    App.openModal(isEdit ? 'Edit Zone' : 'New Delivery Zone', `
        <form onsubmit="saveZone(event, ${isEdit ? `'${zone.id}'` : 'null'})">
            <div class="zone-form-grid">
                <div class="zone-form-fields">
                    <div class="form-group">
                        <label class="form-label">Zone Name</label>
                        <input type="text" class="form-input" name="name" value="${zone.name || ''}" placeholder="e.g. Zone A - Local" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Description</label>
                        <input type="text" class="form-input" name="description" value="${zone.description || ''}" placeholder="e.g. Bradley, Bourbonnais, Kankakee">
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Delivery Fee</label>
                            <div class="input-with-prefix"><span>$</span>
                                <input type="number" step="0.01" class="form-input" name="delivery_fee" value="${zone.delivery_fee || 0}" min="0">
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Color</label>
                            <div class="color-picker">${colorOptions}</div>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">ZIP Codes <span class="text-gray">(one per line or comma-separated)</span></label>
                        <textarea class="form-textarea" name="zip_codes" rows="4" placeholder="60915&#10;60914&#10;60901">${(zone.zip_codes || []).join('\n')}</textarea>
                    </div>
                </div>
                
                <div class="zone-form-map">
                    <label class="form-label">Draw Zone on Map</label>
                    <p class="text-sm text-gray mb-2">Click to add points. Click first point to close shape.</p>
                    <div id="zoneDrawMap"></div>
                    <div class="map-instructions">
                        <span>🖱️ Click to add point</span>
                        <span>↩️ Undo last</span>
                        <span>🗑️ Clear all</span>
                    </div>
                    <input type="hidden" name="polygon" id="polygonInput" value='${JSON.stringify(zone.polygon || [])}'>
                </div>
            </div>
            
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="closeZoneModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Create Zone'}</button>
            </div>
        </form>
    `);
    
    // Initialize drawing map after modal renders
    setTimeout(() => initDrawingMap(zone.polygon || []), 150);
}

function closeZoneModal() {
    const modal = document.getElementById('modal');
    const modalContent = modal.querySelector('.modal-content');
    modalContent.classList.remove('modal-large');
    closeModal();
}

function initDrawingMap(existingPolygon = []) {
    const mapEl = document.getElementById('zoneDrawMap');
    if (!mapEl) return;
    
    const base = window._baseLocation || { lat: 41.1417, lng: -87.8792 };
    const drawMap = L.map('zoneDrawMap', {
        center: [base.lat, base.lng],
        zoom: 11
    });
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OSM'
    }).addTo(drawMap);
    
    // Force map to recalculate size after modal animation
    setTimeout(() => drawMap.invalidateSize(), 200);
    
    currentDrawing = existingPolygon.length > 0 ? [...existingPolygon] : [];
    let markers = [];
    let polyline = null;
    let polygon = null;
    
    function updateDrawing() {
        if (polyline) drawMap.removeLayer(polyline);
        if (polygon) drawMap.removeLayer(polygon);
        polyline = null;
        polygon = null;
        
        if (currentDrawing.length >= 3) {
            polygon = L.polygon(currentDrawing, {
                color: '#f97316',
                fillColor: '#f97316',
                fillOpacity: 0.2
            }).addTo(drawMap);
        } else if (currentDrawing.length >= 2) {
            polyline = L.polyline(currentDrawing, { color: '#f97316', weight: 3 }).addTo(drawMap);
        }
        
        document.getElementById('polygonInput').value = JSON.stringify(currentDrawing);
    }
    
    function addPoint(latlng) {
        currentDrawing.push([latlng.lat, latlng.lng]);
        const marker = L.circleMarker(latlng, {
            radius: 8,
            color: '#f97316',
            fillColor: '#fff',
            fillOpacity: 1,
            weight: 3
        }).addTo(drawMap);
        markers.push(marker);
        updateDrawing();
    }
    
    // Draw existing polygon
    if (existingPolygon.length > 0) {
        existingPolygon.forEach(p => {
            const marker = L.circleMarker([p[0], p[1]], {
                radius: 8,
                color: '#f97316',
                fillColor: '#fff',
                fillOpacity: 1,
                weight: 3
            }).addTo(drawMap);
            markers.push(marker);
        });
        updateDrawing();
        setTimeout(() => {
            drawMap.fitBounds(L.polygon(existingPolygon).getBounds().pad(0.3));
        }, 250);
    }
    
    drawMap.on('click', function(e) {
        addPoint(e.latlng);
    });
    
    // Clear button
    const clearBtn = L.control({ position: 'topright' });
    clearBtn.onAdd = function() {
        const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        div.innerHTML = '<a href="#" title="Clear all points" style="font-size:14px;width:30px;height:30px;line-height:30px;display:block;text-align:center;text-decoration:none;">🗑️</a>';
        L.DomEvent.on(div, 'click', function(e) {
            L.DomEvent.stop(e);
            currentDrawing = [];
            markers.forEach(m => drawMap.removeLayer(m));
            markers = [];
            if (polyline) drawMap.removeLayer(polyline);
            if (polygon) drawMap.removeLayer(polygon);
            polyline = null;
            polygon = null;
            document.getElementById('polygonInput').value = '[]';
        });
        return div;
    };
    clearBtn.addTo(drawMap);
    
    // Undo button
    const undoBtn = L.control({ position: 'topright' });
    undoBtn.onAdd = function() {
        const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        div.innerHTML = '<a href="#" title="Undo last point" style="font-size:14px;width:30px;height:30px;line-height:30px;display:block;text-align:center;text-decoration:none;">↩️</a>';
        L.DomEvent.on(div, 'click', function(e) {
            L.DomEvent.stop(e);
            if (currentDrawing.length > 0) {
                currentDrawing.pop();
                if (markers.length > 0) {
                    drawMap.removeLayer(markers.pop());
                }
                updateDrawing();
            }
        });
        return div;
    };
    undoBtn.addTo(drawMap);
}

async function saveZone(e, id) {
    e.preventDefault();
    const form = e.target;
    const data = {
        name: form.name.value,
        description: form.description.value,
        delivery_fee: parseFloat(form.delivery_fee.value) || 0,
        color: form.color.value,
        zip_codes: form.zip_codes.value.split(/[\n,]/).map(z => z.trim()).filter(z => z),
        polygon: JSON.parse(form.polygon.value || '[]')
    };
    
    try {
        if (id) {
            await App.api('zones', { method: 'PUT', id, body: data });
            App.toast('Zone updated!', 'success');
        } else {
            await App.api('zones', { method: 'POST', body: data });
            App.toast('Zone created!', 'success');
        }
        closeZoneModal();
        App.navigate('settings');
    } catch (err) {
        App.toast('Error: ' + err.message, 'error');
    }
}

async function editZone(id) {
    const zones = window._zones || [];
    const zone = zones.find(z => z.id === id);
    if (zone) showZoneForm(zone);
}

async function deleteZone(id) {
    if (!confirm('Delete this delivery zone?')) return;
    try {
        await App.api('zones', { method: 'DELETE', id });
        App.toast('Zone deleted!', 'success');
        App.navigate('settings');
    } catch (err) {
        App.toast('Error: ' + err.message, 'error');
    }
}

// ============ Reporting System ============
let reportData = null;

async function loadReportData() {
    const from = App.state.reportFrom;
    const to = App.state.reportTo;
    reportData = await App.api('reports', { params: { from, to, detailed: true } });
    return reportData;
}

function setReportRange(preset) {
    const today = new Date();
    let from, to;
    
    switch(preset) {
        case 'today':
            from = to = today.toISOString().split('T')[0];
            break;
        case 'week':
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay());
            from = startOfWeek.toISOString().split('T')[0];
            to = today.toISOString().split('T')[0];
            break;
        case 'month':
            from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
            to = today.toISOString().split('T')[0];
            break;
        case 'quarter':
            const quarterStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
            from = quarterStart.toISOString().split('T')[0];
            to = today.toISOString().split('T')[0];
            break;
        case 'year':
            from = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
            to = today.toISOString().split('T')[0];
            break;
        case 'all':
            from = '2020-01-01';
            to = today.toISOString().split('T')[0];
            break;
    }
    
    document.getElementById('reportFrom').value = from;
    document.getElementById('reportTo').value = to;
    App.state.reportFrom = from;
    App.state.reportTo = to;
    
    // Update active button
    document.querySelectorAll('.date-presets .btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    
    showReport(App.state.currentReport || 'overview');
}

function updateReportRange() {
    App.state.reportFrom = document.getElementById('reportFrom').value;
    App.state.reportTo = document.getElementById('reportTo').value;
    document.querySelectorAll('.date-presets .btn').forEach(b => b.classList.remove('active'));
    showReport(App.state.currentReport || 'overview');
}

async function showReport(type) {
    App.state.currentReport = type;
    
    // Update tabs
    document.querySelectorAll('.report-tab').forEach(t => t.classList.toggle('active', t.dataset.report === type));
    
    const container = document.getElementById('reportContent');
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        await loadReportData();
        
        switch(type) {
            case 'overview': container.innerHTML = renderOverviewReport(); break;
            case 'revenue': container.innerHTML = renderRevenueReport(); break;
            case 'bookings': container.innerHTML = renderBookingsReport(); break;
            case 'products': container.innerHTML = renderProductsReport(); break;
            case 'customers': container.innerHTML = renderCustomersReport(); break;
            case 'operations': container.innerHTML = renderOperationsReport(); break;
        }
        
        lucide.createIcons();
        renderCharts(type);
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><p>Error loading reports: ${err.message}</p></div>`;
    }
}

function renderOverviewReport() {
    const d = reportData;
    const revChange = d.comparison?.revenue_change || 0;
    const bookChange = d.comparison?.booking_change || 0;
    
    return `
        <div class="stats-grid stats-grid-5">
            <div class="stat-card gradient">
                <div class="stat-icon">💰</div>
                <div class="stat-label">Total Revenue</div>
                <div class="stat-value">${App.fmt.currency(d.summary.total_revenue)}</div>
                ${revChange !== 0 ? `<div class="stat-change ${revChange >= 0 ? 'positive' : 'negative'}">${revChange >= 0 ? '↑' : '↓'} ${Math.abs(revChange).toFixed(1)}% vs prev period</div>` : ''}
            </div>
            <div class="stat-card">
                <div class="stat-icon">📅</div>
                <div class="stat-label">Total Bookings</div>
                <div class="stat-value">${d.summary.total_bookings}</div>
                ${bookChange !== 0 ? `<div class="stat-change ${bookChange >= 0 ? 'positive' : 'negative'}">${bookChange >= 0 ? '↑' : '↓'} ${Math.abs(bookChange).toFixed(1)}%</div>` : ''}
            </div>
            <div class="stat-card">
                <div class="stat-icon">🎯</div>
                <div class="stat-label">Avg Booking Value</div>
                <div class="stat-value">${App.fmt.currency(d.summary.avg_booking_value)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">👥</div>
                <div class="stat-label">Unique Customers</div>
                <div class="stat-value">${d.summary.unique_customers}</div>
                <div class="stat-sub">${d.summary.new_customers} new</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">⭐</div>
                <div class="stat-label">Completion Rate</div>
                <div class="stat-value">${d.summary.completion_rate.toFixed(0)}%</div>
            </div>
        </div>
        
        <div class="grid-2 mt-4">
            <div class="card">
                <div class="card-header"><h3 class="card-title">Revenue Trend</h3></div>
                <div class="card-body"><canvas id="revenueChart" height="200"></canvas></div>
            </div>
            <div class="card">
                <div class="card-header"><h3 class="card-title">Booking Status</h3></div>
                <div class="card-body"><canvas id="statusChart" height="200"></canvas></div>
            </div>
        </div>
        
        <div class="grid-3 mt-4">
            <div class="card">
                <div class="card-header"><h3 class="card-title">Top Products</h3></div>
                <div class="card-body">
                    ${d.products.slice(0, 5).map((p, i) => `
                        <div class="rank-item">
                            <span class="rank-num">${i + 1}</span>
                            <span class="rank-emoji">${p.emoji || '🎪'}</span>
                            <div class="rank-details">
                                <div class="rank-name">${p.name}</div>
                                <div class="rank-meta">${p.rental_count} rentals</div>
                            </div>
                            <div class="rank-value">${App.fmt.currency(p.revenue)}</div>
                        </div>
                    `).join('') || '<p class="text-gray text-center">No data</p>'}
                </div>
            </div>
            <div class="card">
                <div class="card-header"><h3 class="card-title">Top Customers</h3></div>
                <div class="card-body">
                    ${d.top_customers.slice(0, 5).map((c, i) => `
                        <div class="rank-item">
                            <span class="rank-num">${i + 1}</span>
                            <div class="customer-avatar-sm">${App.fmt.initials(c.name)}</div>
                            <div class="rank-details">
                                <div class="rank-name">${c.name}</div>
                                <div class="rank-meta">${c.booking_count} bookings</div>
                            </div>
                            <div class="rank-value">${App.fmt.currency(c.total_spent)}</div>
                        </div>
                    `).join('') || '<p class="text-gray text-center">No data</p>'}
                </div>
            </div>
            <div class="card">
                <div class="card-header"><h3 class="card-title">Busiest Days</h3></div>
                <div class="card-body">
                    ${d.busiest_days.slice(0, 5).map((day, i) => `
                        <div class="rank-item">
                            <span class="rank-num">${i + 1}</span>
                            <div class="rank-details">
                                <div class="rank-name">${App.fmt.date(day.date)}</div>
                                <div class="rank-meta">${day.day_of_week}</div>
                            </div>
                            <div class="rank-value">${day.booking_count} bookings</div>
                        </div>
                    `).join('') || '<p class="text-gray text-center">No data</p>'}
                </div>
            </div>
        </div>
    `;
}

function renderRevenueReport() {
    const d = reportData;
    return `
        <div class="stats-grid">
            <div class="stat-card gradient">
                <div class="stat-label">Gross Revenue</div>
                <div class="stat-value">${App.fmt.currency(d.revenue.gross)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Tax Collected</div>
                <div class="stat-value">${App.fmt.currency(d.revenue.tax_collected)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Delivery Fees</div>
                <div class="stat-value">${App.fmt.currency(d.revenue.delivery_fees)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Outstanding</div>
                <div class="stat-value text-danger">${App.fmt.currency(d.revenue.outstanding)}</div>
                <div class="stat-sub">${d.revenue.outstanding_count} invoices</div>
            </div>
        </div>
        
        <div class="card mt-4">
            <div class="card-header"><h3 class="card-title">Revenue Over Time</h3></div>
            <div class="card-body"><canvas id="revenueTimeChart" height="250"></canvas></div>
        </div>
        
        <div class="grid-2 mt-4">
            <div class="card">
                <div class="card-header"><h3 class="card-title">Payment Methods</h3></div>
                <div class="card-body">
                    <canvas id="paymentMethodChart" height="200"></canvas>
                    <div class="chart-legend mt-3">
                        ${Object.entries(d.revenue.by_payment_method).map(([method, amount]) => `
                            <div class="legend-item">
                                <span class="legend-dot" style="background:${getPaymentColor(method)}"></span>
                                <span class="legend-label">${method}</span>
                                <span class="legend-value">${App.fmt.currency(amount)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            <div class="card">
                <div class="card-header"><h3 class="card-title">Revenue by Category</h3></div>
                <div class="card-body">
                    <canvas id="categoryRevenueChart" height="200"></canvas>
                    <div class="chart-legend mt-3">
                        ${Object.entries(d.revenue.by_category).map(([cat, amount]) => `
                            <div class="legend-item">
                                <span class="legend-dot" style="background:${getCategoryColor(cat)}"></span>
                                <span class="legend-label">${formatCategory(cat)}</span>
                                <span class="legend-value">${App.fmt.currency(amount)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
        
        <div class="card mt-4">
            <div class="card-header">
                <h3 class="card-title">Daily Revenue Breakdown</h3>
            </div>
            <div class="card-body">
                <div class="table-wrapper">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th class="text-right">Bookings</th>
                                <th class="text-right">Gross</th>
                                <th class="text-right">Tax</th>
                                <th class="text-right">Delivery</th>
                                <th class="text-right">Collected</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${d.revenue.daily.slice(-30).reverse().map(day => `
                                <tr>
                                    <td>${App.fmt.date(day.date)}</td>
                                    <td class="text-right">${day.booking_count}</td>
                                    <td class="text-right">${App.fmt.currency(day.gross)}</td>
                                    <td class="text-right">${App.fmt.currency(day.tax)}</td>
                                    <td class="text-right">${App.fmt.currency(day.delivery)}</td>
                                    <td class="text-right text-success">${App.fmt.currency(day.collected)}</td>
                                </tr>
                            `).join('') || '<tr><td colspan="6" class="text-center text-gray">No data</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function renderBookingsReport() {
    const d = reportData;
    return `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Total Bookings</div>
                <div class="stat-value">${d.bookings.total}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Completed</div>
                <div class="stat-value text-success">${d.bookings.by_status.completed || 0}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Cancelled</div>
                <div class="stat-value text-danger">${d.bookings.by_status.cancelled || 0}</div>
                <div class="stat-sub">${d.bookings.cancellation_rate.toFixed(1)}% rate</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Avg Lead Time</div>
                <div class="stat-value">${d.bookings.avg_lead_time.toFixed(0)} days</div>
                <div class="stat-sub">booking to event</div>
            </div>
        </div>
        
        <div class="grid-2 mt-4">
            <div class="card">
                <div class="card-header"><h3 class="card-title">Bookings by Status</h3></div>
                <div class="card-body"><canvas id="bookingStatusChart" height="200"></canvas></div>
            </div>
            <div class="card">
                <div class="card-header"><h3 class="card-title">Bookings Over Time</h3></div>
                <div class="card-body"><canvas id="bookingTrendChart" height="200"></canvas></div>
            </div>
        </div>
        
        <div class="grid-2 mt-4">
            <div class="card">
                <div class="card-header"><h3 class="card-title">Bookings by Day of Week</h3></div>
                <div class="card-body"><canvas id="dayOfWeekChart" height="200"></canvas></div>
            </div>
            <div class="card">
                <div class="card-header"><h3 class="card-title">Event Types</h3></div>
                <div class="card-body">
                    ${Object.entries(d.bookings.by_event_type).sort((a,b) => b[1] - a[1]).map(([type, count]) => `
                        <div class="progress-row">
                            <div class="progress-label">${formatEventType(type)}</div>
                            <div class="progress-bar-wrapper">
                                <div class="progress-bar" style="width:${(count/d.bookings.total*100)}%;background:var(--primary)"></div>
                            </div>
                            <div class="progress-value">${count}</div>
                        </div>
                    `).join('') || '<p class="text-gray text-center">No data</p>'}
                </div>
            </div>
        </div>
        
        <div class="card mt-4">
            <div class="card-header"><h3 class="card-title">Lead Time Distribution</h3></div>
            <div class="card-body">
                <div class="lead-time-grid">
                    <div class="lead-time-item">
                        <div class="lead-time-value">${d.bookings.lead_time_breakdown.same_day || 0}</div>
                        <div class="lead-time-label">Same Day</div>
                    </div>
                    <div class="lead-time-item">
                        <div class="lead-time-value">${d.bookings.lead_time_breakdown.within_week || 0}</div>
                        <div class="lead-time-label">1-7 Days</div>
                    </div>
                    <div class="lead-time-item">
                        <div class="lead-time-value">${d.bookings.lead_time_breakdown.within_two_weeks || 0}</div>
                        <div class="lead-time-label">8-14 Days</div>
                    </div>
                    <div class="lead-time-item">
                        <div class="lead-time-value">${d.bookings.lead_time_breakdown.within_month || 0}</div>
                        <div class="lead-time-label">15-30 Days</div>
                    </div>
                    <div class="lead-time-item">
                        <div class="lead-time-value">${d.bookings.lead_time_breakdown.over_month || 0}</div>
                        <div class="lead-time-label">30+ Days</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderProductsReport() {
    const d = reportData;
    return `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Total Products</div>
                <div class="stat-value">${d.products_summary.total}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Active Products</div>
                <div class="stat-value">${d.products_summary.active}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Rentals</div>
                <div class="stat-value">${d.products_summary.total_rentals}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Avg Utilization</div>
                <div class="stat-value">${d.products_summary.avg_utilization.toFixed(0)}%</div>
            </div>
        </div>
        
        <div class="card mt-4">
            <div class="card-header"><h3 class="card-title">Product Performance</h3></div>
            <div class="card-body">
                <div class="table-wrapper">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>Category</th>
                                <th class="text-right">Rentals</th>
                                <th class="text-right">Revenue</th>
                                <th class="text-right">Avg/Rental</th>
                                <th class="text-right">Utilization</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${d.products.map(p => `
                                <tr>
                                    <td>
                                        <div class="flex items-center gap-2">
                                            <span>${p.emoji || '🎪'}</span>
                                            <span class="font-bold">${p.name}</span>
                                        </div>
                                    </td>
                                    <td><span class="badge badge-${p.category}">${formatCategory(p.category)}</span></td>
                                    <td class="text-right">${p.rental_count}</td>
                                    <td class="text-right">${App.fmt.currency(p.revenue)}</td>
                                    <td class="text-right">${App.fmt.currency(p.avg_revenue)}</td>
                                    <td class="text-right">
                                        <div class="utilization-bar">
                                            <div class="utilization-fill" style="width:${Math.min(p.utilization, 100)}%"></div>
                                            <span>${p.utilization.toFixed(0)}%</span>
                                        </div>
                                    </td>
                                </tr>
                            `).join('') || '<tr><td colspan="6" class="text-center text-gray">No data</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        
        <div class="grid-2 mt-4">
            <div class="card">
                <div class="card-header"><h3 class="card-title">Revenue by Product</h3></div>
                <div class="card-body"><canvas id="productRevenueChart" height="250"></canvas></div>
            </div>
            <div class="card">
                <div class="card-header"><h3 class="card-title">Rentals by Category</h3></div>
                <div class="card-body"><canvas id="categoryRentalsChart" height="250"></canvas></div>
            </div>
        </div>
    `;
}

function renderCustomersReport() {
    const d = reportData;
    return `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Total Customers</div>
                <div class="stat-value">${d.customers.total}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">New Customers</div>
                <div class="stat-value text-success">${d.customers.new_in_period}</div>
                <div class="stat-sub">in this period</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Returning</div>
                <div class="stat-value">${d.customers.returning}</div>
                <div class="stat-sub">${d.customers.return_rate.toFixed(0)}% rate</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Avg Lifetime Value</div>
                <div class="stat-value">${App.fmt.currency(d.customers.avg_lifetime_value)}</div>
            </div>
        </div>
        
        <div class="grid-2 mt-4">
            <div class="card">
                <div class="card-header"><h3 class="card-title">New vs Returning</h3></div>
                <div class="card-body"><canvas id="newVsReturningChart" height="200"></canvas></div>
            </div>
            <div class="card">
                <div class="card-header"><h3 class="card-title">Acquisition Sources</h3></div>
                <div class="card-body"><canvas id="sourceChart" height="200"></canvas></div>
            </div>
        </div>
        
        <div class="card mt-4">
            <div class="card-header"><h3 class="card-title">Top Customers by Revenue</h3></div>
            <div class="card-body">
                <div class="table-wrapper">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Customer</th>
                                <th>Contact</th>
                                <th class="text-right">Bookings</th>
                                <th class="text-right">Total Spent</th>
                                <th class="text-right">Avg Order</th>
                                <th>Last Booking</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${d.top_customers.map(c => `
                                <tr onclick="viewCustomer('${c.id}')" style="cursor:pointer">
                                    <td>
                                        <div class="flex items-center gap-2">
                                            <div class="customer-avatar-sm">${App.fmt.initials(c.name)}</div>
                                            <span class="font-bold">${c.name}</span>
                                        </div>
                                    </td>
                                    <td class="text-gray">${c.email || c.phone || '-'}</td>
                                    <td class="text-right">${c.booking_count}</td>
                                    <td class="text-right font-bold">${App.fmt.currency(c.total_spent)}</td>
                                    <td class="text-right">${App.fmt.currency(c.avg_order)}</td>
                                    <td>${c.last_booking ? App.fmt.date(c.last_booking) : '-'}</td>
                                </tr>
                            `).join('') || '<tr><td colspan="6" class="text-center text-gray">No data</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        
        <div class="card mt-4">
            <div class="card-header"><h3 class="card-title">Customer Segments</h3></div>
            <div class="card-body">
                <div class="segment-grid">
                    <div class="segment-card">
                        <div class="segment-icon">🌟</div>
                        <div class="segment-name">VIP</div>
                        <div class="segment-desc">3+ bookings, $500+ spent</div>
                        <div class="segment-count">${d.customers.segments.vip} customers</div>
                    </div>
                    <div class="segment-card">
                        <div class="segment-icon">🔄</div>
                        <div class="segment-name">Regular</div>
                        <div class="segment-desc">2+ bookings</div>
                        <div class="segment-count">${d.customers.segments.regular} customers</div>
                    </div>
                    <div class="segment-card">
                        <div class="segment-icon">👋</div>
                        <div class="segment-name">One-time</div>
                        <div class="segment-desc">Single booking</div>
                        <div class="segment-count">${d.customers.segments.one_time} customers</div>
                    </div>
                    <div class="segment-card">
                        <div class="segment-icon">😴</div>
                        <div class="segment-name">Dormant</div>
                        <div class="segment-desc">No booking in 6+ months</div>
                        <div class="segment-count">${d.customers.segments.dormant} customers</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderOperationsReport() {
    const d = reportData;
    return `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Total Deliveries</div>
                <div class="stat-value">${d.operations.total_deliveries}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Delivery Revenue</div>
                <div class="stat-value">${App.fmt.currency(d.operations.delivery_revenue)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Avg/Delivery</div>
                <div class="stat-value">${App.fmt.currency(d.operations.avg_delivery_fee)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Free Deliveries</div>
                <div class="stat-value">${d.operations.free_deliveries}</div>
                <div class="stat-sub">${d.operations.free_delivery_pct.toFixed(0)}% of total</div>
            </div>
        </div>
        
        <div class="grid-2 mt-4">
            <div class="card">
                <div class="card-header"><h3 class="card-title">Deliveries by Zone</h3></div>
                <div class="card-body">
                    ${d.operations.by_zone.map(z => `
                        <div class="zone-stat-row">
                            <div class="zone-stat-color" style="background:${z.color || '#10b981'}"></div>
                            <div class="zone-stat-details">
                                <div class="zone-stat-name">${z.name}</div>
                                <div class="zone-stat-meta">${z.delivery_count} deliveries</div>
                            </div>
                            <div class="zone-stat-values">
                                <div class="zone-stat-revenue">${App.fmt.currency(z.revenue)}</div>
                                <div class="zone-stat-fee">${z.fee === 0 ? 'FREE' : App.fmt.currency(z.fee) + '/ea'}</div>
                            </div>
                        </div>
                    `).join('') || '<p class="text-gray text-center">No zone data</p>'}
                </div>
            </div>
            <div class="card">
                <div class="card-header"><h3 class="card-title">Deliveries by Day</h3></div>
                <div class="card-body"><canvas id="deliveryDayChart" height="200"></canvas></div>
            </div>
        </div>
        
        <div class="card mt-4">
            <div class="card-header"><h3 class="card-title">Delivery Heatmap</h3></div>
            <div class="card-body">
                <div class="heatmap-container">
                    <div class="heatmap-header">
                        <span></span>
                        ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<span>${d}</span>`).join('')}
                    </div>
                    ${renderHeatmap(d.operations.heatmap)}
                </div>
                <div class="heatmap-legend">
                    <span>Less</span>
                    <div class="heatmap-scale">
                        <span style="background:#f0fdf4"></span>
                        <span style="background:#bbf7d0"></span>
                        <span style="background:#4ade80"></span>
                        <span style="background:#16a34a"></span>
                        <span style="background:#166534"></span>
                    </div>
                    <span>More</span>
                </div>
            </div>
        </div>
        
        <div class="card mt-4">
            <div class="card-header"><h3 class="card-title">Waiver Status</h3></div>
            <div class="card-body">
                <div class="stats-grid stats-grid-3">
                    <div class="mini-stat">
                        <div class="mini-stat-value text-success">${d.operations.waivers.signed}</div>
                        <div class="mini-stat-label">Signed</div>
                    </div>
                    <div class="mini-stat">
                        <div class="mini-stat-value text-warning">${d.operations.waivers.pending}</div>
                        <div class="mini-stat-label">Pending</div>
                    </div>
                    <div class="mini-stat">
                        <div class="mini-stat-value">${d.operations.waivers.completion_rate.toFixed(0)}%</div>
                        <div class="mini-stat-label">Completion Rate</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderHeatmap(data) {
    if (!data || data.length === 0) {
        return '<p class="text-gray text-center">No heatmap data available</p>';
    }
    
    const maxVal = Math.max(...data.flat().filter(v => v !== null), 1);
    const weeks = data;
    
    return weeks.map((week, wi) => `
        <div class="heatmap-row">
            <span class="heatmap-week">W${wi + 1}</span>
            ${week.map(val => {
                if (val === null) return '<span class="heatmap-cell empty"></span>';
                const intensity = Math.min(Math.floor((val / maxVal) * 5), 4);
                const colors = ['#f0fdf4', '#bbf7d0', '#4ade80', '#16a34a', '#166534'];
                return `<span class="heatmap-cell" style="background:${colors[intensity]}" title="${val} bookings"></span>`;
            }).join('')}
        </div>
    `).join('');
}

function renderCharts(type) {
    if (typeof Chart === 'undefined') return;
    
    const d = reportData;
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.plugins.legend.display = false;
    
    const colors = {
        primary: '#f97316',
        secondary: '#ec4899',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#3b82f6',
        purple: '#8b5cf6'
    };
    
    switch(type) {
        case 'overview':
            // Revenue Trend Chart
            if (document.getElementById('revenueChart')) {
                new Chart(document.getElementById('revenueChart'), {
                    type: 'line',
                    data: {
                        labels: d.revenue.daily.slice(-14).map(r => App.fmt.date(r.date)),
                        datasets: [{
                            data: d.revenue.daily.slice(-14).map(r => r.collected),
                            borderColor: colors.primary,
                            backgroundColor: colors.primary + '20',
                            fill: true,
                            tension: 0.4
                        }]
                    },
                    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
                });
            }
            
            // Status Chart
            if (document.getElementById('statusChart')) {
                new Chart(document.getElementById('statusChart'), {
                    type: 'doughnut',
                    data: {
                        labels: Object.keys(d.bookings.by_status).map(s => s.charAt(0).toUpperCase() + s.slice(1)),
                        datasets: [{
                            data: Object.values(d.bookings.by_status),
                            backgroundColor: [colors.warning, colors.info, colors.purple, colors.success, colors.danger]
                        }]
                    },
                    options: { responsive: true, plugins: { legend: { display: true, position: 'bottom' } } }
                });
            }
            break;
            
        case 'revenue':
            if (document.getElementById('revenueTimeChart')) {
                new Chart(document.getElementById('revenueTimeChart'), {
                    type: 'bar',
                    data: {
                        labels: d.revenue.daily.map(r => App.fmt.date(r.date)),
                        datasets: [{
                            label: 'Revenue',
                            data: d.revenue.daily.map(r => r.collected),
                            backgroundColor: colors.primary
                        }]
                    },
                    options: { responsive: true, scales: { y: { beginAtZero: true } } }
                });
            }
            
            if (document.getElementById('paymentMethodChart')) {
                new Chart(document.getElementById('paymentMethodChart'), {
                    type: 'doughnut',
                    data: {
                        labels: Object.keys(d.revenue.by_payment_method),
                        datasets: [{ data: Object.values(d.revenue.by_payment_method), backgroundColor: [colors.primary, colors.success, colors.info, colors.warning, colors.purple] }]
                    }
                });
            }
            
            if (document.getElementById('categoryRevenueChart')) {
                new Chart(document.getElementById('categoryRevenueChart'), {
                    type: 'doughnut',
                    data: {
                        labels: Object.keys(d.revenue.by_category).map(formatCategory),
                        datasets: [{ data: Object.values(d.revenue.by_category), backgroundColor: [colors.primary, colors.info, colors.success, colors.warning, colors.purple] }]
                    }
                });
            }
            break;
            
        case 'bookings':
            if (document.getElementById('bookingStatusChart')) {
                new Chart(document.getElementById('bookingStatusChart'), {
                    type: 'doughnut',
                    data: {
                        labels: Object.keys(d.bookings.by_status).map(s => s.charAt(0).toUpperCase() + s.slice(1)),
                        datasets: [{ data: Object.values(d.bookings.by_status), backgroundColor: [colors.warning, colors.info, colors.purple, colors.success, colors.danger] }]
                    },
                    options: { plugins: { legend: { display: true, position: 'right' } } }
                });
            }
            
            if (document.getElementById('bookingTrendChart')) {
                new Chart(document.getElementById('bookingTrendChart'), {
                    type: 'line',
                    data: {
                        labels: d.bookings.daily.map(b => App.fmt.date(b.date)),
                        datasets: [{ data: d.bookings.daily.map(b => b.count), borderColor: colors.info, backgroundColor: colors.info + '20', fill: true, tension: 0.4 }]
                    },
                    options: { scales: { y: { beginAtZero: true } } }
                });
            }
            
            if (document.getElementById('dayOfWeekChart')) {
                new Chart(document.getElementById('dayOfWeekChart'), {
                    type: 'bar',
                    data: {
                        labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
                        datasets: [{ data: d.bookings.by_day_of_week, backgroundColor: colors.primary }]
                    },
                    options: { scales: { y: { beginAtZero: true } } }
                });
            }
            break;
            
        case 'products':
            if (document.getElementById('productRevenueChart')) {
                new Chart(document.getElementById('productRevenueChart'), {
                    type: 'bar',
                    data: {
                        labels: d.products.slice(0, 8).map(p => p.name),
                        datasets: [{ data: d.products.slice(0, 8).map(p => p.revenue), backgroundColor: colors.primary }]
                    },
                    options: { indexAxis: 'y', scales: { x: { beginAtZero: true } } }
                });
            }
            
            if (document.getElementById('categoryRentalsChart')) {
                const catData = {};
                d.products.forEach(p => { catData[p.category] = (catData[p.category] || 0) + p.rental_count; });
                new Chart(document.getElementById('categoryRentalsChart'), {
                    type: 'doughnut',
                    data: {
                        labels: Object.keys(catData).map(formatCategory),
                        datasets: [{ data: Object.values(catData), backgroundColor: [colors.primary, colors.info, colors.success, colors.warning, colors.purple] }]
                    },
                    options: { plugins: { legend: { display: true, position: 'right' } } }
                });
            }
            break;
            
        case 'customers':
            if (document.getElementById('newVsReturningChart')) {
                new Chart(document.getElementById('newVsReturningChart'), {
                    type: 'doughnut',
                    data: {
                        labels: ['New', 'Returning'],
                        datasets: [{ data: [d.customers.new_in_period, d.customers.returning_in_period], backgroundColor: [colors.success, colors.info] }]
                    },
                    options: { plugins: { legend: { display: true, position: 'bottom' } } }
                });
            }
            
            if (document.getElementById('sourceChart')) {
                new Chart(document.getElementById('sourceChart'), {
                    type: 'doughnut',
                    data: {
                        labels: Object.keys(d.customers.by_source).map(s => s.charAt(0).toUpperCase() + s.slice(1)),
                        datasets: [{ data: Object.values(d.customers.by_source), backgroundColor: [colors.primary, colors.info, colors.success, colors.warning, colors.purple, colors.secondary] }]
                    },
                    options: { plugins: { legend: { display: true, position: 'bottom' } } }
                });
            }
            break;
            
        case 'operations':
            if (document.getElementById('deliveryDayChart')) {
                new Chart(document.getElementById('deliveryDayChart'), {
                    type: 'bar',
                    data: {
                        labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
                        datasets: [{ data: d.operations.by_day_of_week, backgroundColor: colors.success }]
                    },
                    options: { scales: { y: { beginAtZero: true } } }
                });
            }
            break;
    }
}

// Helper functions for reports
function getPaymentColor(method) {
    const colors = { card: '#f97316', cash: '#10b981', check: '#3b82f6', venmo: '#008CFF', zelle: '#6D1ED4' };
    return colors[method] || '#6b7280';
}

function getCategoryColor(cat) {
    const colors = { 'bounce-house': '#f97316', 'water-slide': '#3b82f6', 'combo': '#10b981', 'obstacle': '#f59e0b', 'concession': '#ec4899' };
    return colors[cat] || '#6b7280';
}

function formatCategory(cat) {
    const names = { 'bounce-house': 'Bounce Houses', 'water-slide': 'Water Slides', 'combo': 'Combos', 'obstacle': 'Obstacles', 'concession': 'Concessions' };
    return names[cat] || cat;
}

function formatEventType(type) {
    const names = { birthday: '🎂 Birthday', corporate: '🏢 Corporate', church: '⛪ Church', school: '🏫 School', community: '🏘️ Community', other: '📅 Other' };
    return names[type] || type;
}

async function exportReports() {
    showExportModal('reports');
}

// ============ Export System ============
function showExportModal(defaultType = 'bookings') {
    const today = new Date().toISOString().split('T')[0];
    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    
    const modalHtml = `
        <div class="export-modal-inner">
            <div class="form-group">
                <label class="form-label">What to Export</label>
                <select class="form-select" id="exportType" onchange="updateExportOptions()">
                    <option value="bookings" ${defaultType === 'bookings' ? 'selected' : ''}>📅 Bookings</option>
                    <option value="customers" ${defaultType === 'customers' ? 'selected' : ''}>👥 Customers</option>
                    <option value="products" ${defaultType === 'products' ? 'selected' : ''}>📦 Products (Inventory)</option>
                    <option value="payments" ${defaultType === 'payments' ? 'selected' : ''}>💳 Payments</option>
                    <option value="reports" ${defaultType === 'reports' ? 'selected' : ''}>📊 Financial Report</option>
                    <option value="calendar" ${defaultType === 'calendar' ? 'selected' : ''}>🗓️ Calendar Events</option>
                </select>
            </div>
            
            <div class="form-group" id="dateRangeGroup">
                <label class="form-label">Date Range</label>
                <div class="form-row">
                    <input type="date" class="form-input" id="exportFrom" value="${firstOfMonth}">
                    <input type="date" class="form-input" id="exportTo" value="${today}">
                </div>
                <div class="export-presets">
                    <button type="button" class="btn btn-sm btn-secondary" onclick="setExportRange('month')">This Month</button>
                    <button type="button" class="btn btn-sm btn-secondary" onclick="setExportRange('quarter')">This Quarter</button>
                    <button type="button" class="btn btn-sm btn-secondary" onclick="setExportRange('year')">This Year</button>
                    <button type="button" class="btn btn-sm btn-secondary" onclick="setExportRange('all')">All Time</button>
                </div>
            </div>
            
            <div class="form-group">
                <label class="form-label">Export Format</label>
                <div class="export-formats" id="exportFormats">
                    <label class="export-format-option selected" data-format="xlsx">
                        <input type="radio" name="exportFormat" value="xlsx" checked>
                        <span class="format-icon">📊</span>
                        <span class="format-name">Excel</span>
                        <span class="format-ext">.xlsx</span>
                    </label>
                    <label class="export-format-option" data-format="csv">
                        <input type="radio" name="exportFormat" value="csv">
                        <span class="format-icon">📄</span>
                        <span class="format-name">CSV</span>
                        <span class="format-ext">.csv</span>
                    </label>
                    <label class="export-format-option" data-format="qb-iif">
                        <input type="radio" name="exportFormat" value="qb-iif">
                        <span class="format-icon">📒</span>
                        <span class="format-name">QuickBooks</span>
                        <span class="format-ext">.iif</span>
                    </label>
                    <label class="export-format-option" data-format="qbo">
                        <input type="radio" name="exportFormat" value="qbo">
                        <span class="format-icon">☁️</span>
                        <span class="format-name">QB Online</span>
                        <span class="format-ext">.csv</span>
                    </label>
                    <label class="export-format-option" data-format="xero">
                        <input type="radio" name="exportFormat" value="xero">
                        <span class="format-icon">🔷</span>
                        <span class="format-name">Xero</span>
                        <span class="format-ext">.csv</span>
                    </label>
                    <label class="export-format-option" data-format="pdf">
                        <input type="radio" name="exportFormat" value="pdf">
                        <span class="format-icon">📕</span>
                        <span class="format-name">PDF</span>
                        <span class="format-ext">.pdf</span>
                    </label>
                    <label class="export-format-option" data-format="ical">
                        <input type="radio" name="exportFormat" value="ical">
                        <span class="format-icon">📆</span>
                        <span class="format-name">iCal</span>
                        <span class="format-ext">.ics</span>
                    </label>
                    <label class="export-format-option" data-format="json">
                        <input type="radio" name="exportFormat" value="json">
                        <span class="format-icon">{ }</span>
                        <span class="format-name">JSON</span>
                        <span class="format-ext">.json</span>
                    </label>
                </div>
            </div>
            
            <div class="export-options" id="exportOptions"></div>
            
            <div class="export-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="button" class="btn btn-primary" onclick="executeExport()">
                    <i data-lucide="download"></i> Export
                </button>
            </div>
        </div>
    `;
    
    App.openModal('Export Data', modalHtml);
    
    // Add export-modal class to modal-content for wider sizing
    setTimeout(() => {
        const modalContent = document.querySelector('.modal-content');
        if (modalContent) {
            modalContent.classList.add('modal-export');
        }
        
        // Set up format selection
        document.querySelectorAll('.export-format-option').forEach(opt => {
            opt.addEventListener('click', () => {
                document.querySelectorAll('.export-format-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                opt.querySelector('input').checked = true;
                updateExportOptions();
            });
        });
        
        updateExportOptions();
        lucide.createIcons();
    }, 50);
}

function updateExportOptions() {
    const type = document.getElementById('exportType').value;
    const format = document.querySelector('input[name="exportFormat"]:checked')?.value || 'xlsx';
    const dateGroup = document.getElementById('dateRangeGroup');
    const optionsDiv = document.getElementById('exportOptions');
    
    // Show/hide date range based on type
    dateGroup.style.display = ['bookings', 'payments', 'reports', 'calendar'].includes(type) ? 'block' : 'none';
    
    // Update available formats based on type
    document.querySelectorAll('.export-format-option').forEach(opt => {
        const fmt = opt.dataset.format;
        let show = true;
        
        // Calendar only works with iCal
        if (type === 'calendar' && !['ical', 'csv', 'json'].includes(fmt)) show = false;
        // Products/Customers don't need accounting formats
        if (['products', 'customers'].includes(type) && ['qb-iif', 'qbo', 'xero'].includes(fmt)) show = false;
        // iCal only for calendar/bookings
        if (fmt === 'ical' && !['calendar', 'bookings'].includes(type)) show = false;
        
        opt.style.display = show ? 'flex' : 'none';
    });
    
    // Additional options
    let optionsHtml = '';
    
    if (type === 'bookings') {
        optionsHtml = `
            <div class="form-group">
                <label class="form-label">Status Filter</label>
                <select class="form-select" id="exportStatus">
                    <option value="all">All Statuses</option>
                    <option value="confirmed">Confirmed Only</option>
                    <option value="completed">Completed Only</option>
                    <option value="pending">Pending Only</option>
                </select>
            </div>
            <label class="checkbox-label">
                <input type="checkbox" id="exportIncludeCustomer" checked> Include customer details
            </label>
            <label class="checkbox-label">
                <input type="checkbox" id="exportIncludeItems" checked> Include line items
            </label>
        `;
    } else if (type === 'customers') {
        optionsHtml = `
            <label class="checkbox-label">
                <input type="checkbox" id="exportIncludeBookingHistory"> Include booking history
            </label>
            <label class="checkbox-label">
                <input type="checkbox" id="exportEmailOnly"> Email addresses only (for Mailchimp)
            </label>
        `;
    } else if (type === 'payments') {
        optionsHtml = `
            <div class="form-group">
                <label class="form-label">Payment Method</label>
                <select class="form-select" id="exportPaymentMethod">
                    <option value="all">All Methods</option>
                    <option value="card">Card Only</option>
                    <option value="cash">Cash Only</option>
                    <option value="check">Check Only</option>
                </select>
            </div>
        `;
    } else if (type === 'reports' && ['qb-iif', 'qbo', 'xero'].includes(format)) {
        optionsHtml = `
            <div class="form-group">
                <label class="form-label">Income Account</label>
                <input type="text" class="form-input" id="exportIncomeAccount" value="Rental Income" placeholder="e.g., Rental Income">
            </div>
            <div class="form-group">
                <label class="form-label">Sales Tax Account</label>
                <input type="text" class="form-input" id="exportTaxAccount" value="Sales Tax Payable" placeholder="e.g., Sales Tax Payable">
            </div>
        `;
    }
    
    optionsDiv.innerHTML = optionsHtml;
}

function setExportRange(preset) {
    const today = new Date();
    let from, to;
    
    switch(preset) {
        case 'month':
            from = new Date(today.getFullYear(), today.getMonth(), 1);
            to = today;
            break;
        case 'quarter':
            from = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
            to = today;
            break;
        case 'year':
            from = new Date(today.getFullYear(), 0, 1);
            to = today;
            break;
        case 'all':
            from = new Date(2020, 0, 1);
            to = today;
            break;
    }
    
    document.getElementById('exportFrom').value = from.toISOString().split('T')[0];
    document.getElementById('exportTo').value = to.toISOString().split('T')[0];
}

async function executeExport() {
    const type = document.getElementById('exportType').value;
    const format = document.querySelector('input[name="exportFormat"]:checked').value;
    const from = document.getElementById('exportFrom')?.value || '';
    const to = document.getElementById('exportTo')?.value || '';
    
    App.toast('Preparing export...', 'info');
    
    try {
        // Fetch data based on type
        let data;
        const params = new URLSearchParams({ from, to });
        
        switch(type) {
            case 'bookings':
                data = await App.api('bookings');
                if (from) data = data.filter(b => b.event_date >= from && b.event_date <= to);
                const status = document.getElementById('exportStatus')?.value;
                if (status && status !== 'all') data = data.filter(b => b.status === status);
                break;
            case 'customers':
                data = await App.api('customers');
                break;
            case 'products':
                data = await App.api('products');
                break;
            case 'payments':
                data = await App.api('payments');
                if (from) data = data.filter(p => p.created_at?.substring(0, 10) >= from && p.created_at?.substring(0, 10) <= to);
                const method = document.getElementById('exportPaymentMethod')?.value;
                if (method && method !== 'all') data = data.filter(p => p.method === method);
                break;
            case 'reports':
                data = await App.api('reports', { params: { from, to, detailed: true } });
                break;
            case 'calendar':
                data = await App.api('bookings');
                if (from) data = data.filter(b => b.event_date >= from && b.event_date <= to);
                data = data.filter(b => b.status !== 'cancelled');
                break;
        }
        
        // Generate export
        let content, filename, mimeType;
        const timestamp = new Date().toISOString().split('T')[0];
        
        switch(format) {
            case 'xlsx':
                ({ content, filename, mimeType } = generateExcel(type, data, timestamp));
                break;
            case 'csv':
                ({ content, filename, mimeType } = generateCSV(type, data, timestamp));
                break;
            case 'qb-iif':
                ({ content, filename, mimeType } = generateQuickBooksIIF(type, data, timestamp));
                break;
            case 'qbo':
                ({ content, filename, mimeType } = generateQuickBooksOnline(type, data, timestamp));
                break;
            case 'xero':
                ({ content, filename, mimeType } = generateXero(type, data, timestamp));
                break;
            case 'pdf':
                ({ content, filename, mimeType } = await generatePDF(type, data, timestamp));
                break;
            case 'ical':
                ({ content, filename, mimeType } = generateICal(type, data, timestamp));
                break;
            case 'json':
                ({ content, filename, mimeType } = generateJSON(type, data, timestamp));
                break;
        }
        
        // Download file
        downloadFile(content, filename, mimeType);
        App.toast('Export complete!', 'success');
        closeModal();
        
    } catch (err) {
        console.error('Export error:', err);
        App.toast('Export failed: ' + err.message, 'error');
    }
}

function generateCSV(type, data, timestamp) {
    let csv = '';
    let filename = `bounceplatform-${type}-${timestamp}.csv`;
    
    switch(type) {
        case 'bookings':
            csv = 'Booking Number,Date,Customer,Email,Phone,Event Type,Items,Subtotal,Tax,Delivery,Total,Paid,Balance,Status\n';
            data.forEach(b => {
                const items = (b.items || []).map(i => `${i.product_name} x${i.quantity}`).join('; ');
                csv += `"${b.booking_number}","${b.event_date}","${b.customer_name || ''}","${b.customer_email || ''}","${b.customer_phone || ''}","${b.event_type || ''}","${items}",${b.subtotal || 0},${b.tax || 0},${b.delivery_fee || 0},${b.total || 0},${b.amount_paid || 0},${b.balance_due || 0},"${b.status}"\n`;
            });
            break;
            
        case 'customers':
            const emailOnly = document.getElementById('exportEmailOnly')?.checked;
            if (emailOnly) {
                csv = 'Email,First Name,Last Name\n';
                data.forEach(c => {
                    if (c.email) csv += `"${c.email}","${c.first_name || ''}","${c.last_name || ''}"\n`;
                });
            } else {
                csv = 'First Name,Last Name,Email,Phone,Address,City,State,ZIP,Source,Created,Notes\n';
                data.forEach(c => {
                    csv += `"${c.first_name || ''}","${c.last_name || ''}","${c.email || ''}","${c.phone || ''}","${c.address || ''}","${c.city || ''}","${c.state || ''}","${c.zip || ''}","${c.source || ''}","${c.created_at || ''}","${(c.notes || '').replace(/"/g, '""')}"\n`;
                });
            }
            break;
            
        case 'products':
            csv = 'Name,Category,Daily Rate,Deposit,Quantity,Status,Dimensions,Capacity,Age Range\n';
            data.forEach(p => {
                csv += `"${p.name}","${p.category}",${p.daily_rate},${p.deposit_amount || 0},${p.quantity || 1},"${p.status}","${p.dimensions || ''}","${p.capacity || ''}","${p.age_range || ''}"\n`;
            });
            break;
            
        case 'payments':
            csv = 'Date,Booking,Customer,Method,Amount,Notes\n';
            data.forEach(p => {
                csv += `"${p.created_at?.substring(0, 10) || ''}","${p.booking_number || ''}","${p.customer_name || ''}","${p.method}",${p.amount},"${(p.notes || '').replace(/"/g, '""')}"\n`;
            });
            break;
            
        case 'reports':
            csv = 'Report: Financial Summary\n';
            csv += `Period,${data.period.from} to ${data.period.to}\n\n`;
            csv += 'Summary\n';
            csv += `Total Revenue,$${data.summary.total_revenue}\n`;
            csv += `Total Bookings,${data.summary.total_bookings}\n`;
            csv += `Average Booking,$${data.summary.avg_booking_value.toFixed(2)}\n\n`;
            csv += 'Daily Breakdown\n';
            csv += 'Date,Bookings,Gross,Tax,Delivery,Collected\n';
            (data.revenue.daily || []).forEach(d => {
                csv += `${d.date},${d.booking_count},${d.gross},${d.tax},${d.delivery},${d.collected}\n`;
            });
            break;
    }
    
    return { content: csv, filename, mimeType: 'text/csv' };
}

function generateExcel(type, data, timestamp) {
    // For simplicity, we'll generate CSV with .xlsx extension
    // A real implementation would use a library like SheetJS
    const csv = generateCSV(type, data, timestamp);
    return { 
        content: csv.content, 
        filename: csv.filename.replace('.csv', '.xlsx'), 
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    };
}

function generateQuickBooksIIF(type, data, timestamp) {
    let iif = '';
    const incomeAccount = document.getElementById('exportIncomeAccount')?.value || 'Rental Income';
    const taxAccount = document.getElementById('exportTaxAccount')?.value || 'Sales Tax Payable';
    
    if (type === 'payments' || type === 'reports') {
        // IIF format for invoices/payments
        iif = '!TRNS\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO\n';
        iif += '!SPL\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO\n';
        iif += '!ENDTRNS\n';
        
        const payments = type === 'reports' ? (data.payments || []) : data;
        
        payments.forEach(p => {
            const date = (p.created_at || '').substring(0, 10).replace(/-/g, '/');
            // Header line
            iif += `TRNS\tPAYMENT\t${date}\tUndeposited Funds\t${p.customer_name || 'Customer'}\t${p.amount}\t${p.booking_number || ''}\n`;
            // Split line
            iif += `SPL\tPAYMENT\t${date}\tAccounts Receivable\t${p.customer_name || 'Customer'}\t${-p.amount}\t${p.booking_number || ''}\n`;
            iif += 'ENDTRNS\n';
        });
    } else if (type === 'bookings') {
        // IIF format for invoices
        iif = '!TRNS\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO\n';
        iif += '!SPL\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO\n';
        iif += '!ENDTRNS\n';
        
        data.forEach(b => {
            const date = (b.event_date || '').replace(/-/g, '/');
            const customer = b.customer_name || 'Customer';
            const total = b.total || 0;
            const tax = b.tax || 0;
            const subtotal = (b.subtotal || 0) + (b.delivery_fee || 0);
            
            iif += `TRNS\tINVOICE\t${date}\tAccounts Receivable\t${customer}\t${total}\t${b.booking_number}\n`;
            iif += `SPL\tINVOICE\t${date}\t${incomeAccount}\t${customer}\t${-subtotal}\tRental\n`;
            if (tax > 0) {
                iif += `SPL\tINVOICE\t${date}\t${taxAccount}\t${customer}\t${-tax}\tSales Tax\n`;
            }
            iif += 'ENDTRNS\n';
        });
    }
    
    return { content: iif, filename: `quickbooks-${type}-${timestamp}.iif`, mimeType: 'text/plain' };
}

function generateQuickBooksOnline(type, data, timestamp) {
    let csv = '';
    
    if (type === 'payments' || type === 'reports') {
        // QBO Sales Receipt format
        csv = 'Customer,Transaction Date,Due Date,Item,Description,Quantity,Rate,Amount,Payment Method\n';
        const payments = type === 'reports' ? [] : data;
        
        // For payments, we'd need booking data too - simplified version
        payments.forEach(p => {
            csv += `"${p.customer_name || 'Customer'}","${p.created_at?.substring(0, 10) || ''}","${p.created_at?.substring(0, 10) || ''}","Payment","Payment received",1,${p.amount},${p.amount},"${p.method}"\n`;
        });
    } else if (type === 'bookings') {
        // QBO Invoice format
        csv = 'Customer,InvoiceNo,InvoiceDate,DueDate,Item(Product/Service),ItemDescription,ItemQuantity,ItemRate,ItemAmount,Taxable\n';
        
        data.forEach(b => {
            (b.items || []).forEach(item => {
                csv += `"${b.customer_name || 'Customer'}","${b.booking_number}","${b.event_date}","${b.event_date}","${item.product_name}","Rental for ${b.event_date}",${item.quantity},${item.unit_price},${item.subtotal},"TAX"\n`;
            });
            if (b.delivery_fee > 0) {
                csv += `"${b.customer_name || 'Customer'}","${b.booking_number}","${b.event_date}","${b.event_date}","Delivery","Delivery fee",1,${b.delivery_fee},${b.delivery_fee},"TAX"\n`;
            }
        });
    }
    
    return { content: csv, filename: `qbo-${type}-${timestamp}.csv`, mimeType: 'text/csv' };
}

function generateXero(type, data, timestamp) {
    let csv = '';
    
    if (type === 'bookings') {
        // Xero invoice import format
        csv = '*ContactName,EmailAddress,POAddressLine1,POCity,POPostalCode,*InvoiceNumber,*InvoiceDate,*DueDate,Total,TaxTotal,Description,Quantity,UnitAmount,AccountCode,TaxType\n';
        
        data.forEach(b => {
            const customer = b.customer_name || 'Customer';
            const email = b.customer_email || '';
            
            (b.items || []).forEach((item, idx) => {
                csv += `"${idx === 0 ? customer : ''}","${idx === 0 ? email : ''}","${idx === 0 ? (b.delivery_address || '') : ''}","","","${b.booking_number}","${b.event_date}","${b.event_date}",${idx === 0 ? b.total : ''},${idx === 0 ? b.tax : ''},"${item.product_name}",${item.quantity},${item.unit_price},"200","OUTPUT"\n`;
            });
        });
    } else if (type === 'payments') {
        // Xero payment format
        csv = '*Date,*Amount,Reference,Description\n';
        data.forEach(p => {
            csv += `"${p.created_at?.substring(0, 10) || ''}",${p.amount},"${p.booking_number || ''}","Payment from ${p.customer_name || 'Customer'}"\n`;
        });
    }
    
    return { content: csv, filename: `xero-${type}-${timestamp}.csv`, mimeType: 'text/csv' };
}

function generateICal(type, data, timestamp) {
    const events = Array.isArray(data) ? data : [];
    let ical = 'BEGIN:VCALENDAR\n';
    ical += 'VERSION:2.0\n';
    ical += 'PRODID:-//BouncePlatform//Bookings//EN\n';
    ical += 'CALSCALE:GREGORIAN\n';
    ical += 'METHOD:PUBLISH\n';
    ical += 'X-WR-CALNAME:BouncePlatform Bookings\n';
    
    events.forEach(b => {
        const startDate = (b.event_date || '').replace(/-/g, '');
        const startTime = (b.event_start || '10:00').replace(':', '') + '00';
        const endTime = (b.event_end || '18:00').replace(':', '') + '00';
        const items = (b.items || []).map(i => i.product_name).join(', ');
        const uid = `${b.id}@bounceplatform`;
        
        ical += 'BEGIN:VEVENT\n';
        ical += `UID:${uid}\n`;
        ical += `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z\n`;
        ical += `DTSTART:${startDate}T${startTime}\n`;
        ical += `DTEND:${startDate}T${endTime}\n`;
        ical += `SUMMARY:${b.booking_number} - ${b.customer_name || 'Booking'}\n`;
        ical += `DESCRIPTION:Items: ${items}\\nTotal: $${b.total || 0}\\nPhone: ${b.customer_phone || 'N/A'}\\nNotes: ${(b.delivery_notes || '').replace(/\n/g, '\\n')}\n`;
        ical += `LOCATION:${(b.delivery_address || '').replace(/,/g, '\\,')}\n`;
        ical += `STATUS:${b.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}\n`;
        ical += 'END:VEVENT\n';
    });
    
    ical += 'END:VCALENDAR';
    
    return { content: ical, filename: `bounceplatform-calendar-${timestamp}.ics`, mimeType: 'text/calendar' };
}

function generateJSON(type, data, timestamp) {
    const exportData = {
        type,
        exported_at: new Date().toISOString(),
        record_count: Array.isArray(data) ? data.length : 1,
        data
    };
    
    return { 
        content: JSON.stringify(exportData, null, 2), 
        filename: `bounceplatform-${type}-${timestamp}.json`, 
        mimeType: 'application/json' 
    };
}

async function generatePDF(type, data, timestamp) {
    // Generate HTML for PDF (will be printed via browser)
    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
                h1 { color: #f97316; border-bottom: 2px solid #f97316; padding-bottom: 10px; }
                h2 { color: #374151; margin-top: 30px; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th, td { border: 1px solid #e5e7eb; padding: 10px; text-align: left; }
                th { background: #f3f4f6; font-weight: 600; }
                .total-row { font-weight: bold; background: #fef3c7; }
                .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
                .stat { text-align: center; padding: 15px; background: #f9fafb; border-radius: 8px; }
                .stat-value { font-size: 24px; font-weight: bold; color: #f97316; }
                .stat-label { font-size: 12px; color: #6b7280; }
                .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
                @media print { body { padding: 20px; } }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🎪 BouncePlatform Report</h1>
                <div>Generated: ${new Date().toLocaleDateString()}</div>
            </div>
    `;
    
    if (type === 'reports') {
        html += `
            <h2>Financial Summary</h2>
            <p>Period: ${data.period.from} to ${data.period.to}</p>
            <div class="stats-grid">
                <div class="stat"><div class="stat-value">$${data.summary.total_revenue.toLocaleString()}</div><div class="stat-label">Total Revenue</div></div>
                <div class="stat"><div class="stat-value">${data.summary.total_bookings}</div><div class="stat-label">Total Bookings</div></div>
                <div class="stat"><div class="stat-value">$${data.summary.avg_booking_value.toFixed(0)}</div><div class="stat-label">Avg Booking</div></div>
                <div class="stat"><div class="stat-value">${data.summary.unique_customers}</div><div class="stat-label">Customers</div></div>
            </div>
            <h2>Revenue by Day</h2>
            <table>
                <tr><th>Date</th><th>Bookings</th><th>Gross</th><th>Tax</th><th>Collected</th></tr>
                ${(data.revenue.daily || []).slice(-30).map(d => `
                    <tr><td>${d.date}</td><td>${d.booking_count}</td><td>$${d.gross.toFixed(2)}</td><td>$${d.tax.toFixed(2)}</td><td>$${d.collected.toFixed(2)}</td></tr>
                `).join('')}
            </table>
        `;
    } else if (type === 'bookings') {
        html += `
            <h2>Bookings (${data.length} total)</h2>
            <table>
                <tr><th>Number</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th></tr>
                ${data.map(b => `
                    <tr>
                        <td>${b.booking_number}</td>
                        <td>${b.event_date}</td>
                        <td>${b.customer_name || ''}</td>
                        <td>${(b.items || []).map(i => i.product_name).join(', ')}</td>
                        <td>$${(b.total || 0).toFixed(2)}</td>
                        <td>${b.status}</td>
                    </tr>
                `).join('')}
            </table>
        `;
    } else if (type === 'customers') {
        html += `
            <h2>Customers (${data.length} total)</h2>
            <table>
                <tr><th>Name</th><th>Email</th><th>Phone</th><th>City</th><th>Source</th></tr>
                ${data.map(c => `
                    <tr>
                        <td>${c.first_name || ''} ${c.last_name || ''}</td>
                        <td>${c.email || ''}</td>
                        <td>${c.phone || ''}</td>
                        <td>${c.city || ''}</td>
                        <td>${c.source || ''}</td>
                    </tr>
                `).join('')}
            </table>
        `;
    }
    
    html += '</body></html>';
    
    // Open print dialog
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
    
    return { content: '', filename: '', mimeType: '' }; // PDF handled via print
}

function downloadFile(content, filename, mimeType) {
    if (!content) return; // PDF uses print dialog
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Initialize reports when page loads
document.addEventListener('DOMContentLoaded', () => {
    if (location.hash === '#reports') {
        setTimeout(() => showReport('overview'), 100);
    }
});

// ============ Export Functions ============

async function exportData(type, format) {
    const formatRadio = document.querySelector('input[name="spreadsheetFormat"]:checked');
    format = formatRadio ? formatRadio.value : format;
    
    App.toast(`Generating ${type} export...`, 'info');
    
    try {
        let data, filename, headers, rows;
        const today = new Date().toISOString().split('T')[0];
        
        switch(type) {
            case 'bookings':
                data = await App.api('bookings');
                headers = ['Booking #', 'Date', 'Customer', 'Email', 'Phone', 'Items', 'Subtotal', 'Delivery', 'Tax', 'Total', 'Paid', 'Balance', 'Status', 'Created'];
                rows = data.map(b => [
                    b.booking_number,
                    b.event_date,
                    b.customer_name,
                    b.customer_email || '',
                    b.customer_phone || '',
                    (b.items || []).map(i => `${i.product_name} x${i.quantity}`).join('; '),
                    b.subtotal?.toFixed(2),
                    b.delivery_fee?.toFixed(2),
                    b.tax?.toFixed(2),
                    b.total?.toFixed(2),
                    b.paid?.toFixed(2),
                    b.balance_due?.toFixed(2),
                    b.status,
                    b.created_at?.split('T')[0]
                ]);
                filename = `bookings-export-${today}`;
                break;
                
            case 'customers':
                data = await App.api('customers');
                headers = ['ID', 'First Name', 'Last Name', 'Email', 'Phone', 'Address', 'City', 'State', 'ZIP', 'Source', 'Total Bookings', 'Total Spent', 'Created'];
                rows = data.map(c => [
                    c.id,
                    c.first_name,
                    c.last_name,
                    c.email || '',
                    c.phone || '',
                    c.address || '',
                    c.city || '',
                    c.state || 'IL',
                    c.zip || '',
                    c.source || '',
                    c.booking_count || 0,
                    c.total_spent?.toFixed(2) || '0.00',
                    c.created_at?.split('T')[0]
                ]);
                filename = `customers-export-${today}`;
                break;
                
            case 'products':
                data = await App.api('products');
                headers = ['ID', 'SKU', 'Name', 'Category', 'Daily Rate', 'Weekend Rate', 'Deposit', 'Quantity', 'Status', 'Dimensions', 'Capacity', 'Age Range'];
                rows = data.map(p => [
                    p.id,
                    p.sku || '',
                    p.name,
                    p.category,
                    p.daily_rate?.toFixed(2),
                    p.weekend_rate?.toFixed(2),
                    p.deposit_amount?.toFixed(2),
                    p.quantity,
                    p.status,
                    p.dimensions || '',
                    p.capacity || '',
                    p.age_range || ''
                ]);
                filename = `products-export-${today}`;
                break;
                
            case 'payments':
                data = await App.api('payments');
                headers = ['Payment ID', 'Booking #', 'Customer', 'Date', 'Amount', 'Method', 'Type', 'Reference', 'Notes'];
                rows = data.map(p => [
                    p.id,
                    p.booking_number || '',
                    p.customer_name || '',
                    p.created_at?.split('T')[0],
                    p.amount?.toFixed(2),
                    p.method,
                    p.type,
                    p.reference || '',
                    p.notes || ''
                ]);
                filename = `payments-export-${today}`;
                break;
                
            case 'revenue':
                const from = document.getElementById('qbFrom')?.value || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
                const to = document.getElementById('qbTo')?.value || today;
                data = await App.api('reports', { params: { from, to, detailed: true } });
                headers = ['Date', 'Bookings', 'Gross Revenue', 'Tax', 'Delivery Fees', 'Collected'];
                rows = data.revenue.daily.map(d => [
                    d.date,
                    d.booking_count,
                    d.gross?.toFixed(2),
                    d.tax?.toFixed(2),
                    d.delivery?.toFixed(2),
                    d.collected?.toFixed(2)
                ]);
                filename = `revenue-report-${from}-to-${to}`;
                break;
        }
        
        if (format === 'xlsx') {
            downloadXLSX(headers, rows, filename);
        } else {
            downloadCSV(headers, rows, filename);
        }
        
        App.toast(`${type} exported successfully!`, 'success');
    } catch (err) {
        App.toast('Export failed: ' + err.message, 'error');
    }
}

function downloadCSV(headers, rows, filename) {
    const escape = val => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    };
    
    let csv = headers.map(escape).join(',') + '\n';
    rows.forEach(row => {
        csv += row.map(escape).join(',') + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename + '.csv';
    a.click();
    URL.revokeObjectURL(url);
}

function downloadXLSX(headers, rows, filename) {
    // Simple XLSX using XML format (works without libraries)
    const escapeXml = str => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    let xml = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>';
    xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
    xml += '<Worksheet ss:Name="Sheet1"><Table>';
    
    // Header row
    xml += '<Row>';
    headers.forEach(h => {
        xml += `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`;
    });
    xml += '</Row>';
    
    // Data rows
    rows.forEach(row => {
        xml += '<Row>';
        row.forEach(cell => {
            const isNum = !isNaN(parseFloat(cell)) && isFinite(cell);
            xml += `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${escapeXml(cell)}</Data></Cell>`;
        });
        xml += '</Row>';
    });
    
    xml += '</Table></Worksheet></Workbook>';
    
    const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename + '.xls';
    a.click();
    URL.revokeObjectURL(url);
}

async function exportQuickBooks(type) {
    const from = document.getElementById('qbFrom').value;
    const to = document.getElementById('qbTo').value;
    
    App.toast(`Generating QuickBooks ${type} export...`, 'info');
    
    try {
        let iif = '';
        const today = new Date().toISOString().split('T')[0];
        
        switch(type) {
            case 'invoices':
                const bookings = await App.api('bookings');
                const filtered = bookings.filter(b => b.event_date >= from && b.event_date <= to);
                
                // IIF header for invoices
                iif = '!TRNS\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tDOCNUM\tMEMO\n';
                iif += '!SPL\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO\n';
                iif += '!ENDTRNS\n';
                
                filtered.forEach(b => {
                    const date = new Date(b.event_date).toLocaleDateString('en-US');
                    // Transaction line
                    iif += `TRNS\tINVOICE\t${date}\tAccounts Receivable\t${b.customer_name}\t${b.total.toFixed(2)}\t${b.booking_number}\tBounce House Rental\n`;
                    // Split line (income)
                    iif += `SPL\tINVOICE\t${date}\tSales Income\t${b.customer_name}\t-${b.subtotal.toFixed(2)}\tRental Items\n`;
                    if (b.delivery_fee > 0) {
                        iif += `SPL\tINVOICE\t${date}\tDelivery Income\t${b.customer_name}\t-${b.delivery_fee.toFixed(2)}\tDelivery Fee\n`;
                    }
                    if (b.tax > 0) {
                        iif += `SPL\tINVOICE\t${date}\tSales Tax Payable\t${b.customer_name}\t-${b.tax.toFixed(2)}\tSales Tax\n`;
                    }
                    iif += 'ENDTRNS\n';
                });
                break;
                
            case 'customers':
                const customers = await App.api('customers');
                
                iif = '!CUST\tNAME\tBADDR1\tBADDR2\tBADDR3\tPHONE1\tEMAIL\n';
                customers.forEach(c => {
                    const name = `${c.first_name} ${c.last_name}`.trim();
                    const addr1 = c.address || '';
                    const addr2 = `${c.city || ''}, ${c.state || 'IL'} ${c.zip || ''}`.trim();
                    iif += `CUST\t${name}\t${addr1}\t${addr2}\t\t${c.phone || ''}\t${c.email || ''}\n`;
                });
                break;
                
            case 'payments':
                const payments = await App.api('payments');
                const filteredPay = payments.filter(p => p.created_at?.split('T')[0] >= from && p.created_at?.split('T')[0] <= to);
                
                iif = '!TRNS\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tDOCNUM\tMEMO\n';
                iif += '!SPL\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO\n';
                iif += '!ENDTRNS\n';
                
                filteredPay.forEach(p => {
                    const date = new Date(p.created_at).toLocaleDateString('en-US');
                    const acct = p.method === 'cash' ? 'Cash' : (p.method === 'check' ? 'Checking' : 'Undeposited Funds');
                    iif += `TRNS\tPAYMENT\t${date}\t${acct}\t${p.customer_name || 'Customer'}\t${p.amount.toFixed(2)}\t${p.booking_number || ''}\tPayment received\n`;
                    iif += `SPL\tPAYMENT\t${date}\tAccounts Receivable\t${p.customer_name || 'Customer'}\t-${p.amount.toFixed(2)}\tPayment\n`;
                    iif += 'ENDTRNS\n';
                });
                break;
        }
        
        const blob = new Blob([iif], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `quickbooks-${type}-${from}-to-${to}.iif`;
        a.click();
        URL.revokeObjectURL(url);
        
        App.toast('QuickBooks export downloaded!', 'success');
    } catch (err) {
        App.toast('Export failed: ' + err.message, 'error');
    }
}

async function exportCalendar(format) {
    App.toast('Generating calendar file...', 'info');
    
    try {
        const bookings = await App.api('bookings');
        const upcoming = bookings.filter(b => b.status !== 'cancelled' && b.event_date >= new Date().toISOString().split('T')[0]);
        
        let ical = 'BEGIN:VCALENDAR\n';
        ical += 'VERSION:2.0\n';
        ical += 'PRODID:-//BouncePlatform//Bookings//EN\n';
        ical += 'CALSCALE:GREGORIAN\n';
        ical += 'METHOD:PUBLISH\n';
        ical += 'X-WR-CALNAME:Bounce House Bookings\n';
        
        upcoming.forEach(b => {
            const startDate = b.event_date.replace(/-/g, '');
            const startTime = (b.event_start || '10:00').replace(':', '') + '00';
            const endTime = (b.event_end || '18:00').replace(':', '') + '00';
            const items = (b.items || []).map(i => i.product_name).join(', ');
            
            ical += 'BEGIN:VEVENT\n';
            ical += `UID:${b.id}@bounceplatform\n`;
            ical += `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z\n`;
            ical += `DTSTART:${startDate}T${startTime}\n`;
            ical += `DTEND:${startDate}T${endTime}\n`;
            ical += `SUMMARY:🎪 ${b.booking_number} - ${b.customer_name}\n`;
            ical += `DESCRIPTION:Items: ${items}\\nAddress: ${b.delivery_address || 'TBD'}\\nPhone: ${b.customer_phone || 'N/A'}\\nTotal: $${b.total?.toFixed(2)}\\nNotes: ${b.delivery_notes || 'None'}\n`;
            ical += `LOCATION:${b.delivery_address || ''}\n`;
            ical += `STATUS:${b.status === 'confirmed' ? 'CONFIRMED' : 'TENTATIVE'}\n`;
            ical += 'END:VEVENT\n';
        });
        
        ical += 'END:VCALENDAR';
        
        const blob = new Blob([ical], { type: 'text/calendar' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'bounceplatform-bookings.ics';
        a.click();
        URL.revokeObjectURL(url);
        
        App.toast('Calendar file downloaded!', 'success');
    } catch (err) {
        App.toast('Export failed: ' + err.message, 'error');
    }
}

function copyCalendarUrl() {
    const baseUrl = window.location.origin + window.location.pathname.replace('admin/', '');
    const calUrl = baseUrl + 'api.php?action=calendar&format=ical';
    
    document.getElementById('calendarUrlDisplay').style.display = 'block';
    document.getElementById('calendarUrl').value = calUrl;
    
    navigator.clipboard.writeText(calUrl).then(() => {
        App.toast('Calendar URL copied!', 'success');
    });
}

async function exportPDF(type) {
    const from = document.getElementById('pdfFrom').value;
    const to = document.getElementById('pdfTo').value;
    
    App.toast(`Generating ${type} PDF...`, 'info');
    
    try {
        let html = `<!DOCTYPE html><html><head><style>
            body { font-family: Arial, sans-serif; font-size: 12px; margin: 40px; }
            h1 { color: #f97316; font-size: 24px; margin-bottom: 5px; }
            h2 { color: #374151; font-size: 16px; margin-top: 20px; }
            .header { border-bottom: 2px solid #f97316; padding-bottom: 10px; margin-bottom: 20px; }
            .meta { color: #6b7280; font-size: 11px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #e5e7eb; }
            th { background: #f3f4f6; font-weight: 600; }
            .total-row { font-weight: bold; background: #fef3c7; }
            .amount { text-align: right; }
            @media print { body { margin: 20px; } }
        </style></head><body>`;
        
        const settings = await App.api('settings');
        const businessName = settings.meta?.business_name || 'Bounce House Rentals';
        const businessPhone = settings.meta?.business_phone || '';
        
        switch(type) {
            case 'invoice-batch':
                const bookings = await App.api('bookings');
                const filtered = bookings.filter(b => b.event_date >= from && b.event_date <= to && b.status !== 'cancelled');
                
                html += `<div class="header"><h1>${businessName}</h1><p class="meta">${businessPhone}</p></div>`;
                html += `<h2>Invoices: ${from} to ${to}</h2>`;
                html += '<table><thead><tr><th>Invoice #</th><th>Date</th><th>Customer</th><th>Items</th><th class="amount">Total</th><th class="amount">Paid</th><th class="amount">Balance</th></tr></thead><tbody>';
                
                let totalBilled = 0, totalPaid = 0;
                filtered.forEach(b => {
                    const items = (b.items || []).map(i => i.product_name).join(', ');
                    html += `<tr><td>${b.booking_number}</td><td>${b.event_date}</td><td>${b.customer_name}</td><td>${items}</td><td class="amount">$${b.total?.toFixed(2)}</td><td class="amount">$${b.paid?.toFixed(2)}</td><td class="amount">$${b.balance_due?.toFixed(2)}</td></tr>`;
                    totalBilled += b.total || 0;
                    totalPaid += b.paid || 0;
                });
                html += `<tr class="total-row"><td colspan="4">TOTALS</td><td class="amount">$${totalBilled.toFixed(2)}</td><td class="amount">$${totalPaid.toFixed(2)}</td><td class="amount">$${(totalBilled - totalPaid).toFixed(2)}</td></tr>`;
                html += '</tbody></table>';
                break;
                
            case 'revenue-report':
                const report = await App.api('reports', { params: { from, to, detailed: true } });
                
                html += `<div class="header"><h1>${businessName}</h1><p class="meta">Revenue Report</p></div>`;
                html += `<h2>Period: ${from} to ${to}</h2>`;
                html += `<p><strong>Total Revenue:</strong> $${report.summary.total_revenue?.toFixed(2)}</p>`;
                html += `<p><strong>Total Bookings:</strong> ${report.summary.total_bookings}</p>`;
                html += `<p><strong>Average Booking:</strong> $${report.summary.avg_booking_value?.toFixed(2)}</p>`;
                
                html += '<h2>Daily Breakdown</h2>';
                html += '<table><thead><tr><th>Date</th><th class="amount">Bookings</th><th class="amount">Gross</th><th class="amount">Tax</th><th class="amount">Delivery</th><th class="amount">Collected</th></tr></thead><tbody>';
                report.revenue.daily.forEach(d => {
                    html += `<tr><td>${d.date}</td><td class="amount">${d.booking_count}</td><td class="amount">$${d.gross?.toFixed(2)}</td><td class="amount">$${d.tax?.toFixed(2)}</td><td class="amount">$${d.delivery?.toFixed(2)}</td><td class="amount">$${d.collected?.toFixed(2)}</td></tr>`;
                });
                html += '</tbody></table>';
                break;
                
            case 'delivery-schedule':
                const deliveries = await App.api('bookings');
                const upcoming = deliveries.filter(b => b.event_date >= from && b.event_date <= to && b.status !== 'cancelled');
                upcoming.sort((a, b) => a.event_date.localeCompare(b.event_date));
                
                html += `<div class="header"><h1>${businessName}</h1><p class="meta">Delivery Schedule</p></div>`;
                html += `<h2>${from} to ${to}</h2>`;
                html += '<table><thead><tr><th>Date</th><th>Time</th><th>Booking #</th><th>Customer</th><th>Phone</th><th>Address</th><th>Items</th></tr></thead><tbody>';
                upcoming.forEach(b => {
                    const items = (b.items || []).map(i => `${i.product_name} x${i.quantity}`).join(', ');
                    html += `<tr><td>${b.event_date}</td><td>${b.event_start || '10:00'}</td><td>${b.booking_number}</td><td>${b.customer_name}</td><td>${b.customer_phone || ''}</td><td>${b.delivery_address || ''}</td><td>${items}</td></tr>`;
                });
                html += '</tbody></table>';
                break;
                
            case 'customer-list':
                const customers = await App.api('customers');
                
                html += `<div class="header"><h1>${businessName}</h1><p class="meta">Customer List</p></div>`;
                html += `<p class="meta">Generated: ${new Date().toLocaleDateString()}</p>`;
                html += '<table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>City</th><th class="amount">Bookings</th><th class="amount">Total Spent</th></tr></thead><tbody>';
                customers.forEach(c => {
                    html += `<tr><td>${c.first_name} ${c.last_name}</td><td>${c.email || ''}</td><td>${c.phone || ''}</td><td>${c.city || ''}</td><td class="amount">${c.booking_count || 0}</td><td class="amount">$${c.total_spent?.toFixed(2) || '0.00'}</td></tr>`;
                });
                html += '</tbody></table>';
                break;
        }
        
        html += '</body></html>';
        
        // Open in new window for printing
        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
        win.print();
        
        App.toast('PDF ready for printing!', 'success');
    } catch (err) {
        App.toast('Export failed: ' + err.message, 'error');
    }
}

async function exportGoogleSheets(type) {
    // Export as CSV with Google Sheets optimized format
    await exportData(type, 'csv');
    App.toast('Download complete. Open Google Sheets → File → Import to upload.', 'info');
}

async function exportMailingList(segment) {
    App.toast('Generating mailing list...', 'info');
    
    try {
        const customers = await App.api('customers');
        let filtered;
        
        switch(segment) {
            case 'recent':
                const ninetyDaysAgo = new Date();
                ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
                filtered = customers.filter(c => c.last_booking && new Date(c.last_booking) >= ninetyDaysAgo);
                break;
            case 'vip':
                filtered = customers.filter(c => (c.booking_count || 0) >= 3 || (c.total_spent || 0) >= 500);
                break;
            default:
                filtered = customers;
        }
        
        // Mailchimp/Constant Contact format
        const headers = ['Email Address', 'First Name', 'Last Name', 'Phone', 'Address', 'City', 'State', 'ZIP'];
        const rows = filtered.filter(c => c.email).map(c => [
            c.email,
            c.first_name || '',
            c.last_name || '',
            c.phone || '',
            c.address || '',
            c.city || '',
            c.state || 'IL',
            c.zip || ''
        ]);
        
        downloadCSV(headers, rows, `mailing-list-${segment}-${new Date().toISOString().split('T')[0]}`);
        App.toast(`${rows.length} contacts exported!`, 'success');
    } catch (err) {
        App.toast('Export failed: ' + err.message, 'error');
    }
}

async function exportFullBackup() {
    App.toast('Creating full backup...', 'info');
    
    try {
        const data = {
            exported_at: new Date().toISOString(),
            version: '2.0',
            bookings: await App.api('bookings'),
            customers: await App.api('customers'),
            products: await App.api('products'),
            payments: await App.api('payments'),
            promos: await App.api('promos'),
            settings: await App.api('settings')
        };
        
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bounceplatform-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        App.toast('Full backup downloaded!', 'success');
    } catch (err) {
        App.toast('Backup failed: ' + err.message, 'error');
    }
}

function showWebhookSetup() {
    App.openModal('Webhook Configuration', document.getElementById('webhookSetupContent').innerHTML);
}

async function saveWebhookSettings() {
    const url = document.getElementById('webhookUrl').value;
    const events = Array.from(document.querySelectorAll('input[name="webhookEvents"]:checked')).map(el => el.value);
    
    if (!url) {
        App.toast('Please enter a webhook URL', 'error');
        return;
    }
    
    try {
        await App.api('settings', {
            method: 'PUT',
            body: { webhook_url: url, webhook_events: events }
        });
        closeModal();
        App.toast('Webhook settings saved!', 'success');
    } catch (err) {
        App.toast('Error saving settings: ' + err.message, 'error');
    }
}