import { calculateShardId, ShardState } from "discordeno";

const adapters = new Map();
const trackedClients = new Set();
const trackedShards = new Map();

/**
 * Tracks a Discordeno client, listening to VOICE_SERVER_UPDATE and VOICE_STATE_UPDATE events
 *
 * @param client - The Discordeno Client to track
 */
function trackClient(client) {
	if (trackedClients.has(client)) return;
	trackedClients.add(client);

	client._voiceServerUpdate = (client, payload) => {
		payload = snakelizeAndStringToBigInt(payload);

		let adapter = adapters.get(payload.guild_id);
		if (adapter) {
			adapter.onVoiceServerUpdate(payload);
		}
	};

	client._voiceStateUpdate = (client, payload) => {
		payload = snakelizeAndStringToBigInt(payload);

		if (payload.guild_id && payload.session_id && payload.user_id === client.id.toString()) {
			let adapter = adapters.get(payload.guild_id);
			if (adapter) {
				adapter.onVoiceStateUpdate(payload);
			}
		}
	};

	/*
	client.on(Events.SHARD_DISCONNECT, (_, shardId) => {
		const guilds = trackedShards.get(shardId);
		if (guilds) {
			for (const guildID of guilds.values()) {
				adapters.get(guildID)?.destroy();
			}
		}
		trackedShards.delete(shardId);
	});
	*/
}

function trackGuild(guildId, shardId) {
	let guilds = trackedShards.get(shardId);
	if (!guilds) {
		guilds = new Set();
		trackedShards.set(shardId, guilds);
	}

	guilds.add(guildId);
}

/**
 * Creates an adapter for a Voice Channel.
 *
 * @param client - Discordeno bot client
 * @param guildId - The guild to connect to
 */
export function createDiscordenoAdapter(client, guildId) {
    let shardId = calculateShardId(client.gateway, guildId);
    let shard = client.gateway.manager.shards.get(shardId);

	return (methods) => {
		adapters.set(guildId, methods);
		trackClient(client);
		trackGuild(guildId, shardId);
		return {
			sendPayload(data) {
				if (shard.state === ShardState.Connected) {
					shard.send(data);
					return true;
				}
                
				return false;
			},
			destroy() {
				return adapters.delete(guildId);
			}
		};
	};
}

function snakelizeAndStringToBigInt(object) {
	if (Array.isArray(object)) {
	  return object.map((element) => snakelizeAndStringToBigInt(element))
	}
  
	if (typeof object === 'object' && object !== null) {
	  const obj = {}
	  ;(Object.keys(object)).forEach((key) => {
		;(obj[camelToSnakeCase(key)]) = snakelizeAndStringToBigInt(object[key])
	  })
	  return obj
	}

	if (typeof object === "bigint") {
		return object.toString();
	}

	return object;
};

function camelToSnakeCase(str) {
	let result = ''
	for (let i = 0, len = str.length; i < len; ++i) {
	  if (str[i] >= 'A' && str[i] <= 'Z') {
		result += `_${str[i].toLowerCase()}`
  
		continue
	  }
  
	  result += str[i]
	}
  
	return result
};