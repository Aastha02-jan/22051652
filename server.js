const express = require('express');
const app = express();
const PORT = 9876;

// Configuration
const CONFIG = {
    WINDOW_SIZE: 10,
    TIMEOUT_MS: 500
};

// Mock data for testing
const MOCK_DATA = {
    primes: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29],
    fibo: [1, 1, 2, 3, 5, 8, 13, 21, 34, 55],
    even: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
    rand: [7, 14, 21, 28, 35, 42, 49, 56, 63, 70]
};

// In-memory storage
const numberWindows = {
    p: [], f: [], e: [], r: [] 
};

// Calculate average
const calculateAverage = (numbers) => {
    if (numbers.length === 0) return 0;
    const sum = numbers.reduce((a, b) => a + b, 0);
    return parseFloat((sum / numbers.length).toFixed(2));
};

// Main API endpoint
app.get('/numbers/:type', (req, res) => {
    const type = req.params.type;
    const windowSize = parseInt(req.query.windowSize) || CONFIG.WINDOW_SIZE;

    if (!['p', 'f', 'e', 'r'].includes(type)) {
        return res.status(400).json({ 
            error: 'Use p (primes), f (fibonacci), e (even), or r (random)' 
        });
    }

    const prevState = [...numberWindows[type]];
    const newNumbers = MOCK_DATA[
        type === 'p' ? 'primes' :
        type === 'f' ? 'fibo' :
        type === 'e' ? 'even' : 'rand'
    ];

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
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});