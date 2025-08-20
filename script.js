

// Game state variables
let gameData = {
    main: {},
    cards: {}
};

let playerState = {
    currency: 0,
    generators: {},
    upgrades: [],
    achievements: [],
    cards: [],
    selectedCards: [],
    legacy: {
        completions: 0,
        bonus: 0
    },
    narrativeStage: 'stage1'
};

// DOM element references
const currencyDisplay = document.getElementById('currency-display');
const cpsDisplay = document.getElementById('cps-display');
const clickButton = document.getElementById('click-button');
const generatorsContainer = document.getElementById('generators-container');
const upgradesContainer = document.getElementById('upgrades-container');
const cardsContainer = document.getElementById('cards-container');
const cardActionsContainer = document.getElementById('card-actions-container');
const narrativeTitle = document.getElementById('narrative-title');
const narrativeText = document.getElementById('narrative-text');

// ---
// Core Game Logic
// ---

async function loadAllGameData() {
    try {
        const [gameDataResponse, cardsResponse] = await Promise.all([
            fetch('gameData.json'),
            fetch('cards.json')
        ]);
        
        if (!gameDataResponse.ok || !cardsResponse.ok) {
            throw new Error(`HTTP error! status: ${gameDataResponse.status} or ${cardsResponse.status}`);
        }
        
        gameData.main = await gameDataResponse.json();
        gameData.cards = await cardsResponse.json();
        
        console.log('Main game data loaded:', gameData.main);
        console.log('Card game data loaded:', gameData.cards);
        initializeGame();
    } catch (error) {
        console.error('Could not load game data:', error);
        useEmbeddedGameData();
    }
}

function useEmbeddedGameData() {
    gameData.main = {
        "meta": {
            "engine": {
                "tick_seconds_recommended": 0.1,
                "currency_start": 100
            },
            "theme": {
                "currency_name": "Coins"
            }
        },
        "narrative_stages": [
            {
                "id": "stage1",
                "order": 1,
                "unlock_condition": { "type": "auto" },
                "theme": { 
                    "name": "Glass in Crypto Castle", 
                    "story_text": "In the beginning, there was just a glass of water in a castle made of promises..." 
                }
            },
            {
                "id": "stage2", 
                "order": 2,
                "unlock_condition": { "type": "currency", "value": 500 },
                "theme": { 
                    "name": "Bitcoin Wizard Jesus: Water → Wine", 
                    "story_text": "And lo, the water became wine, and the people said 'surely this is magic'..." 
                }
            }
        ],
        "generators": [
            {
                "id": "generator1",
                "tier": 1,
                "baseCost": 10,
                "baseRate": 2.0,
                "costScaling": 1.15,
                "unlock_condition": { "type": "narrative_stage", "value": "stage1" },
                "theme": { "name": "Tap Wallet", "description": "Manual taps and tiny auto-taps." }
            },
            {
                "id": "generator2",
                "tier": 2,
                "baseCost": 100,
                "baseRate": 8.0,
                "costScaling": 1.15,
                "unlock_condition": { "type": "narrative_stage", "value": "stage1" },
                "theme": { "name": "Solo Miner", "description": "A single enthusiast-run rig in the castle basement." }
            }
        ],
        "upgrades": [
            {
                "id": "upgrade1",
                "cost": 300,
                "effect": { "type": "multiplier", "target": "global", "value": 2.0 },
                "unlock_condition": { "type": "narrative_stage", "value": "stage2" },
                "theme": { "name": "Water → Wine Multiplier", "description": "The miracle spreads. Double all production." }
            }
        ]
    };
    
    gameData.cards = {
        "card_types": [
            {
                "id": "btc_miner",
                "name": "Bitcoin Miner",
                "rarity": "common",
                "description": "Early adopter energy. Boosts click power.",
                "effects": { "type": "click_power", "base_value": 2.0, "scaling_per_level": 1.5 },
                "image": "https://via.placeholder.com/100x140/FFD700/000000?text=BTC",
                "intrinsic_value": 25,
                "unlock_condition": { "type": "narrative_stage", "value": "stage1" }
            },
            {
                "id": "eth_staker",
                "name": "ETH Staker",
                "rarity": "uncommon",
                "description": "Vitalik's blessing. Provides steady autoclick.",
                "effects": { "type": "autoclick_rate", "base_value": 1.0, "scaling_per_level": 0.8 },
                "image": "https://via.placeholder.com/100x140/00FF00/000000?text=ETH",
                "intrinsic_value": 75,
                "unlock_condition": { "type": "narrative_stage", "value": "stage2" }
            }
        ],
        "combination_rules": {
            "basic_combination": {
                "input_requirements": { "card_count": 2, "same_name": true, "same_rarity": true }
            }
        }
    };
    console.log('Using embedded game data for testing');
    initializeGame();
}

function initializeGame() {
    playerState.currency = gameData.main.meta.engine.currency_start;
    
    updateUI();
    renderGenerators();
    renderUpgrades();
    renderCards();
    renderCardActions();
    
    setInterval(gameLoop, gameData.main.meta.engine.tick_seconds_recommended * 1000);
    clickButton.addEventListener('click', handleManualClick);
    
    const initialStage = gameData.main.narrative_stages.find(stage => stage.id === playerState.narrativeStage);
    if (initialStage) {
        displayNarrative(initialStage.theme.name, initialStage.theme.story_text);
    }
}

// ---
// Core Game Logic
// ---

function handleManualClick() {
    let clickValue = 1;
    let clickMultiplier = 1;

    const clickUpgrades = gameData.main.upgrades.filter(u => 
        u.effect.target === 'currency_per_click' && playerState.upgrades.includes(u.id)
    );
    clickUpgrades.forEach(upgrade => {
        if (upgrade.effect.type === 'multiplier') {
            clickMultiplier *= upgrade.effect.value;
        }
    });

    playerState.cards.forEach(card => {
        const cardData = getCardData(card.id);
        if (cardData && cardData.effects.type === 'click_power') {
            clickValue += cardData.effects.base_value * (card.level || 1);
        }
        if (cardData && cardData.effects.type === 'click_multiplier') {
            clickMultiplier *= cardData.effects.base_value * (card.level || 1);
        }
    });

    playerState.currency += clickValue * clickMultiplier;
    updateUI();
    renderGenerators();
}

function gameLoop() {
    const cps = calculateCPS();
    playerState.currency += cps * gameData.main.meta.engine.tick_seconds_recommended;
    
    checkNarrativeUnlocks();
    updateUI();
}

function calculateCPS() {
    let totalCps = 0;
    let globalMultiplier = 1;

    for (const generatorId in playerState.generators) {
        const generatorCount = playerState.generators[generatorId];
        const generatorData = gameData.main.generators.find(g => g.id === generatorId);
        if (generatorData) {
            totalCps += generatorCount * generatorData.baseRate;
        }
    }

    playerState.upgrades.forEach(upgradeId => {
        const upgradeData = gameData.main.upgrades.find(u => u.id === upgradeId);
        if (upgradeData && upgradeData.effect.target === 'global' && upgradeData.effect.type === 'multiplier') {
            globalMultiplier *= upgradeData.effect.value;
        }
    });

    playerState.cards.forEach(card => {
        const cardData = getCardData(card.id);
        if (cardData && cardData.effects.type === 'autoclick_rate') {
            totalCps += cardData.effects.base_value * (card.level || 1);
        }
        if (cardData && cardData.effects.type === 'global_multiplier') {
            globalMultiplier *= cardData.effects.base_value * (card.level || 1);
        }
    });

    return totalCps * globalMultiplier;
}

// ---
// Generator & Upgrade Functions
// ---

function calculateGeneratorCost(generatorId) {
    const generatorData = gameData.main.generators.find(g => g.id === generatorId);
    const ownedCount = playerState.generators[generatorId] || 0;
    return Math.floor(generatorData.baseCost * Math.pow(generatorData.costScaling, ownedCount));
}

function buyGenerator(generatorId) {
    const cost = calculateGeneratorCost(generatorId);
    if (playerState.currency >= cost) {
        playerState.currency -= cost;
        playerState.generators[generatorId] = (playerState.generators[generatorId] || 0) + 1;
        updateUI();
        renderGenerators();
    }
}

function buyUpgrade(upgradeId) {
    const upgradeData = gameData.main.upgrades.find(u => u.id === upgradeId);
    if (upgradeData && playerState.currency >= upgradeData.cost && !playerState.upgrades.includes(upgradeId)) {
        playerState.currency -= upgradeData.cost;
        playerState.upgrades.push(upgradeId);
        updateUI();
        renderUpgrades();
    }
}

function renderGenerators() {
    generatorsContainer.innerHTML = '';
    const currentStageOrder = gameData.main.narrative_stages.find(stage => stage.id === playerState.narrativeStage).order;
    
    gameData.main.generators.forEach(generator => {
        let shouldShow = false;
        if (generator.unlock_condition.type === 'narrative_stage') {
            const unlockStage = gameData.main.narrative_stages.find(stage => stage.id === generator.unlock_condition.value);
            if (unlockStage && unlockStage.order <= currentStageOrder) {
                shouldShow = true;
            }
        }
        
        if (shouldShow) {
            const cost = calculateGeneratorCost(generator.id);
            const ownedCount = playerState.generators[generator.id] || 0;
            const canAfford = playerState.currency >= cost;
            const generatorCard = document.createElement('div');
            generatorCard.classList.add('item-card');
            
            if (!canAfford) {
                generatorCard.classList.add('disabled');
            } else {
                generatorCard.classList.remove('disabled');
            }

            generatorCard.innerHTML = `
                <h4>${generator.theme.name} (${ownedCount})</h4>
                <p>${generator.theme.description}</p>
                <p class="item-cost">Cost: ${formatNumber(cost)} ${gameData.main.meta.theme.currency_name}</p>
            `;
            
            generatorCard.addEventListener('click', () => {
                if (playerState.currency >= calculateGeneratorCost(generator.id)) {
                    buyGenerator(generator.id);
                }
            });
            generatorsContainer.appendChild(generatorCard);
        }
    });
}

function renderUpgrades() {
    upgradesContainer.innerHTML = '';
    const currentStageOrder = gameData.main.narrative_stages.find(stage => stage.id === playerState.narrativeStage).order;
    
    gameData.main.upgrades.forEach(upgrade => {
        const isOwned = playerState.upgrades.includes(upgrade.id);
        let shouldShow = false;
        if (upgrade.unlock_condition.type === 'narrative_stage') {
            const unlockStage = gameData.main.narrative_stages.find(stage => stage.id === upgrade.unlock_condition.value);
            if (unlockStage && unlockStage.order <= currentStageOrder && !isOwned) {
                shouldShow = true;
            }
        }
        if (shouldShow) {
            const canAfford = playerState.currency >= upgrade.cost;
            const upgradeCard = document.createElement('div');
            upgradeCard.classList.add('item-card');
            if (!canAfford) {
                upgradeCard.classList.add('disabled');
            }
            upgradeCard.innerHTML = `
                <h4>${upgrade.theme.name}</h4>
                <p>${upgrade.theme.description}</p>
                <p class="item-cost">Cost: ${formatNumber(upgrade.cost)} ${gameData.main.meta.theme.currency_name}</p>
            `;
            upgradeCard.addEventListener('click', () => {
                if (canAfford) {
                    buyUpgrade(upgrade.id);
                }
            });
            upgradesContainer.appendChild(upgradeCard);
        }
    });
}

// ---
// Card Functions
// ---

function getCardData(cardId) {
    return gameData.cards.card_types.find(c => c.id === cardId);
}

function generateCard() {
    const cardData = gameData.cards.card_types[Math.floor(Math.random() * gameData.cards.card_types.length)];
    if (cardData) {
        const newCard = { id: cardData.id, level: 1 };
        playerState.cards.push(newCard);
        playerState.selectedCards = []; 
        updateUI();
        renderCards();
        renderCardActions();
    }
}

function handleCardClick(index) {
    const cardElement = cardsContainer.children[index];
    const cardIndex = playerState.selectedCards.indexOf(index);
    
    if (cardIndex > -1) {
        playerState.selectedCards.splice(cardIndex, 1);
        cardElement.classList.remove('selected');
    } else {
        if (playerState.selectedCards.length < 2) {
            playerState.selectedCards.push(index);
            cardElement.classList.add('selected');
        } else {
            const oldIndex = playerState.selectedCards.shift();
            if (cardsContainer.children[oldIndex]) {
                cardsContainer.children[oldIndex].classList.remove('selected');
            }
            playerState.selectedCards.push(index);
            cardElement.classList.add('selected');
        }
    }
    renderCardActions();
}

function combineCards() {
    if (playerState.selectedCards.length !== 2) {
        alert("You must select exactly two cards to combine.");
        return;
    }

    const [index1, index2] = playerState.selectedCards;
    const card1 = playerState.cards[index1];
    const card2 = playerState.cards[index2];
    const card1Data = getCardData(card1.id);
    const card2Data = getCardData(card2.id);

    if (card1Data.name === card2Data.name && card1Data.rarity === card2Data.rarity) {
        const sortedIndices = playerState.selectedCards.slice().sort((a, b) => b - a);
        
        playerState.cards.splice(sortedIndices[0], 1);
        playerState.cards.splice(sortedIndices[1], 1);
        
        const newLevel = (card1.level || 1) + 1;
        playerState.cards.push({ id: card1.id, level: newLevel });

        playerState.selectedCards = [];

        updateUI();
        renderCards();
        renderCardActions();
    } else {
        alert("These cards cannot be combined!");
    }
}

function sellSelectedCards() {
    if (playerState.selectedCards.length === 0) {
        alert("You must select at least one card to sell.");
        return;
    }

    playerState.selectedCards.sort((a, b) => b - a);
    
    playerState.selectedCards.forEach(index => {
        const card = playerState.cards[index];
        const cardData = getCardData(card.id);
        if (cardData) {
            playerState.currency += cardData.intrinsic_value * (card.level || 1);
            playerState.cards.splice(index, 1);
        }
    });

    playerState.selectedCards = [];

    updateUI();
    renderCards();
    renderCardActions();
}

// ---
// UI & Display Functions
// ---

function updateUI() {
    const formattedCurrency = formatNumber(Math.floor(playerState.currency));
    currencyDisplay.textContent = `${formattedCurrency} ${gameData.main.meta.theme.currency_name}`;
    const formattedCps = formatNumber(calculateCPS());
    cpsDisplay.textContent = `${formattedCps} / sec`;
}

function renderCards() {
    cardsContainer.innerHTML = '';
    playerState.cards.forEach((card, index) => {
        const cardData = getCardData(card.id);
        if (cardData) {
            const cardElement = document.createElement('div');
            cardElement.classList.add('item-card');
            if (playerState.selectedCards.includes(index)) {
                cardElement.classList.add('selected');
            }
            cardElement.innerHTML = `
                <h4>${cardData.name} (Lvl ${card.level || 1})</h4>
                <p>${cardData.description}</p>
                <img src="${cardData.image}" alt="${cardData.name}" style="width:100px;">
            `;
            cardElement.addEventListener('click', () => handleCardClick(index));
            cardsContainer.appendChild(cardElement);
        }
    });
}

function renderCardActions() {
    cardActionsContainer.innerHTML = '';

    const generateButton = document.createElement('button');
    generateButton.textContent = 'Generate New Card';
    generateButton.addEventListener('click', generateCard);
    cardActionsContainer.appendChild(generateButton);

    const combineButton = document.createElement('button');
    combineButton.textContent = 'Combine Selected Cards';
    const canCombine = checkCanCombine();
    if (canCombine) {
        combineButton.addEventListener('click', combineCards);
    } else {
        combineButton.classList.add('disabled');
    }
    cardActionsContainer.appendChild(combineButton);

    const sellButton = document.createElement('button');
    sellButton.textContent = `Sell Selected Cards (${getSellValue()})`;
    const canSell = playerState.selectedCards.length > 0;
    if (canSell) {
        sellButton.addEventListener('click', sellSelectedCards);
    } else {
        sellButton.classList.add('disabled');
    }
    cardActionsContainer.appendChild(sellButton);
}

function checkCanCombine() {
    if (playerState.selectedCards.length !== 2) return false;
    const [index1, index2] = playerState.selectedCards;
    const card1 = playerState.cards[index1];
    const card2 = playerState.cards[index2];
    const card1Data = getCardData(card1.id);
    const card2Data = getCardData(card2.id);

    return card1Data && card2Data && card1Data.name === card2Data.name && card1Data.rarity === card2Data.rarity;
}

function getSellValue() {
    let totalValue = 0;
    playerState.selectedCards.forEach(index => {
        const card = playerState.cards[index];
        const cardData = getCardData(card.id);
        if (cardData) {
            totalValue += cardData.intrinsic_value * (card.level || 1);
        }
    });
    return formatNumber(totalValue);
}

function checkNarrativeUnlocks() {
    const currentStage = gameData.main.narrative_stages.find(stage => stage.id === playerState.narrativeStage);
    if (!currentStage) return;
    
    const nextStage = gameData.main.narrative_stages.find(stage => stage.order === currentStage.order + 1);

    if (nextStage) {
        const condition = nextStage.unlock_condition;
        let unlocked = false;
        
        if (condition.type === 'currency' && playerState.currency >= condition.value) {
            unlocked = true;
        } else if (condition.type === 'auto') {
            unlocked = true;
        }

        if (unlocked) {
            playerState.narrativeStage = nextStage.id;
            displayNarrative(nextStage.theme.name, nextStage.theme.story_text);
            renderGenerators();
            renderUpgrades();
        }
    }
}

function displayNarrative(title, text) {
    narrativeTitle.textContent = title;
    narrativeText.textContent = text;
}

function formatNumber(num) {
    if (num >= 1000000000) {
        return (num / 1000000000).toFixed(2) + 'B';
    }
    if (num >= 1000000) {
        return (num / 1000000).toFixed(2) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(2) + 'K';
    }
    return Math.floor(num).toString();
}

// Start the game by loading data
loadAllGameData();

