<script lang="ts">
	import { tick } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import gsap from 'gsap';

	export interface Card {
		suit: 'copas' | 'espadas' | 'ouros' | 'paus';
		rank: '2' | '3' | '4' | '5' | '6' | 'Q' | 'J' | 'K' | '7' | 'A';
		value: number;
	}
	export interface Player {
		id: string;
		isBot: boolean;
	}
	export interface PlayedCard {
		playerId: string;
		card: Card;
	}

	let {
		myHand,
		table,
		playersList,
		activePlayerId,
		myPlayerId,
		ownerId,
		dealerId,
		team1Points,
		team2Points,
		team1MatchPoints,
		team2MatchPoints,
		trumpCard,
		currentRoomCode,
		isSoloMode,
		quitRoom,
		playCard
	} = $props<{
		myHand: Card[];
		table: PlayedCard[];
		playersList: Player[];
		activePlayerId: string;
		myPlayerId: string;
		ownerId: string;
		dealerId: string;
		team1Points: number;
		team2Points: number;
		team1MatchPoints: number;
		team2MatchPoints: number;
		trumpCard: Card | null;
		currentRoomCode: string;
		isSoloMode: boolean;
		quitRoom: () => void;
		playCard: (index: number) => void;
	}>();

	let isMyTurn = $derived(
		activePlayerId === myPlayerId && activePlayerId !== '' && table.length < 4
	);

	let myIndex = $derived(playersList.findIndex((p: Player) => p.id === myPlayerId));
	let playerSouth = $derived(playersList[myIndex]);
	let playerEast = $derived(playersList[(myIndex + 1) % 4]);
	let playerNorth = $derived(playersList[(myIndex + 2) % 4]);
	let playerWest = $derived(playersList[(myIndex + 3) % 4]);

	let isStartOfRound = $derived(
		myHand.length === 10 && table.length === 0 && team1Points === 0 && team2Points === 0
	);

	function getPlayedCard(playerId: string | undefined): Card | null {
		if (!playerId) return null;
		return table.find((play: PlayedCard) => play.playerId === playerId)?.card || null;
	}

	function dealAnimation(
		node: HTMLElement,
		{ index = 0, playerOffset = 0 }: { index: number; playerOffset: number }
	) {
		if (!isStartOfRound) {
			node.style.opacity = '1';
			return;
		}
		node.style.opacity = '0';
		tick().then(() => {
			const deckEl = document.getElementById('deck');
			if (!deckEl) {
				node.style.opacity = '1';
				return;
			}
			const deckRect = deckEl.getBoundingClientRect();
			const cardRect = node.getBoundingClientRect();
			const deltaX = deckRect.left + deckRect.width / 2 - (cardRect.left + cardRect.width / 2);
			const deltaY = deckRect.top + deckRect.height / 2 - (cardRect.top + cardRect.height / 2);
			const dIndex = playersList.findIndex((p: Player) => p.id === dealerId);
			const dOffset = dIndex !== -1 ? (dIndex - myIndex + 4) % 4 : 0;
			const isDealer = playerOffset === dOffset;
			const dealTurn = (playerOffset - dOffset - 1 + 4) % 4;

			if (isDealer && index === 9) {
				gsap.fromTo(
					node,
					{ x: deltaX + 80, y: deltaY, scale: 1, rotationY: playerOffset === 0 ? 0 : 90 },
					{
						x: 0,
						y: 0,
						scale: 1,
						rotationY: 0,
						duration: 0.4,
						delay: playerOffset === 0 ? 2.6 : 2.8,
						ease: 'back.out(1.2)',
						onStart: () => {
							node.style.opacity = '1';
						},
						onComplete: () => {
							gsap.set(node, { clearProps: 'all' });
						}
					}
				);
			} else {
				let delayTime = 0.5 + (dealTurn * 10 + index) * 0.05;
				gsap.fromTo(
					node,
					{ x: deltaX, y: deltaY, scale: 0.2, rotation: Math.random() * 180 - 90 },
					{
						x: 0,
						y: 0,
						scale: 1,
						rotation: 0,
						duration: 0.4,
						delay: delayTime,
						ease: 'power2.out',
						onStart: () => {
							node.style.opacity = '1';
						},
						onComplete: () => {
							gsap.set(node, { clearProps: 'all' });
						}
					}
				);
			}
		});
		return {
			destroy() {
				gsap.killTweensOf(node);
			}
		};
	}

	function ghostTrunfoAnim(node: HTMLElement) {
		if (!isStartOfRound) {
			node.style.display = 'none';
			return;
		}
		const dIndex = playersList.findIndex((p: Player) => p.id === dealerId);
		const dOffset = dIndex !== -1 ? (dIndex - myIndex + 4) % 4 : 0;
		const tl = gsap.timeline();
		tl.set(node, { opacity: 1, scale: 0.2, x: 0, y: 0, rotationY: 0 });
		tl.to(node, { x: 80, scale: 1, duration: 0.4, ease: 'power2.out' });
		tl.to(node, { duration: 2.2 });
		if (dOffset === 0) {
			tl.to(node, { opacity: 0, duration: 0 });
		} else {
			tl.to(node, { rotationY: -90, duration: 0.2, ease: 'power1.inOut' });
			tl.to(node, { opacity: 0, duration: 0 });
		}
		return {
			destroy() {
				tl.kill();
			}
		};
	}

	function deckAnim(node: HTMLElement) {
		if (!isStartOfRound) {
			node.style.opacity = '0';
			return;
		}
		node.style.opacity = '1';
		gsap.to(node, { opacity: 0, duration: 0.5, delay: 3.0 });
		return {
			destroy() {
				gsap.killTweensOf(node);
			}
		};
	}
</script>

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
		{#if !isSoloMode}
			<div class="font-mono text-xs font-bold tracking-widest text-emerald-400/50 uppercase">
				Room: {currentRoomCode}
			</div>
		{/if}
		<button
			onclick={quitRoom}
			class="text-left text-xs font-bold tracking-widest text-red-400/60 uppercase hover:text-red-400"
			>Quit Match</button
		>
	</div>

	{#if trumpCard}
		<div
			in:fade={{ duration: 500, delay: isStartOfRound ? 3200 : 0 }}
			class="absolute top-4 right-4 z-20 rounded-lg border border-white/10 bg-black/40 p-3 text-center backdrop-blur-sm"
		>
			<div class="text-[10px] tracking-widest text-emerald-300 uppercase">Trunfo</div>
			<div class="flex items-center gap-2 text-xl font-bold">
				{trumpCard.rank}
				<span class="text-2xl"
					>{#if trumpCard.suit === 'copas'}❤️{:else if trumpCard.suit === 'espadas'}♠️{:else if trumpCard.suit === 'ouros'}♦️{:else}♣️{/if}</span
				>
			</div>
		</div>
	{/if}

	<div class="flex h-20 w-full items-center justify-center pt-4">
		{#if playerNorth}
			<div
				class="flex flex-col items-center transition-all {activePlayerId === playerNorth.id
					? 'scale-110 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]'
					: 'opacity-70'}"
			>
				{#if myHand.length > 0}
					<div class="mb-2 flex -space-x-6">
						{#each myHand as card, index (card.suit + card.rank)}
							<div use:dealAnimation={{ index, playerOffset: 2 }}>
								<img
									src="/cards/back.svg"
									alt="Card Back"
									class="h-auto w-12 drop-shadow-md"
									draggable="false"
								/>
							</div>
						{/each}
					</div>
				{/if}
				<div
					class="rounded-full border border-emerald-700 bg-emerald-950 px-4 py-1 text-sm font-bold shadow {dealerId ===
					playerNorth.id
						? 'border-amber-400 text-amber-400'
						: ''}"
				>
					{playerNorth.id} (Partner) {dealerId === playerNorth.id ? '🃏' : ''}
					{ownerId === playerNorth.id && !isSoloMode ? '👑' : ''}
				</div>
			</div>
		{/if}
	</div>

	<div class="flex flex-1 items-center justify-between px-4">
		{#if playerWest}
			<div
				class="flex flex-row items-center transition-all {activePlayerId === playerWest.id
					? 'scale-110 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]'
					: 'opacity-70'}"
			>
				<div
					class="rounded-full border border-emerald-700 bg-emerald-950 px-4 py-1 text-sm font-bold shadow {dealerId ===
					playerWest.id
						? 'border-amber-400 text-amber-400'
						: ''}"
					style="transform: rotate(-90deg);"
				>
					{playerWest.id}
					{dealerId === playerWest.id ? '🃏' : ''}
					{ownerId === playerWest.id && !isSoloMode ? '👑' : ''}
				</div>
				{#if myHand.length > 0}
					<div class="ml-2 flex flex-col -space-y-8">
						{#each myHand as card, index (card.suit + card.rank)}
							<div use:dealAnimation={{ index, playerOffset: 3 }}>
								<img
									src="/cards/back.svg"
									alt="Card Back"
									class="h-auto w-12 drop-shadow-md"
									style="transform: rotate(90deg);"
									draggable="false"
								/>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<div class="relative h-64 w-64 rounded-full border-2 border-dashed border-emerald-600/50">
			<div
				id="deck"
				use:deckAnim
				class="pointer-events-none absolute top-1/2 left-1/2 z-0 h-24 w-16 -translate-x-1/2 -translate-y-1/2"
			>
				<img
					src="/cards/back.svg"
					alt="Deck"
					class="h-full w-full drop-shadow-2xl"
					draggable="false"
				/>
				<img src="/cards/back.svg" alt="" class="absolute top-0.5 left-0.5 -z-10 h-full w-full" />
				<img src="/cards/back.svg" alt="" class="absolute top-1 left-1 -z-20 h-full w-full" />
			</div>

			{#if trumpCard}
				<img
					use:ghostTrunfoAnim
					src="/cards/{trumpCard.suit}-{trumpCard.rank}.svg"
					alt="Trunfo"
					class="pointer-events-none absolute top-1/2 left-1/2 z-10 h-24 w-16 -translate-x-1/2 -translate-y-1/2 drop-shadow-2xl"
				/>
			{/if}

			{#if getPlayedCard(playerNorth?.id)}
				<div
					in:fly={{ y: -100, duration: 300, easing: cubicOut }}
					class="absolute top-4 left-1/2 flex h-24 w-16 -translate-x-1/2 flex-col justify-between rounded-lg"
				>
					<img
						src="/cards/{getPlayedCard(playerNorth?.id)?.suit}-{getPlayedCard(playerNorth?.id)
							?.rank}.svg"
						alt="Played Card"
						class="h-full w-full object-contain"
					/>
				</div>
			{/if}

			{#if getPlayedCard(playerSouth?.id)}
				<div
					in:fly={{ y: 100, duration: 300, easing: cubicOut }}
					class="absolute bottom-4 left-1/2 z-10 flex h-24 w-16 -translate-x-1/2 flex-col justify-between rounded-lg"
				>
					<img
						src="/cards/{getPlayedCard(playerSouth?.id)?.suit}-{getPlayedCard(playerSouth?.id)
							?.rank}.svg"
						alt="Played Card"
						class="h-full w-full object-contain"
					/>
				</div>
			{/if}

			{#if getPlayedCard(playerWest?.id)}
				<div
					in:fly={{ x: -100, duration: 300, easing: cubicOut }}
					class="absolute top-1/2 left-4 flex h-24 w-16 -translate-y-1/2 rotate-90 flex-col justify-between rounded-lg"
				>
					<img
						src="/cards/{getPlayedCard(playerWest?.id)?.suit}-{getPlayedCard(playerWest?.id)
							?.rank}.svg"
						alt="Played Card"
						class="h-full w-full object-contain"
					/>
				</div>
			{/if}

			{#if getPlayedCard(playerEast?.id)}
				<div
					in:fly={{ x: 100, duration: 300, easing: cubicOut }}
					class="absolute top-1/2 right-4 flex h-24 w-16 -translate-y-1/2 -rotate-90 flex-col justify-between rounded-lg"
				>
					<img
						src="/cards/{getPlayedCard(playerEast?.id)?.suit}-{getPlayedCard(playerEast?.id)
							?.rank}.svg"
						alt="Played Card"
						class="h-full w-full object-contain"
					/>
				</div>
			{/if}
		</div>

		{#if playerEast}
			<div
				class="flex flex-row items-center transition-all {activePlayerId === playerEast.id
					? 'scale-110 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]'
					: 'opacity-70'}"
			>
				{#if myHand.length > 0}
					<div class="mr-2 flex flex-col -space-y-8">
						{#each myHand as card, index (card.suit + card.rank)}
							<div use:dealAnimation={{ index, playerOffset: 1 }}>
								<img
									src="/cards/back.svg"
									alt="Card Back"
									class="h-auto w-12 drop-shadow-md"
									style="transform: rotate(-90deg);"
									draggable="false"
								/>
							</div>
						{/each}
					</div>
				{/if}
				<div
					class="rounded-full border border-emerald-700 bg-emerald-950 px-4 py-1 text-sm font-bold shadow {dealerId ===
					playerEast.id
						? 'border-amber-400 text-amber-400'
						: ''}"
					style="transform: rotate(90deg);"
				>
					{playerEast.id}
					{dealerId === playerEast.id ? '🃏' : ''}
					{ownerId === playerEast.id && !isSoloMode ? '👑' : ''}
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
			{#each myHand as card, index (card.suit + card.rank)}
				<div use:dealAnimation={{ index, playerOffset: 0 }} class="h-36 w-24">
					<button
						onclick={() => playCard(index)}
						class="group relative flex h-full w-full flex-col justify-between rounded-xl transition-all duration-300 hover:z-50
            {isMyTurn
							? 'cursor-pointer hover:-translate-y-6 hover:shadow-2xl'
							: 'cursor-not-allowed opacity-80 hover:-translate-y-2'}"
						style="transform: translateY({Math.abs(index - myHand.length / 2) *
							5}px) rotate({(index - myHand.length / 2) * 3}deg);"
					>
						<img
							src="/cards/{card.suit}-{card.rank}.svg"
							alt="{card.rank} of {card.suit}"
							class="h-full w-full object-contain drop-shadow-md"
							draggable="false"
						/>
					</button>
				</div>
			{/each}
		</div>
	</div>
</div>
