const express = require('express');
const axios = require('axios');
const winston = require('winston');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 9876;

// Configure logging
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'average-calculator.log' })
    ]
});

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Configuration
const CONFIG = {
    WINDOW_SIZE: 10,
    THIRD_PARTY_API_BASE: 'http://20.244.56.144/evaluation-service',
    TIMEOUT_MS: 500,
    ALLOWED_TYPES: ['p', 'f', 'e', 'r'] // prime, fibonacci, even, random
};

// In-memory storage for numbers by type
const numberWindows = {};
CONFIG.ALLOWED_TYPES.forEach(type => {
    numberWindows[type] = [];
});

// Helper function to calculate average
const calculateAverage = (numbers) => {
    if (numbers.length === 0) return 0;
    const sum = numbers.reduce((acc, num) => acc + num, 0);
    return parseFloat((sum / numbers.length).toFixed(2));
};

// Helper function to fetch numbers from third-party API
const fetchNumbers = async (type) => {
    try {
        let endpoint;
        switch (type) {
            case 'p': endpoint = 'primes'; break;
            case 'f': endpoint = 'fibo'; break;
            case 'e': endpoint = 'even'; break;
            case 'r': endpoint = 'rand'; break;
            default: throw new Error('Invalid number type');
        }

        const url = `${CONFIG.THIRD_PARTY_API_BASE}/${endpoint}`;
        logger.info(`Fetching numbers from: ${url}`);

        const response = await axios.get(url, { timeout: CONFIG.TIMEOUT_MS });
        return response.data.numbers || [];
    } catch (error) {
        logger.error(`Error fetching ${type} numbers: ${error.message}`);
        return [];
    }
};

// Process and update number window
const updateNumberWindow = (type, newNumbers, windowSize) => {
    const currentWindow = numberWindows[type];
    const prevWindow = [...currentWindow];

    // Add new numbers, ensuring uniqueness
    newNumbers.forEach(num => {
        if (!currentWindow.includes(num)) {
            currentWindow.push(num);
            
            // Enforce window size limit
            if (currentWindow.length > windowSize) {
                currentWindow.shift(); // Remove oldest number
            }
        }
    });

    return prevWindow;
};

// API endpoint
app.get('/numbers/:numberid', async (req, res) => {
    const startTime = process.hrtime();
    const numberId = req.params.numberid;
    const windowSize = parseInt(req.query.windowSize) || CONFIG.WINDOW_SIZE;

    // Validate input
    if (!CONFIG.ALLOWED_TYPES.includes(numberId)) {
        logger.warn(`Invalid number type requested: ${numberId}`);
        return res.status(400).json({ 
            error: `Invalid number type. Use one of: ${CONFIG.ALLOWED_TYPES.join(', ')}` 
        });
    }

    if (isNaN(windowSize) || windowSize < 1) {
        logger.warn(`Invalid window size: ${req.query.windowSize}`);
        return res.status(400).json({ 
            error: 'Window size must be a positive integer' 
        });
    }

    try {
        // Save previous state
        const windowPrevState = [...numberWindows[numberId]];

        // Fetch new numbers
        const newNumbers = await fetchNumbers(numberId);
        logger.info(`Fetched ${newNumbers.length} new numbers for type ${numberId}`);

        // Update window with new numbers
        updateNumberWindow(numberId, newNumbers, windowSize);

        // Calculate response time
        const elapsedTime = process.hrtime(startTime);
        const elapsedMs = elapsedTime[0] * 1000 + elapsedTime[1] / 1e6;
        logger.info(`Request processed in ${elapsedMs.toFixed(2)}ms`);

        // Prepare response
        const response = {
            windowPrevState,
            windowCurrState: [...numberWindows[numberId]],
            numbers: newNumbers,
            avg: calculateAverage(numberWindows[numberId])
        };

        res.json(response);
    } catch (error) {
        logger.error(`Error processing request: ${error.stack}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Start server
const server = app.listen(PORT, () => {
    logger.info(`Average Calculator microservice running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received. Shutting down gracefully...');
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});

module.exports = app; // For testing