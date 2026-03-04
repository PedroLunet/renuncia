<script lang="ts">
	let {
		localPlayerId,
		openRooms,
		roomInput = $bindable(),
		connectToTable,
		fetchRooms
	} = $props<{
		localPlayerId: string;
		openRooms: unknown[];
		roomInput: string;
		connectToTable: (code: string, solo: boolean, isPrivate: boolean) => void;
		fetchRooms: () => void;
	}>();

	function generateRoomCode() {
		return Math.random().toString(36).substring(2, 6).toUpperCase();
	}
</script>

<div
	class="w-full max-w-lg rounded-2xl border border-neutral-800 bg-[#121212] p-10 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
>
	<h1
		class="mb-10 text-center text-3xl font-light tracking-[0.3em] text-text uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]"
	>
		Sueca
	</h1>

	<div class="space-y-8">
		<div class="space-y-3">
			<button
				onclick={() => connectToTable(`SOLO_${localPlayerId}`, true, false)}
				class="w-full rounded-xl border border-neutral-700 bg-neutral-900 py-4 text-xs font-light tracking-[0.2em] text-text uppercase transition-all duration-300 hover:border-neutral-500 hover:bg-neutral-800 hover:shadow-[0_0_15px_rgba(255,255,255,0.05)]"
			>
				Play Solo
			</button>

			<div class="flex gap-3">
				<button
					onclick={() => connectToTable(generateRoomCode(), false, false)}
					class="flex-1 rounded-xl bg-neutral-800 py-4 text-xs font-light tracking-[0.2em] text-text uppercase transition-all duration-300 hover:bg-neutral-700"
				>
					Public Room
				</button>
				<button
					onclick={() => connectToTable(generateRoomCode(), false, true)}
					class="flex-1 rounded-xl border border-neutral-800 bg-transparent py-4 text-xs font-light tracking-[0.2em] text-neutral-500 uppercase transition-all duration-300 hover:border-neutral-600 hover:text-text"
				>
					Private Room
				</button>
			</div>
		</div>

		<div class="rounded-xl border border-neutral-800/60 bg-[#0c0c0c] p-6">
			<div class="mb-4 flex items-center justify-between border-b border-neutral-800/50 pb-4">
				<h2 class="text-[10px] font-light tracking-[0.2em] text-neutral-500 uppercase">
					Open Rooms
				</h2>
				<button
					onclick={fetchRooms}
					class="text-[10px] font-light tracking-[0.2em] text-neutral-500 uppercase transition-colors hover:text-text"
				>
					Refresh
				</button>
			</div>

			<div class="custom-scrollbar max-h-48 space-y-1 overflow-y-auto pr-2">
				{#if openRooms.length === 0}
					<div class="py-8 text-center text-xs font-light tracking-widest text-neutral-600">
						No rooms active
					</div>
				{:else}
					{#each openRooms as room (room.code)}
						<div
							class="group flex items-center justify-between rounded-lg border border-transparent p-3 transition-colors hover:border-neutral-800 hover:bg-neutral-900/50"
						>
							<div>
								<div class="flex items-center gap-2 font-mono text-lg font-light text-text">
									{room.code}
									{#if room.isPrivate}
										<span class="text-[10px] tracking-widest text-neutral-500">(Private)</span>
									{/if}
								</div>
								<div
									class="mt-1 text-[9px] font-light tracking-[0.2em] uppercase {room.status ===
									'playing'
										? 'text-neutral-500'
										: 'text-neutral-400'}"
								>
									{room.status === 'playing' ? 'In Progress' : 'Waiting'} • {room.playerCount}/4
								</div>
							</div>
							<button
								onclick={() => connectToTable(room.code, false, false)}
								disabled={room.playerCount >= 4 || room.status === 'playing'}
								class="rounded-full border border-neutral-700 px-6 py-2 text-[10px] font-medium tracking-[0.2em] text-text uppercase transition-all hover:bg-text hover:text-black disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-text"
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
				placeholder="CODE"
				maxlength="4"
				class="w-full rounded-xl border border-neutral-800 bg-[#0c0c0c] px-4 py-4 text-center font-mono text-xl font-light tracking-widest text-text uppercase placeholder-neutral-800 focus:border-neutral-600 focus:ring-0 focus:outline-none"
			/>
			<button
				onclick={() => connectToTable(roomInput, false, false)}
				disabled={roomInput.length < 4}
				class="rounded-xl bg-neutral-200 px-8 text-xs font-medium tracking-[0.2em] text-black uppercase transition-all duration-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-30"
			>
				Join
			</button>
		</div>
	</div>
</div>
