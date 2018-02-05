const Discord = require('discord.js')
const TVDB = require('node-tvdb')
const spacetime = require('spacetime')

let config = require('../' + process.env["CONFIG_FILE"]);

// Uncomment the following for testing purposes
spacetime.now = () => spacetime('February 2, 2018 18:00:03', 'America/Los_Angeles');

async function checkShowAsync(context, client, seriesId) {
    let episode = null;

    try
    {
        const today = spacetime.now()
        today.goto('America/New_York')
        const episodes = await tvdbClient.getEpisodesByAirDate(seriesId, today.format('iso-short'));
        if (episodes.length == 0)
        {
            return null;
        }

        episode = episodes[0];
    }
    catch (err)
    {
        if (err.response && err.response.status == 404)
        {
            // 404 error means nothing aired today (assuming series id exists....)
            return null;
        }

        throw err;
    }

    try
    {
        const series = await tvdbClient.getSeriesById(seriesId);

        return {
            seasonNum: episode['airedSeason'],
            episodeNum: episode['airedEpisodeNumber'],
            episodeName: episode['episodeName'],
            airsTime: series['airsTime']
        }
    }
    catch (err)
    {
        throw err;
    }
}

async function checkShowsAsync(context, server) {
    tvdbClient = new TVDB(process.env['TVDB_KEY']);
    const shows = config['shows']

    for (let show of shows)
    {
        const seriesId = show['id'];
        const channelName = show['channel'];
        const episodeInfo = await checkShowAsync(context, tvdbClient, seriesId);
        if (episodeInfo !== null) {
            s = spacetime.now().startOf('quarterHour');
            s.goto('America/New_York');
            const currentTime = s.format('h:mm a');
            if (episodeInfo['airsTime'] === currentTime) {
                const messageText = `Episode ${episodeInfo['seasonNum']}x${episodeInfo['episodeNum']} - "${episodeInfo['episodeName']}" airing now. Mute channel to avoid spoilers`;
                context.log(messageText);
                const channel = server.channels.find("name", channelName);
                channel.send(messageText)
                    .then(message => message.pin())
                    .catch(err => context.log.error(err));
            }
        }
    }
}

module.exports = function (context) {
    const client = new Discord.Client();
    
    client.on('ready', () => {
        const server = client.guilds.get(process.env["SERVER_ID"])
        checkShowsAsync(context, server)
            .then(() => context.done())
            .catch(err => context.done(err));
    });

    client.login(process.env["DISCORD_BOT_TOKEN"]);
};