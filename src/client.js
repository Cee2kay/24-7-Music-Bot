import {
    GatewayIntents,
    createBot,
    getUser,
    startBot,
    sendMessage,
    stopBot
} from "discordeno";
import { promises as fs } from "fs";

import {
    createAudioPlayer,
    createAudioResource,
    entersState,
    joinVoiceChannel,
    AudioPlayerStatus,
    StreamType,
    VoiceConnectionStatus,
    NoSubscriberBehavior
} from "@discordjs/voice";
import { createDiscordenoAdapter } from "./adapter.js";
import play from "play-dl"

/* BOT EVENTS */

const botEvents = {
    
    async ready(client, payload) {
        console.log(`Logged in at ${ new Date().toISOString() } using shard ${ payload.shardId }`);

        getUser(client, client.id).then(user => console.log(`Logged in as ${ user.username }#${ user.discriminator }`));
    },

    async voiceServerUpdate(client, payload) {
        if (client._voiceServerUpdate) {
            client._voiceServerUpdate(client, payload);
        }
    },

    async voiceStateUpdate(client, payload) {
        if (client._voiceStateUpdate) {
            client._voiceStateUpdate(client, payload);
        }
    },

    async messageCreate(client, message) {
        if (message.content === "!join") {
            sendMessage(client, message.channelId, {
                content: `Joining <#${ message.channelId }>.`,
                allowedMentions: {
                    repliedUser: false
                }
            });

            const channelId = message.channelId.toString();
            const guildId = message.guildId.toString();

            const connection = joinVoiceChannel({
                channelId: channelId,
                guildId: guildId,
                adapterCreator: createDiscordenoAdapter(client, guildId)
            });


            let stream = await play.stream("https://www.youtube.com/watch?v=jfKfPfyJRdk")

            let resource = createAudioResource(stream.stream, {
                inputType: stream.type
            })
    
            let player = createAudioPlayer({
                behaviors: {
                    noSubscriber: NoSubscriberBehavior.Play
                }
            })
            
            player.play(resource)
    
            connection.subscribe(player)

            try {
                await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
            } catch (error) {
                connection.destroy();
                throw error;
            }

            entersState(player, AudioPlayerStatus.Playing, 5000);
            connection.subscribe(player);
        }
    }
};

/* STARTUP / SHUTDOWN */

let onGracefulExit = () => {
    process.exit();
};

process.on("SIGINT", onGracefulExit);
process.on("SIGTERM", onGracefulExit);

console.log("Started at " + new Date().toISOString());
fs.readFile("./token.json", "utf-8").then(file => {

    const json = JSON.parse(file);

    const client = createBot({
		intents: GatewayIntents.Guilds | GatewayIntents.GuildVoiceStates | GatewayIntents.GuildMessages | GatewayIntents.MessageContent,
		token: json.token,
		events: botEvents
	});

    startBot(client);

    onGracefulExit = async () => {
        const date = new Date();
        console.log("Closed at " + date.toISOString());
    
        await stopBot(client);
        process.exit();
    }
});