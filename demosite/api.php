<?php
/**
 * BouncePlatform API
 * Usage: api.php?action=ACTION&id=ID
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

class JsonDB {
    private static $file = __DIR__ . '/data.json';
    private static $data = null;
    
    public static function load() {
        if (self::$data === null) {
            if (!file_exists(self::$file)) {
                self::$data = ['products'=>[],'customers'=>[],'bookings'=>[],'payments'=>[],'promos'=>[],'zones'=>[],'staff'=>[],'settings'=>[],'_meta'=>[]];
            } else {
                self::$data = json_decode(file_get_contents(self::$file), true);
            }
        }
        return self::$data;
    }
    
    public static function save() {
        $backupDir = __DIR__ . '/backups';
        if (!is_dir($backupDir)) @mkdir($backupDir, 0755, true);
        if (file_exists(self::$file)) {
            @copy(self::$file, $backupDir . '/data_' . date('Y-m-d_His') . '.json');
            $backups = glob($backupDir . '/data_*.json');
            if (count($backups) > 10) {
                usort($backups, fn($a, $b) => filemtime($a) - filemtime($b));
                array_map('unlink', array_slice($backups, 0, count($backups) - 10));
            }
        }
        self::$data['_meta']['updated_at'] = date('c');
        file_put_contents(self::$file, json_encode(self::$data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
    }
    
    public static function get($col) { $d = self::load(); return $d[$col] ?? []; }
    public static function set($col, $items) { self::load(); self::$data[$col] = $items; self::save(); }
    
    public static function find($col, $id) {
        foreach (self::get($col) as $item) { if (($item['id'] ?? null) === $id) return $item; }
        return null;
    }
    
    public static function insert($col, $item) {
        self::load();
        $item['id'] = $item['id'] ?? substr($col,0,4) . '_' . bin2hex(random_bytes(4));
        $item['created_at'] = $item['created_at'] ?? date('c');
        $item['updated_at'] = date('c');
        self::$data[$col][] = $item;
        self::save();
        return $item;
    }
    
    public static function update($col, $id, $updates) {
        self::load();
        foreach (self::$data[$col] as &$item) {
            if (($item['id'] ?? null) === $id) {
                $item = array_merge($item, $updates, ['id' => $id, 'updated_at' => date('c')]);
                self::save();
                return $item;
            }
        }
        return null;
    }
    
    public static function delete($col, $id) {
        self::load();
        $before = count(self::$data[$col]);
        self::$data[$col] = array_values(array_filter(self::$data[$col], fn($i) => ($i['id'] ?? null) !== $id));
        if (count(self::$data[$col]) < $before) { self::save(); return true; }
        return false;
    }
    
    public static function meta($key = null, $val = null) {
        self::load();
        if ($val !== null) { self::$data['_meta'][$key] = $val; self::save(); }
        return $key ? (self::$data['_meta'][$key] ?? null) : self::$data['_meta'];
    }
}

function respond($data, $code = 200) { http_response_code($code); echo json_encode($data); exit; }
function error($msg, $code = 400) { respond(['error' => $msg, 'success' => false], $code); }

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$id = $_GET['id'] ?? null;
$input = json_decode(file_get_contents('php://input'), true) ?? [];

switch ($action) {
    
    case 'dashboard':
        $today = date('Y-m-d');
        $weekEnd = date('Y-m-d', strtotime('+7 days'));
        $monthStart = date('Y-m-01');
        
        $bookings = JsonDB::get('bookings');
        $payments = JsonDB::get('payments');
        $customers = JsonDB::get('customers');
        
        $todayBookings = array_filter($bookings, fn($b) => $b['event_date'] === $today && $b['status'] !== 'cancelled');
        $upcoming = array_filter($bookings, fn($b) => $b['event_date'] > $today && $b['event_date'] <= $weekEnd && $b['status'] !== 'cancelled');
        $pendingWaivers = array_filter($bookings, fn($b) => ($b['waiver_status'] ?? 'pending') === 'pending' && $b['status'] !== 'cancelled' && $b['event_date'] >= $today);
        $outstanding = array_filter($bookings, fn($b) => ($b['balance_due'] ?? 0) > 0 && $b['status'] !== 'cancelled');
        $monthPayments = array_filter($payments, fn($p) => substr($p['created_at'], 0, 10) >= $monthStart);
        
        $customerMap = []; foreach ($customers as $c) $customerMap[$c['id']] = $c;
        $enrich = fn($list) => array_values(array_map(fn($b) => array_merge($b, ['customer' => $customerMap[$b['customer_id']] ?? null]), $list));
        
        respond([
            'today' => $enrich($todayBookings),
            'upcoming' => $enrich($upcoming),
            'stats' => [
                'today_count' => count($todayBookings),
                'upcoming_count' => count($upcoming),
                'pending_waivers' => count($pendingWaivers),
                'outstanding_balance' => array_sum(array_column($outstanding, 'balance_due')),
                'outstanding_count' => count($outstanding),
                'month_revenue' => array_sum(array_column($monthPayments, 'amount')),
                'total_customers' => count($customers),
                'total_bookings' => count($bookings)
            ]
        ]);
        break;
    
    case 'products':
        switch ($method) {
            case 'GET':
                if ($id) { $p = JsonDB::find('products', $id); $p ? respond($p) : error('Not found', 404); }
                $products = JsonDB::get('products');
                if (!empty($_GET['category']) && $_GET['category'] !== 'all') 
                    $products = array_filter($products, fn($p) => $p['category'] === $_GET['category']);
                if (!empty($_GET['status'])) 
                    $products = array_filter($products, fn($p) => $p['status'] === $_GET['status']);
                if (!empty($_GET['search'])) {
                    $q = strtolower($_GET['search']);
                    $products = array_filter($products, fn($p) => strpos(strtolower($p['name']), $q) !== false);
                }
                usort($products, fn($a, $b) => ($a['sort_order'] ?? 99) - ($b['sort_order'] ?? 99));
                respond(array_values($products));
                break;
            case 'POST':
                if (empty($input['name'])) error('Name required');
                respond(JsonDB::insert('products', [
                    'name' => $input['name'],
                    'category' => $input['category'] ?? 'bounce-house',
                    'description' => $input['description'] ?? '',
                    'daily_rate' => floatval($input['daily_rate'] ?? 0),
                    'weekend_rate' => floatval($input['weekend_rate'] ?? $input['daily_rate'] ?? 0),
                    'deposit_amount' => floatval($input['deposit_amount'] ?? 0),
                    'dimensions' => $input['dimensions'] ?? '',
                    'capacity' => $input['capacity'] ?? '',
                    'age_range' => $input['age_range'] ?? '',
                    'emoji' => $input['emoji'] ?? '🎪',
                    'quantity' => intval($input['quantity'] ?? 1),
                    'status' => $input['status'] ?? 'active',
                    'featured' => $input['featured'] ?? false,
                    'sort_order' => intval($input['sort_order'] ?? 99),
                    'notes' => $input['notes'] ?? ''
                ]), 201);
                break;
            case 'PUT':
                if (!$id) error('ID required');
                $p = JsonDB::update('products', $id, $input);
                $p ? respond($p) : error('Not found', 404);
                break;
            case 'DELETE':
                if (!$id) error('ID required');
                JsonDB::delete('products', $id) ? respond(['success' => true]) : error('Not found', 404);
                break;
        }
        break;
    
    case 'customers':
        switch ($method) {
            case 'GET':
                if ($id) {
                    $c = JsonDB::find('customers', $id);
                    if ($c) {
                        $c['bookings'] = array_values(array_filter(JsonDB::get('bookings'), fn($b) => $b['customer_id'] === $id));
                        respond($c);
                    }
                    error('Not found', 404);
                }
                $customers = JsonDB::get('customers');
                if (!empty($_GET['search'])) {
                    $q = strtolower($_GET['search']);
                    $customers = array_filter($customers, fn($c) => 
                        strpos(strtolower($c['first_name'] . ' ' . $c['last_name']), $q) !== false ||
                        strpos(strtolower($c['email'] ?? ''), $q) !== false ||
                        strpos($c['phone'] ?? '', $q) !== false
                    );
                }
                respond(array_values($customers));
                break;
            case 'POST':
                if (empty($input['first_name']) || empty($input['last_name'])) error('Name required');
                respond(JsonDB::insert('customers', [
                    'first_name' => $input['first_name'],
                    'last_name' => $input['last_name'],
                    'email' => $input['email'] ?? '',
                    'phone' => preg_replace('/[^0-9]/', '', $input['phone'] ?? ''),
                    'address' => $input['address'] ?? '',
                    'city' => $input['city'] ?? '',
                    'state' => $input['state'] ?? 'IL',
                    'zip' => $input['zip'] ?? '',
                    'source' => $input['source'] ?? 'website',
                    'notes' => $input['notes'] ?? ''
                ]), 201);
                break;
            case 'PUT':
                if (!$id) error('ID required');
                $c = JsonDB::update('customers', $id, $input);
                $c ? respond($c) : error('Not found', 404);
                break;
            case 'DELETE':
                if (!$id) error('ID required');
                if (!empty(array_filter(JsonDB::get('bookings'), fn($b) => $b['customer_id'] === $id))) 
                    error('Has bookings');
                JsonDB::delete('customers', $id) ? respond(['success' => true]) : error('Not found', 404);
                break;
        }
        break;
    
    case 'bookings':
        switch ($method) {
            case 'GET':
                if ($id) {
                    $b = JsonDB::find('bookings', $id);
                    if ($b) {
                        $b['customer'] = JsonDB::find('customers', $b['customer_id']);
                        $b['payments'] = array_values(array_filter(JsonDB::get('payments'), fn($p) => $p['booking_id'] === $id));
                        respond($b);
                    }
                    error('Not found', 404);
                }
                $bookings = JsonDB::get('bookings');
                $customers = JsonDB::get('customers');
                $cmap = []; foreach ($customers as $c) $cmap[$c['id']] = $c;
                foreach ($bookings as &$b) $b['customer'] = $cmap[$b['customer_id']] ?? null;
                
                if (!empty($_GET['status']) && $_GET['status'] !== 'all')
                    $bookings = array_filter($bookings, fn($b) => $b['status'] === $_GET['status']);
                if (!empty($_GET['from']))
                    $bookings = array_filter($bookings, fn($b) => $b['event_date'] >= $_GET['from']);
                if (!empty($_GET['to']))
                    $bookings = array_filter($bookings, fn($b) => $b['event_date'] <= $_GET['to']);
                if (!empty($_GET['search'])) {
                    $q = strtolower($_GET['search']);
                    $bookings = array_filter($bookings, fn($b) => 
                        strpos(strtolower($b['booking_number'] ?? ''), $q) !== false ||
                        strpos(strtolower(($b['customer']['first_name'] ?? '') . ' ' . ($b['customer']['last_name'] ?? '')), $q) !== false
                    );
                }
                usort($bookings, fn($a, $b) => strcmp($b['event_date'], $a['event_date']));
                respond(array_values($bookings));
                break;
                
            case 'POST':
                if (empty($input['customer_id']) || empty($input['items']) || empty($input['event_date'])) 
                    error('Customer, items, and date required');
                
                $meta = JsonDB::meta();
                $taxRate = $meta['tax_rate'] ?? 0.0625;
                $subtotal = array_sum(array_map(fn($i) => floatval($i['unit_price'] ?? 0) * intval($i['quantity'] ?? 1), $input['items']));
                $deliveryFee = floatval($input['delivery_fee'] ?? 0);
                $discount = floatval($input['discount_amount'] ?? 0);
                $taxable = $subtotal + $deliveryFee - $discount;
                $tax = round($taxable * $taxRate, 2);
                $total = $taxable + $tax;
                
                $year = date('Y');
                $num = count(array_filter(JsonDB::get('bookings'), fn($b) => strpos($b['booking_number'] ?? '', "BK-$year") === 0)) + 1;
                $bookingNumber = "BK-$year-" . str_pad($num, 3, '0', STR_PAD_LEFT);
                $depositRequired = round($total * (($meta['deposit_percent'] ?? 25) / 100), 2);
                
                respond(JsonDB::insert('bookings', [
                    'booking_number' => $bookingNumber,
                    'customer_id' => $input['customer_id'],
                    'status' => 'pending',
                    'event_date' => $input['event_date'],
                    'event_start' => $input['event_start'] ?? '10:00',
                    'event_end' => $input['event_end'] ?? '18:00',
                    'event_type' => $input['event_type'] ?? 'birthday',
                    'event_name' => $input['event_name'] ?? '',
                    'delivery_address' => $input['delivery_address'] ?? '',
                    'delivery_notes' => $input['delivery_notes'] ?? '',
                    'items' => $input['items'],
                    'subtotal' => $subtotal,
                    'delivery_fee' => $deliveryFee,
                    'tax' => $tax,
                    'discount_amount' => $discount,
                    'total' => $total,
                    'deposit_required' => $depositRequired,
                    'amount_paid' => 0,
                    'balance_due' => $total,
                    'payment_status' => 'pending',
                    'waiver_status' => 'pending',
                    'internal_notes' => $input['internal_notes'] ?? '',
                    'source' => $input['source'] ?? 'website'
                ]), 201);
                break;
                
            case 'PUT':
                if (!$id) error('ID required');
                $b = JsonDB::update('bookings', $id, $input);
                $b ? respond($b) : error('Not found', 404);
                break;
                
            case 'DELETE':
                if (!$id) error('ID required');
                $b = JsonDB::update('bookings', $id, ['status' => 'cancelled']);
                $b ? respond($b) : error('Not found', 404);
                break;
        }
        break;
    
    case 'payments':
        switch ($method) {
            case 'GET':
                $payments = JsonDB::get('payments');
                if (!empty($_GET['booking_id']))
                    $payments = array_filter($payments, fn($p) => $p['booking_id'] === $_GET['booking_id']);
                usort($payments, fn($a, $b) => strcmp($b['created_at'], $a['created_at']));
                respond(array_values($payments));
                break;
                
            case 'POST':
                if (empty($input['booking_id']) || empty($input['amount'])) error('Booking and amount required');
                
                $booking = JsonDB::find('bookings', $input['booking_id']);
                if (!$booking) error('Booking not found', 404);
                
                $amount = floatval($input['amount']);
                $payment = JsonDB::insert('payments', [
                    'booking_id' => $input['booking_id'],
                    'amount' => $amount,
                    'method' => $input['method'] ?? 'card',
                    'type' => $input['type'] ?? 'payment',
                    'reference' => $input['reference'] ?? '',
                    'notes' => $input['notes'] ?? ''
                ]);
                
                $newPaid = ($booking['amount_paid'] ?? 0) + $amount;
                $newBalance = max(0, $booking['total'] - $newPaid);
                $status = $newBalance <= 0 ? 'paid' : ($newPaid >= ($booking['deposit_required'] ?? 0) ? 'deposit' : ($newPaid > 0 ? 'partial' : 'pending'));
                
                JsonDB::update('bookings', $input['booking_id'], [
                    'amount_paid' => $newPaid,
                    'balance_due' => $newBalance,
                    'payment_status' => $status
                ]);
                
                respond($payment, 201);
                break;
        }
        break;
    
    case 'promos':
        switch ($method) {
            case 'GET':
                if ($id) { $p = JsonDB::find('promos', $id); $p ? respond($p) : error('Not found', 404); }
                if (!empty($_GET['code'])) {
                    $code = strtoupper(trim($_GET['code']));
                    $promo = null;
                    foreach (JsonDB::get('promos') as $p) { if (strtoupper($p['code']) === $code) { $promo = $p; break; } }
                    if (!$promo) error('Invalid code', 404);
                    if ($promo['status'] !== 'active') error('Inactive');
                    if ($promo['valid_until'] && $promo['valid_until'] < date('Y-m-d')) error('Expired');
                    if ($promo['max_uses'] && $promo['times_used'] >= $promo['max_uses']) error('Limit reached');
                    respond($promo);
                }
                respond(JsonDB::get('promos'));
                break;
            case 'POST':
                if (empty($input['code'])) error('Code required');
                respond(JsonDB::insert('promos', [
                    'code' => strtoupper(trim($input['code'])),
                    'description' => $input['description'] ?? '',
                    'discount_type' => $input['discount_type'] ?? 'percent',
                    'discount_value' => floatval($input['discount_value'] ?? 0),
                    'min_order' => floatval($input['min_order'] ?? 0),
                    'max_uses' => $input['max_uses'] ? intval($input['max_uses']) : null,
                    'times_used' => 0,
                    'valid_until' => $input['valid_until'] ?? null,
                    'status' => 'active'
                ]), 201);
                break;
            case 'PUT':
                if (!$id) error('ID required');
                $p = JsonDB::update('promos', $id, $input);
                $p ? respond($p) : error('Not found', 404);
                break;
            case 'DELETE':
                if (!$id) error('ID required');
                JsonDB::delete('promos', $id) ? respond(['success' => true]) : error('Not found', 404);
                break;
        }
        break;
    
    case 'zones':
        switch ($method) {
            case 'GET':
                if (!empty($_GET['zip'])) {
                    $zip = $_GET['zip'];
                    $fee = null;
                    $zoneName = 'Outside Service Area';
                    foreach (JsonDB::get('zones') as $z) {
                        if (in_array($zip, $z['zip_codes'] ?? [])) { 
                            $fee = $z['delivery_fee']; 
                            $zoneName = $z['name'];
                            break; 
                        }
                    }
                    respond(['zip' => $zip, 'fee' => $fee, 'zone' => $zoneName, 'available' => $fee !== null]);
                }
                respond(JsonDB::get('zones'));
                break;
            case 'POST':
                if (empty($input['name'])) error('Zone name required');
                $zone = JsonDB::insert('zones', [
                    'name' => $input['name'],
                    'description' => $input['description'] ?? '',
                    'delivery_fee' => floatval($input['delivery_fee'] ?? 0),
                    'color' => $input['color'] ?? '#10b981',
                    'zip_codes' => $input['zip_codes'] ?? [],
                    'polygon' => $input['polygon'] ?? []
                ]);
                respond($zone, 201);
                break;
            case 'PUT':
                if (!$id) error('Zone ID required');
                $zone = JsonDB::update('zones', $id, $input);
                $zone ? respond($zone) : error('Zone not found', 404);
                break;
            case 'DELETE':
                if (!$id) error('Zone ID required');
                JsonDB::delete('zones', $id) ? respond(['success' => true]) : error('Zone not found', 404);
                break;
        }
        break;
        
    case 'settings':
        if ($method === 'GET') {
            respond(['meta' => JsonDB::meta(), 'settings' => JsonDB::get('settings'), 'zones' => JsonDB::get('zones'), 'staff' => JsonDB::get('staff')]);
        }
        if ($method === 'PUT') {
            foreach (['business_name', 'business_phone', 'business_email', 'tax_rate', 'deposit_percent', 'base_location'] as $k) {
                if (isset($input[$k])) JsonDB::meta($k, $input[$k]);
            }
            respond(['success' => true, 'meta' => JsonDB::meta()]);
        }
        break;
    
    case 'availability':
        $date = $_GET['date'] ?? date('Y-m-d');
        $booked = [];
        foreach (JsonDB::get('bookings') as $b) {
            if ($b['event_date'] === $date && $b['status'] !== 'cancelled') {
                foreach ($b['items'] as $i) {
                    $booked[$i['product_id']] = ($booked[$i['product_id']] ?? 0) + ($i['quantity'] ?? 1);
                }
            }
        }
        $avail = [];
        foreach (JsonDB::get('products') as $p) {
            if ($p['status'] !== 'active') continue;
            $b = $booked[$p['id']] ?? 0;
            $avail[] = ['product_id' => $p['id'], 'name' => $p['name'], 'total' => $p['quantity'] ?? 1, 'booked' => $b, 'available' => max(0, ($p['quantity'] ?? 1) - $b)];
        }
        respond(['date' => $date, 'products' => $avail]);
        break;
    
    case 'reports':
        $from = $_GET['from'] ?? date('Y-m-01');
        $to = $_GET['to'] ?? date('Y-m-d');
        $detailed = isset($_GET['detailed']);
        
        $bookings = JsonDB::get('bookings');
        $payments = JsonDB::get('payments');
        $customers = JsonDB::get('customers');
        $products = JsonDB::get('products');
        $zones = JsonDB::get('zones');
        
        // Filter bookings by date range
        $periodBookings = array_filter($bookings, fn($b) => $b['event_date'] >= $from && $b['event_date'] <= $to);
        $periodPayments = array_filter($payments, fn($p) => substr($p['created_at'], 0, 10) >= $from && substr($p['created_at'], 0, 10) <= $to);
        
        // Summary stats
        $totalRevenue = array_sum(array_column($periodPayments, 'amount'));
        $totalBookings = count($periodBookings);
        $completedBookings = count(array_filter($periodBookings, fn($b) => $b['status'] === 'completed'));
        $cancelledBookings = count(array_filter($periodBookings, fn($b) => $b['status'] === 'cancelled'));
        $uniqueCustomers = count(array_unique(array_column($periodBookings, 'customer_id')));
        $avgBookingValue = $totalBookings > 0 ? array_sum(array_column($periodBookings, 'total')) / $totalBookings : 0;
        
        // New customers in period
        $periodCustomerIds = array_unique(array_column($periodBookings, 'customer_id'));
        $newCustomers = 0;
        foreach ($customers as $c) {
            if (in_array($c['id'], $periodCustomerIds) && substr($c['created_at'] ?? '', 0, 10) >= $from) {
                $newCustomers++;
            }
        }
        
        // Comparison with previous period
        $periodLength = (strtotime($to) - strtotime($from)) / 86400;
        $prevFrom = date('Y-m-d', strtotime($from) - $periodLength * 86400);
        $prevTo = date('Y-m-d', strtotime($from) - 1);
        $prevPayments = array_filter($payments, fn($p) => substr($p['created_at'], 0, 10) >= $prevFrom && substr($p['created_at'], 0, 10) <= $prevTo);
        $prevBookings = array_filter($bookings, fn($b) => $b['event_date'] >= $prevFrom && $b['event_date'] <= $prevTo);
        $prevRevenue = array_sum(array_column($prevPayments, 'amount'));
        $prevBookingCount = count($prevBookings);
        
        $revenueChange = $prevRevenue > 0 ? (($totalRevenue - $prevRevenue) / $prevRevenue) * 100 : 0;
        $bookingChange = $prevBookingCount > 0 ? (($totalBookings - $prevBookingCount) / $prevBookingCount) * 100 : 0;
        
        // Daily revenue breakdown
        $dailyRevenue = [];
        $current = $from;
        while ($current <= $to) {
            $dayPayments = array_filter($periodPayments, fn($p) => substr($p['created_at'], 0, 10) === $current);
            $dayBookings = array_filter($periodBookings, fn($b) => $b['event_date'] === $current);
            $dailyRevenue[] = [
                'date' => $current,
                'booking_count' => count($dayBookings),
                'gross' => array_sum(array_column($dayBookings, 'total')),
                'tax' => array_sum(array_column($dayBookings, 'tax')),
                'delivery' => array_sum(array_column($dayBookings, 'delivery_fee')),
                'collected' => array_sum(array_column($dayPayments, 'amount'))
            ];
            $current = date('Y-m-d', strtotime($current . ' +1 day'));
        }
        
        // Revenue by payment method
        $byPaymentMethod = [];
        foreach ($periodPayments as $p) {
            $method = $p['method'] ?? 'other';
            $byPaymentMethod[$method] = ($byPaymentMethod[$method] ?? 0) + $p['amount'];
        }
        
        // Revenue by category
        $byCategory = [];
        foreach ($periodBookings as $b) {
            foreach ($b['items'] ?? [] as $item) {
                $prod = null;
                foreach ($products as $p) { if ($p['id'] === $item['product_id']) { $prod = $p; break; } }
                $cat = $prod['category'] ?? 'other';
                $byCategory[$cat] = ($byCategory[$cat] ?? 0) + ($item['subtotal'] ?? 0);
            }
        }
        
        // Bookings by status
        $byStatus = [];
        foreach ($periodBookings as $b) {
            $status = $b['status'] ?? 'pending';
            $byStatus[$status] = ($byStatus[$status] ?? 0) + 1;
        }
        
        // Bookings by day of week
        $byDayOfWeek = [0, 0, 0, 0, 0, 0, 0];
        foreach ($periodBookings as $b) {
            $dow = date('w', strtotime($b['event_date']));
            $byDayOfWeek[$dow]++;
        }
        
        // Bookings by event type
        $byEventType = [];
        foreach ($periodBookings as $b) {
            $type = $b['event_type'] ?? 'other';
            $byEventType[$type] = ($byEventType[$type] ?? 0) + 1;
        }
        
        // Daily bookings for trend
        $dailyBookings = [];
        $current = $from;
        while ($current <= $to) {
            $count = count(array_filter($periodBookings, fn($b) => $b['event_date'] === $current));
            $dailyBookings[] = ['date' => $current, 'count' => $count];
            $current = date('Y-m-d', strtotime($current . ' +1 day'));
        }
        
        // Lead time analysis
        $leadTimes = [];
        foreach ($periodBookings as $b) {
            $created = strtotime($b['created_at'] ?? $b['event_date']);
            $event = strtotime($b['event_date']);
            $leadTimes[] = max(0, ($event - $created) / 86400);
        }
        $avgLeadTime = count($leadTimes) > 0 ? array_sum($leadTimes) / count($leadTimes) : 0;
        
        $leadTimeBreakdown = ['same_day' => 0, 'within_week' => 0, 'within_two_weeks' => 0, 'within_month' => 0, 'over_month' => 0];
        foreach ($leadTimes as $lt) {
            if ($lt < 1) $leadTimeBreakdown['same_day']++;
            elseif ($lt <= 7) $leadTimeBreakdown['within_week']++;
            elseif ($lt <= 14) $leadTimeBreakdown['within_two_weeks']++;
            elseif ($lt <= 30) $leadTimeBreakdown['within_month']++;
            else $leadTimeBreakdown['over_month']++;
        }
        
        // Product performance
        $productStats = [];
        foreach ($products as $prod) {
            $rentals = 0;
            $revenue = 0;
            foreach ($periodBookings as $b) {
                if ($b['status'] === 'cancelled') continue;
                foreach ($b['items'] ?? [] as $item) {
                    if ($item['product_id'] === $prod['id']) {
                        $rentals += $item['quantity'] ?? 1;
                        $revenue += $item['subtotal'] ?? 0;
                    }
                }
            }
            $daysInPeriod = max(1, (strtotime($to) - strtotime($from)) / 86400);
            $maxRentals = ($prod['quantity'] ?? 1) * $daysInPeriod;
            $utilization = $maxRentals > 0 ? ($rentals / $maxRentals) * 100 : 0;
            
            $productStats[] = [
                'id' => $prod['id'],
                'name' => $prod['name'],
                'emoji' => $prod['emoji'] ?? '🎪',
                'category' => $prod['category'] ?? 'other',
                'rental_count' => $rentals,
                'revenue' => $revenue,
                'avg_revenue' => $rentals > 0 ? $revenue / $rentals : 0,
                'utilization' => $utilization
            ];
        }
        usort($productStats, fn($a, $b) => $b['revenue'] - $a['revenue']);
        
        // Customer analysis
        $customerStats = [];
        foreach ($customers as $c) {
            $custBookings = array_filter($bookings, fn($b) => $b['customer_id'] === $c['id'] && $b['status'] !== 'cancelled');
            $totalSpent = array_sum(array_column($custBookings, 'total'));
            $bookingCount = count($custBookings);
            $lastBooking = null;
            foreach ($custBookings as $cb) {
                if (!$lastBooking || $cb['event_date'] > $lastBooking) $lastBooking = $cb['event_date'];
            }
            
            if ($bookingCount > 0) {
                $customerStats[] = [
                    'id' => $c['id'],
                    'name' => trim(($c['first_name'] ?? '') . ' ' . ($c['last_name'] ?? '')),
                    'email' => $c['email'] ?? '',
                    'phone' => $c['phone'] ?? '',
                    'booking_count' => $bookingCount,
                    'total_spent' => $totalSpent,
                    'avg_order' => $totalSpent / $bookingCount,
                    'last_booking' => $lastBooking
                ];
            }
        }
        usort($customerStats, fn($a, $b) => $b['total_spent'] - $a['total_spent']);
        
        // Customer segments
        $segments = ['vip' => 0, 'regular' => 0, 'one_time' => 0, 'dormant' => 0];
        $sixMonthsAgo = date('Y-m-d', strtotime('-6 months'));
        foreach ($customerStats as $cs) {
            if ($cs['booking_count'] >= 3 && $cs['total_spent'] >= 500) $segments['vip']++;
            elseif ($cs['booking_count'] >= 2) $segments['regular']++;
            elseif ($cs['last_booking'] && $cs['last_booking'] < $sixMonthsAgo) $segments['dormant']++;
            else $segments['one_time']++;
        }
        
        // Customer sources
        $bySources = [];
        foreach ($customers as $c) {
            $src = $c['source'] ?? 'unknown';
            $bySources[$src] = ($bySources[$src] ?? 0) + 1;
        }
        
        // Returning customers in period
        $returningInPeriod = 0;
        $newInPeriod = 0;
        foreach ($periodCustomerIds as $cid) {
            $priorBookings = count(array_filter($bookings, fn($b) => $b['customer_id'] === $cid && $b['event_date'] < $from));
            if ($priorBookings > 0) $returningInPeriod++;
            else $newInPeriod++;
        }
        
        // Operations - delivery zones
        $zoneStats = [];
        foreach ($zones as $z) {
            $deliveries = 0;
            $revenue = 0;
            foreach ($periodBookings as $b) {
                if ($b['status'] === 'cancelled') continue;
                // Check if delivery ZIP is in this zone
                $bookingZip = $b['delivery_zip'] ?? '';
                if (in_array($bookingZip, $z['zip_codes'] ?? [])) {
                    $deliveries++;
                    $revenue += $b['delivery_fee'] ?? 0;
                }
            }
            $zoneStats[] = [
                'id' => $z['id'],
                'name' => $z['name'],
                'color' => $z['color'] ?? '#10b981',
                'fee' => $z['delivery_fee'],
                'delivery_count' => $deliveries,
                'revenue' => $revenue
            ];
        }
        
        // Operations by day of week
        $deliveryByDay = [0, 0, 0, 0, 0, 0, 0];
        foreach ($periodBookings as $b) {
            if ($b['status'] !== 'cancelled') {
                $dow = date('w', strtotime($b['event_date']));
                $deliveryByDay[$dow]++;
            }
        }
        
        // Heatmap data (weeks x days)
        $heatmap = [];
        $current = $from;
        $week = [];
        $startDow = date('w', strtotime($from));
        for ($i = 0; $i < $startDow; $i++) $week[] = null;
        
        while ($current <= $to) {
            $count = count(array_filter($periodBookings, fn($b) => $b['event_date'] === $current && $b['status'] !== 'cancelled'));
            $week[] = $count;
            if (count($week) === 7) {
                $heatmap[] = $week;
                $week = [];
            }
            $current = date('Y-m-d', strtotime($current . ' +1 day'));
        }
        if (count($week) > 0) {
            while (count($week) < 7) $week[] = null;
            $heatmap[] = $week;
        }
        
        // Waiver stats
        $waiversSigned = count(array_filter($periodBookings, fn($b) => ($b['waiver_status'] ?? '') === 'signed'));
        $waiversPending = count(array_filter($periodBookings, fn($b) => ($b['waiver_status'] ?? 'pending') === 'pending' && $b['status'] !== 'cancelled'));
        
        // Busiest days
        $dayBookingCounts = [];
        foreach ($periodBookings as $b) {
            if ($b['status'] === 'cancelled') continue;
            $d = $b['event_date'];
            if (!isset($dayBookingCounts[$d])) $dayBookingCounts[$d] = 0;
            $dayBookingCounts[$d]++;
        }
        arsort($dayBookingCounts);
        $busiestDays = [];
        foreach (array_slice($dayBookingCounts, 0, 10, true) as $date => $count) {
            $busiestDays[] = [
                'date' => $date,
                'day_of_week' => date('l', strtotime($date)),
                'booking_count' => $count
            ];
        }
        
        // Outstanding balances
        $outstanding = array_sum(array_map(fn($b) => $b['balance_due'] ?? 0, array_filter($periodBookings, fn($b) => ($b['balance_due'] ?? 0) > 0 && $b['status'] !== 'cancelled')));
        $outstandingCount = count(array_filter($periodBookings, fn($b) => ($b['balance_due'] ?? 0) > 0 && $b['status'] !== 'cancelled'));
        
        // Free vs paid deliveries
        $freeDeliveries = count(array_filter($periodBookings, fn($b) => ($b['delivery_fee'] ?? 0) == 0 && $b['status'] !== 'cancelled'));
        $totalDeliveries = count(array_filter($periodBookings, fn($b) => $b['status'] !== 'cancelled'));
        
        respond([
            'period' => ['from' => $from, 'to' => $to],
            'summary' => [
                'total_revenue' => $totalRevenue,
                'total_bookings' => $totalBookings,
                'avg_booking_value' => $avgBookingValue,
                'unique_customers' => $uniqueCustomers,
                'new_customers' => $newCustomers,
                'completion_rate' => $totalBookings > 0 ? ($completedBookings / $totalBookings) * 100 : 0
            ],
            'comparison' => [
                'revenue_change' => $revenueChange,
                'booking_change' => $bookingChange
            ],
            'revenue' => [
                'gross' => array_sum(array_column($periodBookings, 'total')),
                'tax_collected' => array_sum(array_column($periodBookings, 'tax')),
                'delivery_fees' => array_sum(array_column($periodBookings, 'delivery_fee')),
                'outstanding' => $outstanding,
                'outstanding_count' => $outstandingCount,
                'daily' => $dailyRevenue,
                'by_payment_method' => $byPaymentMethod,
                'by_category' => $byCategory
            ],
            'bookings' => [
                'total' => $totalBookings,
                'by_status' => $byStatus,
                'by_day_of_week' => $byDayOfWeek,
                'by_event_type' => $byEventType,
                'daily' => $dailyBookings,
                'cancellation_rate' => $totalBookings > 0 ? ($cancelledBookings / $totalBookings) * 100 : 0,
                'avg_lead_time' => $avgLeadTime,
                'lead_time_breakdown' => $leadTimeBreakdown
            ],
            'products' => $productStats,
            'products_summary' => [
                'total' => count($products),
                'active' => count(array_filter($products, fn($p) => ($p['status'] ?? '') === 'active')),
                'total_rentals' => array_sum(array_column($productStats, 'rental_count')),
                'avg_utilization' => count($productStats) > 0 ? array_sum(array_column($productStats, 'utilization')) / count($productStats) : 0
            ],
            'customers' => [
                'total' => count($customers),
                'new_in_period' => $newInPeriod,
                'returning' => count(array_filter($customerStats, fn($c) => $c['booking_count'] > 1)),
                'returning_in_period' => $returningInPeriod,
                'return_rate' => count($customerStats) > 0 ? (count(array_filter($customerStats, fn($c) => $c['booking_count'] > 1)) / count($customerStats)) * 100 : 0,
                'avg_lifetime_value' => count($customerStats) > 0 ? array_sum(array_column($customerStats, 'total_spent')) / count($customerStats) : 0,
                'segments' => $segments,
                'by_source' => $bySources
            ],
            'top_customers' => array_slice($customerStats, 0, 20),
            'busiest_days' => $busiestDays,
            'operations' => [
                'total_deliveries' => $totalDeliveries,
                'delivery_revenue' => array_sum(array_column($periodBookings, 'delivery_fee')),
                'avg_delivery_fee' => $totalDeliveries > 0 ? array_sum(array_column($periodBookings, 'delivery_fee')) / $totalDeliveries : 0,
                'free_deliveries' => $freeDeliveries,
                'free_delivery_pct' => $totalDeliveries > 0 ? ($freeDeliveries / $totalDeliveries) * 100 : 0,
                'by_zone' => $zoneStats,
                'by_day_of_week' => $deliveryByDay,
                'heatmap' => $heatmap,
                'waivers' => [
                    'signed' => $waiversSigned,
                    'pending' => $waiversPending,
                    'completion_rate' => ($waiversSigned + $waiversPending) > 0 ? ($waiversSigned / ($waiversSigned + $waiversPending)) * 100 : 0
                ]
            ]
        ]);
        break;
    
    case 'waiver':
        if ($method === 'POST' && !empty($input['booking_id']) && !empty($input['signer_name'])) {
            JsonDB::update('bookings', $input['booking_id'], [
                'waiver_status' => 'signed',
                'waiver_signed_at' => date('c'),
                'waiver_signer_name' => $input['signer_name']
            ]);
            respond(['success' => true]);
        }
        error('Invalid request');
        break;
    
    default:
        error('Unknown action', 404);
}