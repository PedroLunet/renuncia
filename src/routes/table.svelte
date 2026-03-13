<script lang="ts">
	import { tick } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { cubicOut } from 'svelte/easing';
	import gsap from 'gsap';

	// --- TYPES ---
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
		handSizes,
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
		handSizes: Record<string, number>;
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

	function getHandArray(size: number): number[] {
		const arr = [];
		for (let i = 0; i < size; i++) arr.push(i);
		return arr;
	}

	let handNorth = $derived(playerNorth ? getHandArray(handSizes[playerNorth.id] || 0) : []);
	let handEast = $derived(playerEast ? getHandArray(handSizes[playerEast.id] || 0) : []);
	let handWest = $derived(playerWest ? getHandArray(handSizes[playerWest.id] || 0) : []);

	let isStartOfRound = $derived(
		myHand.length === 10 && table.length === 0 && team1Points === 0 && team2Points === 0
	);

	let lastPlayedCardRect: DOMRect | null = null;
	let cachedDeckCenter: { x: number; y: number } | null = null;

	$effect(() => {
		if (isStartOfRound) cachedDeckCenter = null;
	});

	function handlePlayCard(index: number) {
		const card = myHand[index];
		const el = document.getElementById(`my-card-${card.suit}-${card.rank}`);
		if (el) lastPlayedCardRect = el.getBoundingClientRect();
		playCard(index);
	}

	function getPlayedCard(playerId: string | undefined): Card | null {
		if (!playerId) return null;
		return table.find((play: PlayedCard) => play.playerId === playerId)?.card || null;
	}

	function playAnimation(node: HTMLElement, { playerId }: { playerId: string }) {
		setTimeout(() => {
			const isMe = playerId === myPlayerId;
			let sourceRect: DOMRect | null = null;
			let initialRotation = 0;

			if (isMe && lastPlayedCardRect) {
				sourceRect = lastPlayedCardRect;
				lastPlayedCardRect = null;
			} else if (!isMe) {
				const count = handSizes[playerId] || 0;
				if (count > 0) {
					const randomIndex = count > 2 ? Math.floor(Math.random() * (count - 2)) + 1 : 0;
					const sourceEl = document.getElementById(`hand-${playerId}-card-${randomIndex}`);
					if (sourceEl) sourceRect = sourceEl.getBoundingClientRect();
				}
				initialRotation = playerId === playerEast?.id ? -90 : playerId === playerWest?.id ? 90 : 0;
			}

			if (sourceRect) {
				const targetRect = node.getBoundingClientRect();
				const deltaX = sourceRect.left - targetRect.left;
				const deltaY = sourceRect.top - targetRect.top;
				const targetRotation =
					playerId === playerEast?.id ? -90 : playerId === playerWest?.id ? 90 : 0;

				gsap.fromTo(
					node,
					{ x: deltaX, y: deltaY, rotation: initialRotation, scale: 0.8 },
					{
						x: 0,
						y: 0,
						rotation: targetRotation,
						scale: 1,
						duration: 0.4,
						ease: 'power2.out',
						clearProps: 'transform'
					}
				);
			} else {
				gsap.from(node, { scale: 0, opacity: 0, duration: 0.3 });
			}
		}, 10);
		return {
			destroy() {
				gsap.killTweensOf(node);
			}
		};
	}

	// --- MASTER DEALING ILLUSION ---
	function dealAnimation(
		node: HTMLElement,
		args: { index: number; playerOffset: number; isStart: boolean }
	) {
		function applyAnim({ index, playerOffset, isStart }: any) {
			if (!isStart) {
				node.style.opacity = '1';
				gsap.set(node, { clearProps: 'all' });
				return;
			}

			node.style.opacity = '0';

			setTimeout(() => {
				if (!cachedDeckCenter) {
					const deckEl = document.getElementById('deck');
					if (deckEl) {
						const r = deckEl.getBoundingClientRect();
						cachedDeckCenter = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
					} else {
						cachedDeckCenter = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
					}
				}

				const cardRect = node.getBoundingClientRect();
				const cardCenter = {
					x: cardRect.left + cardRect.width / 2,
					y: cardRect.top + cardRect.height / 2
				};

				const deltaX = cachedDeckCenter.x - cardCenter.x;
				const deltaY = cachedDeckCenter.y - cardCenter.y;

				const dIndex = playersList.findIndex((p: Player) => p.id === dealerId);
				const dOffset = dIndex !== -1 ? (dIndex - myIndex + 4) % 4 : 0;
				const isDealer = playerOffset === dOffset;
				const dealTurn = (playerOffset - dOffset - 1 + 4) % 4;

				// ILLUSION FIX 1: Start scale mathematically identical to the 64x96 deck
				const isMe = playerOffset === 0;
				const startScale = isMe ? 0.666 : 1.333;

				if (isDealer && index === 9) {
					// Trunfo Merge
					gsap.fromTo(
						node,
						{
							x: deltaX + 80,
							y: deltaY,
							scale: startScale,
							rotationY: playerOffset === 0 ? 0 : 90,
							zIndex: 100
						},
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
							clearProps: 'all'
						}
					);
				} else {
					// Standard Spree Deal
					let delayTime = 0.5 + (dealTurn * 10 + index) * 0.05;
					gsap.fromTo(
						node,
						// ILLUSION FIX 2: zIndex 100 puts it over the deck, rotation starts barely skewed for realism
						{
							x: deltaX,
							y: deltaY,
							scale: startScale,
							rotation: Math.random() * 20 - 10,
							zIndex: 100
						},
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
							clearProps: 'all'
						}
					);
				}
			}, 50);
		}
		applyAnim(args);
		return {
			update(newArgs: any) {
				applyAnim(newArgs);
			},
			destroy() {
				gsap.killTweensOf(node);
			}
		};
	}

	function ghostTrunfoAnim(node: HTMLElement, isStart: boolean) {
		function applyAnim(start: boolean) {
			if (!start) {
				gsap.set(node, { opacity: 0, display: 'none' });
				return;
			}
			gsap.set(node, { display: 'block', opacity: 1, scale: 1, x: 0, y: 0, rotationY: 0 });
			const dIndex = playersList.findIndex((p: Player) => p.id === dealerId);
			const dOffset = dIndex !== -1 ? (dIndex - myIndex + 4) % 4 : 0;

			const tl = gsap.timeline();
			tl.to(node, { x: 80, duration: 0.4, ease: 'power2.out' });
			tl.to(node, { duration: 2.2 }); // Wait for 39 cards to deal

			if (dOffset === 0) {
				tl.to(node, { opacity: 0, duration: 0 }); // Instantly vanish at 2.6s as my hand takes over
			} else {
				tl.to(node, { rotationY: -90, duration: 0.2, ease: 'power1.inOut' });
				tl.to(node, { opacity: 0, duration: 0 }); // Vanish at 2.8s as opponent hand takes over
			}
		}
		applyAnim(isStart);
		return {
			update(newStart: boolean) {
				applyAnim(newStart);
			},
			destroy() {
				gsap.killTweensOf(node);
			}
		};
	}

	// ILLUSION FIX 3: Deplete the deck layer by layer, perfectly synced with the math
	function deckAnim(node: HTMLElement, isStart: boolean) {
		function applyAnim(start: boolean) {
			const l1 = node.querySelector('.deck-layer-1');
			const l2 = node.querySelector('.deck-layer-2');
			const l3 = node.querySelector('.deck-layer-3');

			if (!start) {
				gsap.set([l1, l2, l3], { opacity: 0 });
				return;
			}

			gsap.set(l1, { opacity: 0.4 });
			gsap.set(l2, { opacity: 0.7 });
			gsap.set(l3, { opacity: 1 });

			// Deal mathematically finishes at 2.4s. Deplete visually as it happens!
			gsap.to(l1, { opacity: 0, duration: 0.1, delay: 1.0 }); // 1st third gone
			gsap.to(l2, { opacity: 0, duration: 0.1, delay: 1.8 }); // 2nd third gone
			gsap.to(l3, { opacity: 0, duration: 0, delay: 2.4 }); // Last card takes off!
		}
		applyAnim(isStart);
		return {
			update(newStart: boolean) {
				applyAnim(newStart);
			},
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
				<span class="text-3xl font-light text-text drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]"
					>{team1Points}</span
				>
				<span class="text-xs font-light text-neutral-400">{team1MatchPoints} Sets</span>
			</div>
		</div>
		<div class="flex flex-col">
			<span class="text-[10px] tracking-[0.2em] text-neutral-500 uppercase">Team 2 (E/W)</span>
			<div class="flex items-baseline gap-2">
				<span class="text-3xl font-light text-text drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]"
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
			class="text-left text-[10px] font-medium tracking-[0.2em] text-neutral-500 uppercase transition-colors hover:text-text"
		>
			Quit Match
		</button>
	</div>

	{#if trumpCard}
		<div
			in:fade={{ duration: 500, delay: isStartOfRound ? 3200 : 0 }}
			class="absolute top-8 right-8 z-20 flex flex-col items-end gap-1"
		>
			<span class="text-[10px] tracking-[0.2em] text-neutral-500 uppercase">Trunfo</span>
			<div class="flex items-center gap-3 text-3xl font-light text-text">
				{trumpCard.rank}
				<img src="/{trumpCard.suit}.svg" alt={trumpCard.suit} class="h-7 w-7 object-contain" />
			</div>
		</div>
	{/if}

	<div class="flex h-32 w-full flex-col items-center justify-start pt-8">
		{#if playerNorth}
			<div class="flex flex-col items-center gap-4 transition-all">
				{#if handNorth.length > 0}
					<div class="flex -space-x-6">
						{#each handNorth as cardIndex (cardIndex + '-' + (trumpCard?.suit || ''))}
							<div
								use:dealAnimation={{ index: cardIndex, playerOffset: 2, isStart: isStartOfRound }}
								id="hand-{playerNorth.id}-card-{cardIndex}"
							>
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
						? 'scale-105 text-text drop-shadow-[0_0_12px_rgba(255,255,255,0.6)]'
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
						? 'scale-105 text-text drop-shadow-[0_0_12px_rgba(255,255,255,0.6)]'
						: 'text-neutral-600'}"
					style="transform: rotate(-90deg);"
				>
					{playerWest.id}
					{dealerId === playerWest.id ? '🃏' : ''}
				</div>
				{#if handWest.length > 0}
					<div class="flex flex-col -space-y-8">
						{#each handWest as cardIndex (cardIndex + '-' + (trumpCard?.suit || ''))}
							<div
								use:dealAnimation={{ index: cardIndex, playerOffset: 3, isStart: isStartOfRound }}
								id="hand-{playerWest.id}-card-{cardIndex}"
							>
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
				use:deckAnim={isStartOfRound}
				class="pointer-events-none absolute top-1/2 left-1/2 z-0 h-24 w-16 -translate-x-1/2 -translate-y-1/2"
			>
				<img
					src="/cards/back.svg"
					alt=""
					class="deck-layer-1 absolute top-2 left-2 -z-30 h-full w-full drop-shadow-md"
				/>
				<img
					src="/cards/back.svg"
					alt=""
					class="deck-layer-2 absolute top-1 left-1 -z-20 h-full w-full drop-shadow-md"
				/>
				<img
					src="/cards/back.svg"
					alt="Deck"
					class="deck-layer-3 absolute top-0 left-0 h-full w-full drop-shadow-2xl"
					draggable="false"
				/>
			</div>

			{#if trumpCard}
				<img
					use:ghostTrunfoAnim={isStartOfRound}
					src="/cards/{trumpCard.suit}-{trumpCard.rank}.svg"
					alt="Trunfo"
					class="pointer-events-none absolute top-1/2 left-1/2 z-10 h-24 w-16 -translate-x-1/2 -translate-y-1/2 drop-shadow-2xl"
				/>
			{/if}

			{#if getPlayedCard(playerNorth?.id)}
				<div
					use:playAnimation={{ playerId: playerNorth.id }}
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
					use:playAnimation={{ playerId: playerSouth.id }}
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
					use:playAnimation={{ playerId: playerWest.id }}
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
					use:playAnimation={{ playerId: playerEast.id }}
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
				{#if handEast.length > 0}
					<div class="flex flex-col -space-y-8">
						{#each handEast as cardIndex (cardIndex + '-' + (trumpCard?.suit || ''))}
							<div
								use:dealAnimation={{ index: cardIndex, playerOffset: 1, isStart: isStartOfRound }}
								id="hand-{playerEast.id}-card-{cardIndex}"
							>
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
						? 'scale-105 text-text drop-shadow-[0_0_12px_rgba(255,255,255,0.6)]'
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
				? 'text-text drop-shadow-[0_0_12px_rgba(255,255,255,0.6)]'
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
				<div
					use:dealAnimation={{ index, playerOffset: 0, isStart: isStartOfRound }}
					animate:flip={{ duration: 400 }}
					id="my-card-{card.suit}-{card.rank}"
					class="h-36 w-24"
				>
					<button
						onclick={() => handlePlayCard(index)}
						class="group relative flex h-full w-full flex-col justify-between rounded-xl transition-all duration-500 hover:z-50 {isMyTurn
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
