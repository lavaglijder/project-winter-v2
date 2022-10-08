// Project winter bot v2

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, GatewayIntentBits, GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel, MessagePayload } from "discord.js";
import * as dotenv from 'dotenv';
import * as fs from "fs"
dotenv.config()

// Constants, to lazy to put it in a json config
const PLAYERS_NEEDED = 6;
const GUILD_ID = '894319824979787846';
const MATCH_PLANNING_CHANNEL = '894323870922854471';
const ANNOUNCEMENT_CHANNEL = '894323150362394665';
const VOICE_CHAT_CHANNEL = '894322416623443978';
const PROJECT_WINTER_ROLE = '896496125681467412';
const MATCH_PLANNING_ROLE = '1028021380089917471';
const SIGNED_UP_ROLE = '896496233131175956';

// Thanks stack overflow <3
Date.prototype.getWeek = function (dowOffset) {
    /*getWeek() was developed by Nick Baicoianu at MeanFreePath: http://www.meanfreepath.com */
    
    dowOffset = typeof(dowOffset) == 'number' ? dowOffset : 0; //default dowOffset to zero
    var newYear = new Date(this.getFullYear(),0,1);
    var day = newYear.getDay() - dowOffset; //the day of week the year begins on
    day = (day >= 0 ? day : day + 7);
    var daynum = Math.floor((this.getTime() - newYear.getTime() - 
    (this.getTimezoneOffset()-newYear.getTimezoneOffset())*60000)/86400000) + 1;
    var weeknum;
    //if the year starts before the middle of a week
    if(day < 4) {
        weeknum = Math.floor((daynum+day-1)/7) + 1;
        if(weeknum > 52) {
            nYear = new Date(this.getFullYear() + 1,0,1);
            nday = nYear.getDay() - dowOffset;
            nday = nday >= 0 ? nday : nday + 7;
            /*if the next year starts before the middle of
              the week, it is week #1 of that year*/
             weeknum = nday < 4 ? 1 : 53;
        }
    }
    else {
        weeknum = Math.floor((daynum+day-1)/7);
    }
    return weeknum;
}

function getDateOfWeek(w, y) {
    var simple = new Date(y, 0, 1 + (w - 1) * 7);
    var dow = simple.getDay();
    var ISOweekStart = simple;
    if (dow <= 4)
        ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else
        ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    return ISOweekStart;
}

function getWeekNumber(d) {
    d = new Date(+d);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    var yearStart = new Date(d.getFullYear(), 0, 1);
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
    return [d.getFullYear(), weekNo];
}
  
function weeksInYear(year) {
    var d = new Date(year, 11, 31);
    var week = getWeekNumber(d)[1];
    return week == 1 ? 52 : week;
}


// No stack overflow from here muhahaha
function toNewDate(day, hour, minutes, lastWeek) {
    let nextWeek = lastWeek + 1;
    let year = new Date().getFullYear();
    if(nextWeek > weeksInYear(year)) {
        nextWeek = 1;
        year = year + 1;
    }
    hour = hour - 2;

    let tempDate = getDateOfWeek(nextWeek, year);
    return new Date(tempDate.getTime() + (((day) * 24 + hour) * 60 + minutes) * 60 * 1000)
}

let bot = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildScheduledEvents,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions
    ]
});

let eventsFile = fs.readFileSync("./events.json");
let events = JSON.parse(eventsFile);

const saveFile = () => {
    fs.writeFileSync("./events.json", JSON.stringify(events, null, 4));
}

// Date to DD/MM/YYYY HH:MM +0000 format (+0000 cause thats the timezone it gives and too lazy to convert)
const dateToString = (date) => date.getDate() + "/" + (date.getMonth() + 1) + "/" + date.getFullYear() + " " +
 (date.getHours()) + ":" + (date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes()) + "+0000";

bot.on('ready', () => {
    console.log("ready");

    // Button message

    // const row = new ActionRowBuilder().addComponents(
    //     new ButtonBuilder().setCustomId("Interested").setLabel("Interested in playing Project Winter").setStyle(ButtonStyle.Secondary).setEmoji("❓")
    // ).addComponents(
    //     new ButtonBuilder().setCustomId("owner").setLabel("I own Project Winter").setStyle(ButtonStyle.Success).setEmoji("❄️")
    // ).addComponents(
    //     new ButtonBuilder().setCustomId("dlc").setLabel("I own the Blackout DLC").setStyle(ButtonStyle.Success).setEmoji("🌙")
    // ).addComponents(
    //     new ButtonBuilder().setCustomId("notifications").setLabel("I want to be notified instantly about new matches").setStyle(ButtonStyle.Danger).setEmoji("👋")
    // );

    // bot.guilds.resolve(GUILD_ID).channels.resolve("894322849572065310").send({
    //     content:"If you want a notification role click on of the buttons",
    //     components: [row]
    // })

    setInterval(async () => {

        // Recurring events
        let recurringEvents = events.weeklySessions;
        let guild = bot.guilds.resolve(GUILD_ID);
        for (let index = 0; index < recurringEvents.length; index++) {
            const eventData = recurringEvents[index];
            let nextSession = toNewDate(eventData.day, eventData.hour, eventData.minutes, eventData.lastWeek);
            if(nextSession.getTime() < new Date().getTime() + 1000 * 60 * 60 * 24 * 7) {
                if(eventData.lastWeek < nextSession.getWeek()) {
                    eventData.lastWeek = nextSession.getWeek()
                    guild.scheduledEvents.create({
                        scheduledStartTime: nextSession,
                        description: "Our usual weekly project winter session",
                        channel: VOICE_CHAT_CHANNEL,
                        name: eventData.sessionName,
                        privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
                        entityType: GuildScheduledEventEntityType.Voice
                    })
                }
            }
            recurringEvents[index] = eventData;
        }
        saveFile();

        // Current events
        let nextEventId = "";
        let nextEventMs = Number.MAX_VALUE
        await bot.guilds.resolve(GUILD_ID).scheduledEvents.fetch().then(eventCollection => {
            eventCollection.forEach(event => {
                if(event.scheduledStartTimestamp < nextEventMs) {
                    nextEventMs = event.scheduledStartTimestamp;
                    nextEventId = event.id;
                }

                // Create data for the event
                if(!events[event.id]) {
                    events[event.id] = {
                        "confirmed": false,
                        "reminded": false
                    }
                }

                let users = event.userCount;

                if(events[event.id].confirmed) return;
                if(users < PLAYERS_NEEDED) {
                    // Send a notification about a potential match to everyone 5 hours ahead if 1 player is needed
                    if(event.scheduledStartAt.getTime() - new Date().getTime() < 1000 * 60 * 60 * 5) {
                        if(events[event.id].reminded) return;
                        if(users < PLAYERS_NEEDED - 1) return;
                        event.guild.channels.resolve(MATCH_PLANNING_CHANNEL).send("<@&" + PROJECT_WINTER_ROLE + "> the following match is very close to have enough players please join :). \nIf you are interested to join please make sure to put yourself on interested in the event."+ 
                        "\nhttps://discord.com/events/" + GUILD_ID + "/" + event.id);
                        events[event.id].reminded = true;
                        saveFile();
                        return 
                    }
                    // Cancel the session 2 * missingplayers
                    let missingPlayers = PLAYERS_NEEDED - users;
                    let hoursToBeCancelled = missingPlayers * 2;
                    if(event.scheduledStartAt.getTime() - new Date().getTime() < 1000 * 60 * 60 * +hoursToBeCancelled) return; 
                    event.guild.channels.resolve(MATCH_PLANNING_CHANNEL).send("The event for " + dateToString(event.scheduledStartAt) + " has been cancelled due to a little player count.");
                    event.delete();
                    return;
                }

                // Send reminder to everyone 5 hours ahead
                if(event.scheduledStartAt.getTime() - new Date().getTime() < 1000 * 60 * 60 * 5) {
                    if(events[event.id].reminded) return;
                    events[event.id].reminded = true;
                    event.guild.channels.resolve(ANNOUNCEMENT_CHANNEL).send("<@&" + PROJECT_WINTER_ROLE + "> Reminder that this match is going to start today! \nIf you want to play together with us please make sure to put yourself as interested!"+ 
                    "\nhttps://discord.com/events/" + GUILD_ID + "/" + event.id);
                    saveFile();
                    return 
                } 

                event.guild.channels.resolve(ANNOUNCEMENT_CHANNEL).send("<@&" + PROJECT_WINTER_ROLE + "> a match has enough players to be played. \nIf you are interested to join please make sure to put yourself on interested in the event."+ 
                "\nhttps://discord.com/events/" + GUILD_ID + "/" + event.id);
            
                events[event.id].confirmed = true;
                saveFile();
                
            })
        })

        // Update the signed up role
        let role = guild.roles.resolve(SIGNED_UP_ROLE);

        events.nextEvent.id = nextEventId;
        
        let subscribers = await guild.scheduledEvents.resolve(nextEventId).fetchSubscribers();

        let guildMembers = await guild.members.fetch();
        guildMembers.forEach(member => {
            if(subscribers.has(member.id)) {
                member.roles.add(role.id);
                return;
            }
            member.roles.remove(role.id);
        })

        saveFile();

    }, 1000 * 60 * 5);
})

bot.on("guildScheduledEventCreate", guildScheduledEvent => {
    guildScheduledEvent.guild.channels.resolve(MATCH_PLANNING_CHANNEL).send("<@&" + MATCH_PLANNING_ROLE + "> potential match date. \nIf you are able to make it to this date please put yourself as interested in the event."+ 
    "\nhttps://discord.com/events/" + GUILD_ID + "/" + guildScheduledEvent.id);

    saveFile();
})

bot.on("interactionCreate", interaction => {
    if(!interaction.isButton()) return;
    let guild = bot.guilds.resolve(GUILD_ID);
    let member = guild.members.resolve(interaction.user.id);

    let updateRole = (roleid) => {
        let role = guild.roles.resolve(roleid);
        if(member.roles.resolve(roleid)) {
            member.roles.remove(roleid)
            interaction.reply({content: "Role `" + role.name + "` has been removed", ephemeral: true});
            return;
        }
        member.roles.add(roleid)
        interaction.reply({content: "Role `" + role.name + "` has been added", ephemeral: true});
        return;
    }

    switch(interaction.customId) {
        case "Interested":
            updateRole("896496099005698118");
            break;

        case "owner":
            updateRole(PROJECT_WINTER_ROLE);
            break;

        case "dlc":
            updateRole("896496189392965642");
            break;

        case "notifications":
            updateRole(MATCH_PLANNING_ROLE);
            break;
    }
})

bot.login(process.env.DISCORD_TOKEN)