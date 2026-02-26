import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, params, platform }) => {
	const roomCode = params.roomCode?.toUpperCase();
	if (!roomCode) throw error(400, 'Room code is required');

	const GAME_ROOM = platform?.env?.GAME_ROOM;
	if (!GAME_ROOM) throw error(500, 'Durable Object binding missing');

	const id = GAME_ROOM.idFromName(roomCode);
	const stub = GAME_ROOM.get(id);

	return stub.fetch(request);
};
