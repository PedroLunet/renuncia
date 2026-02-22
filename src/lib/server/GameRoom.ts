import { DurableObject } from 'cloudflare:workers';

export class GameRoom extends DurableObject {
	async fetch(request: Request): Promise<Response> {
		const upgradeHeader = request.headers.get('Upgrade');
		if (!upgradeHeader || upgradeHeader !== 'websocket') {
			return new Response('Expected Upgrade: websocket', { status: 426 });
		}

		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);

		this.ctx.acceptWebSocket(server);

		return new Response(null, {
			status: 101,
			webSocket: client
		});
	}

	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
		console.log('Received from player:', message);

		ws.send(
			JSON.stringify({
				action: 'SYNC',
				message: 'Hello from the Edge! You are connected to Renúncia.'
			})
		);
	}

	async webSocketClose(ws: WebSocket) {
		console.log('A player disconnected.');
	}
}
