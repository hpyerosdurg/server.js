const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let onlinePlayers = 0;
let playerWallets = {}; 
let activeBets = {};    

let gameState = {
    status: 'betting', 
    timeLeft: 12, 
    history: []
};

const suits = [
    { icon: '♠', color: 'black-suit' }, { icon: '♥', color: 'red-suit' },   
    { icon: '♦', color: 'red-suit' }, { icon: '♣', color: 'black-suit' }  
];
const cardFaces = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const cardValues = { 'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13 };

function drawCard() {
    const face = cardFaces[Math.floor(Math.random() * cardFaces.length)];
    const suit = suits[Math.floor(Math.random() * suits.length)];
    return { face, suit };
}

setInterval(() => {
    if (gameState.status === 'betting') {
        gameState.timeLeft--;
        if (gameState.timeLeft <= 0) {
            gameState.status = 'showdown';
            gameState.timeLeft = 10; 

            const dragonCard = drawCard();
            const tigerCard = drawCard();
            const dVal = cardValues[dragonCard.face];
            const tVal = cardValues[tigerCard.face];

            let winner = "Tie";
            if (dVal > tVal) winner = "Dragon";
            if (tVal > dVal) winner = "Tiger";

            gameState.history.unshift(winner);
            if (gameState.history.length > 5) gameState.history.pop();

            Object.keys(activeBets).forEach(socketId => {
                const pBet = activeBets[socketId];
                if (pBet && playerWallets[socketId] !== undefined) {
                    if (pBet.type === winner) {
                        playerWallets[socketId] += (pBet.amount * 2);
                    }
                    io.to(socketId).emit('walletUpdate', playerWallets[socketId]);
                }
            });

            io.emit('gameResult', { dragonCard, tigerCard, winner, history: gameState.history });
            activeBets = {};
        }
    } else if (gameState.status === 'showdown') {
        gameState.timeLeft--;
        if (gameState.timeLeft <= 0) {
            gameState.status = 'betting';
            gameState.timeLeft = 12; 
        }
    }
    io.emit('timeUpdate', { status: gameState.status, timeLeft: gameState.timeLeft });
}, 1000);

io.on('connection', (socket) => {
    onlinePlayers++;
    io.emit('playerCount', onlinePlayers);

    playerWallets[socket.id] = 1000; 
    socket.emit('walletUpdate', playerWallets[socket.id]);

    socket.on('playerBet', (betData) => {
        if (gameState.status !== 'betting') return;

        const currentWallet = playerWallets[socket.id] || 0;
        if (currentWallet >= betData.amount) {
            playerWallets[socket.id] -= betData.amount;
            socket.emit('walletUpdate', playerWallets[socket.id]);

            if (!activeBets[socket.id]) {
                activeBets[socket.id] = { type: betData.type, amount: betData.amount };
            } else {
                activeBets[socket.id].type = betData.type;
                activeBets[socket.id].amount += betData.amount;
            }
        }
    });

    socket.on('disconnect', () => {
        onlinePlayers--;
        io.emit('playerCount', onlinePlayers);
        delete playerWallets[socket.id];
        delete activeBets[socket.id];
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
              
