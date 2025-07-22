class IndexController {
    constructor() {
        // Initialize any properties if needed
    }

    getHome(req, res) {
        res.send('Welcome to the API!');
    }

    getStatus(req, res) {
        res.json({ status: 'API is running' });
    }

    // Add more methods as needed for handling requests
}

export default IndexController;