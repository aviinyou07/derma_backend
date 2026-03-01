require('dotenv').config();
const express = require('express');
const path = require('path');
const { validateEnv } = require('./config/env');

const app = express();
const PORT = Number(process.env.PORT);

validateEnv();

const viewRoutes = require('./routes/view.route');
const productRoutes = require('./routes/product.route');
const categoryRoutes = require('./routes/category.route');
const userRoutes = require('./routes/user.routes');
const orderRoutes = require('./routes/order.route');
const cartRoutes = require('./routes/cart.route');
const wishlistRoutes = require('./routes/wishlist.route');
const reviewRoutes = require('./routes/review.route');
const newsletterRoutes = require('./routes/newsletter.route');

// Set EJS as view engine
app.set('view engine', 'ejs');

// Set views folder (optional if named 'views')
app.set('views', path.join(__dirname, 'views'));

// Middleware for static files (CSS, JS, images)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// View routes (EJS pages)
app.use('/', viewRoutes);

// API routes
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/newsletter', newsletterRoutes);


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});