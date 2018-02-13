const Discord = require('discord.js')
const spacetime = require('spacetime/immutable')

let config = require('../' + process.env["CONFIG_FILE"]);

function isDaysBefore(releaseDate, numDays) {
    const today = spacetime.now('America/Chicago').startOf('day');
    const date = spacetime(releaseDate, 'America/Chicago').startOf('day');

    const dayBefore = date.subtract(numDays, 'days').startOf('day');
    return today.epoch === dayBefore.epoch;
}

function dateToDay(date) {
    const day = spacetime(date, 'America/Chicago')
    return day.format('day');
}

class MovieReminderHandler {
    constructor (azureContext) {
        this.azureContext = azureContext;
        this.discordClient = new Discord.Client();
        this.movies = config['movies'];

        this.discordClient.on('ready', this.onDiscordClientReady.bind(this));
    }

    run() {
        this.discordClient.login(process.env["DISCORD_BOT_TOKEN"]);
    }

    onDiscordClientReady() {
        const serverId = process.env["SERVER_ID"];
        this.discordServer = this.discordClient.guilds.get(serverId);

        this.postRemindersIfNecessaryAsync()
            .then(this.azureContext.done)
            .catch(err => {
                this.azureContext.log.error(err);
                this.azureContext.done(err);
            })
    }

    async postRemindersIfNecessaryAsync() {
        for (let movie of this.movies) {
            const currentHour = spacetime.now('America/Chicago').hour(); 
            this.azureContext.log(isDaysBefore(movie.date, 2));

            if (isDaysBefore(movie.date, 2) && currentHour == 11) {
                await this.postHypeMessageAsync(movie);
            }

            if (isDaysBefore(movie.date, 0) && currentHour == 11) {
                await this.postFirstWarningMessageAsync(movie);
            }

            if (isDaysBefore(movie.date, 0) && currentHour == 15) {
                await this.postFinalWarningMessageAsync(movie);
            }
        }
    }

    async postHypeMessageAsync(movie) {
        const day = dateToDay(movie.date);
        const text = `*${movie.name}* comes out on ${day}. Get hyped! Remember to mute the channel by then if you want to avoid spoilers. No rush though, I'll remind you again on ${day}`;
        this.azureContext.log(text);
        await this.postMessageToDiscordChannelAsync(movie.channel, text);
    }

    async postFirstWarningMessageAsync(movie) {
        const text = `*${movie.name}* comes out today. Remember to mute the channel soon. Try to avoid spoilers until I say so though!`;
        this.azureContext.log(text);
        await this.postMessageToDiscordChannelAsync(movie.channel, text);
    }

    async postFinalWarningMessageAsync(movie) {
        const text = `People are going to be watching *${movie.name}* soon. Mute the channel cuz spoilers are allowed!`;
        this.azureContext.log(text);
        await this.postMessageToDiscordChannelAsync(movie.channel, text);
    }

    async postMessageToDiscordChannelAsync(channelName, text) {
        const channel = this.discordServer.channels.find("name", channelName);
        await channel.send(text);
    }
}

module.exports = function (context) {
    const handler = new MovieReminderHandler(context);
    handler.run();
};