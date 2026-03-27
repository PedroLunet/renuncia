<script lang="ts">
	import Button from '$lib/components/button.svelte';
	import TextInput from '$lib/components/textInput.svelte';

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

<div class="w-full max-w-lg p-10">
	<h1 class="font-regular mb-10 text-center font-sentient text-3xl tracking-wider text-primary">
		renúncia
	</h1>

	<div class="space-y-8">
		<div class="space-y-3">
			<Button
				variant="outline"
				class="w-full lowercase"
				onclick={() => connectToTable(`SOLO_${generateRoomCode()}`, true, false)}
			>
				Play Solo
			</Button>

			<div class="flex w-full gap-2">
				<Button
					size="md"
					class="flex-1 lowercase"
					onclick={() => connectToTable(generateRoomCode(), false, false)}
				>
					Public Room
				</Button>
				<Button
					size="md"
					variant="outline"
					class="flex-1 text-xl font-extralight lowercase"
					onclick={() => connectToTable(generateRoomCode(), false, true)}
				>
					Private Room
				</Button>
			</div>
		</div>

		<div class="rounded-xl border border-neutral-800/60 bg-bg p-6">
			<div class="mb-4 flex items-center justify-between border-b border-neutral-800/50 pb-4">
				<h2 class="text-[10px] font-light tracking-[0.2em] text-neutral-500 uppercase">
					Open Rooms
				</h2>
				<Button
					variant="ghost"
					size="xs"
					onclick={fetchRooms}
					class="text-[10px] font-light tracking-[0.2em] text-neutral-500 uppercase transition-colors hover:text-text"
				>
					Refresh
				</Button>
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
							<Button
								variant="outline"
								size="xs"
								onclick={() => connectToTable(room.code, false, false)}
								disabled={room.playerCount >= 4 || room.status === 'playing'}
								class="lowercase"
							>
								Join
							</Button>
						</div>
					{/each}
				{/if}
			</div>
		</div>

		<div class="flex gap-2">
			<TextInput
				size="md"
				type="text"
				bind:value={roomInput}
				placeholder="CODE"
				maxlength="4"
				class="w-full uppercase"
			/>
			<Button
				variant="primary"
				size="md"
				class="lowercase"
				onclick={() => connectToTable(roomInput, false, false)}
				disabled={roomInput.length < 4}
			>
				Join
			</Button>
		</div>
	</div>
</div>
