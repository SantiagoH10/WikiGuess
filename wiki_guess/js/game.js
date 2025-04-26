// Game state
const gameState = {
    currentArticle: null,
    wordStatus: {},
    wordIndex: {},
    foundWords: 0,
    totalWords: 0,
    guessCount: 0,
    totalGuessCount: 0,
    completedArticles: 0,
    isLoading: false,
    titleWords: [],
    timerInterval: null
};

// DOM elements
const elements = {
    articleDisplay: document.getElementById('article-display'),
    guessInput: document.getElementById('guess-input'),
    guessBtn: document.getElementById('guess-btn'),
    newGameBtn: document.getElementById('new-game-btn'),
    foundCounter: document.getElementById('found-counter'),
    totalWordsDisplay: document.getElementById('total-words'),
    guessCounter: document.getElementById('guess-counter'),
    hintText: document.getElementById('hint-text'),
    completedCounter: document.getElementById('completed-counter'),
    totalGuessesDisplay: document.getElementById('total-guesses'),
    loadingIndicator: document.getElementById('loading-indicator'),
    minLanguagesInput: document.getElementById('min-languages'),
    guessList: document.getElementById('guess-list'),
    loadingOverlay: document.getElementById('loading-overlay'),
    launchGameBtn: document.getElementById('launch-game-btn'),
    timer: document.getElementById('timer')
};

// Timer functions
const timer = {
    start() {
        let seconds = 0;
        if (gameState.timerInterval) clearInterval(gameState.timerInterval);
        gameState.timerInterval = setInterval(() => {
            seconds++;
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            elements.timer.textContent = `Time: ${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
        }, 1000);
    },

    stop() {
        if (gameState.timerInterval) {
            clearInterval(gameState.timerInterval);
        }
    }
};

// Article processing functions
const articleProcessor = {
    handleParentheses(text) {
        return text.replace(/\s*\([^)]*\)/g, '');
    },

    processContent(content) {
        // Split on spaces first
        const words = content.split(/\s+/)
            .flatMap(word => {
                // Then handle special characters
                const parts = word.split(/(-|\/|'|"|,|\(|\))/);
                return parts.filter(part => part && part.length > 0);
            })
            .map(word => word.replace(/[^\w']/g, ''))
            .filter(word => word.length > 0);
    
        const uniqueWords = {};
        gameState.wordIndex = {};
    
        words.forEach((word, index) => {
            const lowerWord = word.toLowerCase();
            if (this.isCommonWord(lowerWord)) {
                gameState.wordStatus[lowerWord] = true;
            } else {
                if (!gameState.wordIndex[lowerWord]) {
                    gameState.wordIndex[lowerWord] = {
                        originalForms: new Set([word]),
                        positions: new Set([index])
                    };
                } else {
                    gameState.wordIndex[lowerWord].originalForms.add(word);
                    gameState.wordIndex[lowerWord].positions.add(index);
                }
                uniqueWords[lowerWord] = word;
                if (!gameState.wordStatus.hasOwnProperty(lowerWord)) {
                    gameState.wordStatus[lowerWord] = false;
                }
            }
        });
    
        return Object.keys(uniqueWords);
    },

    processTitleWords(title) {
        const words = title.split(/\s+/)
            .map(word => word.replace(/[^\w']/g, ''))
            .filter(word => word.length > 0);
        
        gameState.titleWords = words.map(word => word.toLowerCase());
        
        words.forEach(word => {
            const lowerWord = word.toLowerCase();
            if (!this.isCommonWord(lowerWord) && !gameState.wordStatus.hasOwnProperty(lowerWord)) {
                gameState.wordStatus[lowerWord] = false;
            }
        });
    },

    isCommonWord(word) {
        return word.length < 3 || ['the', 'and', 'for', 'are', 'was', 'its', 'who', 'has', 'had', 'his', 'her', 'this', 'that', 'they', 'with', 'from'].includes(word);
    }
};

// Wikipedia API functions
const wikiAPI = {
    async getMultiLanguageArticle() {
        try {
            const minLanguages = elements.minLanguagesInput ? 
                parseInt(elements.minLanguagesInput.value) || 20 : 20;
            
            setLoading(true);
            
            let foundSuitableArticle = false;
            let attempts = 0;
            const maxAttempts = 300;
            
            while (!foundSuitableArticle && attempts < maxAttempts) {
                attempts++;
                const randomData = await this.getRandomArticle();
                const langCount = await this.checkLanguageCount(randomData.pageId);
                
                if (langCount >= minLanguages) {
                    foundSuitableArticle = true;
                    await this.getAndDisplayArticle(randomData.title);
                }
            }
            
            if (!foundSuitableArticle) {
                this.handleNoSuitableArticle(minLanguages);
            }
        } catch (error) {
            this.handleError(error);
        }
    },

    async getRandomArticle() {
        const response = await fetch(
            'https://en.wikipedia.org/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=1&format=json&origin=*'
        );
        const data = await response.json();
        return {
            pageId: data.query.random[0].id,
            title: data.query.random[0].title
        };
    },

    async checkLanguageCount(pageId) {
        const response = await fetch(
            `https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllimit=500&pageids=${pageId}&format=json&origin=*`
        );
        const data = await response.json();
        return (data.query.pages[pageId].langlinks || []).length;
    },

    async getAndDisplayArticle(title) {
        try {
            setLoading(true);
            const pageId = await this.getPageId(title);
            const langCount = await this.checkLanguageCount(pageId);
            const extract = await this.getArticleContent(pageId);
            
            const processedContent = articleProcessor.handleParentheses(extract);
            
            gameState.currentArticle = {
                title: title,
                content: processedContent,
                hint: `This article is available in ${langCount} languages`
            };

            this.updateGameState();
        } catch (error) {
            this.handleError(error);
        }
    },

    async getPageId(title) {
        const response = await fetch(
            `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&format=json&origin=*`
        );
        const data = await response.json();
        const pageId = Object.keys(data.query.pages)[0];
        if (pageId === '-1') throw new Error('Article not found');
        return pageId;
    },

    async getArticleContent(pageId) {
        const response = await fetch(
            `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&pageids=${pageId}&format=json&origin=*`
        );
        const data = await response.json();
        return data.query.pages[pageId].extract;
    },

    updateGameState() {
        articleProcessor.processContent(gameState.currentArticle.content);
        articleProcessor.processTitleWords(gameState.currentArticle.title);
        gameState.totalWords = Object.keys(gameState.wordStatus)
            .filter(word => !gameState.wordStatus[word]).length;
        
        timer.start();
        uiController.updateDisplay();
        setLoading(false);
    },

    handleError(error) {
        console.error('Error fetching Wikipedia article:', error);
        setLoading(false);
        alert(`Error: ${error.message}. Trying again...`);
        setTimeout(() => this.getMultiLanguageArticle(), 2000);
    },

    handleNoSuitableArticle(minLanguages) {
        alert(`Couldn't find an article with at least ${minLanguages} languages. Trying with a lower minimum...`);
        if (elements.minLanguagesInput) {
            elements.minLanguagesInput.value = Math.max(5, minLanguages - 5);
        }
        this.getMultiLanguageArticle();
    }
};

// Game mechanics
const gameMechanics = {
    normalizeWord(word) {
        return word.toLowerCase().trim();
    },

    checkTitleGuess(guess) {
        if (!gameState.currentArticle) return false;
        if (guess === '') return false;

        const normalizedGuess = this.normalizeWord(guess);
        const normalizedTitle = this.normalizeWord(gameState.currentArticle.title);
        const simplifiedTitle = normalizedTitle
            .replace(/\s*\(.*?\)/g, '')
            .replace(/\s*,.*$/, '')
            .trim();

        if (normalizedGuess === simplifiedTitle) return true;
        if (simplifiedTitle.startsWith('the ') && 
            normalizedGuess === simplifiedTitle.substring(4)) return true;

        return false;
    },

    submitGuess() {
        if (!gameState.currentArticle) return;
        
        const guess = this.normalizeWord(elements.guessInput.value);
        if (guess.length < 3) {
            elements.guessInput.value = '';
            return;
        }
        
        this.updateGuessStats(guess);
        
        if (this.checkTitleGuess(guess)) {
            this.handleCorrectTitleGuess();
            return true;
        }
        
        return this.handleWordGuess(guess);
    },

    updateGuessStats(guess) {
        elements.guessInput.value = '';
        gameState.guessCount++;
        gameState.totalGuessCount++;
        uiController.updateGuessCounters();
        uiController.addToGuessList(guess);
    },

    handleCorrectTitleGuess() {
        timer.stop();
        // Reveal all words
        Object.keys(gameState.wordIndex).forEach(word => {
            gameState.wordStatus[word] = true;
        });
        gameState.foundWords = gameState.totalWords;
        
        // Update UI immediately
        uiController.updateDisplay();
        
        setTimeout(() => {
            alert(`Congratulations! You've guessed the article title: "${gameState.currentArticle.title}"!`);
            gameState.completedArticles++;
            uiController.updateCompletedCounter();
        }, 500);
    },

    handleWordGuess(guess) {
        const normalizedGuess = this.normalizeWord(guess);
        if (gameState.wordIndex.hasOwnProperty(normalizedGuess) && !gameState.wordStatus[normalizedGuess]) {
            // Mark word as found
            gameState.wordStatus[normalizedGuess] = true;
            gameState.foundWords++;
            
            // Update UI
            uiController.updateFoundCounter();
            uiController.updateArticleDisplay(); // Add this to refresh display
            
            if (gameState.foundWords === gameState.totalWords) {
                this.handleAllWordsFound();
            }
            return true;
        }
        return false;
    },

    handleAllWordsFound() {
        setTimeout(() => {
            alert(`Congratulations! You've found all words! The article was about "${gameState.currentArticle.title}"`);
            gameState.completedArticles++;
            uiController.updateCompletedCounter();
            initGame();
        }, 500);
    }
};

// UI Controller
const uiController = {
    updateDisplay() {
        this.updateArticleDisplay();
        this.updateCounters();
        elements.hintText.textContent = gameState.currentArticle.hint;
    },

    updateArticleDisplay() {
        if (!gameState.currentArticle?.content) {
            elements.articleDisplay.innerHTML = "Loading article...";
            return;
        }
    
        // First split by whitespace and common punctuation
        const words = gameState.currentArticle.content.split(/(\s+|[.,;"()]|\-|\/)/);
        const html = words.map((part, index) => {
            // Handle pure whitespace and standard punctuation
            if (part.trim() === '' || /^[.,;"()]$/.test(part)) return part;
            
            // Handle hyphens and forward slashes
            if (part === '-' || part === '/') return part;
    
            // Handle words with apostrophes
            if (part.includes("'")) {
                return part.split(/(')/)
                    .map(subPart => {
                        if (subPart === "'") return subPart;
                        if (!subPart) return ''; // Handle empty parts
                        
                        const cleanWord = subPart.replace(/[^\w']/g, '');
                        if (cleanWord === '') return subPart;
                        
                        const lowerWord = cleanWord.toLowerCase();
                        const indexedWord = gameState.wordIndex[lowerWord];
                        if (indexedWord) {
                            const isRevealed = this.shouldRevealWord(lowerWord);
                            const wordClass = isRevealed ? 'revealed-word' : 'hidden-word';
                            const dataAttr = `data-word-index="${index}" data-clean-word="${lowerWord}"`;
                            return `<span class="${wordClass}" ${dataAttr}>${subPart}</span>`;
                        }
                        return subPart;
                    }).join('');
            }
    
            // Handle regular words
            const cleanWord = part.replace(/[^\w]/g, '');
            if (cleanWord === '') return part;
    
            const lowerWord = cleanWord.toLowerCase();
            const indexedWord = gameState.wordIndex[lowerWord];
            if (indexedWord) {
                const isRevealed = this.shouldRevealWord(lowerWord);
                const wordClass = isRevealed ? 'revealed-word' : 'hidden-word';
                const dataAttr = `data-word-index="${index}" data-clean-word="${lowerWord}"`;
                return `<span class="${wordClass}" ${dataAttr}>${part}</span>`;
            }
    
            return part;
        }).join('');
        
        elements.articleDisplay.innerHTML = html;
    },

    formatArticlePart(part) {
        if (part.trim() === '' || /[.,;()\-]/.test(part)) return part;

        const cleanWord = part.replace(/[^\w']/g, '');
        if (cleanWord === '') return part;

        const lowerWord = cleanWord.toLowerCase();
        return this.shouldRevealWord(lowerWord) ? 
            `<span class="revealed-word">${part}</span>` : 
            `<span class="hidden-word">${part}</span>`;
    },

    shouldRevealWord(word) {
        return word.length <= 2 || 
               gameState.wordStatus[word] === true || 
               (gameState.titleWords.includes(word) && 
                gameState.guessCount > 0 && 
                gameMechanics.checkTitleGuess(''));
    },

    updateCounters() {
        elements.foundCounter.textContent = gameState.foundWords;
        elements.totalWordsDisplay.textContent = gameState.totalWords;
        elements.guessCounter.textContent = gameState.guessCount;
    },

    updateGuessCounters() {
        elements.guessCounter.textContent = gameState.guessCount;
        if (elements.totalGuessesDisplay) {
            elements.totalGuessesDisplay.textContent = gameState.totalGuessCount;
        }
    },

    updateFoundCounter() {
        elements.foundCounter.textContent = gameState.foundWords;
    },

    updateCompletedCounter() {
        if (elements.completedCounter) {
            elements.completedCounter.textContent = gameState.completedArticles;
        }
    },

    addToGuessList(guess) {
        const guessItem = document.createElement('div');
        guessItem.textContent = guess;
        elements.guessList.appendChild(guessItem);
    }
};

// Utility functions
function setLoading(isLoading) {
    gameState.isLoading = isLoading;
    if (isLoading) {
        elements.loadingOverlay.classList.add('active');
        elements.loadingIndicator.style.display = 'block';
        elements.launchGameBtn.style.display = 'none';
    } else {
        elements.loadingOverlay.classList.remove('active');
        elements.loadingIndicator.style.display = 'none';
    }
}

function initGame() {
    Object.assign(gameState, {
        guessCount: 0,
        foundWords: 0,
        wordStatus: {},
        wordIndex: {},
        titleWords: []
    });
    
    setLoading(false);
    wikiAPI.getMultiLanguageArticle();
}

// Event listeners
function initEventListeners() {
    elements.guessBtn?.addEventListener('click', () => gameMechanics.submitGuess());
    elements.guessInput?.addEventListener('keypress', e => {
        if (e.key === 'Enter') gameMechanics.submitGuess();
    });
    elements.newGameBtn?.addEventListener('click', () => {
        timer.stop();
        initGame();
    });
    elements.launchGameBtn?.addEventListener('click', () => {
        setLoading(false);
        initGame();
    });
}

// Start the game
initEventListeners();
initGame();
