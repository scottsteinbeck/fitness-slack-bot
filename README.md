# Fitness Slack BOT

> Based on https://github.com/brandonshin/slackbot-workout work.

## Usage

- Modify config.json
    * *teamDomain*: your slack's team domain
    * *botId*: bot ID which you can get from your slack's integrations page
    * *channelId*: slack channel ID that bot will live
    * *channelName*: slack channel name that bot will live
    * *waitTime*: time that user has to perform an exercise
    * *minInterval*: minimum lottery interval
    * *maxInterval*: maximum lottery interval
- Get Slack Tokens
    * *BOT_TOKEN*: Get one here: https://${config.teamDomain}.slack.com/services => Bots Integration
    * *USER_TOKEN*: Get one here: https://api.slack.com/web => Create Token
- Run it!

```
$ BOT_TOKEN=<your-token> USER_TOKEN=<your-token> node index.js
```

## Heroku Deployment

```sh
$ heroku git:remote -a <your-dyno>
$ heroku heroku config:set USER_TOKEN=<your-token> BOT_TOKEN=<your-token>
$ heroku ps:scale web=1
$ git push heroku master
```
