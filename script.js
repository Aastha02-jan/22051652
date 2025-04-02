const express = require('express');
const axios = require('axios');
const app = express();
const PORT = 9876;

// Enhanced configuration
const CONFIG = {
    WINDOW_SIZE: 10,
    THIRD_PARTY_API: {
        primes: 'http://20.244.56.144/numbers/primes',
        fibo: 'http://20.244.56.144/numbers/fibo',
        even: 'http://20.244.56.144/numbers/even',
        rand: 'http://20.244.56.144/numbers/rand'
    },
    TIMEOUT_MS: 500
};

// Initialize number windows
const numberWindows = {
    p: [], f: [], e: [], r: []
};

// Improved fetch function with fallback
const fetchNumbers = async (type) => {
    const endpoints = {
        p: CONFIG.THIRD_PARTY_API.primes,
        f: CONFIG.THIRD_PARTY_API.fibo,
        e: CONFIG.THIRD_PARTY_API.even,
        r: CONFIG.THIRD_PARTY_API.rand
    };

    try {
        console.log(`Fetching from: ${endpoints[type]}`);
        const response = await axios.get(endpoints[type], {
            timeout: CONFIG.TIMEOUT_MS
        });
        return response.data.numbers || [];
    } catch (error) {
        console.error(`Failed to fetch ${type} numbers:`, error.message);
        
        // Fallback test data if API fails
        const fallback = {
            p: [2, 3, 5, 7, 11],
            f: [1, 1, 2, 3, 5, 8],
            e: [2, 4, 6, 8, 10],
            r: [7, 14, 21, 28, 35]
        };
        return fallback[type];
    }
};

// API endpoint with enhanced error handling
app.get('/numbers/:type', async (req, res) => {
    const type = req.params.type;
    const windowSize = parseInt(req.query.windowSize) || CONFIG.WINDOW_SIZE;

    if (!['p', 'f', 'e', 'r'].includes(type)) {
        return res.status(400).json({
            error: 'Invalid type. Use p (primes), f (fibo), e (even), or r (random)'
        });
    }

    try {
        const prevState = [...numberWindows[type]];
        const newNumbers = await fetchNumbers(type);
        
        // Update window
        newNumbers.forEach(num => {
            if (!numberWindows[type].includes(num)) {
                numberWindows[type].push(num);
                if (numberWindows[type].length > windowSize) {
                    numberWindows[type].shift();
                }
            }
        });

        res.json({
            windowPrevState: prevState,
            windowCurrState: [...numberWindows[type]],
            numbers: newNumbers,
            avg: calculateAverage(numberWindows[type])
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

function calculateAverage(numbers) {
    if (numbers.length === 0) return 0;
    const sum = numbers.reduce((a, b) => a + b, 0);
    return parseFloat((sum / numbers.length).toFixed(2));
}

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
