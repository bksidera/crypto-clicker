

// Game state variables
let gameData = {};
let playerState = {
    currency: 0,
    generators: {},
    upgrades: [],
    achievements: [],
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
const narrativeTitle = document.getElementById('narrative-title');
const narrativeText = document.getElementById('narrative-text');

// ---
// Core Game Logic
// ---

async function loadGameData() {
    try {
        const response = await fetch('gameData.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        gameData = await response.json();
        console.log('Game data loaded:', gameData);
        initializeGame();
    } catch (error) {
        console.error('Could not load game data:', error);
        // Fallback: use embedded data for testing
        useEmbeddedGameData();
    }
}

function useEmbeddedGameData() {
    // Minimal embedded data for testing
    gameData = {
        "meta": {
            "engine": {
                "tick_seconds_recommended": 0.1,
                "currency_start": 1
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
                "unlock_condition": { "type": "currency", "value": 100 },
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
                "baseCost": 15,
                "baseRate": 0.5,
                "costScaling": 1.15,
                "unlock_condition": { "type": "narrative_stage", "value": "stage1" },
                "theme": {
                    "name": "Tap Wallet",
                    "description": "Manual taps and tiny auto-taps."
                }
            },
            {
                "id": "generator2",
                "tier": 2,
                "baseCost": 100,
                "baseRate": 2.0,
                "costScaling": 1.15,
                "unlock_condition": { "type": "narrative_stage", "value": "stage1" },
                "theme": {
                    "name": "Solo Miner", 
                    "description": "A single enthusiast-run rig."
                }
            }
        ],
        "upgrades": [
            {
                "id": "upgrade1",
                "cost": 50,
                "effect": {
                    "type": "multiplier",
                    "target": "global",
                    "value": 2.0
                },
                "unlock_condition": { "type": "narrative_stage", "value": "stage1" },
                "theme": {
                    "name": "Double Power",
                    "description": "Double all production."
                }
            }
        ]
    };
    console.log('Using embedded game data for testing');
    initializeGame();
}

function initializeGame() {
    playerState.currency = gameData.meta.engine.currency_start;
    updateUI();
    
    // Start game loop
    setInterval(gameLoop, gameData.meta.engine.tick_seconds_recommended * 1000);
    
    // Set up click handler
    clickButton.addEventListener('click', handleManualClick);
    
    // Initialize narrative
    const initialStage = gameData.narrative_stages.find(stage => stage.id === playerState.narrativeStage);
    if (initialStage) {
        displayNarrative(initialStage.theme.name, initialStage.theme.story_text);
    }
    
    // Initial render
    renderGenerators();
    renderUpgrades();
}

function handleManualClick() {
    let clickValue = 1;
    
    // Check for click upgrades
    const clickUpgrades = gameData.upgrades.filter(u => 
        u.effect.target === 'currency_per_click' && playerState.upgrades.includes(u.id)
    );
    
    clickUpgrades.forEach(upgrade => {
        if (upgrade.effect.type === 'multiplier') {
            clickValue *= upgrade.effect.value;
        }
    });
    
    playerState.currency += clickValue;
    updateUI();
    // New lines added below
    renderGenerators();
    renderUpgrades();

}

function gameLoop() {
    const cps = calculateCPS();
    playerState.currency += cps * gameData.meta.engine.tick_seconds_recommended;
    updateUI();
    checkNarrativeUnlocks();
}

function calculateCPS() {
    let totalCps = 0;
    let globalMultiplier = 1;

    // Sum base rates from owned generators
    for (const generatorId in playerState.generators) {
        const generatorCount = playerState.generators[generatorId];
        const generatorData = gameData.generators.find(g => g.id === generatorId);
        if (generatorData) {
            totalCps += generatorCount * generatorData.baseRate;
        }
    }

    // Apply global multipliers from upgrades
    playerState.upgrades.forEach(upgradeId => {
        const upgradeData = gameData.upgrades.find(u => u.id === upgradeId);
        if (upgradeData && upgradeData.effect.target === 'global' && upgradeData.effect.type === 'multiplier') {
            globalMultiplier *= upgradeData.effect.value;
        }
    });

    return totalCps * globalMultiplier;
}

function calculateGeneratorCost(generatorId) {
    const generatorData = gameData.generators.find(g => g.id === generatorId);
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
    const upgradeData = gameData.upgrades.find(u => u.id === upgradeId);
    if (upgradeData && playerState.currency >= upgradeData.cost && !playerState.upgrades.includes(upgradeId)) {
        playerState.currency -= upgradeData.cost;
        playerState.upgrades.push(upgradeId);
        updateUI();
        renderUpgrades();
    }
}

// ---
// UI & Display Functions
// ---

function updateUI() {
    const formattedCurrency = formatNumber(Math.floor(playerState.currency));
    currencyDisplay.textContent = `${formattedCurrency} ${gameData.meta.theme.currency_name}`;
    const formattedCps = formatNumber(calculateCPS());
    cpsDisplay.textContent = `${formattedCps} / sec`;
}

function renderGenerators() {
    generatorsContainer.innerHTML = '';
    const currentStageOrder = gameData.narrative_stages.find(stage => stage.id === playerState.narrativeStage).order;
    
    gameData.generators.forEach(generator => {
        // Check if generator should be unlocked
        let shouldShow = false;
        
        if (generator.unlock_condition.type === 'narrative_stage') {
            const unlockStage = gameData.narrative_stages.find(stage => stage.id === generator.unlock_condition.value);
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
            }
            
            generatorCard.innerHTML = `
                <h4>${generator.theme.name} (${ownedCount})</h4>
                <p>${generator.theme.description}</p>
                <p class="item-cost">Cost: ${formatNumber(cost)} ${gameData.meta.theme.currency_name}</p>
            `;
            
            if (canAfford) {
                generatorCard.addEventListener('click', () => buyGenerator(generator.id));
            }
            
            generatorsContainer.appendChild(generatorCard);
        }
    });
}

function renderUpgrades() {
    upgradesContainer.innerHTML = '';
    const currentStageOrder = gameData.narrative_stages.find(stage => stage.id === playerState.narrativeStage).order;
    
    gameData.upgrades.forEach(upgrade => {
        const isOwned = playerState.upgrades.includes(upgrade.id);
        
        // Check if upgrade should be shown
        let shouldShow = false;
        
        if (upgrade.unlock_condition.type === 'narrative_stage') {
            const unlockStage = gameData.narrative_stages.find(stage => stage.id === upgrade.unlock_condition.value);
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
                <p class="item-cost">Cost: ${formatNumber(upgrade.cost)} ${gameData.meta.theme.currency_name}</p>
            `;
            
            if (canAfford) {
                upgradeCard.addEventListener('click', () => buyUpgrade(upgrade.id));
            }
            
            upgradesContainer.appendChild(upgradeCard);
        }
    });
}

function checkNarrativeUnlocks() {
    const currentStageOrder = gameData.narrative_stages.find(stage => stage.id === playerState.narrativeStage).order;
    const nextStage = gameData.narrative_stages.find(stage => stage.order === currentStageOrder + 1);

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

// Start the game
loadGameData();