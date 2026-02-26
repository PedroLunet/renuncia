<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	let socket: WebSocket | null = null;

	let isConnected = $state(false);
	let myHand: any[] = $state([]);
	let table: any[] = $state([]);
	let playersList: any[] = $state([]);
	let activePlayerId = $state('');
	let myPlayerId = $state('');
	let ownerId = $state('');
	let gameStarted = $state(false);
	let team1Points = $state(0);
	let team2Points = $state(0);
	let team1MatchPoints = $state(0);
	let team2MatchPoints = $state(0);
	let trumpCard: any = $state(null);
	let errorMessage = $state('');

	let showGameOverModal = $state(false);
	let gameOverData: any = $state(null);

	let roomInput = $state('');
	let currentRoomCode = $state('');
	let isSoloMode = $state(false);
	let openRooms: any[] = $state([]);
	let lobbyTimer: ReturnType<typeof setInterval>;

	let isWaitingForHost = $state(false);
	let approvalRequests: string[] = $state([]);

	let isMyTurn = $derived(
		activePlayerId === myPlayerId && activePlayerId !== '' && table.length < 4
	);

	let myIndex = $derived(playersList.findIndex((p) => p.id === myPlayerId));
	let playerSouth = $derived(playersList[myIndex]);
	let playerWest = $derived(playersList[(myIndex + 1) % 4]);
	let playerNorth = $derived(playersList[(myIndex + 2) % 4]);
	let playerEast = $derived(playersList[(myIndex + 3) % 4]);

	async function fetchRooms() {
		if (isConnected) return;
		try {
			const res = await fetch('/api/lobby');
			if (res.ok) {
				openRooms = await res.json();
			}
		} catch (e) {
			console.error('Failed to fetch lobby');
		}
	}

	onMount(() => {
		fetchRooms();
		lobbyTimer = setInterval(fetchRooms, 3000);
	});
	onDestroy(() => {
		if (lobbyTimer) clearInterval(lobbyTimer);
	});

	function getPlayedCard(playerId: string | undefined) {
		if (!playerId) return null;
		return table.find((play) => play.playerId === playerId)?.card;
	}

	function generateRoomCode() {
		return Math.random().toString(36).substring(2, 6).toUpperCase();
	}

	function connectToTable(code: string, solo: boolean = false, isPrivate: boolean = false) {
		if (!code) return;
		currentRoomCode = code.toUpperCase();
		isSoloMode = solo;

		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		const wsUrl = `${protocol}//${window.location.host}/api/play/${currentRoomCode}${isPrivate ? '?private=true' : ''}`;

		socket = new WebSocket(wsUrl);

		socket.onopen = () => {
			isConnected = true;
			if (isSoloMode) {
				setTimeout(() => socket?.send('START_GAME'), 500);
			}
		};

		socket.onmessage = (event) => {
			const data = JSON.parse(event.data);

			if (data.action === 'GAME_STATE_UPDATE') {
				isWaitingForHost = false;
				gameStarted = data.gameStarted;

				if (gameStarted) showGameOverModal = false;

				ownerId = data.ownerId;
				myHand = data.myHand;
				table = data.table;
				playersList = data.players;
				activePlayerId = data.activePlayerId;
				myPlayerId = data.myPlayerId;
				team1Points = data.team1Points;
				team2Points = data.team2Points;
				team1MatchPoints = data.team1MatchPoints;
				team2MatchPoints = data.team2MatchPoints;
				trumpCard = data.trumpCard;
			} else if (data.action === 'WAITING_APPROVAL') {
				isWaitingForHost = true;
			} else if (data.action === 'APPROVAL_REQUEST') {
				approvalRequests = data.requests;
			} else if (data.action === 'REJECTED') {
				errorMessage = 'The host declined your join request.';
				setTimeout(() => quitRoom(), 2000);
			} else if (data.action === 'ERROR') {
				errorMessage = data.message;
				setTimeout(() => (errorMessage = ''), 4000);
			} else if (data.action === 'GAME_OVER') {
				// Trigger the beautiful UI modal instead of an alert!
				gameOverData = data;
				showGameOverModal = true;
				gameStarted = false;
			}
		};

		socket.onclose = () => {
			quitRoom();
		};
	}

	function playCard(index: number) {
		try {
			if (!socket || socket.readyState !== WebSocket.OPEN) throw new Error(`Socket disconnected.`);
			socket.send(`PLAY_CARD:${index}`);
		} catch (err: any) {
			errorMessage = `FRONTEND ERROR: ${err.message}`;
			setTimeout(() => (errorMessage = ''), 4000);
		}
	}

	function quitRoom() {
		if (socket) {
			socket.onclose = null;
			socket.close();
			socket = null;
		}
		isConnected = false;
		isWaitingForHost = false;
		gameStarted = false;
		showGameOverModal = false;
		gameOverData = null;
		myHand = [];
		table = [];
		playersList = [];
		approvalRequests = [];
		currentRoomCode = '';
		activePlayerId = '';
		myPlayerId = '';
		ownerId = '';
		fetchRooms();
	}
</script>

<main
	class="flex min-h-screen flex-col items-center justify-center bg-emerald-900 p-4 font-sans text-white selection:bg-emerald-500"
>
	{#if errorMessage}
		<div
			class="fixed top-10 left-1/2 z-50 -translate-x-1/2 animate-bounce rounded-full border-2 border-red-400 bg-red-900/90 px-6 py-2 font-bold text-white shadow-xl backdrop-blur-md"
		>
			⚠️ {errorMessage}
		</div>
	{/if}

	{#if !isConnected}
		<div class="w-full max-w-lg rounded-xl border border-emerald-700 bg-emerald-800 p-8 shadow-2xl">
			<h1 class="mb-8 text-center text-4xl font-bold text-amber-400">Sueca Online</h1>

			<div class="space-y-6">
				<button
					onclick={() => connectToTable(generateRoomCode(), true, false)}
					class="w-full rounded-lg bg-indigo-600 py-4 font-bold text-white shadow-lg transition-transform hover:-translate-y-1 hover:bg-indigo-500"
				>
					👤 Solo Match
				</button>

				<div class="flex gap-4">
					<button
						onclick={() => connectToTable(generateRoomCode(), false, false)}
						class="flex-1 rounded-lg bg-emerald-600 py-3 font-bold text-white shadow-lg transition-transform hover:-translate-y-1 hover:bg-emerald-500"
					>
						➕ Public Room
					</button>
					<button
						onclick={() => connectToTable(generateRoomCode(), false, true)}
						class="flex-1 rounded-lg border-2 border-amber-500 bg-emerald-800 py-3 font-bold text-amber-500 shadow-lg transition-transform hover:-translate-y-1 hover:bg-emerald-700"
					>
						🔒 Private Room
					</button>
				</div>

				<div class="rounded-xl border border-emerald-700 bg-emerald-950/50 p-6">
					<div class="mb-4 flex items-center justify-between">
						<h2 class="text-xl font-bold text-emerald-300">Open Rooms</h2>
						<button
							onclick={fetchRooms}
							class="text-xs font-bold tracking-wider text-emerald-400 uppercase hover:text-white"
							>🔄 Refresh</button
						>
					</div>

					<div class="custom-scrollbar max-h-48 space-y-2 overflow-y-auto pr-2">
						{#if openRooms.length === 0}
							<div class="py-6 text-center text-sm font-bold text-emerald-700">
								No rooms active right now.
							</div>
						{:else}
							{#each openRooms as room}
								<div
									class="flex items-center justify-between rounded-lg border border-emerald-800 bg-emerald-900 p-3 shadow-sm transition-colors hover:border-emerald-600"
								>
									<div>
										<div class="font-mono text-lg font-bold text-amber-400">
											{room.code}
											{#if room.isPrivate}
												<span class="text-sm">🔒</span>
											{/if}
										</div>
										<div
											class="text-xs font-bold tracking-widest uppercase {room.status === 'playing'
												? 'text-red-400'
												: 'text-emerald-400'}"
										>
											{room.status === 'playing' ? 'In Progress' : 'Waiting'} • {room.playerCount}/4
										</div>
									</div>
									<button
										onclick={() => connectToTable(room.code, false, false)}
										disabled={room.playerCount >= 4 || room.status === 'playing'}
										class="rounded-lg bg-amber-500 px-6 py-2 font-bold text-emerald-950 shadow-md transition-transform hover:-translate-y-0.5 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:translate-y-0"
									>
										Join
									</button>
								</div>
							{/each}
						{/if}
					</div>
				</div>

				<div class="flex gap-2">
					<input
						type="text"
						bind:value={roomInput}
						placeholder="ABCD"
						maxlength="4"
						class="w-full rounded-lg border border-emerald-600 bg-emerald-950 px-4 py-3 text-center font-mono text-xl font-bold text-white uppercase placeholder-emerald-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
					/>
					<button
						onclick={() => connectToTable(roomInput, false, false)}
						disabled={roomInput.length < 4}
						class="rounded-lg bg-emerald-700 px-8 font-bold text-white shadow-lg transition-transform hover:-translate-y-1 hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
						>Join</button
					>
				</div>
			</div>
		</div>
	{:else if isWaitingForHost}
		<div
			class="w-full max-w-md rounded-xl border border-amber-600 bg-emerald-800 p-8 text-center shadow-2xl"
		>
			<div class="mb-6 animate-pulse text-6xl">🔒</div>
			<h1 class="mb-2 text-2xl font-bold text-amber-400">Waiting for Host Approval...</h1>
			<p class="mb-8 text-emerald-200">
				The owner of room <strong>{currentRoomCode}</strong> is reviewing your request to join.
			</p>
			<button
				onclick={quitRoom}
				class="text-sm font-bold tracking-widest text-red-400 uppercase hover:text-red-300"
				>Cancel Request</button
			>
		</div>
	{:else if !gameStarted}
		<div
			class="w-full max-w-md rounded-xl border border-emerald-700 bg-emerald-800 p-8 text-center shadow-2xl"
		>
			<h1 class="mb-2 text-3xl font-bold text-amber-400">
				{#if ownerId === myPlayerId}
					👑 You are the Host!
				{:else}
					Waiting for players...
				{/if}
			</h1>
			<p class="mb-8 text-emerald-200">Players in room: {playersList.length}/4</p>

			<div class="mb-6 rounded-lg border border-emerald-600 bg-emerald-950 p-6 shadow-inner">
				<div class="mb-2 text-sm tracking-widest text-emerald-400 uppercase">Room Code</div>
				<div class="font-mono text-5xl font-bold tracking-widest text-white">{currentRoomCode}</div>
			</div>

			{#if ownerId === myPlayerId && approvalRequests.length > 0}
				<div class="mb-6 rounded-lg border-2 border-amber-500 bg-emerald-900 p-4">
					<h3 class="mb-3 text-sm font-bold tracking-widest text-amber-400 uppercase">
						Pending Requests
					</h3>
					<div class="space-y-2">
						{#each approvalRequests as reqId}
							<div
								class="flex items-center justify-between rounded border border-emerald-700 bg-emerald-950 p-2"
							>
								<span class="font-bold">{reqId}</span>
								<div class="flex gap-2">
									<button
										onclick={() => socket?.send(`DECLINE_PLAYER:${reqId}`)}
										class="rounded bg-red-900/50 px-3 py-1 text-xs font-bold text-red-400 uppercase hover:bg-red-800"
										>Decline</button
									>
									<button
										onclick={() => socket?.send(`ACCEPT_PLAYER:${reqId}`)}
										class="rounded bg-amber-500 px-3 py-1 text-xs font-bold text-emerald-950 uppercase hover:bg-amber-400"
										>Accept</button
									>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			{#if ownerId === myPlayerId}
				<button
					onclick={() => socket?.send('START_GAME')}
					class="w-full rounded-lg bg-emerald-600 py-4 font-bold text-white shadow-lg transition-transform hover:-translate-y-1 hover:bg-emerald-500"
				>
					Start Game Now (Fill with Bots)
				</button>
			{:else}
				<div class="py-4 text-emerald-400 italic">Waiting for host to start the game...</div>
			{/if}

			<button
				onclick={quitRoom}
				class="mt-6 text-sm font-bold tracking-widest text-red-400 uppercase hover:text-red-300"
				>Leave Room</button
			>
		</div>
	{:else}
		<div
			class="relative flex h-[90vh] w-full max-w-5xl flex-col justify-between overflow-hidden rounded-3xl border-8 border-emerald-950 bg-emerald-800 p-4 shadow-2xl"
		>
			<div class="absolute top-4 left-4 z-20 flex gap-4">
				<div class="rounded-lg border border-white/10 bg-black/40 p-3 text-center backdrop-blur-sm">
					<div class="text-[10px] tracking-widest text-emerald-300 uppercase">Team 1 (N/S)</div>
					<div class="text-xl font-bold text-amber-400">{team1Points} pts</div>
					<div class="text-xs text-amber-400/70">{team1MatchPoints} Sets</div>
				</div>
				<div class="rounded-lg border border-white/10 bg-black/40 p-3 text-center backdrop-blur-sm">
					<div class="text-[10px] tracking-widest text-emerald-300 uppercase">Team 2 (E/W)</div>
					<div class="text-xl font-bold text-white">{team2Points} pts</div>
					<div class="text-xs text-white/70">{team2MatchPoints} Sets</div>
				</div>
			</div>

			<div class="absolute bottom-4 left-4 z-20 flex flex-col gap-2">
				<div class="font-mono text-xs font-bold tracking-widest text-emerald-400/50 uppercase">
					Room: {currentRoomCode}
				</div>
				<button
					onclick={quitRoom}
					class="text-left text-xs font-bold tracking-widest text-red-400/60 uppercase hover:text-red-400"
					>Quit Match</button
				>
			</div>

			{#if trumpCard}
				<div
					class="absolute top-4 right-4 z-20 rounded-lg border border-white/10 bg-black/40 p-3 text-center backdrop-blur-sm"
				>
					<div class="text-[10px] tracking-widest text-emerald-300 uppercase">Trunfo</div>
					<div class="flex items-center gap-2 text-xl font-bold">
						{trumpCard.rank}
						<span class="text-2xl">
							{#if trumpCard.suit === 'copas'}❤️{:else if trumpCard.suit === 'espadas'}♠️{:else if trumpCard.suit === 'ouros'}♦️{:else}♣️{/if}
						</span>
					</div>
				</div>
			{/if}

			<div class="flex h-20 w-full items-center justify-center">
				{#if playerNorth}
					<div
						class="flex flex-col items-center transition-all {activePlayerId === playerNorth.id
							? 'scale-110 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]'
							: 'opacity-70'}"
					>
						<div
							class="rounded-full border border-emerald-700 bg-emerald-950 px-4 py-1 text-sm font-bold shadow"
						>
							{playerNorth.id} (Partner) {ownerId === playerNorth.id ? '👑' : ''}
						</div>
					</div>
				{/if}
			</div>

			<div class="flex flex-1 items-center justify-between px-4">
				{#if playerWest}
					<div
						class="flex flex-col items-center transition-all {activePlayerId === playerWest.id
							? 'scale-110 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]'
							: 'opacity-70'}"
					>
						<div
							class="rounded-full border border-emerald-700 bg-emerald-950 px-4 py-1 text-sm font-bold shadow"
						>
							{playerWest.id}
							{ownerId === playerWest.id ? '👑' : ''}
						</div>
					</div>
				{/if}

				<div class="relative h-64 w-64 rounded-full border-2 border-dashed border-emerald-600/50">
					{#if getPlayedCard(playerNorth?.id)}
						<div
							class="absolute top-4 left-1/2 flex h-24 w-16 -translate-x-1/2 flex-col justify-between rounded-lg border border-neutral-200 bg-white p-2 text-black shadow-xl"
						>
							<div class="leading-none font-bold">{getPlayedCard(playerNorth?.id).rank}</div>
							<div class="text-center text-2xl">
								{#if getPlayedCard(playerNorth?.id).suit === 'copas'}❤️{:else if getPlayedCard(playerNorth?.id).suit === 'espadas'}♠️{:else if getPlayedCard(playerNorth?.id).suit === 'ouros'}♦️{:else}♣️{/if}
							</div>
						</div>
					{/if}

					{#if getPlayedCard(playerSouth?.id)}
						<div
							class="absolute bottom-4 left-1/2 z-10 flex h-24 w-16 -translate-x-1/2 flex-col justify-between rounded-lg border border-neutral-200 bg-white p-2 text-black shadow-xl"
						>
							<div class="leading-none font-bold">{getPlayedCard(playerSouth?.id).rank}</div>
							<div class="text-center text-2xl">
								{#if getPlayedCard(playerSouth?.id).suit === 'copas'}❤️{:else if getPlayedCard(playerSouth?.id).suit === 'espadas'}♠️{:else if getPlayedCard(playerSouth?.id).suit === 'ouros'}♦️{:else}♣️{/if}
							</div>
						</div>
					{/if}

					{#if getPlayedCard(playerWest?.id)}
						<div
							class="absolute top-1/2 left-4 flex h-24 w-16 -translate-y-1/2 -rotate-12 flex-col justify-between rounded-lg border border-neutral-200 bg-white p-2 text-black shadow-xl"
						>
							<div class="leading-none font-bold">{getPlayedCard(playerWest?.id).rank}</div>
							<div class="text-center text-2xl">
								{#if getPlayedCard(playerWest?.id).suit === 'copas'}❤️{:else if getPlayedCard(playerWest?.id).suit === 'espadas'}♠️{:else if getPlayedCard(playerWest?.id).suit === 'ouros'}♦️{:else}♣️{/if}
							</div>
						</div>
					{/if}

					{#if getPlayedCard(playerEast?.id)}
						<div
							class="absolute top-1/2 right-4 flex h-24 w-16 -translate-y-1/2 rotate-12 flex-col justify-between rounded-lg border border-neutral-200 bg-white p-2 text-black shadow-xl"
						>
							<div class="leading-none font-bold">{getPlayedCard(playerEast?.id).rank}</div>
							<div class="text-center text-2xl">
								{#if getPlayedCard(playerEast?.id).suit === 'copas'}❤️{:else if getPlayedCard(playerEast?.id).suit === 'espadas'}♠️{:else if getPlayedCard(playerEast?.id).suit === 'ouros'}♦️{:else}♣️{/if}
							</div>
						</div>
					{/if}
				</div>

				{#if playerEast}
					<div
						class="flex flex-col items-center transition-all {activePlayerId === playerEast.id
							? 'scale-110 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]'
							: 'opacity-70'}"
					>
						<div
							class="rounded-full border border-emerald-700 bg-emerald-950 px-4 py-1 text-sm font-bold shadow"
						>
							{playerEast.id}
							{ownerId === playerEast.id ? '👑' : ''}
						</div>
					</div>
				{/if}
			</div>

			<div class="flex flex-col items-center justify-end pt-8 pb-4">
				<div
					class="mb-4 rounded-full border border-white/10 bg-black/40 px-6 py-2 backdrop-blur-sm transition-colors {isMyTurn
						? 'border-amber-500 shadow-[0_0_15px_rgba(251,191,36,0.3)]'
						: ''}"
				>
					{#if isMyTurn}
						<span class="font-bold text-amber-400">🔥 YOUR TURN! Play a card.</span>
					{:else}
						<span class="text-emerald-300">⏳ Waiting for {activePlayerId}...</span>
					{/if}
				</div>

				<div class="relative flex h-32 w-full max-w-3xl justify-center gap-2">
					{#each myHand as card, index}
						<button
							onclick={() => playCard(index)}
							class="group relative flex h-36 w-24 flex-col justify-between rounded-xl border border-neutral-300 bg-white p-2 text-black shadow-xl transition-all duration-300 hover:z-50
              {isMyTurn
								? 'cursor-pointer hover:-translate-y-6 hover:shadow-2xl'
								: 'cursor-not-allowed opacity-80 hover:-translate-y-2'}"
							style="transform: translateY({Math.abs(index - myHand.length / 2) *
								5}px) rotate({(index - myHand.length / 2) * 3}deg);"
						>
							<div
								class="self-start text-xl leading-none font-bold {card.suit === 'copas' ||
								card.suit === 'ouros'
									? 'text-red-600'
									: 'text-black'}"
							>
								{card.rank}
							</div>
							<div class="text-center text-4xl">
								{#if card.suit === 'copas'}❤️{:else if card.suit === 'espadas'}♠️{:else if card.suit === 'ouros'}♦️{:else}♣️{/if}
							</div>
							<div
								class="rotate-180 self-end text-xl leading-none font-bold {card.suit === 'copas' ||
								card.suit === 'ouros'
									? 'text-red-600'
									: 'text-black'}"
							>
								{card.rank}
							</div>
						</button>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	{#if showGameOverModal && gameOverData}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
		>
			<div
				class="w-full max-w-md rounded-2xl border-2 border-amber-500 bg-emerald-900 p-8 text-center shadow-[0_0_50px_rgba(251,191,36,0.2)]"
			>
				<h2 class="mb-2 text-4xl font-bold text-amber-400">Round Over!</h2>

				<div
					class="my-8 flex justify-around rounded-xl border border-emerald-800 bg-emerald-950 p-6 shadow-inner"
				>
					<div class="flex flex-col items-center">
						<span class="mb-1 text-xs font-bold tracking-widest text-emerald-400 uppercase"
							>Team 1</span
						>
						<span class="text-4xl font-bold text-amber-400">{gameOverData.t1}</span>
						<span class="mt-1 text-[10px] text-amber-400/50 uppercase">Points</span>
					</div>
					<div class="w-px bg-emerald-800"></div>
					<div class="flex flex-col items-center">
						<span class="mb-1 text-xs font-bold tracking-widest text-emerald-400 uppercase"
							>Team 2</span
						>
						<span class="text-4xl font-bold text-white">{gameOverData.t2}</span>
						<span class="mt-1 text-[10px] text-white/50 uppercase">Points</span>
					</div>
				</div>

				<p class="mb-8 text-lg font-bold whitespace-pre-line text-emerald-100">
					{gameOverData.matchResult}
				</p>

				<div class="flex flex-col gap-3">
					{#if ownerId === myPlayerId || isSoloMode}
						<button
							onclick={() => socket?.send('START_GAME')}
							class="w-full rounded-lg bg-amber-500 py-4 font-bold text-emerald-950 shadow-lg transition-transform hover:-translate-y-1 hover:bg-amber-400"
						>
							🃏 Play Next Round
						</button>
					{:else}
						<div
							class="rounded-lg border border-emerald-700 bg-emerald-800/50 py-4 font-bold text-emerald-300 italic"
						>
							Waiting for host to continue...
						</div>
					{/if}

					<button
						onclick={quitRoom}
						class="w-full rounded-lg border border-red-500/30 bg-red-900/20 py-3 text-sm font-bold tracking-widest text-red-400 uppercase transition-colors hover:bg-red-900/50 hover:text-red-300"
					>
						Leave Room
					</button>
				</div>
			</div>
		</div>
	{/if}
</main>

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 6px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background-color: #047857;
		border-radius: 10px;
	}
</style>
