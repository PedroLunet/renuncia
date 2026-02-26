import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform }) => {
	const LOBBY_MANAGER = platform?.env?.LOBBY_MANAGER;
	if (!LOBBY_MANAGER) return json({ error: 'Binding missing' }, { status: 500 });

	const id = LOBBY_MANAGER.idFromName('GLOBAL_LOBBY_INSTANCE');
	const stub = LOBBY_MANAGER.get(id);

	const response = await stub.fetch(new Request('http://internal/lobby', { method: 'GET' }));
	const rooms = await response.json();

	return json(rooms);
};
