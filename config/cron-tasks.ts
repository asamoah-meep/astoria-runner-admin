import { parseFromString, Node } from "dom-parser";
import { StrapiRunningEvent, MeetupRunningEvent } from "../src/models/runningEvent";
import { Context } from "koa";

const EVENT_DATE_REGEX = new RegExp(/<time dateTime="([\dT:-]+)".+?>/);
const EVENT_TITLE_REGEX = new RegExp(/<title>(.+)\|(.+)<\/title>/);

async function deleteOldEvents(targetUrl: string){
    const currentRunEventsResponse = await fetch(targetUrl);
    console.log(currentRunEventsResponse);
    const currentRunEvents: StrapiRunningEvent[] = (await currentRunEventsResponse.json())["data"];
    const eventsToDelete: StrapiRunningEvent[] = currentRunEvents.filter(ele => {
        const elementDate: number = Date.parse(ele.dateStr);
        const refDate: number = new Date().getTime();
        const dayDifference = (refDate-elementDate)/(1000*60*60*24);
        return dayDifference > 30;
    });

    console.log("Old events:");
    console.log(eventsToDelete);

    eventsToDelete.forEach(async (ele) => {
        const response = await fetch(targetUrl, {
            method: "DELETE"
        });
    });
}

async function fetchMeetupEvents(): Promise<MeetupRunningEvent[]> {
    const rssResponse= await fetch("https://www.meetup.com/astoriarunners/events/rss/");
    if (!rssResponse.ok){
        console.log("Error fetching RSS data from meetup: " + rssResponse.text);
        return;
    }
    const rssData = await rssResponse.text();

    const filteredRSSData = rssData.split("\n").slice(1).join("\n"); //Removing top RSS tag
    const domData = parseFromString(filteredRSSData);
    const rssItems: Node[] = domData.getElementsByTagName("item");

    //Post events
    return await Promise.all(
        rssItems.map(async(ele) => await processRunningEvent(ele)));
}

async function updateExistingEvents(meetupEvents: Record<string, MeetupRunningEvent>, strapiEvents: Record<string, StrapiRunningEvent>, targetUrl: string) {
    const modifiedEvents: StrapiRunningEvent[] = [];

    for(const strapiEventKey in strapiEvents) {
        if(strapiEventKey in meetupEvents){
            const strapiEvent = strapiEvents[strapiEventKey];
            const meetupEvent = meetupEvents[strapiEventKey];

            if(strapiEvent.link === meetupEvent.link && strapiEvent.title === meetupEvent.title)
                continue;

            modifiedEvents.push({
                id: strapiEvent.id,
                documentId: strapiEvent.documentId,
                title: meetupEvent.title,
                link: meetupEvent.link,
                dateStr: strapiEventKey
            });
        }
    }

    console.log("Modified events:");
    console.log(modifiedEvents);

    modifiedEvents.forEach(async (ele) => {
        const data = {
            data: {
                title: ele.title,
                link: ele.link,
                dateStr: ele.dateStr
            }
        }
        const response = await fetch(`${targetUrl}/${ele.documentId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data)
        });
    })
}

async function createNewEvents(meetupEvents: Record<string, MeetupRunningEvent>, strapiEvents: Record<string, StrapiRunningEvent>, targetUrl: string){
    const newEvents: MeetupRunningEvent[] = [];

    for(const meetupEventKey in meetupEvents) {
        if(!(meetupEventKey in strapiEvents)){
            newEvents.push(meetupEvents[meetupEventKey]);
        }
    }

    console.log("New events: ");
    console.log(newEvents);

    newEvents
    .forEach(async (ele) => {
        const data = {
            data: {
                title: ele.title,
                link: ele.link,
                dateStr: ele.dateStr
            }
        }
        const response = await fetch(targetUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data)
        });
    });
}

async function processRunningEvent(item: Node): Promise<MeetupRunningEvent|null>{
   
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
    runningEvents: {
        options: {
            // rule: "0 6 * * 2", // Scheduling on Tuesdays since we never schedule runs then,
            rule: "0 10 * * *", //Testing the function by scheduling it daily to see if anything breaks
            tz: "America/New_York"
        }, 
        task: async ({ strapi }) => {
            const baseUrl = strapi['internal_config'].server.absoluteUrl;
            const eventsUrl = `${baseUrl}/api/run-events`;

            deleteOldEvents(eventsUrl);
            const meetupEvents: MeetupRunningEvent[] = await fetchMeetupEvents();
            const meetupEventsMap: Record<string, MeetupRunningEvent> = meetupEvents.reduce( (acc, current) => {
                acc[current.dateStr] = current;
                return acc;
            }, {});
            const existingEvents: StrapiRunningEvent[] = (await (await fetch(eventsUrl)).json())["data"];
            const existingEventsMap: Record<string, StrapiRunningEvent> = existingEvents.reduce( (acc, current) => {
                acc[current.dateStr] = current;
                return acc;
            }, {});

            updateExistingEvents(meetupEventsMap, existingEventsMap, eventsUrl);
            createNewEvents(meetupEventsMap, existingEventsMap, eventsUrl);
        }
    }
}