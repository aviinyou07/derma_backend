const productService = require('../services/product.service');

exports.home = (req, res) => {
  res.render('index', { title: 'Home Page' });
};

exports.productListPage = async (req, res) => {
  try {
    const products = await productService.listProducts(req.query || {});
    res.render('productlist', { products, error: null });
  } catch (error) {
    res.render('productlist', { products: [], error: error.message });
  }
};

exports.checkoutPage = (req, res) => {
  res.render('checkout');
};

exports.orderHistoryPage = (req, res) => {
  res.render('orderhistory');
};

exports.productDetailsPage = async (req, res) => {
  const slug = req.params.slug;

  if (!slug) {
    return res.render('productdetails', { product: null, error: null });
  }

  try {
    const product = await productService.getProductDetails(slug);
    return res.render('productdetails', { product, error: null });
  } catch (error) {
    return res.render('productdetails', { product: null, error: error.message });
  }
};

exports.orderDetailsPage = (req, res) => {
  res.render('orderdetails');
};

exports.cartPage = (req, res) => {
  res.render('cart');
};
