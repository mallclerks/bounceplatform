<?php
/**
 * BouncePlatform Demo - Admin Panel
 * Located at /demoadmin/index.php
 */
$dataFile = __DIR__ . '/data.json';
$data = file_exists($dataFile) ? json_decode(file_get_contents($dataFile), true) : [];
$meta = $data['_meta'] ?? [];
$businessName = $meta['business_name'] ?? "Stan's Bounce House";
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin - <?= htmlspecialchars($businessName) ?></title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="demo-banner">
        <span>🎮 DEMO MODE</span> - Changes will reset periodically. <a href="/">Learn about BouncePlatform →</a>
    </div>
    
    <div id="app">
        <!-- Sidebar -->
        <aside class="sidebar" id="sidebar">
            <div class="sidebar-header">
                <span class="logo-icon">🎪</span>
                <span class="logo-text"><?= htmlspecialchars($businessName) ?></span>
            </div>
            <nav class="sidebar-nav">
                <a href="#dashboard" class="nav-item active" data-page="dashboard"><i data-lucide="layout-dashboard"></i><span>Dashboard</span></a>
                <a href="#bookings" class="nav-item" data-page="bookings"><i data-lucide="calendar"></i><span>Bookings</span></a>
                <a href="#customers" class="nav-item" data-page="customers"><i data-lucide="users"></i><span>Customers</span></a>
                <a href="#inventory" class="nav-item" data-page="inventory"><i data-lucide="box"></i><span>Inventory</span></a>
                <a href="#payments" class="nav-item" data-page="payments"><i data-lucide="credit-card"></i><span>Payments</span></a>
                <a href="#promos" class="nav-item" data-page="promos"><i data-lucide="tag"></i><span>Promos</span></a>
                <a href="#reports" class="nav-item" data-page="reports"><i data-lucide="bar-chart-2"></i><span>Reports</span></a>
                <a href="#exports" class="nav-item" data-page="exports"><i data-lucide="download"></i><span>Exports</span></a>
                <a href="#settings" class="nav-item" data-page="settings"><i data-lucide="settings"></i><span>Settings</span></a>
            </nav>
            <div class="sidebar-footer">
                <a href="/demosite/" class="nav-item"><i data-lucide="eye"></i><span>View Customer Site</span></a>
                <a href="/" class="nav-item"><i data-lucide="home"></i><span>BouncePlatform Home</span></a>
            </div>
        </aside>
        
        <!-- Main -->
        <main class="main-content">
            <header class="top-header">
                <button class="menu-toggle" id="menuToggle"><i data-lucide="menu"></i></button>
                <h1 class="page-title" id="pageTitle">Dashboard</h1>
                <div class="header-actions" id="headerActions"></div>
            </header>
            <div class="page-content" id="pageContent">
                <div class="loading"><div class="spinner"></div></div>
            </div>
        </main>
        
        <!-- Slide Panel -->
        <div class="slide-panel" id="slidePanel">
            <div class="panel-header">
                <h2 class="panel-title" id="panelTitle">Details</h2>
                <button class="panel-close" onclick="closePanel()"><i data-lucide="x"></i></button>
            </div>
            <div class="panel-content" id="panelContent"></div>
        </div>
        <div class="panel-overlay" id="panelOverlay" onclick="closePanel()"></div>
        
        <!-- Modal -->
        <div class="modal" id="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title" id="modalTitle">Modal</h2>
                    <button class="modal-close" onclick="closeModal()"><i data-lucide="x"></i></button>
                </div>
                <div class="modal-body" id="modalBody"></div>
            </div>
        </div>
        
        <!-- Toasts -->
        <div class="toast-container" id="toastContainer"></div>
    </div>
    
    <script>
        // Set API path - same directory
        const API_PATH = 'api.php';
    </script>
    <script src="app.js"></script>
    <script>App.init();</script>
</body>
</html>