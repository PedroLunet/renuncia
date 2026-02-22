import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, platform }) => {
	const gameRoomNamespace = platform?.env.GAME_ROOM;

	if (!gameRoomNamespace) {
		return new Response('Game Room not found on the edge.', { status: 500 });
	}

	const roomId = gameRoomNamespace.idFromName('table-1');

	const roomStub = gameRoomNamespace.get(roomId);

	return roomStub.fetch(request);
};
