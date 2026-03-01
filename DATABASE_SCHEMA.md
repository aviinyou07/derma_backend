# Database Schema - db_derma_co

Generated: 2/3/2026, 12:21:48 am

================================================================================

## TABLE: brands
--------------------------------------------------------------------------------
Engine: InnoDB | Collation: utf8mb4_0900_ai_ci | Auto Increment: 1

### Columns
1. id (int) [NOT NULL] [PRIMARY KEY]
2. name (varchar(150)) [NOT NULL] [UNIQUE]
3. slug (varchar(150)) [NOT NULL] [UNIQUE]
4. logo (varchar(255))
5. description (text)
6. is_active (tinyint(1)) [DEFAULT: 1]
7. created_at (timestamp) [DEFAULT: CURRENT_TIMESTAMP]
8. updated_at (timestamp) [DEFAULT: CURRENT_TIMESTAMP]

### Indexes
- name (name) [UNIQUE]
- PRIMARY (id) [UNIQUE]
- slug (slug) [UNIQUE]


## TABLE: cart_items
--------------------------------------------------------------------------------
Engine: InnoDB | Collation: utf8mb4_0900_ai_ci | Auto Increment: null

### Columns
1. id (int) [NOT NULL] [PRIMARY KEY]
2. user_id (int) [NOT NULL]
3. variation_id (int) [NOT NULL]
4. quantity (int) [NOT NULL] [DEFAULT: 1]
5. created_at (timestamp) [DEFAULT: CURRENT_TIMESTAMP]
6. updated_at (timestamp) [DEFAULT: CURRENT_TIMESTAMP]

### Indexes
- idx_cart_items_user (user_id)
- idx_cart_items_variation (variation_id)
- PRIMARY (id) [UNIQUE]
- uniq_user_variation (user_id, variation_id) [UNIQUE]

### Foreign Keys
- user_id → users.id (ON UPDATE NO ACTION, ON DELETE CASCADE)
- variation_id → product_variations.id (ON UPDATE NO ACTION, ON DELETE CASCADE)

### Check Constraints
- chk_cart_items_quantity_positive: (`quantity` > 0)


## TABLE: categories
--------------------------------------------------------------------------------
Engine: InnoDB | Collation: utf8mb4_0900_ai_ci | Auto Increment: 1

### Columns
1. id (int) [NOT NULL] [PRIMARY KEY]
2. name (varchar(150)) [NOT NULL]
3. slug (varchar(150)) [NOT NULL] [UNIQUE]
4. image (varchar(255))
5. description (text)
6. is_active (tinyint(1)) [DEFAULT: 1]
7. created_at (timestamp) [DEFAULT: CURRENT_TIMESTAMP]
8. updated_at (timestamp) [DEFAULT: CURRENT_TIMESTAMP]

### Indexes
- PRIMARY (id) [UNIQUE]
- slug (slug) [UNIQUE]


## TABLE: coupon_usages
--------------------------------------------------------------------------------
Engine: InnoDB | Collation: utf8mb4_0900_ai_ci | Auto Increment: 1

### Columns
1. id (int) [NOT NULL] [PRIMARY KEY]
2. coupon_id (int) [NOT NULL]
3. user_id (int) [NOT NULL]
4. order_id (int) [NOT NULL]
5. used_at (timestamp) [DEFAULT: CURRENT_TIMESTAMP]

### Indexes
- fk_coupon_usage_order (order_id)
- fk_coupon_usage_user (user_id)
- idx_coupon_user (coupon_id, user_id)
- PRIMARY (id) [UNIQUE]
- uniq_coupon_user_order (coupon_id, user_id, order_id) [UNIQUE]

### Foreign Keys
- coupon_id → coupons.id (ON UPDATE NO ACTION, ON DELETE CASCADE)
- order_id → orders.id (ON UPDATE NO ACTION, ON DELETE CASCADE)
- user_id → users.id (ON UPDATE NO ACTION, ON DELETE CASCADE)


## TABLE: coupons
--------------------------------------------------------------------------------
Engine: InnoDB | Collation: utf8mb4_0900_ai_ci | Auto Increment: 1

### Columns
1. id (int) [NOT NULL] [PRIMARY KEY]
2. code (varchar(50)) [NOT NULL] [UNIQUE]
3. discount_type (enum('percentage','flat')) [NOT NULL]
4. discount_value (decimal(10,2)) [NOT NULL]
5. max_discount_amount (decimal(10,2))
6. minimum_order_amount (decimal(10,2)) [DEFAULT: 0.00]
7. usage_limit (int)
8. used_count (int) [DEFAULT: 0]
9. per_user_limit (int) [DEFAULT: 1]
10. starts_at (datetime)
11. expires_at (datetime)
12. is_active (tinyint(1)) [DEFAULT: 1]
13. created_at (timestamp) [DEFAULT: CURRENT_TIMESTAMP]
14. updated_at (timestamp) [DEFAULT: CURRENT_TIMESTAMP]

### Indexes
- code (code) [UNIQUE]
- expires_at (expires_at)
- is_active (is_active)
- PRIMARY (id) [UNIQUE]


## TABLE: newsletter_subscribers
--------------------------------------------------------------------------------
Engine: InnoDB | Collation: utf8mb4_0900_ai_ci | Auto Increment: null

### Columns
1. id (int) [NOT NULL] [PRIMARY KEY]
2. email (varchar(255)) [NOT NULL] [UNIQUE]
3. full_name (varchar(150))
4. source (varchar(50)) [NOT NULL] [DEFAULT: footer]
5. is_active (tinyint(1)) [DEFAULT: 1]
6. subscribed_at (datetime) [NOT NULL] [DEFAULT: CURRENT_TIMESTAMP]
7. unsubscribed_at (datetime)
8. created_at (timestamp) [DEFAULT: CURRENT_TIMESTAMP]
9. updated_at (timestamp) [DEFAULT: CURRENT_TIMESTAMP]

### Indexes
- idx_newsletter_active_created (is_active, created_at)
- PRIMARY (id) [UNIQUE]
- uniq_newsletter_email (email) [UNIQUE]


## TABLE: order_items
--------------------------------------------------------------------------------
Engine: InnoDB | Collation: utf8mb4_0900_ai_ci | Auto Increment: 1

### Columns
1. id (int) [NOT NULL] [PRIMARY KEY]
2. order_id (int) [NOT NULL]
3. product_id (int)
4. variation_id (int)
5. product_name (varchar(255)) [NOT NULL]
6. product_slug (varchar(255))
7. brand_name (varchar(150))
8. size (varchar(50))
9. quantity (int) [NOT NULL]
10. unit_price (decimal(12,2)) [NOT NULL]
11. mrp (decimal(12,2))
12. gst_percentage (decimal(5,2)) [NOT NULL]
13. gst_amount (decimal(12,2)) [NOT NULL]
14. discount_amount (decimal(12,2)) [NOT NULL] [DEFAULT: 0.00]
15. total_price (decimal(12,2)) [NOT NULL]
16. created_at (timestamp) [DEFAULT: CURRENT_TIMESTAMP]

### Indexes
- idx_order_items_created_at (created_at)
- order_id (order_id)
- PRIMARY (id) [UNIQUE]
- product_id (product_id)
- variation_id (variation_id)

### Foreign Keys
- order_id → orders.id (ON UPDATE NO ACTION, ON DELETE CASCADE)

### Check Constraints
- chk_order_items_non_negative: ((`quantity` > 0) and (`unit_price` >= 0) and (`gst_amount` >= 0) and (`discount_amount` >= 0) and (`total_price` >= 0))


## TABLE: order_status_history
--------------------------------------------------------------------------------
Engine: InnoDB | Collation: utf8mb4_0900_ai_ci | Auto Increment: null

### Columns
1. id (int) [NOT NULL] [PRIMARY KEY]
2. order_id (int) [NOT NULL]
3. from_status (enum('pending','confirmed','processing','shipped','delivered','cancelled','returned'))
4. to_status (enum('pending','confirmed','processing','shipped','delivered','cancelled','returned')) [NOT NULL]
5. changed_by (int)
6. change_reason (varchar(255))
7. metadata (json)
8. created_at (timestamp) [DEFAULT: CURRENT_TIMESTAMP]

### Indexes
- fk_osh_changed_by (changed_by)
- idx_osh_order_created (order_id, created_at)
- idx_osh_to_status_created (to_status, created_at)
- PRIMARY (id) [UNIQUE]

### Foreign Keys
- changed_by → users.id (ON UPDATE NO ACTION, ON DELETE SET NULL)
- order_id → orders.id (ON UPDATE NO ACTION, ON DELETE CASCADE)


## TABLE: orders
--------------------------------------------------------------------------------
Engine: InnoDB | Collation: utf8mb4_0900_ai_ci | Auto Increment: 1

### Columns
1. id (int) [NOT NULL] [PRIMARY KEY]
2. user_id (int) [NOT NULL]
3. order_number (varchar(50)) [NOT NULL] [UNIQUE]
4. status (enum('pending','confirmed','processing','shipped','delivered','cancelled','returned')) [NOT NULL] [DEFAULT: pending]
5. payment_method (enum('razorpay','cod')) [NOT NULL] [DEFAULT: razorpay]
6. payment_status (enum('pending','paid','failed','refunded','partially_refunded')) [NOT NULL] [DEFAULT: pending]
7. currency (varchar(10)) [NOT NULL] [DEFAULT: INR]
8. total_quantity (int) [NOT NULL]
9. subtotal (decimal(12,2)) [NOT NULL]
10. total_gst (decimal(12,2)) [NOT NULL] [DEFAULT: 0.00]
11. shipping_charge (decimal(12,2)) [NOT NULL] [DEFAULT: 0.00]
12. discount_amount (decimal(12,2)) [NOT NULL] [DEFAULT: 0.00]
13. grand_total (decimal(12,2)) [NOT NULL]
14. coupon_code (varchar(100))
15. shipping_address (json) [NOT NULL]
16. billing_address (json)
17. invoice_number (varchar(100))
18. notes (text)
19. placed_at (timestamp) [DEFAULT: CURRENT_TIMESTAMP]
20. confirmed_at (timestamp)
21. shipped_at (timestamp)
22. delivered_at (timestamp)
23. cancelled_at (timestamp)
24. returned_at (timestamp)
25. created_at (timestamp) [DEFAULT: CURRENT_TIMESTAMP]
26. updated_at (timestamp) [DEFAULT: CURRENT_TIMESTAMP]
27. tracking_number (varchar(100))
28. courier_name (varchar(100))

### Indexes
- idx_orders_created_at (created_at)
- idx_orders_status_date (status, placed_at)
- idx_orders_status_payment (status, payment_status)
- idx_orders_updated_at (updated_at)
- idx_orders_user_date (user_id, placed_at)
- order_number (order_number) [UNIQUE]
- payment_status (payment_status)
- placed_at (placed_at)
- PRIMARY (id) [UNIQUE]
- status (status)
- user_id (user_id)

### Foreign Keys
- user_id → users.id (ON UPDATE NO ACTION, ON DELETE CASCADE)

### Check Constraints
- chk_orders_totals_non_negative: ((`subtotal` >= 0) and (`total_gst` >= 0) and (`shipping_charge` >= 0) and (`discount_amount` >= 0) and (`grand_total` >= 0))


## TABLE: payment_events
--------------------------------------------------------------------------------
Engine: InnoDB | Collation: utf8mb4_0900_ai_ci | Auto Increment: null

### Columns
1. id (int) [NOT NULL] [PRIMARY KEY]
2. order_id (int) [NOT NULL]
3. payment_gateway (varchar(50)) [NOT NULL]
4. event_type (varchar(100)) [NOT NULL]
5. gateway_event_id (varchar(150)) [NOT NULL] [UNIQUE]
6. signature (varchar(255))
7. payload (json)
8. processed_at (datetime)
9. created_at (timestamp) [DEFAULT: CURRENT_TIMESTAMP]

### Indexes
- idx_payment_events_gateway_created (payment_gateway, created_at)
- idx_payment_events_order_created (order_id, created_at)
- PRIMARY (id) [UNIQUE]
- uniq_payment_event_gateway_id (gateway_event_id) [UNIQUE]

### Foreign Keys
- order_id → orders.id (ON UPDATE NO ACTION, ON DELETE CASCADE)


## TABLE: product_reviews
--------------------------------------------------------------------------------
Engine: InnoDB | Collation: utf8mb4_0900_ai_ci | Auto Increment: null

### Columns
1. id (int) [NOT NULL] [PRIMARY KEY]
2. user_id (int) [NOT NULL]
3. product_id (int) [NOT NULL]
4. order_item_id (int) [UNIQUE]
5. rating (tinyint) [NOT NULL]
6. review_title (varchar(150))
7. review_text (text)
8. is_verified_purchase (tinyint(1)) [DEFAULT: 0]
9. is_published (tinyint(1)) [DEFAULT: 1]
10. created_at (timestamp) [DEFAULT: CURRENT_TIMESTAMP]
11. updated_at (timestamp) [DEFAULT: CURRENT_TIMESTAMP]

### Indexes
- idx_reviews_product_created (product_id, created_at)
- idx_reviews_product_rating (product_id, rating)
- idx_reviews_user_created (user_id, created_at)
- PRIMARY (id) [UNIQUE]
- uniq_review_order_item (order_item_id) [UNIQUE]

### Foreign Keys
- order_item_id → order_items.id (ON UPDATE NO ACTION, ON DELETE SET NULL)
- product_id → products.id (ON UPDATE NO ACTION, ON DELETE CASCADE)
- user_id → users.id (ON UPDATE NO ACTION, ON DELETE CASCADE)

### Check Constraints
- chk_reviews_rating_range: (`rating` between 1 and 5)


## TABLE: product_variations
--------------------------------------------------------------------------------
Engine: InnoDB | Collation: utf8mb4_0900_ai_ci | Auto Increment: 1

### Columns
1. id (int) [NOT NULL] [PRIMARY KEY]
2. product_id (int) [NOT NULL]
3. size (varchar(50)) [NOT NULL]
4. price (decimal(10,2)) [NOT NULL]
5. mrp (decimal(10,2))
6. gst_percentage (decimal(5,2)) [NOT NULL] [DEFAULT: 18.00]
7. sku (varchar(100)) [NOT NULL] [UNIQUE]
8. stock (int) [DEFAULT: 0]
9. is_default (tinyint(1)) [DEFAULT: 0]
10. is_active (tinyint(1)) [DEFAULT: 1]
11. created_at (timestamp) [DEFAULT: CURRENT_TIMESTAMP]
12. updated_at (timestamp) [DEFAULT: CURRENT_TIMESTAMP]

### Indexes
- idx_variations_is_active (is_active)
- PRIMARY (id) [UNIQUE]
- product_id (product_id, size) [UNIQUE]
- product_id_2 (product_id)
- sku (sku) [UNIQUE]

### Foreign Keys
- product_id → products.id (ON UPDATE NO ACTION, ON DELETE CASCADE)

### Check Constraints
- chk_variations_price_non_negative: (`price` >= 0)
- chk_variations_stock_non_negative: (`stock` >= 0)


## TABLE: products
--------------------------------------------------------------------------------
Engine: InnoDB | Collation: utf8mb4_0900_ai_ci | Auto Increment: 1

### Columns
1. id (int) [NOT NULL] [PRIMARY KEY]
2. name (varchar(255)) [NOT NULL]
3. slug (varchar(255)) [NOT NULL] [UNIQUE]
4. brand_id (int)
5. category_id (int)
6. description (json)
7. images (json)
8. labels (varchar(255))
9. keywords (varchar(500))
10. is_active (tinyint(1)) [DEFAULT: 1]
11. is_featured (tinyint(1)) [DEFAULT: 0]
12. is_trending (tinyint(1)) [DEFAULT: 0]
13. average_rating (decimal(3,2)) [NOT NULL] [DEFAULT: 0.00]
14. review_count (int) [NOT NULL] [DEFAULT: 0]
15. created_at (timestamp) [DEFAULT: CURRENT_TIMESTAMP]
16. updated_at (timestamp) [DEFAULT: CURRENT_TIMESTAMP]

### Indexes
- brand_id (brand_id)
- category_id (category_id)
- idx_products_average_rating (average_rating)
- idx_products_is_active (is_active)
- idx_products_is_featured (is_featured)
- idx_products_is_trending (is_trending)
- idx_products_review_count (review_count)
- PRIMARY (id) [UNIQUE]
- slug (slug) [UNIQUE]

### Foreign Keys
- category_id → categories.id (ON UPDATE NO ACTION, ON DELETE SET NULL)
- brand_id → brands.id (ON UPDATE NO ACTION, ON DELETE SET NULL)

### Check Constraints
- chk_products_rating_bounds: ((`average_rating` >= 0) and (`average_rating` <= 5) and (`review_count` >= 0))


## TABLE: transactions
--------------------------------------------------------------------------------
Engine: InnoDB | Collation: utf8mb4_0900_ai_ci | Auto Increment: 1

### Columns
1. id (int) [NOT NULL] [PRIMARY KEY]
2. order_id (int) [NOT NULL]
3. payment_gateway (varchar(50)) [NOT NULL]
4. payment_method (varchar(50))
5. gateway_order_id (varchar(100))
6. gateway_payment_id (varchar(100)) [UNIQUE]
7. gateway_signature (varchar(255))
8. amount (decimal(12,2)) [NOT NULL]
9. status (enum('pending','success','failed','refunded','partially_refunded')) [NOT NULL] [DEFAULT: pending]
10. refund_amount (decimal(12,2)) [DEFAULT: 0.00]
11. raw_response (json)
12. created_at (timestamp) [DEFAULT: CURRENT_TIMESTAMP]
13. updated_at (timestamp) [DEFAULT: CURRENT_TIMESTAMP]

### Indexes
- gateway_payment_id (gateway_payment_id)
- idx_transaction_status_order (order_id, status)
- idx_transactions_created_at (created_at)
- order_id (order_id)
- PRIMARY (id) [UNIQUE]
- status (status)
- uniq_gateway_payment_id (gateway_payment_id) [UNIQUE]

### Foreign Keys
- order_id → orders.id (ON UPDATE NO ACTION, ON DELETE CASCADE)

### Check Constraints
- chk_transactions_amount_non_negative: ((`amount` >= 0) and (`refund_amount` >= 0))


## TABLE: user_addresses
--------------------------------------------------------------------------------
Engine: InnoDB | Collation: utf8mb4_0900_ai_ci | Auto Increment: 1

### Columns
1. id (int) [NOT NULL] [PRIMARY KEY]
2. user_id (int) [NOT NULL]
3. address_type (enum('home','work','other')) [DEFAULT: home]
4. full_name (varchar(150))
5. phone (varchar(20))
6. address_line1 (varchar(255)) [NOT NULL]
7. address_line2 (varchar(255))
8. city (varchar(150)) [NOT NULL]
9. state (varchar(150)) [NOT NULL]
10. postal_code (varchar(20)) [NOT NULL]
11. country (varchar(150)) [NOT NULL]
12. is_default (tinyint(1)) [DEFAULT: 0]
13. created_at (timestamp) [DEFAULT: CURRENT_TIMESTAMP]
14. updated_at (timestamp) [DEFAULT: CURRENT_TIMESTAMP]

### Indexes
- PRIMARY (id) [UNIQUE]
- user_id (user_id)

### Foreign Keys
- user_id → users.id (ON UPDATE NO ACTION, ON DELETE CASCADE)


## TABLE: user_otps
--------------------------------------------------------------------------------
Engine: InnoDB | Collation: utf8mb4_0900_ai_ci | Auto Increment: 1

### Columns
1. id (int) [NOT NULL] [PRIMARY KEY]
2. user_id (int) [NOT NULL]
3. purpose (enum('email_verification','password_reset','login_verification')) [NOT NULL]
4. otp_hash (varchar(255)) [NOT NULL]
5. expires_at (datetime) [NOT NULL]
6. attempts (int) [DEFAULT: 0]
7. is_used (tinyint(1)) [DEFAULT: 0]
8. created_at (timestamp) [DEFAULT: CURRENT_TIMESTAMP]

### Indexes
- expires_at (expires_at)
- idx_user_otp_lookup (user_id, purpose, is_used, expires_at)
- PRIMARY (id) [UNIQUE]
- purpose (purpose)
- user_id (user_id)

### Foreign Keys
- user_id → users.id (ON UPDATE NO ACTION, ON DELETE CASCADE)


## TABLE: users
--------------------------------------------------------------------------------
Engine: InnoDB | Collation: utf8mb4_0900_ai_ci | Auto Increment: 1

### Columns
1. id (int) [NOT NULL] [PRIMARY KEY]
2. name (varchar(150)) [NOT NULL]
3. email (varchar(255)) [NOT NULL] [UNIQUE]
4. phone (varchar(20)) [UNIQUE]
5. password (varchar(255)) [NOT NULL]
6. is_active (tinyint(1)) [DEFAULT: 1]
7. email_verified (tinyint(1)) [DEFAULT: 0]
8. created_at (timestamp) [DEFAULT: CURRENT_TIMESTAMP]
9. updated_at (timestamp) [DEFAULT: CURRENT_TIMESTAMP]

### Indexes
- email (email) [UNIQUE]
- phone (phone) [UNIQUE]
- PRIMARY (id) [UNIQUE]


## TABLE: wishlist_items
--------------------------------------------------------------------------------
Engine: InnoDB | Collation: utf8mb4_0900_ai_ci | Auto Increment: null

### Columns
1. id (int) [NOT NULL] [PRIMARY KEY]
2. user_id (int) [NOT NULL]
3. product_id (int) [NOT NULL]
4. created_at (timestamp) [DEFAULT: CURRENT_TIMESTAMP]

### Indexes
- idx_wishlist_product_created (product_id, created_at)
- idx_wishlist_user_created (user_id, created_at)
- PRIMARY (id) [UNIQUE]
- uniq_wishlist_user_product (user_id, product_id) [UNIQUE]

### Foreign Keys
- product_id → products.id (ON UPDATE NO ACTION, ON DELETE CASCADE)
- user_id → users.id (ON UPDATE NO ACTION, ON DELETE CASCADE)

================================================================================
