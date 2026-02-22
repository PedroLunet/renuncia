<script lang="ts">
	import { onMount } from 'svelte';

	let socket: WebSocket | null = null;
	let messages: string[] = [];
	let isConnected = false;

	let myHand: any[] = [];
	let table: any[] = [];
	let activePlayerId: string = '';
	let myPlayerId: string = '';
	let isMyTurn = false;
	let gameStarted = false;

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

				isMyTurn = activePlayerId === myPlayerId;
			} else if (data.action === 'ERROR') {
				alert(`Server: ${data.message}`);
			}
		};

		socket.onclose = () => {
			isConnected = false;
		};
	}

	function playTopCard() {
		if (socket && isConnected && myHand.length > 0) {
			socket.send('PLAY_CARD:0');
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
							<span class="text-sm">{playedCard.card.suit}</span>
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
					<div class="flex flex-wrap gap-2">
						{#each myHand as card}
							<div class="rounded border border-neutral-600 bg-neutral-700 px-3 py-1 text-sm">
								{card.rank} of {card.suit}
							</div>
						{/each}
					</div>
				</div>

				<button
					onclick={playTopCard}
					disabled={!isMyTurn}
					class="w-full rounded-lg py-3 font-semibold transition-colors {isMyTurn
						? 'bg-amber-600 text-white hover:bg-amber-500'
						: 'cursor-not-allowed bg-neutral-700 text-neutral-500'}"
				>
					Play Leftmost Card
				</button>
			</div>
		{/if}
	</div>
</main>
