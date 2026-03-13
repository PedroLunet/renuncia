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

	let trickCollected = $state(false);
	let lastPlayedCardRect: DOMRect | null = null;
	let cachedDeckCenter: { x: number; y: number } | null = null;

	$effect(() => {
		if (isStartOfRound) {
			cachedDeckCenter = null;
			trickCollected = false;
		} else if (table.length === 0 && myHand.length < 10) {
			setTimeout(() => {
				trickCollected = true;
			}, 1300);
		}
	});

	function handlePlayCard(index: number) {
		const card = myHand[index];
		const el = document.getElementById(`my-card-${card.suit}-${card.rank}`);
		if (el) lastPlayedCardRect = el.getBoundingClientRect();
		playCard(index);
	}

	// --- REBUILT & BULLETPROOF 3-STEP ANIMATION ---
	function trickVanish(node: HTMLElement, { initialRot = 0 }) {
		const rect = node.getBoundingClientRect();

		// Relative target 1: The exact center of the screen
		const centerTargetX = window.innerWidth / 2 - (rect.left + rect.width / 2);
		const centerTargetY = window.innerHeight / 2 - (rect.top + rect.height / 2);

		// Relative target 2: The Won Tricks Pile (bottom-right)
		const pileTargetX = window.innerWidth - 32 - 25.6 - (rect.left + rect.width / 2);
		const pileTargetY = window.innerHeight - 32 - 38.4 - (rect.top + rect.height / 2);

		const faceImg = node.querySelector('.card-face') as HTMLElement;
		const backImg = node.querySelector('.card-back') as HTMLElement;

		return {
			duration: 1500,
			// FIX: Changed from `css:` to `tick:`. This runs JavaScript every single frame!
			tick: (t: number, u: number) => {
				let x = 0,
					y = 0,
					rotZ = initialRot,
					rotY = 0,
					scale = 1;

				if (u < 0.3) {
					// STEP 1: Slide to center & stack (0% - 30%)
					const p = cubicOut(u / 0.3);
					x = centerTargetX * p;
					y = centerTargetY * p;
					rotZ = initialRot * (1 - p);
				} else if (u < 0.5) {
					// PAUSE: Let user register the perfect face-up stack (30% - 50%)
					x = centerTargetX;
					y = centerTargetY;
					rotZ = 0;
				} else if (u < 0.7) {
					// STEP 2: Flip the stack upside down (50% - 70%)
					const p = (u - 0.5) / 0.2;
					x = centerTargetX;
					y = centerTargetY;
					rotZ = 0;
					rotY = 180 * p;
				} else {
					// STEP 3: Fly to corner pile & shrink (70% - 100%)
					const p = cubicOut((u - 0.7) / 0.3);
					x = centerTargetX + (pileTargetX - centerTargetX) * p;
					y = centerTargetY + (pileTargetY - centerTargetY) * p;
					rotZ = 0;
					rotY = 180;
					scale = 1 - 0.2 * p;
				}

				// PERFECT IMAGE SWAP
				if (rotY > 90) {
					if (faceImg) faceImg.style.display = 'none';
					if (backImg) backImg.style.display = 'block';
				} else {
					if (faceImg) faceImg.style.display = 'block';
					if (backImg) backImg.style.display = 'none';
				}

				// Applies clean relative transforms directly to the node
				node.style.transform = `translate(${x}px, ${y}px) rotateZ(${rotZ}deg) rotateY(${rotY}deg) scale(${scale})`;
				node.style.transformStyle = 'preserve-3d';
				node.style.zIndex = '9999';
			}
		};
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
						onComplete: () => {
							gsap.set(node, { clearProps: 'transform' });
							if (targetRotation !== 0) {
								node.style.transform = `rotate(${targetRotation}deg)`;
							}
						}
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

				const isMe = playerOffset === 0;
				const startScale = isMe ? 0.666 : 1.333;

				if (isDealer && index === 9) {
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
					let delayTime = 0.5 + (dealTurn * 10 + index) * 0.05;
					gsap.fromTo(
						node,
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
			tl.to(node, { duration: 2.2 });

			if (dOffset === 0) {
				tl.to(node, { opacity: 0, duration: 0 });
			} else {
				tl.to(node, { rotationY: -90, duration: 0.2, ease: 'power1.inOut' });
				tl.to(node, { opacity: 0, duration: 0 });
			}
		}
		applyAnim(isStart);
		return {
			update(newStart: boolean) {
				applyAnim(newStart);
			},
			destroy() {
				tl.kill();
			}
		};
	}

	function deckAnim(node: HTMLElement, isStart: boolean) {
		function applyAnim(start: boolean) {
			const l1 = node.querySelector('.deck-layer-1');
			const l2 = node.querySelector('.deck-layer-2');

			if (!start) {
				gsap.set(node, { opacity: 0 });
				return;
			}

			gsap.set(node, { opacity: 1 });
			gsap.set(l1, { x: 8, y: 8, opacity: 0.4 });
			gsap.set(l2, { x: 4, y: 4, opacity: 0.7 });

			gsap.to([l1, l2], { x: 0, y: 0, opacity: 0, duration: 2.0, delay: 0.5, ease: 'none' });
			gsap.set(node, { opacity: 0, delay: 2.5 });
		}
		applyAnim(isStart);
		return {
			update(newStart: boolean) {
				applyAnim(newStart);
			},
			destroy() {
				gsap.killTweensOf(node);
				gsap.killTweensOf(node.children);
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

	{#if trickCollected}
		<div
			in:fade={{ duration: 300 }}
			class="absolute right-8 bottom-8 z-10 flex h-[76.8px] w-[51.2px] items-center justify-center"
		>
			<img
				src="/cards/back.svg"
				alt="Pile"
				class="absolute top-0 left-0 h-full w-full opacity-90 drop-shadow-xl"
				draggable="false"
			/>
			<img
				src="/cards/back.svg"
				alt="Pile"
				class="absolute top-1 left-1 -z-10 h-full w-full opacity-40 drop-shadow-lg"
				draggable="false"
			/>
		</div>
	{/if}

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
					class="deck-layer-1 absolute top-0 left-0 -z-30 h-full w-full drop-shadow-md"
				/>
				<img
					src="/cards/back.svg"
					alt=""
					class="deck-layer-2 absolute top-0 left-0 -z-20 h-full w-full drop-shadow-md"
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

			{#each table.filter((p) => playerNorth && p.playerId === playerNorth.id) as play (play.card.suit + '-' + play.card.rank)}
				<div
					use:playAnimation={{ playerId: playerNorth.id }}
					out:trickVanish={{ initialRot: 0 }}
					class="absolute z-20 flex flex-col justify-between rounded-lg drop-shadow-xl"
					style="width: 64px; height: 96px; top: 16px; left: calc(50% - 32px);"
				>
					<img
						src="/cards/{play.card.suit}-{play.card.rank}.svg"
						alt="Face"
						class="card-face absolute inset-0 h-full w-full object-contain"
					/>
					<img
						src="/cards/back.svg"
						alt="Back"
						class="card-back absolute inset-0 h-full w-full object-contain"
						style="display: none; transform: scaleX(-1);"
					/>
				</div>
			{/each}

			{#each table.filter((p) => playerSouth && p.playerId === playerSouth.id) as play (play.card.suit + '-' + play.card.rank)}
				<div
					use:playAnimation={{ playerId: playerSouth.id }}
					out:trickVanish={{ initialRot: 0 }}
					class="absolute z-40 flex flex-col justify-between rounded-lg drop-shadow-xl"
					style="width: 64px; height: 96px; bottom: 16px; left: calc(50% - 32px);"
				>
					<img
						src="/cards/{play.card.suit}-{play.card.rank}.svg"
						alt="Face"
						class="card-face absolute inset-0 h-full w-full object-contain"
					/>
					<img
						src="/cards/back.svg"
						alt="Back"
						class="card-back absolute inset-0 h-full w-full object-contain"
						style="display: none; transform: scaleX(-1);"
					/>
				</div>
			{/each}

			{#each table.filter((p) => playerWest && p.playerId === playerWest.id) as play (play.card.suit + '-' + play.card.rank)}
				<div
					use:playAnimation={{ playerId: playerWest.id }}
					out:trickVanish={{ initialRot: 90 }}
					class="absolute z-30 flex flex-col justify-between rounded-lg drop-shadow-xl"
					style="width: 64px; height: 96px; left: 16px; top: calc(50% - 48px); transform: rotate(90deg);"
				>
					<img
						src="/cards/{play.card.suit}-{play.card.rank}.svg"
						alt="Face"
						class="card-face absolute inset-0 h-full w-full object-contain"
					/>
					<img
						src="/cards/back.svg"
						alt="Back"
						class="card-back absolute inset-0 h-full w-full object-contain"
						style="display: none; transform: scaleX(-1);"
					/>
				</div>
			{/each}

			{#each table.filter((p) => playerEast && p.playerId === playerEast.id) as play (play.card.suit + '-' + play.card.rank)}
				<div
					use:playAnimation={{ playerId: playerEast.id }}
					out:trickVanish={{ initialRot: -90 }}
					class="absolute z-30 flex flex-col justify-between rounded-lg drop-shadow-xl"
					style="width: 64px; height: 96px; right: 16px; top: calc(50% - 48px); transform: rotate(-90deg);"
				>
					<img
						src="/cards/{play.card.suit}-{play.card.rank}.svg"
						alt="Face"
						class="card-face absolute inset-0 h-full w-full object-contain"
					/>
					<img
						src="/cards/back.svg"
						alt="Back"
						class="card-back absolute inset-0 h-full w-full object-contain"
						style="display: none; transform: scaleX(-1);"
					/>
				</div>
			{/each}
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
