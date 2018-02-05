const Discord = require('discord.js')
const TVDB = require('node-tvdb')
const spacetime = require('spacetime/immutable')

let config = require('../' + process.env["CONFIG_FILE"]);

// Uncomment the following for testing purposes
// spacetime.now = () => spacetime('February 2, 2018 18:00:03', 'America/Los_Angeles');

function formatMessageText(info) {
    const messageText = `Episode ${info['seasonNum']}x${info['episodeNum']} - "${info['episodeName']}" airing now. Mute channel to avoid spoilers`;
    return messageText;
}

function isNotFoundError(err) {
    return err.response && err.response.status == 404;
}

class EpisodeReminderHandler {
    constructor (azureContext) {
        this.azureContext = azureContext;
        this.discordClient = new Discord.Client();
        this.tvdbClient = new TVDB(process.env['TVDB_KEY']);
        this.shows = config['shows'];

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
        for (let show of this.shows) {
            const { id: seriesId, channel: channelName } = show;
            
            const info = await this.getInfoForReminder(seriesId);
            if (info)
            {
                const text = formatMessageText(info); 
                this.azureContext.log(text);
                await this.postPinnedMessageToDiscordChannel(channelName, text);
            }
        }
    }

    async getInfoForReminder(seriesId) {
        const episode = await this.getEpisodeForToday(seriesId);
        if (episode) {
            const series = await this.tvdbClient.getSeriesById(seriesId);
            return {
                seasonNum: episode['airedSeason'],
                episodeNum: episode['airedEpisodeNumber'],
                episodeName: episode['episodeName'],
                airsTime: series['airsTime']
            };
        }
        
        return null;
    }

    async postPinnedMessageToDiscordChannel(channelName, text) {
        const channel = this.discordServer.channels.find("name", channelName);
        const message = await channel.send(text);
        await message.pin();
    }

    async getEpisodeForToday(seriesId) {
        try {
            const today = spacetime.now('America/New_York').format('iso-short');
            const episodes = await this.tvdbClient.getEpisodesByAirDate(seriesId, today);

            // TODO: handle cases of multiple episodes aired on same day
            return (episodes.length > 0) ? episodes[0] : null;
        }
        catch (err) {
            if (isNotFoundError(err)) {
                // 404 returned if no episodes aired on that day (assuming series id is valid)
                return null;
            }

            throw err;
        }
    }

}

module.exports = function (context) {
    const handler = new EpisodeReminderHandler(context);
    handler.run();
};