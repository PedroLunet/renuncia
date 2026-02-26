import { DurableObject } from 'cloudflare:workers';

export interface RoomInfo {
	code: string;
	isPrivate: boolean;
	playerCount: number;
	status: 'waiting' | 'playing';
	lastUpdated: number;
}

export class LobbyManager extends DurableObject {
	rooms: Record<string, RoomInfo> = {};

	constructor(ctx: DurableObjectState, env: unknown) {
		super(ctx, env);
		this.ctx.blockConcurrencyWhile(async () => {
			const stored = await this.ctx.storage.get<Record<string, RoomInfo>>('rooms');
			if (stored) this.rooms = stored;
		});
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (request.method === 'GET') {
			const now = Date.now();
			let changed = false;
			for (const [code, room] of Object.entries(this.rooms)) {
				if (now - room.lastUpdated > 2 * 60 * 60 * 1000) {
					delete this.rooms[code];
					changed = true;
				}
			}
			if (changed) await this.ctx.storage.put('rooms', this.rooms);

			return new Response(JSON.stringify(Object.values(this.rooms)), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		if (request.method === 'POST') {
			const data = (await request.json()) as RoomInfo;
			data.lastUpdated = Date.now();
			this.rooms[data.code] = data;
			await this.ctx.storage.put('rooms', this.rooms);
			return new Response('OK');
		}

		if (request.method === 'DELETE') {
			const code = url.searchParams.get('code');
			if (code && this.rooms[code]) {
				delete this.rooms[code];
				await this.ctx.storage.put('rooms', this.rooms);
			}
			return new Response('OK');
		}

		return new Response('Method not allowed', { status: 405 });
	}
}
