<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Lobby from './lobby.svelte';
	import Table from './table.svelte';

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
				errorMessage = 'The host declined your join request.';
				setTimeout(() => quitRoom(), 2000);
			} else if (data.action === 'ERROR') {
				errorMessage = data.message;
				setTimeout(() => (errorMessage = ''), 4000);
			} else if (data.action === 'GAME_OVER') {
				gameOverData = data;
				showGameOverModal = true;
				gameStarted = false;
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
			errorMessage = `FRONTEND ERROR: ${err.message}`;
			setTimeout(() => (errorMessage = ''), 4000);
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
	{#if errorMessage}
		<div
			class="fixed top-10 left-1/2 z-50 -translate-x-1/2 animate-bounce rounded-full border-2 border-red-400 bg-red-900/90 px-6 py-2 font-bold text-text shadow-xl backdrop-blur-md"
		>
			⚠️ {errorMessage}
		</div>
	{/if}

	{#if !isConnected}
		<Lobby {localPlayerId} {openRooms} bind:roomInput {connectToTable} {fetchRooms} />
	{:else if isWaitingForHost}
		<div
			class="w-full max-w-md rounded-xl border border-amber-600 bg-emerald-800 p-8 text-center shadow-2xl"
		>
			<div class="mb-6 animate-pulse text-6xl">🔒</div>
			<h1 class="mb-2 text-2xl font-bold text-amber-400">Waiting for Host Approval...</h1>
			<p class="mb-8 text-emerald-200">
				The owner of room <strong>{currentRoomCode}</strong> is reviewing your request.
			</p>
			<button
				onclick={quitRoom}
				class="text-sm font-bold tracking-widest text-red-400 uppercase hover:text-red-300"
				>Cancel Request</button
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
		/>
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
						<span class="text-4xl font-bold text-text">{gameOverData.t2}</span>
						<span class="mt-1 text-[10px] text-text/50 uppercase">Points</span>
					</div>
				</div>
				<p class="mb-8 text-lg font-bold whitespace-pre-line text-emerald-100">
					{gameOverData.matchResult}
				</p>
				<div class="flex flex-col gap-3">
					{#if ownerId === myPlayerId || isSoloMode}
						<button
							onclick={() => socket?.send('START_GAME')}
							class="w-full rounded-lg py-4 font-bold shadow-lg transition-transform hover:-translate-y-1 {gameOverData.isMatchOver
								? 'bg-indigo-600 text-text hover:bg-indigo-500'
								: 'bg-amber-500 text-emerald-950 hover:bg-amber-400'}"
							>{gameOverData.isMatchOver ? '🏆 Play New Match' : '🃏 Play Next Round'}</button
						>
					{:else}
						<div
							class="rounded-lg border border-emerald-700 bg-emerald-800/50 py-4 font-bold text-emerald-300 italic"
						>
							Waiting for host to continue...
						</div>
					{/if}
					<button
						onclick={quitRoom}
						class="w-full rounded-lg border py-3 text-sm font-bold tracking-widest uppercase transition-colors {gameOverData.isMatchOver
							? 'border-emerald-500/50 bg-emerald-900/40 text-emerald-400 hover:bg-emerald-800 hover:text-text'
							: 'border-red-500/30 bg-red-900/20 text-red-400 hover:bg-red-900/50 hover:text-red-300'}"
						>{gameOverData.isMatchOver ? '🏠 Return to Home' : 'Leave Room'}</button
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
		background-color: #047857;
		border-radius: 10px;
	}
</style>
