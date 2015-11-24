'use strict';

const BOT_TOKEN = process.env.BOT_TOKEN;
const request = require('request');

class Bot {
    constructor(channelId) {
        this.channelId = channelId;
    }

    postMessage(message) {
        return new Promise((resolve, reject) => {
            request.post({
                url: 'https://slack.com/api/chat.postMessage',
                qs: {
                    token: BOT_TOKEN,
                    channel: this.channelId,
                    as_user: true,
                    text: message
                }
            }, (err, res, body) => {
                if (err) reject(err);
                resolve(body);
            });
        });
    }
}

module.exports = Bot;
