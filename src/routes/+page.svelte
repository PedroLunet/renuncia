<script lang="ts">
	let socket: WebSocket | null = null;

	let isConnected = $state(false);
	let myHand: any[] = $state([]);
	let table: any[] = $state([]);
	let playersList: any[] = $state([]);
	let activePlayerId = $state('');
	let myPlayerId = $state('');
	let gameStarted = $state(false);
	let team1Points = $state(0);
	let team2Points = $state(0);
	let team1MatchPoints = $state(0);
	let team2MatchPoints = $state(0);
	let trumpCard: any = $state(null);
	let errorMessage = $state('');

	let isMyTurn = $derived(
		activePlayerId === myPlayerId && activePlayerId !== '' && table.length < 4
	);

	let myIndex = $derived(playersList.findIndex((p) => p.id === myPlayerId));
	let playerSouth = $derived(playersList[myIndex]);
	let playerWest = $derived(playersList[(myIndex + 1) % 4]);
	let playerNorth = $derived(playersList[(myIndex + 2) % 4]);
	let playerEast = $derived(playersList[(myIndex + 3) % 4]);

	function getPlayedCard(playerId: string | undefined) {
		if (!playerId) return null;
		return table.find((play) => play.playerId === playerId)?.card;
	}

	function connectToTable() {
		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		const wsUrl = `${protocol}//${window.location.host}/api/play`;

		socket = new WebSocket(wsUrl);

		socket.onopen = () => {
			isConnected = true;
		};

		socket.onmessage = (event) => {
			const data = JSON.parse(event.data);

			if (data.action === 'GAME_STATE_UPDATE') {
				gameStarted = data.gameStarted;
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
			} else if (data.action === 'ERROR') {
				errorMessage = data.message;
				setTimeout(() => (errorMessage = ''), 4000);
			} else if (data.action === 'GAME_OVER') {
				alert(
					`Round Over!\nTeam 1: ${data.t1} pts | Team 2: ${data.t2} pts\n\n${data.matchResult}`
				);
				gameStarted = false;
			}
		};

		socket.onclose = () => {
			isConnected = false;
			gameStarted = false;
			myHand = [];
			table = [];
			playersList = [];
		};
	}

	function playCard(index: number) {
		try {
			if (!socket) throw new Error('WebSocket is entirely null.');
			if (socket.readyState !== WebSocket.OPEN)
				throw new Error(`Socket is disconnected. Refresh the page.`);
			socket.send(`PLAY_CARD:${index}`);
		} catch (err: any) {
			errorMessage = `FRONTEND ERROR: ${err.message}`;
			setTimeout(() => (errorMessage = ''), 4000);
		}
	}
</script>

<main
	class="flex min-h-screen flex-col items-center justify-center bg-emerald-900 p-4 font-sans text-white selection:bg-emerald-500"
>
	{#if !isConnected}
		<div
			class="w-full max-w-md rounded-xl border border-emerald-700 bg-emerald-800 p-8 text-center shadow-2xl"
		>
			<h1 class="mb-8 text-4xl font-bold text-amber-400">Sueca Online</h1>
			<button
				onclick={connectToTable}
				class="w-full rounded-lg bg-amber-500 py-4 font-bold text-emerald-950 shadow-lg transition-transform hover:-translate-y-1 hover:bg-amber-400"
			>
				Join Table
			</button>
		</div>
	{:else if !gameStarted}
		<div
			class="w-full max-w-md rounded-xl border border-emerald-700 bg-emerald-800 p-8 text-center shadow-2xl"
		>
			<h1 class="mb-4 text-3xl font-bold text-amber-400">Waiting for players...</h1>
			<div class="mb-8 text-emerald-200">
				You are <span class="font-bold text-white">{myPlayerId}</span>
			</div>

			{#if team1MatchPoints > 0 || team2MatchPoints > 0}
				<div
					class="mb-8 rounded-lg border border-emerald-800 bg-emerald-950 p-4 text-lg font-bold shadow-inner"
				>
					🏆 Match Score <br />
					<span class="text-amber-400">Team 1: {team1MatchPoints}</span> |
					<span class="text-emerald-400">Team 2: {team2MatchPoints}</span>
				</div>
			{/if}

			<button
				onclick={() => socket?.send('START_GAME')}
				class="w-full rounded-lg bg-emerald-600 py-4 font-bold text-white shadow-lg transition-transform hover:-translate-y-1 hover:bg-emerald-500"
			>
				Start Game (Add Bots)
			</button>
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

			{#if errorMessage}
				<div
					class="absolute top-1/4 left-1/2 z-50 -translate-x-1/2 animate-bounce rounded-full border-2 border-red-400 bg-red-900/90 px-6 py-2 font-bold text-white shadow-xl backdrop-blur-md"
				>
					⚠️ {errorMessage}
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
							{playerNorth.id} (Partner)
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
</main>
