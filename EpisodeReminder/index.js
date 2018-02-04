const TVDB = require('node-tvdb')
const spacetime = require('spacetime')

async function checkShow(context, client, seriesId) {
    let episode = null;

    try
    {
        const episodes = await tvdbClient.getEpisodesByAirDate(seriesId, '2018-01-18');
        if (episodes.length == 0)
        {
            return null;
        }

        episode = episodes[0];
    }
    catch (err)
    {
        if (err.response.status != 404)
        {
            throw err;
        }

        // 404 error means nothing aired today (assuming series id exists....)
        return null;
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

async function checkShowsAsync(context) {
    tvdbClient = new TVDB('FC46768E0F90D59B');
    const episodeInfo = await checkShow(context, tvdbClient, '257655');
    if (episodeInfo !== null)
    {
        s = spacetime.now().startOf('quarterHour');
        s.goto('America/Chicago');
        context.log(s.format('time'));
    }
}

module.exports = function (context) {
    checkShowsAsync(context)
        .then(() => context.done())
        .catch(err => context.done(err));
};