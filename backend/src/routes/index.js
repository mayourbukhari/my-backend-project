const express = require('express');
const IndexController = require('../controllers/index').IndexController;

const router = express.Router();
const indexController = new IndexController();

function setRoutes(app) {
    router.get('/', indexController.home);
    router.get('/about', indexController.about);
    // Add more routes as needed

    app.use('/api', router);
}

module.exports = setRoutes;