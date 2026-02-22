import { DurableObject } from 'cloudflare:workers';

export class GameRoom extends DurableObject {
	async fetch(request: Request): Promise<Response> {
		const upgradeHeader = request.headers.get('Upgrade');
		if (!upgradeHeader || upgradeHeader !== 'websocket') {
			return new Response('Expected Upgrade: websocket', { status: 426 });
		}

		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);

		const playerId = crypto.randomUUID().substring(0, 4).toUpperCase();

		server.serializeAttachment({ playerId });

		this.ctx.acceptWebSocket(server);

		return new Response(null, { status: 101, webSocket: client });
	}

	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
		const { playerId } = ws.deserializeAttachment();

		const textMessage = typeof message === 'string' ? message : new TextDecoder().decode(message);

		const allPlayers = this.ctx.getWebSockets();

		allPlayers.forEach((player) => {
			player.send(
				JSON.stringify({
					action: 'BROADCAST',
					sender: playerId,
					message: textMessage
				})
			);
		});
	}

	async webSocketClose(ws: WebSocket) {
		const { playerId } = ws.deserializeAttachment();
		console.log(`Player ${playerId} disconnected.`);
	}
}
