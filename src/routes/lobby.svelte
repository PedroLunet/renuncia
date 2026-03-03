<script lang="ts">
	let {
		localPlayerId,
		openRooms,
		roomInput = $bindable(),
		connectToTable,
		fetchRooms
	} = $props<{
		localPlayerId: string;
		openRooms: any[];
		roomInput: string;
		connectToTable: (code: string, solo: boolean, isPrivate: boolean) => void;
		fetchRooms: () => void;
	}>();

	function generateRoomCode() {
		return Math.random().toString(36).substring(2, 6).toUpperCase();
	}
</script>

<div class="w-full max-w-lg rounded-xl border border-emerald-700 bg-emerald-800 p-8 shadow-2xl">
	<h1 class="mb-8 text-center text-4xl font-bold text-amber-400">Sueca Online</h1>

	<div class="space-y-6">
		<button
			onclick={() => connectToTable(`SOLO_${localPlayerId}`, true, false)}
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
									{#if room.isPrivate}<span class="text-sm">🔒</span>{/if}
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
								>Join</button
							>
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
