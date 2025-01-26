/**
 * Squaredle Solver Algorithm
 * 
 * The algorithm uses a depth-first search (DFS) approach to find all possible words
 * in a grid of letters. It can move in 8 directions from any cell (including diagonals)
 * and cannot reuse cells within the same word.
 * 
 * Key optimizations:
 * 1. Prefix dictionary to early-exit paths that can't form valid words
 * 2. Set-based visited tracking for O(1) lookup
 * 3. Map-based word storage to maintain unique words with their paths
 */

let dictionary = new Set();        // Complete words
let prefixDictionary = new Set();  // All possible word prefixes
let dictionaryLoaded = false;

/**
 * Initialize by loading and processing the dictionary
 * Uses streaming for memory efficiency when loading large dictionary file
 */
(async function init() {
    const response = await fetch('words.txt.gz');
    const ds = new DecompressionStream('gzip');
    const stream = response.body.pipeThrough(ds);
    const reader = stream.getReader();
    let text = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += new TextDecoder().decode(value);
    }

    // Process each word and build both dictionaries
    text.split('\n').forEach(word => {
        word = word.trim().toLowerCase();
        if (word) {
            // Add complete word
            dictionary.add(word);
            
            // Build prefix dictionary for early pruning
            // e.g., for "HELLO", add "H", "HE", "HEL", "HELL", "HELLO"
            let prefix = '';
            for (const char of word) {
                prefix += char;
                prefixDictionary.add(prefix);
            }
        }
    });

    dictionaryLoaded = true;
})();

/**
 * Main solve function - handles UI state and initiates word finding
 */
function solve() {
    // Toggle between solve and reset states
    if (document.body.classList.contains('solved')) {
        document.body.classList.remove('solved');
        document.getElementById('gridInput').value = '';
        document.getElementById('visualGrid').innerHTML = '';
        document.getElementById('solutions').innerHTML = '';
        document.querySelector('button').textContent = 'Solve';
        return;
    }

    if (!dictionaryLoaded) {
        alert('Dictionary is still loading. Please wait...');
        return;
    }

    const grid = parseGrid();
    renderGrid(grid);
    const results = findWords(grid);
    document.querySelector('button').textContent = 'New Puzzle';
    displayResults(results);
}

/**
 * Convert text input into 2D array of characters
 */
function parseGrid() {
    const text = document.getElementById('gridInput').value.toUpperCase();
    return text.split('\n').map(row => row.split(''));
}

/**
 * Core word-finding algorithm
 * Returns Map of words to their paths through the grid
 */
function findWords(grid) {
    const words = new Map();
    
    // All possible movement directions (including diagonals)
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1], 
        [1, -1],  [1, 0],  [1, 1]
    ];

    /**
     * Depth-first search from a starting position
     * @param {number} x - Current x coordinate
     * @param {number} y - Current y coordinate
     * @param {Array} path - Array of coordinates forming current path
     * @param {string} currentWord - Word being built along current path
     * @param {Set} visited - Set of visited coordinates
     */
    function dfs(x, y, path, currentWord, visited) {
        const normalized = currentWord.toLowerCase();

        // Early exit if current prefix isn't in dictionary
        if (!prefixDictionary.has(normalized)) return;

        // If we've found a valid word, add it to results
        if (dictionary.has(normalized)) {
            words.set(currentWord, path);
        }

        // Try all possible directions
        for (const [dx, dy] of directions) {
            const nx = x + dx;
            const ny = y + dy;

            // Skip if:
            // 1. Out of bounds
            // 2. Empty cell (space)
            // 3. Already visited in current path
            if (nx < 0 || ny < 0 ||
                nx >= grid.length ||
                ny >= grid[nx].length ||
                !grid[nx][ny].trim() ||
                visited.has(`${nx},${ny}`)) continue;

            // Create new path and visited set for this branch
            const newPath = [...path, { x: nx, y: ny }];
            const newVisited = new Set(visited);
            newVisited.add(`${nx},${ny}`);

            // Continue DFS with new letter added
            dfs(nx, ny, newPath, currentWord + grid[nx][ny], newVisited);
        }
    }

    // Start DFS from every cell in the grid
    grid.forEach((row, i) => {
        row.forEach((char, j) => {
            if (char.trim()) {
                dfs(i, j, [{ x: i, y: j }], char, new Set([`${i},${j}`]));
            }
        });
    });

    // Sort by length first, then alphabetically
    return Array.from(words.entries())
        .sort((a, b) => a[0].length - b[0].length || a[0].localeCompare(b[0]));
}

/**
 * Display results grouped by word length
 */
function displayResults(results) {
    // Group results by length
    const groups = results.reduce((acc, [word, path]) => {
        const length = word.length;
        acc[length] = acc[length] || [];
        acc[length].push({ word, path });
        return acc;
    }, {});

    // Update UI with grouped results
    const solutionsDiv = document.getElementById('solutions');
    solutionsDiv.innerHTML = Object.entries(groups)
        .map(([length, words]) => `
            <div class="solution-group">
                <h3>${length} letters (${words.length})</h3>
                ${words.map(({ word, path }) => `
                    <div class="solution-word" 
                        onmouseenter='drawPath(${JSON.stringify(path)})'
                        onmouseleave="document.getElementById('gridOverlay').innerHTML = ''; 
                        document.querySelectorAll('.grid-cell').forEach(c => c.classList.remove('starting-cell'))">
                        ${word}
                    </div>
                `).join('')}
            </div>
        `).join('');
}

function renderGrid(grid) {
    const container = document.getElementById('visualGrid');
    container.innerHTML = '';

    // Calculate cell size based on container width
    const containerWidth = container.clientWidth;
    const gridSize = Math.max(grid.length, grid[0].length);
    const cellSize = Math.min(40, (containerWidth - (gridSize - 1) * 5) / gridSize);
    const spacing = cellSize + 5;

    // Create SVG overlay with proper dimensions
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'gridOverlay';
    svg.style.width = `${spacing * gridSize}px`;
    svg.style.height = `${spacing * gridSize}px`;
    container.appendChild(svg);

    // Create cell elements
    grid.forEach((row, i) => {
        row.forEach((char, j) => {
            if (!char.trim()) return;

            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.textContent = char;
            cell.dataset.x = i;
            cell.dataset.y = j;
            cell.style.left = `${j * spacing}px`;
            cell.style.top = `${i * spacing}px`;
            cell.style.width = `${cellSize}px`;
            cell.style.height = `${cellSize}px`;
            container.appendChild(cell);
        });
    });

    // Mark as solved to hide the input
    document.body.classList.add('solved');
}


function drawPath(path) {
    const svg = document.getElementById('gridOverlay');
    svg.innerHTML = '';

    // Remove previous highlights
    document.querySelectorAll('.grid-cell').forEach(cell => {
        cell.classList.remove('starting-cell');
    });

    // Highlight starting cell
    const startCell = document.querySelector(`.grid-cell[data-x="${path[0].x}"][data-y="${path[0].y}"]`);
    if (startCell) {
        startCell.classList.add('starting-cell');
    }

    // Calculate cell size and spacing
    const cellSize = parseInt(startCell.style.width);
    const spacing = cellSize + 5;

    // Draw path with adjusted coordinates
    const points = path.map(({ x, y }) =>
        `${y * spacing + cellSize / 2},${x * spacing + cellSize / 2}`
    ).join(' ');

    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('points', points);
    polyline.classList.add('path-line');
    svg.appendChild(polyline);
}
