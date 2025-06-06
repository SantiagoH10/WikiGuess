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
    revealBtn: document.getElementById('reveal-btn'),
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

    /* Stand-by for future use
    getSingularForm(word) {
        if (word.endsWith('s')) {
            return word.slice(0, -1);
        }
        return word;
    },
    */

    processContent(content) {
        console.group('Word Processing');
        console.log('Original content:', content);
        // Split on spaces first
        const words = content.split(/\s+/)
            .flatMap(word => {
            // Then handle special characters
            const parts = word.split(/(-|\/|'|"|,|\(|\))/);
            console.log('Split word:', word, 'into parts:', parts);
            return parts.filter(part => part && part.length > 0);
            })
            .map(word => {
                const cleaned = word.replace(/[^\wÀ-ÿ']/g, '');
                console.log('Cleaned word:', { original: word, cleaned });
                return cleaned;
            })
            .filter(word => word.length > 0);

        console.log('Processed words:', words);
    
        const uniqueWords = {};
        gameState.wordIndex = {};
        
    
        console.group('Word Indexing');
        words.forEach((word, index) => {
            const lowerWord = removeAccents(word.toLowerCase());
            const normalizedWord = gameMechanics.normalizeWord(lowerWord);

            console.log('Indexing word:', { 
                original: word, 
                lowercase: lowerWord,
                normalized: normalizedWord,
                hasAccents: word !== removeAccents(word),
                position: index 
            });
            
        if (!gameState.wordIndex[normalizedWord]) {
            gameState.wordIndex[normalizedWord] = {
                originalForms: new Set([word]),
                positions: new Set([index])
            };
            console.log(`New word indexed: ${normalizedWord}`, gameState.wordIndex[normalizedWord]);
        } else {
            gameState.wordIndex[normalizedWord].originalForms.add(word);
            gameState.wordIndex[normalizedWord].positions.add(index);
            console.log(`Updated existing word: ${normalizedWord}`, gameState.wordIndex[normalizedWord]);
        }
        uniqueWords[normalizedWord] = word;
        gameState.wordStatus[normalizedWord] = false;
        
        });
        
        console.log('Final word index:', gameState.wordIndex);
        console.log('Word status map:', gameState.wordStatus);
        console.groupEnd();
        
        return Object.keys(uniqueWords);
    },

    processTitleWords(title) {
        console.log('Processing title:', title);
        const words = title.split(/\s+/)
            .map(word => word.replace(/[^\w']/g, ''))
            .filter(word => word.length > 0);

        console.log('Title words after cleaning:', words);
        
        gameState.titleWords = words.map(word => gameMechanics.normalizeWord(word));

        console.log('Normalized title words:', gameState.titleWords);
        
        words.forEach(word => {
            const normalizedWord = gameMechanics.normalizeWord(word);
            if (!gameState.wordStatus.hasOwnProperty(normalizedWord)) {
                gameState.wordStatus[normalizedWord] = false;
                console.log(`Added word to status: ${normalizedWord}`);
            }
        });
    },
    
};

// Wikipedia API functions
const wikiAPI = {
    async getMultiLanguageArticle() {
        try {
            const minLanguages = elements.minLanguagesInput ? 
                parseInt(elements.minLanguagesInput.value) || 1 : 1;
            
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
    console.log('Checking language count for pageId:', pageId);
    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllimit=500&pageids=${pageId}&format=json&origin=*`;
    console.log('Full URL:', url);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('Response data:', data);
    console.log('Available page IDs:', Object.keys(data.query.pages));
    console.log('Looking for pageId:', pageId);
    
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
    console.log('Getting page ID for title:', title);
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&format=json&origin=*`;
    console.log('Full URL:', url);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('Page ID response:', data);
    const pageId = Object.keys(data.query.pages)[0];
    console.log('Extracted pageId:', pageId);
    
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
        console.log(`Error: ${error.message}. Trying again...`);
        setTimeout(() => this.getMultiLanguageArticle(), 2000);
    },

    handleNoSuitableArticle(minLanguages) {
        console.log(`Couldn't find an article with at least ${minLanguages} languages. Trying with a lower minimum...`);
        if (elements.minLanguagesInput) {
            elements.minLanguagesInput.value = Math.max(5, minLanguages - 5);
        }
        this.getMultiLanguageArticle();
    }
};

// Game mechanics
const gameMechanics = {
    normalizeWord(word) {
        const normalized = removeAccents(word.toLowerCase().trim());
        console.log('Normalized word:', normalized);
        return normalized;
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
        console.group('Word Guess');
        const normalizedGuess = this.normalizeWord(guess);
        console.log('Guess processing:', {
            original: guess,
            normalized: normalizedGuess,
            existsInIndex: gameState.wordIndex.hasOwnProperty(normalizedGuess),
            alreadyFound: gameState.wordStatus[normalizedGuess]
        });
        
        if (gameState.wordIndex.hasOwnProperty(normalizedGuess) && !gameState.wordStatus[normalizedGuess]) {
            console.log('Found in index:', gameState.wordIndex[normalizedGuess]);
            gameState.wordStatus[normalizedGuess] = true;
            gameState.foundWords++;
            
            uiController.updateFoundCounter();
            uiController.updateArticleDisplay();
            
            if (gameState.foundWords === gameState.totalWords) {
                this.handleAllWordsFound();
            }
            
            console.log('Word successfully guessed');
            console.groupEnd();
            return true;
        }
        
        console.log('Word not found or already guessed');
        console.groupEnd();
        return false;
    },

    handleAllWordsFound() {
        setTimeout(() => {
            alert(`Congratulations! You've found all words! The article was about "${gameState.currentArticle.title}"`);
            gameState.completedArticles++;
            uiController.updateCompletedCounter();
            initGame();
        }, 500);
    },

    handleReveal() {
        timer.stop();
        // Reveal all words
        Object.keys(gameState.wordIndex).forEach(word => {
            gameState.wordStatus[word] = true;
        });
        gameState.foundWords = gameState.totalWords;
        
        // Update UI
        uiController.updateDisplay();
        
        // Show article title
        alert(`The article was about: "${gameState.currentArticle.title}"`);
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
        console.group('Article Display Update');
        if (!gameState.currentArticle?.content) {
            console.log('No article content available');
            console.groupEnd();
            elements.articleDisplay.innerHTML = "Loading article...";
            return;
        }
    
        // First split by whitespace and common punctuation
        const words = gameState.currentArticle.content.split(/(\s+|[.,;"()]|\-|\/)/);
        console.log('Split content into parts:', words);

        const html = words.map((part, index) => {
            /*  Debugger
                console.group(`Processing part: "${part}" at index ${index}`);
            */

            // Handle pure whitespace and standard punctuation
            if (part.trim() === '' || /^[.,;"()]$/.test(part)) return part;
                console.log('Punctuation or whitespace - keeping as is');
                console.groupEnd();
            
            // Handle hyphens and forward slashes
            if (part === '-' || part === '/' || part === '—' || part === '–') return part;
    
            // Handle words with apostrophes
            if (part.includes("'")) {
                console.group(`Processing apostrophe in: "${part}"`);
                const result = part.split(/(')/)
                    .map(subPart => {
                        console.log(`Processing subpart: "${subPart}"`);
                        if (subPart === "'") {
                            console.log('Apostrophe character - keeping as is');
                            return subPart;
                        }
                        if (!subPart) {
                            console.log('Empty subpart - skipping');
                            return '';
                        }
                        
                        const cleanWord = subPart.replace(/[^\wÀ-ÿ']/g, '');
                        console.log('Cleaned subpart:', {
                            original: subPart,
                            cleaned: cleanWord
                        });
                        if (cleanWord === '') {
                            console.log('Empty clean word - keeping original');
                            return subPart;
                        }
                        
                        const normalizedWord = gameMechanics.normalizeWord(cleanWord);
                        const indexedWord = gameState.wordIndex[normalizedWord];
                        console.log('Word processing:', {
                            cleaned: cleanWord,
                            normalized: normalizedWord,
                            isIndexed: !!indexedWord,
                            shouldReveal: indexedWord ? this.shouldRevealWord(normalizedWord) : false
                        });
            
                        if (indexedWord) {
                            const isRevealed = this.shouldRevealWord(normalizedWord);
                            const wordClass = isRevealed ? 'revealed-word' : 'hidden-word';
                            const dataAttr = `data-word-index="${index}" data-clean-word="${normalizedWord}"`;
                            const result = `<span class="${wordClass}" ${dataAttr} aria-hidden="true">${subPart}</span>`;
                            console.log('Generated HTML:', result);
                            return result;
                        }
                        console.log('Word not indexed - keeping original');
                        return subPart;
                    }).join('');
                console.groupEnd();
                return result;
            }
    
            // Handle regular words
            console.group(`Processing regular word: "${part}"`);
            const cleanWord = part.replace(/[^\wÀ-ÿ']/g, '');  // Correct: preserves accents
            console.log('Cleaned word:', {
                original: part,
                cleaned: cleanWord
            });

            if (cleanWord === '') {
                console.log('Empty clean word - keeping original');
                console.groupEnd();
                return part;
            }

            const normalizedWord = gameMechanics.normalizeWord(cleanWord);
            const indexedWord = gameState.wordIndex[normalizedWord];
            console.log('Word processing:', {
                original: part,
                cleaned: cleanWord,
                normalized: normalizedWord,
                isIndexed: !!indexedWord,
                indexedData: indexedWord,
                shouldReveal: indexedWord ? this.shouldRevealWord(normalizedWord) : false
            });

            if (indexedWord) {
                const isRevealed = this.shouldRevealWord(normalizedWord);
                const wordClass = isRevealed ? 'revealed-word' : 'hidden-word';
                const dataAttr = `data-word-index="${index}" data-clean-word="${normalizedWord}"`;
                const result = `<span class="${wordClass}" ${dataAttr} aria-hidden="true">${part}</span>`;
                console.log('Generated HTML:', result);
                console.groupEnd();
                return result;
            }

            console.log('Word not indexed - keeping original');
            console.groupEnd();
            return part;
        }).join('');
        
        elements.articleDisplay.innerHTML = html;
    },

    formatArticlePart(part) {
        if (part.trim() === '' || /[.,;()\-]/.test(part)) return part;

        const cleanWord = part.replace(/[^\w']/g, '');
        if (cleanWord === '') return part;

        const normalizedWord = cleanWord.toLowerCase();
        return this.shouldRevealWord(normalizedWord) ? 
            `<span class="revealed-word">${part}</span>` : 
            `<span class="hidden-word">${part}</span>`;
    },

    shouldRevealWord(word) {
        return gameState.wordStatus[word] === true || 
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

function removeAccents(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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

    elements.revealBtn?.addEventListener('click', () => {
            gameMechanics.handleReveal();
    });
}

// Start the game
initEventListeners();
initGame();
console.log("game loaded!");