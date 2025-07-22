const express = require('express');
const bodyParser = require('body-parser');
const { setRoutes } = require('./routes/index');
const middleware = require('./middleware/index');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Use middleware
app.use(middleware);

// Set up routes
setRoutes(app);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});