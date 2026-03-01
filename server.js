const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

// Set EJS as view engine
app.set('view engine', 'ejs');

// Set views folder (optional if named 'views')
app.set('views', path.join(__dirname, 'views'));

// Middleware for static files (CSS, JS, images)
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
    res.render('index', { title: "Home Page" });
});

app.get('/productlist', (req, res) => {
    res.render('productlist');
});

app.get('/checkout', (req, res) => {
    res.render('checkout');
});

app.get('/orderhistory', (req, res) => {
    res.render('orderhistory');
});

app.get('/productdetails', (req, res) => {
    res.render('productdetails');
});

app.get('/orderdetails', (req, res) => {
    res.render('orderdetails');
});

app.get('/cart', (req, res) => {
    res.render('cart');
});






app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});