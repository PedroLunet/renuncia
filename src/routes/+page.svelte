<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import Lobby from './lobby.svelte';
	import Table from './table.svelte';

	function slideY(node: HTMLElement, { duration = 350 }: { duration?: number } = {}) {
		return {
			duration,
			easing: cubicOut,
			css: (t: number) => `transform: translateY(${(1 - t) * -24}px)`
		};
	}

	let socket: WebSocket | null = null;

	let isConnected = $state(false);
	let myHand: any[] = $state([]);
	let handSizes: Record<string, number> = $state({});
	let table: any[] = $state([]);
	let playersList: any[] = $state([]);
	let activePlayerId = $state('');
	let myPlayerId = $state('');
	let ownerId = $state('');
	let dealerId = $state('');
	let gameStarted = $state(false);
	let team1Points = $state(0);
	let team2Points = $state(0);
	let team1MatchPoints = $state(0);
	let team2MatchPoints = $state(0);
	let trumpCard: any = $state(null);

	interface Toast {
		id: number;
		message: string;
	}
	let toasts: Toast[] = $state([]);
	let toastCounter = 0;

	function addToast(message: string) {
		const id = ++toastCounter;
		toasts = [...toasts, { id, message }];
		setTimeout(() => {
			toasts = toasts.filter((t) => t.id !== id);
		}, 3000);
	}

	let showGameOverModal = $state(false);
	let gameOverData: any = $state(null);
	let roundEnded = $state(false);

	let roomInput = $state('');
	let currentRoomCode = $state('');
	let isSoloMode = $state(false);
	let openRooms: any[] = $state([]);
	let lobbyTimer: ReturnType<typeof setInterval>;
	let isWaitingForHost = $state(false);
	let approvalRequests: string[] = $state([]);
	let localPlayerId = '';

	async function fetchRooms() {
		if (isConnected) return;
		try {
			const res = await fetch('/api/lobby');
			if (res.ok) openRooms = await res.json();
		} catch (e) {
			console.error('Failed to fetch lobby');
		}
	}

	onMount(() => {
		localPlayerId = localStorage.getItem('sueca_player_id') || '';
		if (!localPlayerId) {
			localPlayerId = Math.random().toString(36).substring(2, 6).toUpperCase();
			localStorage.setItem('sueca_player_id', localPlayerId);
		}
		const savedRoom = localStorage.getItem('sueca_room_code');
		const savedSolo = localStorage.getItem('sueca_is_solo') === 'true';
		if (savedRoom) {
			connectToTable(savedRoom, savedSolo, false);
		} else {
			fetchRooms();
			lobbyTimer = setInterval(fetchRooms, 3000);
		}
	});

	onDestroy(() => {
		if (lobbyTimer) clearInterval(lobbyTimer);
	});

	function connectToTable(code: string, solo: boolean = false, isPrivate: boolean = false) {
		if (!code) return;
		currentRoomCode = code.toUpperCase();
		isSoloMode = solo;

		localStorage.setItem('sueca_room_code', currentRoomCode);
		localStorage.setItem('sueca_is_solo', isSoloMode.toString());

		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		let wsUrl = `${protocol}//${window.location.host}/api/play/${currentRoomCode}?playerId=${localPlayerId}`;
		if (isPrivate) wsUrl += '&private=true';

		const ws = new WebSocket(wsUrl);
		socket = ws;

		ws.onopen = () => {
			// Ignore if this socket was already superseded by a newer connectToTable call.
			if (socket !== ws) return;
			isConnected = true;
			if (isSoloMode && !gameStarted) ws.send('START_GAME');
		};

		ws.onmessage = (event) => {
			if (socket !== ws) return;
			const data = JSON.parse(event.data);
			if (data.action === 'GAME_STATE_UPDATE') {
				isWaitingForHost = false;
				gameStarted = data.gameStarted;
				if (gameStarted) {
					showGameOverModal = false;
					gameOverData = null;
					roundEnded = false;
				}

				ownerId = data.ownerId;
				myHand = data.myHand;
				handSizes = data.handSizes || {};
				table = data.table;
				playersList = data.players;
				activePlayerId = data.activePlayerId;
				dealerId = data.dealerId;
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
				addToast('The host declined your join request.');
				setTimeout(() => quitRoom(), 2000);
			} else if (data.action === 'ERROR') {
				addToast(data.message);
			} else if (data.action === 'GAME_OVER') {
				gameOverData = data;
				roundEnded = true;
				// Delay modal until the trick-vanish animation finishes (~1500ms) plus a small buffer
				setTimeout(() => {
					showGameOverModal = true;
				}, 1800);
			}
		};

		ws.onclose = () => {
			// Only react to the close of the currently active socket.
			if (socket !== ws) return;
			if (document.visibilityState === 'visible') quitRoom();
		};
	}

	function playCard(index: number) {
		try {
			if (!socket || socket.readyState !== WebSocket.OPEN) throw new Error(`Socket disconnected.`);
			socket.send(`PLAY_CARD:${index}`);
		} catch (err: any) {
			addToast(`${err.message}`);
		}
	}

	function quitRoom() {
		if (socket) {
			if (socket.readyState === WebSocket.OPEN) socket.send('LEAVE_ROOM');
			socket.onclose = null;
			socket.close();
			socket = null;
		}
		localStorage.removeItem('sueca_room_code');
		localStorage.removeItem('sueca_is_solo');
		window.location.reload();
	}
</script>

<main
	class="flex min-h-screen flex-col items-center justify-center bg-[#0c0c0c] p-4 font-sans text-text selection:bg-neutral-500"
>
	<div class="pointer-events-none fixed top-6 left-1/2 z-50 -translate-x-1/2">
		{#each toasts as toast, i (toast.id)}
			{@const depth = toasts.length - 1 - i}
			<!-- Positioning wrapper: CSS-transitioned top/scale -->
			<div
				style="
					position: absolute;
					top: {depth * 6}px;
					left: 50%;
					transform: translateX(-50%) scale({1 - depth * 0.04});
					z-index: {50 - depth};
					transition: top 350ms cubic-bezier(0.32,0.72,0,1), transform 350ms cubic-bezier(0.32,0.72,0,1);
				"
			>
				<!-- Slide wrapper: only translateY, no opacity -->
				<div
					in:slideY={{ duration: 350 }}
					out:slideY={{ duration: 250 }}
					class="w-max rounded border border-neutral-700 bg-[#121212] px-8 py-4 text-sm font-light tracking-[0.15em] text-neutral-300 shadow-2xl backdrop-blur-md"
				>
					{toast.message}
				</div>
			</div>
		{/each}
	</div>

	{#if !isConnected}
		<Lobby {localPlayerId} {openRooms} bind:roomInput {connectToTable} {fetchRooms} />
	{:else if isWaitingForHost}
		<div
			class="w-full max-w-md rounded-xl border border-neutral-800 bg-[#121212] p-8 text-center shadow-2xl"
		>
			<p class="mb-1 text-[10px] font-light tracking-[0.3em] text-neutral-500 uppercase">
				Private Room
			</p>
			<h1 class="mb-6 text-2xl font-light tracking-widest text-text">{currentRoomCode}</h1>
			<p class="mb-8 text-[10px] font-light tracking-[0.2em] text-neutral-500 uppercase">
				Waiting for host approval...
			</p>
			<button
				onclick={quitRoom}
				class="text-[10px] font-light tracking-[0.2em] text-neutral-600 uppercase transition-colors hover:text-text"
				>Cancel</button
			>
		</div>
	{:else}
		<Table
			{myHand}
			{table}
			{playersList}
			{activePlayerId}
			{myPlayerId}
			{ownerId}
			{dealerId}
			{team1Points}
			{team2Points}
			{team1MatchPoints}
			{team2MatchPoints}
			{trumpCard}
			{currentRoomCode}
			{isSoloMode}
			{handSizes}
			{gameStarted}
			{socket}
			{approvalRequests}
			{quitRoom}
			{playCard}
			{roundEnded}
		/>
	{/if}

	{#if showGameOverModal && gameOverData}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
		>
			<div
				class="w-full max-w-md rounded-2xl border border-neutral-800 bg-[#0c0c0c] p-8 text-center shadow-2xl"
			>
				<p class="mb-1 text-[10px] font-light tracking-[0.3em] text-neutral-500 uppercase">
					Round Over
				</p>
				<div class="my-8 flex justify-around rounded-xl border border-neutral-800 bg-[#121212] p-6">
					<div class="flex flex-col items-center">
						<span class="mb-1 text-[10px] font-light tracking-[0.2em] text-neutral-500 uppercase"
							>Team 1</span
						>
						<span class="text-4xl font-light text-text">{gameOverData.t1}</span>
						<span class="mt-1 text-[10px] font-light tracking-widest text-neutral-600 uppercase"
							>pts</span
						>
					</div>
					<div class="w-px bg-neutral-800"></div>
					<div class="flex flex-col items-center">
						<span class="mb-1 text-[10px] font-light tracking-[0.2em] text-neutral-500 uppercase"
							>Team 2</span
						>
						<span class="text-4xl font-light text-text">{gameOverData.t2}</span>
						<span class="mt-1 text-[10px] font-light tracking-widest text-neutral-600 uppercase"
							>pts</span
						>
					</div>
				</div>
				<p class="mb-8 text-sm font-light tracking-wide whitespace-pre-line text-neutral-400">
					{gameOverData.matchResult}
				</p>
				<div class="flex flex-col gap-3">
					{#if ownerId === myPlayerId || isSoloMode}
						<button
							onclick={() => socket?.send('START_GAME')}
							class="w-full rounded-lg border border-neutral-700 bg-neutral-900 py-4 text-[10px] font-light tracking-[0.2em] text-text uppercase transition-all hover:border-neutral-500 hover:bg-neutral-800"
							>{gameOverData.isMatchOver ? 'Play New Match' : 'Next Round'}</button
						>
					{:else}
						<div
							class="rounded-lg border border-neutral-800 bg-neutral-900/50 py-4 text-[10px] font-light tracking-[0.2em] text-neutral-500 uppercase"
						>
							Waiting for host...
						</div>
					{/if}
					<button
						onclick={quitRoom}
						class="w-full rounded-lg border border-neutral-800 py-3 text-[10px] font-light tracking-[0.2em] text-neutral-500 uppercase transition-colors hover:border-neutral-600 hover:text-text"
						>Leave Room</button
					>
				</div>
			</div>
		</div>
	{/if}
</main>

<style>
	:global(.custom-scrollbar::-webkit-scrollbar) {
		width: 6px;
	}
	:global(.custom-scrollbar::-webkit-scrollbar-track) {
		background: transparent;
	}
	:global(.custom-scrollbar::-webkit-scrollbar-thumb) {
		background-color: #404040;
		border-radius: 10px;
	}
</style>
