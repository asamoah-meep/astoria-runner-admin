/**
 * A set of functions called "actions" for `meetup`
 */

import { parseFromString, Node } from "dom-parser";
import { RunningEvent } from "../../../models/runningEvent";
import { Context } from "koa";

const EVENT_DATE_REGEX = new RegExp(/<time dateTime="([\dT:-]+)".+?>/);
const EVENT_TITLE_REGEX = new RegExp(/<title>(.+)\|(.+)<\/title>/);

async function processRunningEvent(item: Node): Promise<RunningEvent|null>{
   
  const linkTag: Node = item.getElementsByTagName("guid")[0];
  const link: string|null = linkTag?.textContent;

  if (link == null)
      return null;
  
  const eventResponse: Response = await fetch(link);
  if (!eventResponse.ok)
    return null;
  
  const pageText: string = await eventResponse.text();

  const titleMatches = EVENT_TITLE_REGEX.exec(pageText);
  const title = titleMatches?.[1];
  if (title == null)
      return null;

  const atDelim: number | undefined = title.includes("@") ? title.indexOf("@") : undefined;
  const commaDelim: number | undefined = title.includes(",") ? title.indexOf(",") : undefined;
  let titleDelimiterIndex = title.length;
  if(atDelim && commaDelim)
      titleDelimiterIndex = Math.min(commaDelim, atDelim);
  else if(atDelim)
      titleDelimiterIndex = atDelim;
  else if(commaDelim)
      titleDelimiterIndex = commaDelim;

  const truncatedTitle = title.substring(0,titleDelimiterIndex).trim();
  
  const dateMatches = EVENT_DATE_REGEX.exec(pageText);
  const dateString = dateMatches?.[1];
 
  
  return {
      title: truncatedTitle,
      link: link,
      dateStr: dateString
  }
}

export default {
  rss: async (ctx: Context) => {
    const rssResponse= await fetch("https://www.meetup.com/astoriarunners/events/rss/");
    if (!rssResponse.ok){
        ctx.response.body = "Error fetching RSS data from meetup: " + rssResponse.text;
        ctx.response.status = rssResponse.status;
        return;
    }
    const rssData = await rssResponse.text();

    const filteredRSSData = rssData.split("\n").slice(1).join("\n"); //Removing top RSS tag
    const domData = parseFromString(filteredRSSData);
    const items: Node[] = domData.getElementsByTagName("item");

    const events: RunningEvent[] = (await Promise.all(
      items.map(processRunningEvent)))
      .filter(ele => ele != null);
    ctx.response.body = events;
    ctx.response.status = 200;
  },

  event: async (ctx: Context) => {
    const eventId = ctx.request.query.eventId;
    const url = `https://www.meetup.com/astoriarunners/events/${eventId}/`;
    const eventResponse= await fetch(url);
    if (!eventResponse.ok){
        ctx.response.body = "Error fetching RSS data from meetup: " + eventResponse.text;
        ctx.response.status = eventResponse.status;
        return;
    }
    const eventData = await eventResponse.text();
    ctx.response.body = eventData;
    ctx.response.status = 200;
  }
};
