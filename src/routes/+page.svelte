<script lang="ts">
	import { onMount } from 'svelte';

	let socket: WebSocket | null = null;
	let messages: string[] = [];
	let isConnected = false;

	function connectToTable() {
		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		const wsUrl = `${protocol}//${window.location.host}/api/play`;

		socket = new WebSocket(wsUrl);

		socket.onopen = () => {
			isConnected = true;
			messages = [...messages, '🟢 Connected to Table!'];
		};

		socket.onmessage = (event) => {
			const data = JSON.parse(event.data);
			messages = [...messages, `👤 Player ${data.sender}: ${data.message}`];
		};

		socket.onclose = () => {
			isConnected = false;
			messages = [...messages, '🔴 Disconnected.'];
		};
	}

	function playTestCard() {
		if (socket && isConnected) {
			socket.send('PLAY_CARD');
		}
	}
</script>

<main class="flex min-h-screen flex-col items-center justify-center bg-neutral-900 p-8 text-white">
	<div class="w-full max-w-md rounded-xl border border-neutral-700 bg-neutral-800 p-6 shadow-2xl">
		<h1 class="mb-2 text-3xl font-bold text-amber-500">Renúncia</h1>
		<p class="mb-6 text-neutral-400">Sueca on the Edge</p>

		<div class="space-y-4">
			{#if !isConnected}
				<button
					onclick={connectToTable}
					class="w-full rounded-lg bg-amber-600 py-3 font-semibold text-white transition-colors hover:bg-amber-500"
				>
					Join Table 1
				</button>
			{:else}
				<button
					onclick={playTestCard}
					class="w-full rounded-lg bg-emerald-600 py-3 font-semibold text-white transition-colors hover:bg-emerald-500"
				>
					Play a Card
				</button>
			{/if}
		</div>

		<div
			class="mt-8 h-48 overflow-y-auto rounded-lg border border-neutral-700 bg-black p-4 font-mono text-sm"
		>
			{#each messages as msg}
				<div class="mb-1 text-green-400">{msg}</div>
			{/each}
			{#if messages.length === 0}
				<div class="text-neutral-600 italic">No connection yet...</div>
			{/if}
		</div>
	</div>
</main>
