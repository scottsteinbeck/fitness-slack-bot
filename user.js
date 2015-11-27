'use strict';

const USER_TOKEN = process.env.USER_TOKEN;
const request = require('request');

class User {
    constructor(id) {
        this.id = id;
    }

    getHandle() {
        return `@${this.username}`;
    }

    fetchInfo() {
        console.log(`> Fetching user info for ID: ${this.id}...`);

        return new Promise((resolve, reject) => {
            request.get({
                url: 'https://slack.com/api/users.info',
                qs: {
                    token: USER_TOKEN,
                    user: this.id
                },
                json: true
            }, (err, res, body) => {
                if (err) reject(err);
                Object.assign(this, {
                    username: body.user.name,
                    realName: body.user.profile.real_name,
                    isBot: body.user.is_bot
                });
                console.log(`New user${this.isBot ? ' [BOT]' : ''}: ${this.realName} (${this.username})`);
                resolve(this);
            });
        });
    }

    isActive() {
        return new Promise((resolve, reject) => {
            request.get({
                url: 'https://slack.com/api/users.getPresence',
                qs: {
                    token: USER_TOKEN,
                    user: this.id
                },
                json: true
            }, (err, res, body) => {
                if (err) reject(false);
                resolve(body && body.presence === 'active');
            });
        });
    }
}

module.exports = User;
