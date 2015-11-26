'use strict';

const request = require('request');
const WebSocket = require('ws');

const Bot = require('./bot');
const User = require('./user');

const config = require('./config');
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
    console.error(`No BOT_TOKEN env variable provided. Get one here: https://${config.teamDomain}.slack.com/services => Bots Integration`);
    return;
}
const USER_TOKEN = process.env.USER_TOKEN;
if (!USER_TOKEN) {
    console.error(`No USER_TOKEN env variable provided. Get one here: https://api.slack.com/web => Create Token`);
    return;
}

const SECOND = 1000;

let mainThread;
let waitingThread;
let bot = new Bot(config.channelId);
let users = [];
let waitingForResponse;
let waitingForResponseDetails = {};

function fetchUsers () {
    return new Promise((resolve, reject) => {
        fetchChannelUsers(config)
            .then(fetchUsersInfo)
            .then(filterBots)
            .then((filteredUsers) => {
                users = filteredUsers;
                return resolve();
            })
            .catch(reject);
	});
}

function fetchChannelUsers (config) {
    console.log(`> Fetching ${config.channelName} (${config.channelId}) channel users...`);

	return new Promise((resolve, reject) => {
		request.get({
            url: 'https://slack.com/api/channels.info',
            qs: {
                token: USER_TOKEN,
                channel: config.channelId
            },
            json: true
        }, (err, res, body) => {
			if (err) reject(err);
			resolve(body.channel.members);
		});
	});
};

function fetchUsersInfo (users) {
    return Promise.all(users.map(userId => {
        let newUser = new User(userId);
        return newUser.fetchInfo();
    }));
}

function filterBots (users) {
    return users.filter(user => !user.isBot);
}

function connectToRTM () {
    return new Promise((resolve, reject) => {
		request.get({
            url: 'https://slack.com/api/rtm.start',
            qs: {
                token: BOT_TOKEN
            },
            json: true
        }, (err, res, body) => {
			if (err) reject(err);
            let ws = new WebSocket(body.url);
            ws.on('open', () => {
                console.log('WebSocket connection opened');
                resolve();
            });
            ws.on('message', (message) => { handleWebSocketsEvent(JSON.parse(message)) });
		});
	});
}

function handleWebSocketsEvent (message) {
    // Where's my deconstruction NODE!? :(
    let channel = message.channel;
    let user = message.user;
    let type = message.type;
    let subtype = message.subtype;
    let text = message.text;

    if (channel !== config.channelId || type !== 'message') return;

    if (subtype === 'channel_join') {
        let newUser = new User(user);
        newUser.fetchInfo().then(() => {
            users.push(newUser);
            bot.postMessage(`[FITNESS BOT]: Hello, ${newUser.getHandle()}. Welcome to the game.`);
        });
        return;
    }

    if (subtype === 'channel_leave') {
        user = users.filter(u => u.id === user)[0];
        users = users.filter(u => u.id !== user);
        bot.postMessage(`[FITNESS BOT]: We will miss you ${user.getHandle()}.`).then(() => {
            if (waitingForResponse && waitingForResponseDetails.userId === user.id) exerciseDone();
        });
        return;
    }

    console.log(`[WebSocket Message] (${message.user === config.botId ? 'BOT' : 'USER'} #${message.user}): ${message.text}`);

    if (waitingForResponse && waitingForResponseDetails.userId === user && new RegExp('^done!?$', 'i').test(text)) {
        bot.postMessage(`[FITNESS BOT]: You made it. ${waitingForResponseDetails.exerciseDesc}. Great job ${waitingForResponseDetails.username}.`).then(() => {
            exerciseDone();
        });
    }
}

function getNextLotteryTime () {
    return (Math.round(Math.random() * (config.maxInterval - config.minInterval)) + config.minInterval);
}

function exerciseDone () {
    waitingForResponse = false;
    waitingForResponseDetails = {};
    clearWaitingThread();
    let nextLotteryTime = getNextLotteryTime();
    bot.postMessage(`[FITNESS BOT]: Next lottery in ${nextLotteryTime} minutes. Beware.`).then(() => {
        setupMainThread(nextLotteryTime);
    });
}

function getRandomFromDataset (dataset, exclude) {
    exclude = exclude || [];

    if (dataset.length === exclude.length) return false;

    let pick = dataset[Math.floor(Math.random() * dataset.length)];
    if (exclude.indexOf(pick.username) !== -1) {
        return getRandomFromDataset(dataset, exclude);
    }
    return pick;
}

function rollTheDice (opts) {
    opts = opts || {
        exclude: []
    };

    let randomUser = getRandomFromDataset(users, opts.exclude);

    if (!randomUser) {
        console.log('[INFO]: No active users, delaying for 5 minutes.');
        setTimeout(() => {
            rollTheDice();
        }, 5 * 60 * 1000);
        return;
    }

    console.log('> Picked user:', randomUser.username);

    randomUser.isActive().then(isActive => {
        if (!isActive) {
            console.log(`${randomUser.realName} ain't active! Looking for new victim...`);
            return rollTheDice({ exclude: opts.exclude.concat(randomUser.username) });
        }

        let exercise = getRandomFromDataset(config.exercises);
        let reps = Math.round(Math.random() * (exercise.maxReps - exercise.minReps)) + exercise.minReps;
        let exerciseDesc = `${reps} ${exercise.units} ${exercise.name}`;
        let message = `[FITNESS BOT]: ${randomUser.getHandle()} do ${exerciseDesc} now. You have only ${config.waitTime} minute${config.waitTime > 1 ? 's' : ''} \`(post 'done' or 'done!' case-insensitive to mark as done)\`.`;

        bot.postMessage(message).then(() => {
            waitingForResponse = true;
            waitingForResponseDetails = {
                userId: randomUser.id,
                username: randomUser.username,
                exerciseDesc: exerciseDesc,
                reps: exercise.maxReps
            };

            clearMainThread();
            setupWaitingThread(waitingForResponseDetails, config.waitTime);
        });
    });
}

function clearWaitingThread () {
    console.log('Waiting thread: STOPPED');
    clearInterval(waitingThread);
}

function setupWaitingThread (data, waitTime) {
    let passed = 0;
    let checkInterval = 1;
    let reminded = false;
    console.log('Waiting thread: STARTED');
    waitingThread = setInterval(() => {
        passed += checkInterval;

        if (passed <= waitTime / 2) return;

        if (passed >= waitTime) {
            bot.postMessage(`[FITNESS BOT]: Sorry, you failed. Better luck next time ${data.username}.`).then(() => {
                return bot.postMessage('[FITNESS BOT]: I will pick someone else then');
            }).then(() => {
                clearWaitingThread();
                rollTheDice({ exclude: [data.username] });
            });
        }

        if (!reminded) {
            let left = waitTime - passed;
            left = left > 0 ? left : 1;
            bot.postMessage(`[FITNESS BOT]: Come on ${data.username}, only ${left} minute${left > 1 ? 's' : ''} left`);
            reminded = true;
        }
    }, checkInterval * 60 * SECOND);
}

function clearMainThread () {
    console.log('Main thread: STOPPED');
    clearInterval(mainThread);
}

function setupMainThread (nextLotteryTime) {
    console.log('Main thread: STARTED');
    nextLotteryTime = nextLotteryTime || getNextLotteryTime();
    mainThread = setInterval(() => {
        rollTheDice();
    }, nextLotteryTime * 60 * SECOND);
}

fetchUsers()
    .then(connectToRTM)
    .then(rollTheDice);


// Heroku Boot Timeout Workaround
// https://devcenter.heroku.com/articles/error-codes#r10-boot-timeout
require('http').createServer((req, res) => {
    res.end('Hey there!')
}).listen(process.env.PORT);
