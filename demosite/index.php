<?php
/**
 * BouncePlatform Demo - Customer Booking Site
 */
$dataFile = __DIR__ . '/data.json';
$data = file_exists($dataFile) ? json_decode(file_get_contents($dataFile), true) : [];
$meta = $data['_meta'] ?? [];
$products = array_filter($data['products'] ?? [], fn($p) => ($p['status'] ?? '') === 'active');
usort($products, fn($a, $b) => ($a['sort_order'] ?? 99) - ($b['sort_order'] ?? 99));
$zones = $data['zones'] ?? [];

$businessName = $meta['business_name'] ?? "Stan's Bounce House";
$phone = $meta['business_phone'] ?? '(815) 555-0100';
$email = $meta['business_email'] ?? 'info@stansbounce.com';
$taxRate = $meta['tax_rate'] ?? 0.0625;
$depositPercent = $meta['deposit_percent'] ?? 25;
$baseLocation = $meta['base_location'] ?? ['lat' => 41.1417, 'lng' => -87.8792];

// Group by category
$categories = [];
foreach ($products as $p) {
    $cat = $p['category'] ?? 'other';
    if (!isset($categories[$cat])) $categories[$cat] = [];
    $categories[$cat][] = $p;
}

$catNames = [
    'bounce-house' => ['name' => 'Bounce Houses', 'emoji' => '🏰', 'desc' => 'Classic bouncing fun for all ages'],
    'water-slide' => ['name' => 'Water Slides', 'emoji' => '🌊', 'desc' => 'Beat the heat with a splash'],
    'combo' => ['name' => 'Combos', 'emoji' => '🎪', 'desc' => 'Bounce, slide, and climb all in one'],
    'obstacle' => ['name' => 'Obstacle Courses', 'emoji' => '🏃', 'desc' => 'Race your friends through the course'],
    'concession' => ['name' => 'Concessions', 'emoji' => '🍿', 'desc' => 'Sweet treats for your party']
];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= htmlspecialchars($businessName) ?> - Bounce House Rentals</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
            --primary: #f97316; --primary-dark: #ea580c; --secondary: #ec4899;
            --success: #10b981; --warning: #f59e0b; --danger: #ef4444;
            --gray-50: #f9fafb; --gray-100: #f3f4f6; --gray-200: #e5e7eb;
            --gray-300: #d1d5db; --gray-400: #9ca3af; --gray-500: #6b7280;
            --gray-600: #4b5563; --gray-700: #374151; --gray-800: #1f2937; --gray-900: #111827;
        }
        body { font-family: 'Inter', -apple-system, sans-serif; color: var(--gray-800); line-height: 1.6; background: var(--gray-50); }
        a { color: inherit; text-decoration: none; }
        
        .demo-badge { background: linear-gradient(90deg, var(--gray-800), var(--gray-700)); color: white; padding: 0.5rem 1rem; font-size: 0.8rem; text-align: center; }
        .demo-badge a { color: #fbbf24; margin-left: 0.5rem; }
        /* Admin link updated to /demoadmin/ */
        
        .navbar { background: white; padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); position: sticky; top: 0; z-index: 100; }
        .logo { font-weight: 800; font-size: 1.25rem; }
        .nav-links { display: flex; gap: 1.5rem; align-items: center; }
        .nav-links a { color: var(--gray-600); font-size: 0.9rem; font-weight: 500; }
        .nav-links a:hover { color: var(--primary); }
        
        .btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.625rem 1.25rem; border-radius: 8px; font-weight: 600; border: none; cursor: pointer; transition: all 0.2s; font-size: 0.9rem; }
        .btn-primary { background: linear-gradient(135deg, var(--primary), var(--secondary)); color: white; }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(249,115,22,0.4); }
        .btn-secondary { background: var(--gray-200); color: var(--gray-700); }
        .btn-lg { padding: 0.875rem 1.75rem; font-size: 1rem; }
        .btn-sm { padding: 0.375rem 0.75rem; font-size: 0.8rem; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        
        .hero { background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%); color: white; padding: 3rem 2rem; text-align: center; }
        .hero h1 { font-size: 2.25rem; font-weight: 800; margin-bottom: 0.5rem; }
        .hero p { font-size: 1.125rem; opacity: 0.9; margin-bottom: 1.5rem; }
        .hero-features { display: flex; justify-content: center; gap: 1.5rem; flex-wrap: wrap; }
        .hero-feature { background: rgba(255,255,255,0.15); padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.85rem; }
        
        .main-container { display: flex; max-width: 1400px; margin: 0 auto; min-height: calc(100vh - 200px); }
        .catalog-section { flex: 1; padding: 2rem; overflow-y: auto; }
        .cart-section { width: 420px; background: white; border-left: 1px solid var(--gray-200); position: sticky; top: 60px; height: calc(100vh - 60px); display: flex; flex-direction: column; }
        
        .section-header { margin-bottom: 1.5rem; }
        .section-header h2 { font-size: 1.5rem; font-weight: 700; display: flex; align-items: center; gap: 0.5rem; }
        .section-header p { color: var(--gray-500); margin-top: 0.25rem; }
        
        .product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem; margin-bottom: 2.5rem; }
        .product-card { background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); overflow: hidden; transition: all 0.3s; border: 2px solid transparent; cursor: pointer; }
        .product-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.12); }
        .product-card.selected { border-color: var(--primary); }
        .product-image { height: 140px; background: linear-gradient(135deg, var(--gray-100), var(--gray-200)); display: flex; align-items: center; justify-content: center; font-size: 4rem; position: relative; }
        .product-image .selected-badge { position: absolute; top: 0.75rem; right: 0.75rem; background: var(--primary); color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1rem; }
        .product-body { padding: 1rem; }
        .product-title { font-size: 1rem; font-weight: 600; margin-bottom: 0.25rem; }
        .product-desc { font-size: 0.8rem; color: var(--gray-500); margin-bottom: 0.75rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 2.4em; }
        .product-specs { display: flex; gap: 0.75rem; flex-wrap: wrap; font-size: 0.7rem; color: var(--gray-500); margin-bottom: 0.75rem; }
        .product-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 0.75rem; border-top: 1px solid var(--gray-100); }
        .product-price { font-size: 1.25rem; font-weight: 700; color: var(--primary); }
        .product-price span { font-size: 0.75rem; font-weight: 500; color: var(--gray-400); }
        
        .cart-header { padding: 1.25rem; border-bottom: 1px solid var(--gray-200); }
        .cart-header h2 { font-size: 1.125rem; font-weight: 700; }
        .cart-steps { display: flex; margin-top: 1rem; }
        .cart-step { flex: 1; text-align: center; font-size: 0.7rem; font-weight: 600; color: var(--gray-400); }
        .cart-step.active { color: var(--primary); }
        .cart-step.completed { color: var(--success); }
        .cart-step-num { width: 24px; height: 24px; border-radius: 50%; background: var(--gray-200); display: flex; align-items: center; justify-content: center; margin: 0 auto 0.25rem; font-size: 0.75rem; }
        .cart-step.active .cart-step-num { background: var(--primary); color: white; }
        .cart-step.completed .cart-step-num { background: var(--success); color: white; }
        
        .cart-content { flex: 1; overflow-y: auto; padding: 1.25rem; }
        .cart-footer { padding: 1.25rem; border-top: 1px solid var(--gray-200); background: var(--gray-50); }
        
        .cart-empty { text-align: center; padding: 3rem 1rem; color: var(--gray-400); }
        .cart-empty-icon { font-size: 3rem; margin-bottom: 1rem; }
        
        .cart-item { display: flex; gap: 0.75rem; padding: 0.75rem; background: var(--gray-50); border-radius: 8px; margin-bottom: 0.75rem; }
        .cart-item-emoji { font-size: 1.5rem; }
        .cart-item-details { flex: 1; }
        .cart-item-name { font-weight: 600; font-size: 0.875rem; }
        .cart-item-price { font-size: 0.8rem; color: var(--gray-500); }
        .cart-item-remove { background: none; border: none; color: var(--gray-400); cursor: pointer; padding: 0.25rem; font-size: 1rem; }
        .cart-item-remove:hover { color: var(--danger); }
        
        .form-section { margin-bottom: 1.5rem; }
        .form-section-title { font-size: 0.8rem; font-weight: 600; color: var(--gray-500); text-transform: uppercase; margin-bottom: 0.75rem; }
        .form-group { margin-bottom: 1rem; }
        .form-label { display: block; font-size: 0.8rem; font-weight: 500; margin-bottom: 0.375rem; }
        .form-input, .form-select, .form-textarea { width: 100%; padding: 0.625rem 0.875rem; border: 1px solid var(--gray-300); border-radius: 8px; font-size: 0.875rem; transition: all 0.2s; font-family: inherit; }
        .form-input:focus, .form-select:focus, .form-textarea:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(249,115,22,0.1); }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
        .form-textarea { min-height: 70px; resize: vertical; }
        .form-hint { font-size: 0.7rem; margin-top: 0.25rem; }
        
        .summary-row { display: flex; justify-content: space-between; padding: 0.5rem 0; font-size: 0.875rem; }
        .summary-row.total { font-weight: 700; font-size: 1.125rem; border-top: 2px solid var(--gray-200); margin-top: 0.5rem; padding-top: 0.75rem; }
        
        .promo-input-group { display: flex; gap: 0.5rem; }
        .promo-input-group input { flex: 1; }
        .promo-message { font-size: 0.8rem; margin-top: 0.5rem; }
        .promo-message.success { color: var(--success); }
        .promo-message.error { color: var(--danger); }
        
        .booking-success { text-align: center; padding: 2rem; }
        .success-icon { font-size: 4rem; margin-bottom: 1rem; }
        .success-title { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem; color: var(--success); }
        .booking-number { background: var(--gray-100); padding: 1rem; border-radius: 8px; font-size: 1.25rem; font-weight: 700; margin: 1rem 0; }
        .booking-details { text-align: left; background: var(--gray-50); padding: 1rem; border-radius: 8px; margin: 1rem 0; font-size: 0.875rem; }
        .booking-details p { margin: 0.25rem 0; }
        
        .service-area-section { background: white; padding: 2rem; margin-top: 1rem; border-radius: 12px; }
        .service-map { height: 300px; border-radius: 8px; margin-bottom: 1rem; }
        .zone-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
        .zone-card { padding: 1rem; background: var(--gray-50); border-radius: 8px; border-left: 4px solid; }
        .zone-card h4 { font-size: 0.9rem; margin-bottom: 0.25rem; }
        .zone-card p { font-size: 0.75rem; color: var(--gray-500); }
        .zone-card .zone-fee { font-size: 1rem; font-weight: 700; color: var(--primary); margin-top: 0.5rem; }
        .zone-card .zone-fee.free { color: var(--success); }
        
        .footer { background: var(--gray-900); color: var(--gray-400); padding: 2rem; text-align: center; }
        .footer a { color: var(--gray-400); }
        .footer a:hover { color: white; }
        
        .loading-spinner { display: inline-block; width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Insurance Disclaimer Modal */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; opacity: 0; visibility: hidden; transition: all 0.3s; }
        .modal-overlay.open { opacity: 1; visibility: visible; }
        .modal-content { background: white; border-radius: 12px; max-width: 700px; width: 90%; max-height: 85vh; display: flex; flex-direction: column; transform: translateY(20px); transition: transform 0.3s; }
        .modal-overlay.open .modal-content { transform: translateY(0); }
        .modal-header { padding: 1.25rem; border-bottom: 1px solid var(--gray-200); display: flex; justify-content: space-between; align-items: center; }
        .modal-header h3 { font-size: 1.125rem; font-weight: 700; display: flex; align-items: center; gap: 0.5rem; }
        .modal-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--gray-400); padding: 0.25rem; line-height: 1; }
        .modal-close:hover { color: var(--gray-700); }
        .modal-body { flex: 1; overflow-y: auto; padding: 1.5rem; }
        .modal-footer { padding: 1.25rem; border-top: 1px solid var(--gray-200); background: var(--gray-50); }

        /* Disclaimer Document Styling */
        .disclaimer-document { background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: 8px; padding: 1.5rem; font-size: 0.875rem; line-height: 1.7; max-height: 400px; overflow-y: auto; }
        .disclaimer-document h4 { font-size: 1rem; font-weight: 700; margin-bottom: 1rem; color: var(--gray-800); }
        .disclaimer-document h5 { font-size: 0.9rem; font-weight: 600; margin-top: 1.25rem; margin-bottom: 0.5rem; color: var(--gray-700); }
        .disclaimer-document p { margin-bottom: 0.75rem; color: var(--gray-600); }
        .disclaimer-document ul { margin: 0.5rem 0 0.75rem 1.5rem; }
        .disclaimer-document li { margin-bottom: 0.375rem; color: var(--gray-600); }

        /* Checkbox and Signature Styling */
        .insurance-section { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 1px solid #f59e0b; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
        .insurance-section-title { font-size: 0.85rem; font-weight: 600; color: #92400e; display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
        .checkbox-group { display: flex; align-items: flex-start; gap: 0.75rem; margin-bottom: 1rem; }
        .checkbox-group input[type="checkbox"] { width: 18px; height: 18px; margin-top: 2px; accent-color: var(--primary); cursor: pointer; flex-shrink: 0; }
        .checkbox-group label { font-size: 0.85rem; color: var(--gray-700); cursor: pointer; line-height: 1.4; }
        .checkbox-group label a { color: var(--primary); text-decoration: underline; font-weight: 500; }
        .checkbox-group label a:hover { color: var(--primary-dark); }
        .signature-field { margin-top: 0.75rem; }
        .signature-field label { display: block; font-size: 0.8rem; font-weight: 500; margin-bottom: 0.375rem; color: var(--gray-700); }
        .signature-input { width: 100%; padding: 0.75rem 1rem; border: 2px dashed var(--gray-300); border-radius: 8px; font-size: 1.125rem; font-family: 'Brush Script MT', 'Segoe Script', cursive; text-align: center; background: white; transition: all 0.2s; }
        .signature-input:focus { outline: none; border-color: var(--primary); border-style: solid; background: #fff7ed; }
        .signature-input::placeholder { font-family: 'Inter', sans-serif; font-size: 0.875rem; color: var(--gray-400); }
        .signature-note { font-size: 0.7rem; color: var(--gray-500); margin-top: 0.375rem; text-align: center; }
        
        @media (max-width: 1024px) {
            .main-container { flex-direction: column; }
            .cart-section { width: 100%; height: auto; position: fixed; bottom: 0; left: 0; right: 0; max-height: 70vh; border-top: 1px solid var(--gray-200); z-index: 200; transform: translateY(calc(100% - 60px)); transition: transform 0.3s; }
            .cart-section.open { transform: translateY(0); }
            .cart-toggle { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; cursor: pointer; background: var(--primary); color: white; font-weight: 600; }
            .cart-toggle-count { background: white; color: var(--primary); padding: 0.125rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; }
            .catalog-section { padding-bottom: 100px; }
        }
        @media (min-width: 1025px) { .cart-toggle { display: none; } }
        @media (max-width: 640px) {
            .navbar { padding: 1rem; }
            .nav-links { display: none; }
            .hero h1 { font-size: 1.75rem; }
            .product-grid { grid-template-columns: 1fr; }
            .form-row { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="demo-badge">🎮 DEMO MODE - This is a preview of the customer booking experience <a href="/demoadmin/">Admin Panel →</a></div>
    
    <nav class="navbar">
        <div class="logo">🎪 <?= htmlspecialchars($businessName) ?></div>
        <div class="nav-links">
            <a href="#products">Rentals</a>
            <a href="#service-area">Service Area</a>
            <a href="tel:<?= preg_replace('/[^0-9]/', '', $phone) ?>">📞 <?= htmlspecialchars($phone) ?></a>
        </div>
    </nav>
    
    <header class="hero">
        <h1>🎈 Book Your Party Rentals</h1>
        <p>Select your items, pick a date, and book online!</p>
        <div class="hero-features">
            <div class="hero-feature">✓ Easy Online Booking</div>
            <div class="hero-feature">✓ Instant Confirmation</div>
            <div class="hero-feature">✓ Setup & Takedown Included</div>
        </div>
    </header>
    
    <div class="main-container">
        <div class="catalog-section" id="products">
            <?php foreach ($categories as $catKey => $catProducts): ?>
                <?php $catInfo = $catNames[$catKey] ?? ['name' => ucwords(str_replace('-', ' ', $catKey)), 'emoji' => '🎪', 'desc' => '']; ?>
                <div class="section-header">
                    <h2><?= $catInfo['emoji'] ?> <?= $catInfo['name'] ?></h2>
                    <?php if ($catInfo['desc']): ?><p><?= $catInfo['desc'] ?></p><?php endif; ?>
                </div>
                <div class="product-grid">
                    <?php foreach ($catProducts as $product): ?>
                        <div class="product-card" data-product-id="<?= $product['id'] ?>" onclick="toggleProduct('<?= $product['id'] ?>')">
                            <div class="product-image">
                                <?= $product['emoji'] ?? '🎪' ?>
                                <div class="selected-badge" style="display:none">✓</div>
                            </div>
                            <div class="product-body">
                                <h3 class="product-title"><?= htmlspecialchars($product['name']) ?></h3>
                                <p class="product-desc"><?= htmlspecialchars($product['description'] ?? '') ?></p>
                                <div class="product-specs">
                                    <?php if (!empty($product['dimensions'])): ?><span>📐 <?= htmlspecialchars($product['dimensions']) ?></span><?php endif; ?>
                                    <?php if (!empty($product['capacity'])): ?><span>👥 <?= htmlspecialchars($product['capacity']) ?></span><?php endif; ?>
                                </div>
                                <div class="product-footer">
                                    <div class="product-price">$<?= number_format($product['daily_rate'] ?? 0) ?><span>/day</span></div>
                                    <button class="btn btn-sm btn-primary add-btn">Add</button>
                                </div>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            <?php endforeach; ?>
            
            <div class="service-area-section" id="service-area">
                <div class="section-header">
                    <h2>🚚 Delivery Service Area</h2>
                    <p>We deliver throughout Kankakee County and surrounding areas</p>
                </div>
                <div id="serviceMap" class="service-map"></div>
                <div class="zone-list">
                    <?php foreach ($zones as $i => $zone): 
                        $colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];
                        $color = $zone['color'] ?? $colors[$i % count($colors)];
                    ?>
                    <div class="zone-card" style="border-color: <?= $color ?>">
                        <h4><?= htmlspecialchars($zone['name']) ?></h4>
                        <p><?= htmlspecialchars($zone['description'] ?? '') ?></p>
                        <div class="zone-fee <?= ($zone['delivery_fee'] ?? 0) == 0 ? 'free' : '' ?>">
                            <?= ($zone['delivery_fee'] ?? 0) == 0 ? '✓ FREE Delivery' : '$' . number_format($zone['delivery_fee'], 0) . ' Delivery' ?>
                        </div>
                    </div>
                    <?php endforeach; ?>
                </div>
            </div>
        </div>
        
        <div class="cart-section" id="cartSection">
            <div class="cart-toggle" onclick="toggleCart()">
                <span>🛒 Your Cart</span>
                <span class="cart-toggle-count" id="cartToggleCount">0</span>
            </div>
            
            <div class="cart-header">
                <h2>🛒 Your Booking</h2>
                <div class="cart-steps">
                    <div class="cart-step active" data-step="1"><div class="cart-step-num">1</div><span>Items</span></div>
                    <div class="cart-step" data-step="2"><div class="cart-step-num">2</div><span>Details</span></div>
                    <div class="cart-step" data-step="3"><div class="cart-step-num">3</div><span>Confirm</span></div>
                </div>
            </div>
            
            <div class="cart-content" id="cartContent">
                <!-- Step 1: Cart Items -->
                <div class="cart-step-content" data-step="1">
                    <div id="cartItems">
                        <div class="cart-empty">
                            <div class="cart-empty-icon">🛒</div>
                            <p>Your cart is empty</p>
                            <p style="font-size:0.8rem;margin-top:0.5rem;">Click items to add them</p>
                        </div>
                    </div>
                    <div class="form-section" id="dateSection" style="display:none;">
                        <div class="form-section-title">Event Date</div>
                        <div class="form-group">
                            <input type="date" class="form-input" id="eventDate" min="<?= date('Y-m-d', strtotime('+1 day')) ?>">
                            <div class="form-hint" id="dateAvailability"></div>
                        </div>
                    </div>
                </div>
                
                <!-- Step 2: Customer Details -->
                <div class="cart-step-content" data-step="2" style="display:none;">
                    <div class="form-section">
                        <div class="form-section-title">Your Information</div>
                        <div class="form-row">
                            <div class="form-group"><label class="form-label">First Name *</label><input type="text" class="form-input" id="firstName"></div>
                            <div class="form-group"><label class="form-label">Last Name *</label><input type="text" class="form-input" id="lastName"></div>
                        </div>
                        <div class="form-group"><label class="form-label">Email *</label><input type="email" class="form-input" id="email"></div>
                        <div class="form-group"><label class="form-label">Phone *</label><input type="tel" class="form-input" id="customerPhone" placeholder="(815) 555-0123"></div>
                    </div>
                    <div class="form-section">
                        <div class="form-section-title">Event Details</div>
                        <div class="form-group">
                            <label class="form-label">Event Type</label>
                            <select class="form-select" id="eventType">
                                <option value="birthday">🎂 Birthday Party</option>
                                <option value="church">⛪ Church Event</option>
                                <option value="school">🏫 School Event</option>
                                <option value="corporate">🏢 Corporate Event</option>
                                <option value="other">📅 Other</option>
                            </select>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Start Time</label>
                                <select class="form-select" id="startTime">
                                    <option value="08:00">8:00 AM</option>
                                    <option value="09:00">9:00 AM</option>
                                    <option value="10:00" selected>10:00 AM</option>
                                    <option value="11:00">11:00 AM</option>
                                    <option value="12:00">12:00 PM</option>
                                    <option value="13:00">1:00 PM</option>
                                    <option value="14:00">2:00 PM</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">End Time</label>
                                <select class="form-select" id="endTime">
                                    <option value="16:00">4:00 PM</option>
                                    <option value="17:00">5:00 PM</option>
                                    <option value="18:00" selected>6:00 PM</option>
                                    <option value="19:00">7:00 PM</option>
                                    <option value="20:00">8:00 PM</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="form-section">
                        <div class="form-section-title">Delivery Address</div>
                        <div class="form-group"><label class="form-label">Street Address *</label><input type="text" class="form-input" id="address" placeholder="123 Main St"></div>
                        <div class="form-row">
                            <div class="form-group"><label class="form-label">City *</label><input type="text" class="form-input" id="city" placeholder="Bradley"></div>
                            <div class="form-group"><label class="form-label">ZIP Code *</label><input type="text" class="form-input" id="zip" placeholder="60915" maxlength="5" onblur="checkDeliveryZone()"></div>
                        </div>
                        <div id="deliveryZoneInfo" class="form-hint"></div>
                        <div class="form-group"><label class="form-label">Delivery Notes</label><textarea class="form-textarea" id="deliveryNotes" placeholder="Gate code, setup location, etc."></textarea></div>
                    </div>
                </div>
                
                <!-- Step 3: Review & Confirm -->
                <div class="cart-step-content" data-step="3" style="display:none;">
                    <div class="form-section">
                        <div class="form-section-title">Order Summary</div>
                        <div id="orderSummaryItems"></div>
                    </div>
                    <div class="form-section">
                        <div class="form-section-title">Promo Code</div>
                        <div class="promo-input-group">
                            <input type="text" class="form-input" id="promoCode" placeholder="Enter code" style="text-transform:uppercase">
                            <button class="btn btn-secondary" onclick="applyPromo()">Apply</button>
                        </div>
                        <div id="promoMessage" class="promo-message"></div>
                    </div>
                    <div id="pricingSummary"></div>

                    <!-- Insurance Disclaimer Agreement -->
                    <div class="insurance-section">
                        <div class="insurance-section-title">🛡️ Insurance & Liability Waiver</div>
                        <div class="checkbox-group">
                            <input type="checkbox" id="insuranceAgree">
                            <label for="insuranceAgree">I have read and agree to the <a href="#" onclick="openInsuranceModal(); return false;">Insurance & Liability Waiver</a>. I understand and accept the terms, conditions, and risks associated with renting inflatable equipment.</label>
                        </div>
                        <div class="signature-field">
                            <label>Sign Your Full Name *</label>
                            <input type="text" class="signature-input" id="waiverSignature" placeholder="Type your full legal name">
                            <div class="signature-note">By typing your name above, you are electronically signing this agreement</div>
                        </div>
                    </div>
                </div>
                
                <!-- Success -->
                <div class="cart-step-content" data-step="success" style="display:none;">
                    <div class="booking-success">
                        <div class="success-icon">🎉</div>
                        <div class="success-title">Booking Confirmed!</div>
                        <p style="color:var(--gray-500)">We've received your booking request</p>
                        <div class="booking-number" id="bookingNumber">BK-2024-XXX</div>
                        <div class="booking-details" id="bookingDetails"></div>
                        <p style="font-size:0.85rem;color:var(--gray-500);margin-bottom:1rem;">We'll contact you shortly to confirm and collect the deposit.</p>
                        <button class="btn btn-primary" onclick="startNewBooking()">Book Another Event</button>
                    </div>
                </div>
            </div>
            
            <div class="cart-footer" id="cartFooter">
                <div id="cartSummary"></div>
                <button class="btn btn-primary btn-lg" style="width:100%;margin-top:1rem;" id="cartActionBtn" onclick="cartAction()" disabled>Select Items to Continue</button>
            </div>
        </div>
    </div>
    
    <!-- Insurance Disclaimer Modal -->
    <div class="modal-overlay" id="insuranceModal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>🛡️ Insurance & Liability Waiver</h3>
                <button class="modal-close" onclick="closeInsuranceModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="disclaimer-document">
                    <h4>RENTAL AGREEMENT, LIABILITY WAIVER & INSURANCE DISCLAIMER</h4>

                    <h5>1. ASSUMPTION OF RISK</h5>
                    <p>I understand that the use of inflatable equipment, including but not limited to bounce houses, water slides, obstacle courses, and related equipment (collectively, "Equipment"), involves inherent risks. These risks include, but are not limited to: falls, collisions with other participants, equipment malfunction, and physical injury. I voluntarily assume all such risks, both known and unknown.</p>

                    <h5>2. RELEASE OF LIABILITY</h5>
                    <p>In consideration of being permitted to rent and use the Equipment, I hereby RELEASE, WAIVE, DISCHARGE AND COVENANT NOT TO SUE <?= htmlspecialchars($businessName) ?>, its owners, officers, employees, agents, and representatives (collectively, "Released Parties") from any and all liability, claims, demands, actions, or causes of action arising out of or related to any loss, damage, or injury, including death, that may be sustained by me or any participant, or to any property belonging to me, while participating in rental activities, or while on or upon the premises where the activities are being conducted.</p>

                    <h5>3. INDEMNIFICATION</h5>
                    <p>I agree to INDEMNIFY AND HOLD HARMLESS the Released Parties from any loss, liability, damage, or costs, including court costs and attorney fees, that may be incurred due to my participation in the activities, whether caused by the negligence of the Released Parties or otherwise.</p>

                    <h5>4. INSURANCE ACKNOWLEDGMENT</h5>
                    <p>I understand and acknowledge that:</p>
                    <ul>
                        <li><?= htmlspecialchars($businessName) ?> carries general liability insurance for its rental operations</li>
                        <li>This insurance does NOT cover injuries sustained by renters or their guests during equipment use</li>
                        <li>I am responsible for ensuring adequate supervision of all users of the Equipment</li>
                        <li>I am encouraged to obtain personal liability insurance coverage for my event</li>
                    </ul>

                    <h5>5. SAFETY RULES & GUIDELINES</h5>
                    <p>I agree to follow all safety rules and guidelines provided by <?= htmlspecialchars($businessName) ?>, including:</p>
                    <ul>
                        <li>Maintaining adult supervision at all times while Equipment is in use</li>
                        <li>Ensuring users remove shoes, eyeglasses, jewelry, and sharp objects before use</li>
                        <li>Not allowing users to exceed the recommended capacity or age limits</li>
                        <li>Not allowing flips, roughhousing, or climbing on exterior walls</li>
                        <li>Keeping Equipment properly staked/anchored at all times</li>
                        <li>Turning off Equipment in case of high winds (15+ mph) or inclement weather</li>
                    </ul>

                    <h5>6. MEDICAL AUTHORIZATION</h5>
                    <p>I authorize <?= htmlspecialchars($businessName) ?> to seek emergency medical treatment for any participant if I am unable to be reached and consent to such treatment is required.</p>

                    <h5>7. GOVERNING LAW</h5>
                    <p>This agreement shall be governed by and construed in accordance with the laws of the State of Illinois. Any disputes arising under this agreement shall be resolved in the courts of Kankakee County, Illinois.</p>

                    <p style="margin-top: 1.5rem; font-weight: 600; color: var(--gray-800);">By signing below, I acknowledge that I have read this agreement, fully understand its terms, understand that I am giving up substantial rights, and have signed it freely and voluntarily without any inducement.</p>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" style="width:100%;" onclick="closeInsuranceModal()">I Have Read This Document</button>
            </div>
        </div>
    </div>

    <footer class="footer">
        <p>© <?= date('Y') ?> <?= htmlspecialchars($businessName) ?> · <a href="tel:<?= preg_replace('/[^0-9]/', '', $phone) ?>"><?= htmlspecialchars($phone) ?></a></p>
        <p style="margin-top:0.5rem;"><a href="/demoadmin/">Admin Panel</a> · <a href="/">BouncePlatform</a></p>
    </footer>
    
    <script>
    const products = <?= json_encode(array_values($products)) ?>;
    const zones = <?= json_encode($zones) ?>;
    const taxRate = <?= $taxRate ?>;
    const depositPercent = <?= $depositPercent ?>;
    const baseLocation = <?= json_encode($baseLocation) ?>;
    
    let cart = [];
    let currentStep = 1;
    let deliveryFee = 0;
    let deliveryZone = null;
    let discount = { amount: 0, code: null, type: null };
    
    function toggleProduct(productId) {
        const idx = cart.findIndex(i => i.product_id === productId);
        if (idx > -1) {
            cart.splice(idx, 1);
        } else {
            const product = products.find(p => p.id === productId);
            if (product) {
                cart.push({ product_id: product.id, product_name: product.name, emoji: product.emoji || '🎪', unit_price: product.daily_rate, quantity: 1, subtotal: product.daily_rate });
            }
        }
        updateCart();
    }
    
    function updateCart() {
        document.querySelectorAll('.product-card').forEach(card => {
            const id = card.dataset.productId;
            const inCart = cart.some(i => i.product_id === id);
            card.classList.toggle('selected', inCart);
            card.querySelector('.selected-badge').style.display = inCart ? 'flex' : 'none';
            card.querySelector('.add-btn').textContent = inCart ? 'Remove' : 'Add';
        });
        
        const cartItemsEl = document.getElementById('cartItems');
        document.getElementById('cartToggleCount').textContent = cart.length;
        
        if (cart.length === 0) {
            cartItemsEl.innerHTML = '<div class="cart-empty"><div class="cart-empty-icon">🛒</div><p>Your cart is empty</p><p style="font-size:0.8rem;margin-top:0.5rem;">Click items to add them</p></div>';
            document.getElementById('dateSection').style.display = 'none';
        } else {
            cartItemsEl.innerHTML = cart.map(item => `
                <div class="cart-item">
                    <div class="cart-item-emoji">${item.emoji}</div>
                    <div class="cart-item-details"><div class="cart-item-name">${item.product_name}</div><div class="cart-item-price">$${item.unit_price}/day</div></div>
                    <button class="cart-item-remove" onclick="event.stopPropagation(); toggleProduct('${item.product_id}')">✕</button>
                </div>
            `).join('');
            document.getElementById('dateSection').style.display = 'block';
        }
        updateSummary();
        updateActionButton();
    }
    
    function updateSummary() {
        const subtotal = cart.reduce((sum, i) => sum + i.subtotal, 0);
        const discountAmt = discount.type === 'percent' ? subtotal * (discount.amount / 100) : discount.amount;
        const taxable = subtotal + deliveryFee - discountAmt;
        const tax = taxable * taxRate;
        const total = taxable + tax;
        const depositAmt = total * (depositPercent / 100);
        
        let html = `<div class="summary-row"><span>Subtotal</span><span>$${subtotal.toFixed(2)}</span></div>`;
        if (deliveryZone !== null) {
            html += `<div class="summary-row"><span>Delivery</span><span style="color:${deliveryFee === 0 ? 'var(--success)' : ''}">${deliveryFee === 0 ? 'FREE' : '$' + deliveryFee.toFixed(2)}</span></div>`;
        }
        if (discountAmt > 0) {
            html += `<div class="summary-row" style="color:var(--success)"><span>Discount (${discount.code})</span><span>-$${discountAmt.toFixed(2)}</span></div>`;
        }
        html += `<div class="summary-row"><span>Tax</span><span>$${tax.toFixed(2)}</span></div>`;
        html += `<div class="summary-row total"><span>Total</span><span>$${total.toFixed(2)}</span></div>`;
        html += `<div class="summary-row" style="font-size:0.8rem;color:var(--gray-500)"><span>Deposit due</span><span>$${depositAmt.toFixed(2)}</span></div>`;
        
        document.getElementById('cartSummary').innerHTML = html;
        if (currentStep === 3) {
            document.getElementById('orderSummaryItems').innerHTML = cart.map(item => `<div class="cart-item"><div class="cart-item-emoji">${item.emoji}</div><div class="cart-item-details"><div class="cart-item-name">${item.product_name}</div><div class="cart-item-price">$${item.unit_price}</div></div></div>`).join('');
            document.getElementById('pricingSummary').innerHTML = html;
        }
    }
    
    function updateActionButton() {
        const btn = document.getElementById('cartActionBtn');
        const eventDate = document.getElementById('eventDate').value;
        if (currentStep === 1) {
            if (cart.length === 0) { btn.disabled = true; btn.textContent = 'Select Items to Continue'; }
            else if (!eventDate) { btn.disabled = true; btn.textContent = 'Select Event Date'; }
            else { btn.disabled = false; btn.textContent = 'Continue to Details →'; }
        } else if (currentStep === 2) { btn.disabled = false; btn.textContent = 'Review Booking →'; }
        else if (currentStep === 3) { btn.disabled = false; btn.textContent = 'Confirm Booking'; }
    }
    
    function cartAction() {
        if (currentStep === 1 && cart.length > 0 && document.getElementById('eventDate').value) goToStep(2);
        else if (currentStep === 2 && validateStep2()) goToStep(3);
        else if (currentStep === 3 && validateWaiver()) submitBooking();
    }
    
    function goToStep(step) {
        currentStep = step;
        document.querySelectorAll('.cart-step').forEach(s => {
            const n = parseInt(s.dataset.step);
            s.classList.toggle('active', n === step);
            s.classList.toggle('completed', n < step);
        });
        document.querySelectorAll('.cart-step-content').forEach(c => { c.style.display = c.dataset.step == step ? 'block' : 'none'; });
        updateSummary();
        updateActionButton();
        document.getElementById('cartContent').scrollTop = 0;
    }
    
    function validateStep2() {
        const fields = ['firstName', 'lastName', 'email', 'customerPhone', 'address', 'city', 'zip'];
        let valid = true;
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (!el.value.trim()) { el.style.borderColor = 'var(--danger)'; valid = false; }
            else { el.style.borderColor = ''; }
        });
        if (!valid) alert('Please fill in all required fields');
        return valid;
    }
    
    function checkDeliveryZone() {
        const zip = document.getElementById('zip').value.trim();
        if (zip.length !== 5) return;
        fetch(`api.php?action=zones&zip=${zip}`)
            .then(r => r.json())
            .then(data => {
                const el = document.getElementById('deliveryZoneInfo');
                if (data.available) {
                    deliveryFee = data.fee;
                    deliveryZone = data.zone;
                    el.innerHTML = data.fee === 0 ? `<span style="color:var(--success)">✓ ${data.zone} - FREE Delivery!</span>` : `<span style="color:var(--primary)">📍 ${data.zone} - $${data.fee} Delivery</span>`;
                } else {
                    deliveryFee = 0;
                    deliveryZone = 'Outside Service Area';
                    el.innerHTML = '<span style="color:var(--warning)">⚠️ Outside service area - call to confirm</span>';
                }
                updateSummary();
            });
    }
    
    document.getElementById('eventDate').addEventListener('change', function() {
        fetch(`api.php?action=availability&date=${this.value}`)
            .then(r => r.json())
            .then(data => {
                const el = document.getElementById('dateAvailability');
                const unavail = data.products.filter(p => cart.some(c => c.product_id === p.product_id) && p.available <= 0);
                if (unavail.length > 0) { el.innerHTML = `<span style="color:var(--danger)">⚠️ ${unavail.map(p => p.name).join(', ')} unavailable</span>`; }
                else { el.innerHTML = '<span style="color:var(--success)">✓ All items available</span>'; }
                updateActionButton();
            });
    });
    
    function applyPromo() {
        const code = document.getElementById('promoCode').value.trim().toUpperCase();
        if (!code) return;
        fetch(`api.php?action=promos&code=${code}`)
            .then(r => r.json())
            .then(data => {
                const el = document.getElementById('promoMessage');
                if (data.error) { el.className = 'promo-message error'; el.textContent = '✕ ' + data.error; discount = { amount: 0, code: null, type: null }; }
                else { el.className = 'promo-message success'; el.textContent = `✓ ${data.discount_type === 'percent' ? data.discount_value + '% off' : '$' + data.discount_value + ' off'} applied!`; discount = { amount: data.discount_value, code: data.code, type: data.discount_type }; }
                updateSummary();
            });
    }
    
    async function submitBooking() {
        const btn = document.getElementById('cartActionBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="loading-spinner"></span> Processing...';
        try {
            const customerRes = await fetch('api.php?action=customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ first_name: document.getElementById('firstName').value, last_name: document.getElementById('lastName').value, email: document.getElementById('email').value, phone: document.getElementById('customerPhone').value, address: document.getElementById('address').value, city: document.getElementById('city').value, state: 'IL', zip: document.getElementById('zip').value, source: 'website' })
            });
            const customer = await customerRes.json();
            
            const subtotal = cart.reduce((s, i) => s + i.subtotal, 0);
            const discountAmt = discount.type === 'percent' ? subtotal * (discount.amount / 100) : discount.amount;
            
            const bookingRes = await fetch('api.php?action=bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customer_id: customer.id,
                    event_date: document.getElementById('eventDate').value,
                    event_start: document.getElementById('startTime').value,
                    event_end: document.getElementById('endTime').value,
                    event_type: document.getElementById('eventType').value,
                    delivery_address: `${document.getElementById('address').value}, ${document.getElementById('city').value}, IL ${document.getElementById('zip').value}`,
                    delivery_zip: document.getElementById('zip').value,
                    delivery_notes: document.getElementById('deliveryNotes').value,
                    delivery_fee: deliveryFee,
                    items: cart,
                    discount_amount: discountAmt,
                    promo_code: discount.code,
                    source: 'website',
                    waiver_status: 'signed',
                    waiver_signed_at: new Date().toISOString(),
                    waiver_signer_name: document.getElementById('waiverSignature').value.trim()
                })
            });
            const booking = await bookingRes.json();
            if (booking.error) throw new Error(booking.error);
            
            document.getElementById('bookingNumber').textContent = booking.booking_number;
            const dateObj = new Date(booking.event_date + 'T12:00:00');
            document.getElementById('bookingDetails').innerHTML = `<p><strong>Date:</strong> ${dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p><p><strong>Time:</strong> ${formatTime(booking.event_start)} - ${formatTime(booking.event_end)}</p><p><strong>Items:</strong> ${cart.map(i => i.product_name).join(', ')}</p><p><strong>Total:</strong> $${booking.total.toFixed(2)}</p><p><strong>Deposit Due:</strong> $${booking.deposit_required.toFixed(2)}</p>`;
            
            document.querySelectorAll('.cart-step-content').forEach(c => c.style.display = 'none');
            document.querySelector('.cart-step-content[data-step="success"]').style.display = 'block';
            document.getElementById('cartFooter').style.display = 'none';
        } catch (err) { alert('Error: ' + err.message); btn.disabled = false; btn.textContent = 'Confirm Booking'; }
    }
    
    function formatTime(t) { const [h, m] = t.split(':'); const hour = parseInt(h); return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`; }
    
    function startNewBooking() {
        cart = []; currentStep = 1; deliveryFee = 0; deliveryZone = null; discount = { amount: 0, code: null, type: null };
        document.querySelectorAll('.form-input, .form-textarea').forEach(el => el.value = '');
        document.getElementById('eventType').value = 'birthday';
        document.getElementById('startTime').value = '10:00';
        document.getElementById('endTime').value = '18:00';
        document.getElementById('deliveryZoneInfo').innerHTML = '';
        document.getElementById('promoMessage').innerHTML = '';
        document.getElementById('insuranceAgree').checked = false;
        document.getElementById('waiverSignature').value = '';
        document.querySelectorAll('.cart-step').forEach(s => { s.classList.toggle('active', s.dataset.step === '1'); s.classList.remove('completed'); });
        document.querySelectorAll('.cart-step-content').forEach(c => { c.style.display = c.dataset.step === '1' ? 'block' : 'none'; });
        document.getElementById('cartFooter').style.display = 'block';
        updateCart();
    }
    
    function toggleCart() { document.getElementById('cartSection').classList.toggle('open'); }

    // Insurance Modal Functions
    function openInsuranceModal() {
        document.getElementById('insuranceModal').classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeInsuranceModal() {
        document.getElementById('insuranceModal').classList.remove('open');
        document.body.style.overflow = '';
    }

    // Close modal on backdrop click
    document.getElementById('insuranceModal').addEventListener('click', function(e) {
        if (e.target === this) closeInsuranceModal();
    });

    // Close modal on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeInsuranceModal();
    });

    // Validate insurance waiver agreement
    function validateWaiver() {
        const checkbox = document.getElementById('insuranceAgree');
        const signature = document.getElementById('waiverSignature').value.trim();

        if (!checkbox.checked) {
            alert('Please read and agree to the Insurance & Liability Waiver before continuing.');
            checkbox.focus();
            return false;
        }

        if (!signature) {
            alert('Please sign your full name to accept the Insurance & Liability Waiver.');
            document.getElementById('waiverSignature').focus();
            return false;
        }

        if (signature.length < 3) {
            alert('Please enter your full legal name as your signature.');
            document.getElementById('waiverSignature').focus();
            return false;
        }

        return true;
    }

    document.addEventListener('DOMContentLoaded', function() {
        const map = L.map('serviceMap').setView([baseLocation.lat, baseLocation.lng], 10);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
        L.marker([baseLocation.lat, baseLocation.lng], { icon: L.divIcon({ html: '<div style="font-size:24px;">🏠</div>', iconSize: [24, 24], iconAnchor: [12, 12] }) }).addTo(map);
        const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];
        const layers = [];
        zones.forEach((zone, i) => {
            if (zone.polygon && zone.polygon.length > 0) {
                const color = zone.color || colors[i % colors.length];
                const polygon = L.polygon(zone.polygon, { color: color, fillColor: color, fillOpacity: 0.15, weight: 2 }).addTo(map);
                polygon.bindPopup(`<b>${zone.name}</b><br>${zone.delivery_fee === 0 ? 'FREE Delivery' : '$' + zone.delivery_fee + ' Delivery'}`);
                layers.push(polygon);
            }
        });
        if (layers.length > 0) map.fitBounds(L.featureGroup(layers).getBounds().pad(0.1));
        updateCart();
    });
    </script>
</body>
</html>