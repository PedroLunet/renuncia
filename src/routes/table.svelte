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
	class="absolute inset-0 flex flex-col justify-between overflow-hidden bg-[#0c0c0c] font-sans text-neutral-300"
>
	<div class="absolute top-8 left-8 z-20 flex gap-12">
		<div class="flex flex-col">
			<span class="text-[10px] tracking-[0.2em] text-neutral-500 uppercase">Team 1 (N/S)</span>
			<div class="flex items-baseline gap-2">
				<span class="text-3xl font-light text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]"
					>{team1Points}</span
				>
				<span class="text-xs font-light text-neutral-400">{team1MatchPoints} Sets</span>
			</div>
		</div>
		<div class="flex flex-col">
			<span class="text-[10px] tracking-[0.2em] text-neutral-500 uppercase">Team 2 (E/W)</span>
			<div class="flex items-baseline gap-2">
				<span class="text-3xl font-light text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]"
					>{team2Points}</span
				>
				<span class="text-xs font-light text-neutral-400">{team2MatchPoints} Sets</span>
			</div>
		</div>
	</div>

	<div class="absolute bottom-8 left-8 z-20 flex flex-col gap-1">
		{#if !isSoloMode}
			<div class="text-[10px] tracking-[0.2em] text-neutral-600 uppercase">
				Room: <span class="text-neutral-400">{currentRoomCode}</span>
			</div>
		{/if}
		<button
			onclick={quitRoom}
			class="text-left text-[10px] font-medium tracking-[0.2em] text-neutral-500 uppercase transition-colors hover:text-white"
		>
			Quit Match
		</button>
	</div>

	{#if trumpCard}
		<div
			in:fade={{ duration: 500, delay: isStartOfRound ? 3200 : 0 }}
			class="absolute top-8 right-8 z-20 flex flex-col items-end"
		>
			<span class="text-[10px] tracking-[0.2em] text-neutral-500 uppercase">Trunfo</span>
			<div
				class="flex items-center gap-2 text-3xl font-light text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]"
			>
				{trumpCard.rank}
				<span class="text-2xl">
					{#if trumpCard.suit === 'copas'}❤️{:else if trumpCard.suit === 'espadas'}♠️{:else if trumpCard.suit === 'ouros'}♦️{:else}♣️{/if}
				</span>
			</div>
		</div>
	{/if}

	<div class="flex h-32 w-full flex-col items-center justify-start pt-8">
		{#if playerNorth}
			<div class="flex flex-col items-center gap-4 transition-all">
				{#if myHand.length > 0}
					<div class="flex -space-x-6">
						{#each myHand as card, index (card.suit + card.rank)}
							<div use:dealAnimation={{ index, playerOffset: 2 }}>
								<img
									src="/cards/back.svg"
									alt="Card Back"
									class="h-auto w-12 drop-shadow-lg"
									draggable="false"
								/>
							</div>
						{/each}
					</div>
				{/if}
				<div
					class="text-[10px] font-light tracking-[0.2em] uppercase transition-all duration-500 {activePlayerId ===
					playerNorth.id
						? 'scale-105 text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.6)]'
						: 'text-neutral-600'}"
				>
					{playerNorth.id}
					{dealerId === playerNorth.id ? '🃏' : ''}
				</div>
			</div>
		{/if}
	</div>

	<div class="flex flex-1 items-center justify-between px-12">
		{#if playerWest}
			<div class="flex flex-row items-center gap-6 transition-all">
				<div
					class="text-[10px] font-light tracking-[0.2em] uppercase transition-all duration-500 {activePlayerId ===
					playerWest.id
						? 'scale-105 text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.6)]'
						: 'text-neutral-600'}"
					style="transform: rotate(-90deg);"
				>
					{playerWest.id}
					{dealerId === playerWest.id ? '🃏' : ''}
				</div>
				{#if myHand.length > 0}
					<div class="flex flex-col -space-y-8">
						{#each myHand as card, index (card.suit + card.rank)}
							<div use:dealAnimation={{ index, playerOffset: 3 }}>
								<img
									src="/cards/back.svg"
									alt="Card Back"
									class="h-auto w-12 drop-shadow-lg"
									style="transform: rotate(90deg);"
									draggable="false"
								/>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<div class="relative h-64 w-64">
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
				<img
					src="/cards/back.svg"
					alt=""
					class="absolute top-0.5 left-0.5 -z-10 h-full w-full opacity-50"
				/>
				<img
					src="/cards/back.svg"
					alt=""
					class="absolute top-1 left-1 -z-20 h-full w-full opacity-20"
				/>
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
					class="absolute top-4 left-1/2 flex h-24 w-16 -translate-x-1/2 flex-col justify-between rounded-lg drop-shadow-xl"
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
					class="absolute bottom-4 left-1/2 z-10 flex h-24 w-16 -translate-x-1/2 flex-col justify-between rounded-lg drop-shadow-xl"
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
					class="absolute top-1/2 left-4 flex h-24 w-16 -translate-y-1/2 rotate-90 flex-col justify-between rounded-lg drop-shadow-xl"
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
					class="absolute top-1/2 right-4 flex h-24 w-16 -translate-y-1/2 -rotate-90 flex-col justify-between rounded-lg drop-shadow-xl"
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
			<div class="flex flex-row items-center gap-6 transition-all">
				{#if myHand.length > 0}
					<div class="flex flex-col -space-y-8">
						{#each myHand as card, index (card.suit + card.rank)}
							<div use:dealAnimation={{ index, playerOffset: 1 }}>
								<img
									src="/cards/back.svg"
									alt="Card Back"
									class="h-auto w-12 drop-shadow-lg"
									style="transform: rotate(-90deg);"
									draggable="false"
								/>
							</div>
						{/each}
					</div>
				{/if}
				<div
					class="text-[10px] font-light tracking-[0.2em] uppercase transition-all duration-500 {activePlayerId ===
					playerEast.id
						? 'scale-105 text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.6)]'
						: 'text-neutral-600'}"
					style="transform: rotate(90deg);"
				>
					{playerEast.id}
					{dealerId === playerEast.id ? '🃏' : ''}
				</div>
			</div>
		{/if}
	</div>

	<div class="flex flex-col items-center justify-end pb-8">
		<div
			class="mb-8 text-[10px] font-light tracking-[0.2em] uppercase transition-all duration-500 {isMyTurn
				? 'text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.6)]'
				: 'text-neutral-600'}"
		>
			{#if isMyTurn}
				Play a card
			{:else}
				Waiting for {activePlayerId}
			{/if}
		</div>

		<div class="relative flex h-32 w-full max-w-3xl justify-center gap-2">
			{#each myHand as card, index (card.suit + card.rank)}
				<div use:dealAnimation={{ index, playerOffset: 0 }} class="h-36 w-24">
					<button
						onclick={() => playCard(index)}
						class="group relative flex h-full w-full flex-col justify-between rounded-xl transition-all duration-500 hover:z-50
            {isMyTurn
							? 'cursor-pointer hover:-translate-y-8 hover:drop-shadow-[0_0_25px_rgba(255,255,255,0.3)]'
							: 'cursor-not-allowed opacity-60 hover:-translate-y-2'}"
						style="transform: translateY({Math.abs(index - myHand.length / 2) *
							5}px) rotate({(index - myHand.length / 2) * 3}deg);"
					>
						<img
							src="/cards/{card.suit}-{card.rank}.svg"
							alt="{card.rank} of {card.suit}"
							class="h-full w-full object-contain drop-shadow-xl"
							draggable="false"
						/>
					</button>
				</div>
			{/each}
		</div>
	</div>
</div>
