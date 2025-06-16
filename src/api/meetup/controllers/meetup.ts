/**
 * A set of functions called "actions" for `meetup`
 */

export default {
  rss: async (ctx) => {
    const rssResponse= await fetch("https://www.meetup.com/astoriarunners/events/rss/");
    if (!rssResponse.ok){
        ctx.response.body = "Error fetching RSS data from meetup: " + rssResponse.text;
        ctx.response.status = rssResponse.status;
    }
    const rssData = await rssResponse.text();
    ctx.response.body = rssData;
    ctx.response.status = 200;
  },

  event: async (ctx) => {
    const eventId = ctx.request.query.eventId;
    const url = `https://www.meetup.com/astoriarunners/events/${eventId}/`;
    const eventResponse= await fetch(url);
    if (!eventResponse.ok){
        ctx.response.body = "Error fetching RSS data from meetup: " + eventResponse.text;
        ctx.response.status = eventResponse.status;
    }
    const eventData = await eventResponse.text();
    ctx.response.body = eventData;
    ctx.response.status = 200;
  }
};
