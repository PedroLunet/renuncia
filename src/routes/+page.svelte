<script lang="ts">
	let socket: WebSocket | null = null;

	let isConnected = $state(false);
	let myHand: any[] = $state([]);
	let table: any[] = $state([]);
	let activePlayerId = $state('');
	let myPlayerId = $state('');
	let gameStarted = $state(false);
	let team1Points = $state(0);
	let team2Points = $state(0);
	let errorMessage = $state('');

	let isMyTurn = $derived(
		activePlayerId === myPlayerId && activePlayerId !== '' && table.length < 4
	);

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
				gameStarted = true;
				myHand = data.myHand;
				table = data.table;
				activePlayerId = data.activePlayerId;
				myPlayerId = data.myPlayerId;
				team1Points = data.team1Points;
				team2Points = data.team2Points;
			} else if (data.action === 'ERROR') {
				errorMessage = data.message;
				setTimeout(() => (errorMessage = ''), 3000);
			} else if (data.action === 'GAME_OVER') {
				alert(`Game Over! Team 1: ${data.t1} pts | Team 2: ${data.t2} pts`);
				gameStarted = false;
			}
		};

		socket.onclose = () => {
			isConnected = false;
		};
	}

	function playCard(index: number) {
		if (socket && isConnected && isMyTurn) {
			socket.send(`PLAY_CARD:${index}`);
		}
	}
</script>

<main class="flex min-h-screen flex-col items-center justify-center bg-neutral-900 p-8 text-white">
	<div class="w-full max-w-2xl rounded-xl border border-neutral-700 bg-neutral-800 p-6 shadow-2xl">
		<h1 class="mb-6 text-center text-3xl font-bold text-amber-500">Renúncia Table</h1>

		{#if !isConnected}
			<button
				onclick={connectToTable}
				class="w-full rounded-lg bg-amber-600 py-3 font-semibold text-white hover:bg-amber-500"
			>
				Join Table
			</button>
		{:else if !gameStarted}
			<button
				onclick={() => socket?.send('START_GAME')}
				class="w-full rounded-lg bg-emerald-600 py-3 font-semibold text-white hover:bg-emerald-500"
			>
				Start Game (Add Bots)
			</button>
		{:else}
			<div class="space-y-6">
				<div class="flex justify-between rounded-lg border border-neutral-700 bg-neutral-900 p-4">
					<div class="text-center">
						<span class="text-xs tracking-widest text-neutral-400 uppercase">Team 1 (P1 & P3)</span>
						<div class="text-2xl font-bold text-amber-500">{team1Points} pts</div>
					</div>
					<div class="text-center">
						<span class="text-xs tracking-widest text-neutral-400 uppercase">Team 2 (P2 & P4)</span>
						<div class="text-2xl font-bold text-emerald-500">{team2Points} pts</div>
					</div>
				</div>

				{#if errorMessage}
					<div
						class="animate-bounce rounded border border-red-500 bg-red-900/80 p-3 text-center font-bold text-red-200 shadow-lg"
					>
						⚠️ {errorMessage}
					</div>
				{/if}

				<div
					class="rounded border bg-neutral-900 p-3 text-center {isMyTurn
						? 'border-amber-500 text-amber-400'
						: 'border-neutral-700 text-neutral-400'}"
				>
					{#if isMyTurn}
						🔥 YOUR TURN! Play a card.
					{:else}
						⏳ Waiting for {activePlayerId} to play...
					{/if}
				</div>

				<div
					class="flex min-h-32 justify-center gap-4 rounded-xl border border-green-800 bg-green-900/20 p-6"
				>
					{#each table as playedCard}
						<div
							class="flex flex-col items-center rounded bg-white px-4 py-6 text-xl font-bold text-black shadow-lg"
						>
							<span>{playedCard.card.rank}</span>
							<span class="text-sm">
								{#if playedCard.card.suit === 'copas'}❤️
								{:else if playedCard.card.suit === 'espadas'}♠️
								{:else if playedCard.card.suit === 'ouros'}♦️
								{:else}♣️{/if}
							</span>
							<span class="mt-2 text-[10px] text-gray-500">{playedCard.playerId}</span>
						</div>
					{/each}
					{#if table.length === 0}
						<span class="my-auto font-bold tracking-widest text-green-800/50 uppercase"
							>Table is Empty</span
						>
					{/if}
				</div>

				<div>
					<h3 class="mb-2 text-sm text-neutral-400">Your Hand ({myHand.length} cards)</h3>
					<div class="flex flex-wrap gap-3">
						{#each myHand as card, index}
							<button
								onclick={() => playCard(index)}
								disabled={!isMyTurn}
								class="relative flex h-32 w-24 flex-col items-center justify-between rounded-xl border-2 bg-white p-2 text-black shadow-md transition-transform {isMyTurn
									? 'cursor-pointer border-neutral-200 hover:-translate-y-4 hover:shadow-xl'
									: 'cursor-not-allowed border-neutral-400 opacity-70'}"
							>
								<div class="self-start text-lg leading-none font-bold">{card.rank}</div>
								<div class="text-3xl">
									{#if card.suit === 'copas'}❤️
									{:else if card.suit === 'espadas'}♠️
									{:else if card.suit === 'ouros'}♦️
									{:else}♣️{/if}
								</div>
								<div class="rotate-180 self-end text-lg leading-none font-bold">{card.rank}</div>
							</button>
						{/each}
					</div>
				</div>
			</div>
		{/if}
	</div>
</main>
