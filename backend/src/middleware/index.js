export const logger = (req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
};

export const authenticate = (req, res, next) => {
    // Placeholder for authentication logic
    next();
};