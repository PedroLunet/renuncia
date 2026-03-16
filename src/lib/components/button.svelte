<script lang="ts" module>
	import { cva, type VariantProps } from 'class-variance-authority';

	export const buttonStyle = cva(
		'font-family-switzer group relative inline-flex items-center justify-center gap-2 whitespace-nowrap select-none transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0c0c] disabled:pointer-events-none disabled:opacity-50 active:duration-75',
		{
			variants: {
				variant: {
					primary: 'bg-primary text-bg',
					destructive:
						'bg-[#2a0808] text-red-200 shadow-[inset_0_2px_3px_rgba(255,255,255,0.04),_inset_0_-3px_4px_rgba(0,0,0,0.6),_0_8px_0_0_#0d0101,_0_14px_20px_rgba(0,0,0,0.6)] hover:bg-[#380b0b] hover:text-red-100 hover:-translate-y-[1px] hover:shadow-[inset_0_2px_4px_rgba(255,255,255,0.06),_inset_0_-3px_4px_rgba(0,0,0,0.6),_0_9px_0_0_#0d0101,_0_18px_25px_rgba(0,0,0,0.8)] active:translate-y-[8px] active:shadow-[inset_0_1px_1px_rgba(255,255,255,0.02),_inset_0_-1px_2px_rgba(0,0,0,0.7),_0_0px_0_0_#0d0101,_0_0px_0px_rgba(0,0,0,0)] focus-visible:ring-red-500',

					secondary:
						'bg-[#121212] text-neutral-400 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05),_0_2px_0_0_#000] hover:-translate-y-[1px] hover:bg-[#1a1a1a] hover:text-neutral-200 hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1),_0_3px_0_0_#000] active:translate-y-[2px] active:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05),_0_0px_0_0_#000] focus-visible:ring-neutral-500',

					outline:
						'border border-neutral-800 bg-transparent text-neutral-400 hover:border-neutral-600 hover:bg-neutral-800/20 hover:text-neutral-200 active:translate-y-[1px] active:scale-[0.98] focus-visible:ring-neutral-500',

					ghost:
						'bg-transparent text-neutral-500 hover:bg-neutral-800/30 hover:text-neutral-200 active:translate-y-[1px] active:scale-[0.98] focus-visible:ring-neutral-500'
				},
				size: {
					xs: 'rounded-lg px-6 py-2 text-[10px]',
					sm: 'rounded-xl px-8 py-3 text-xs',
					md: 'rounded-2xl px-12 py-4 text-sm',
					lg: 'rounded-3xl px-14 py-6 text-base',
					icon: 'h-14 w-14 rounded-2xl p-0'
				},
				square: {
					true: 'aspect-square px-0',
					false: ''
				}
			},
			defaultVariants: {
				variant: 'primary',
				size: 'lg',
				square: false
			}
		}
	);

	export type ButtonVariantProps = VariantProps<typeof buttonStyle>;
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { clsx, type ClassValue } from 'clsx';
	import { twMerge } from 'tailwind-merge';

	function cn(...inputs: ClassValue[]) {
		return twMerge(clsx(inputs));
	}

	let {
		children,
		loader,
		class: className,
		variant = 'primary',
		size = 'md',
		square = false,
		isLoading = false,
		type = 'button',
		href,
		...restProps
	}: {
		children?: Snippet;
		loader?: Snippet;
		class?: string;
		variant?: ButtonVariantProps['variant'];
		size?: ButtonVariantProps['size'];
		square?: boolean;
		isLoading?: boolean;
		type?: 'button' | 'submit' | 'reset';
		href?: string;
		[key: string]: any;
	} = $props();
</script>

{#if href}
	<a {href} class={cn(buttonStyle({ variant, size, square }), className)} {...restProps}>
		<span
			class={cn(
				'inline-flex items-center gap-2 transition-opacity duration-300',
				isLoading ? 'opacity-0' : 'opacity-100'
			)}
		>
			{#if children}{@render children()}{/if}
		</span>

		{#if isLoading && loader}
			<span
				class="animate-in fade-in absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 duration-300"
			>
				{@render loader()}
			</span>
		{/if}
	</a>
{:else}
	<button
		{type}
		disabled={isLoading || restProps.disabled}
		class={cn(buttonStyle({ variant, size, square }), className)}
		{...restProps}
	>
		<span
			class={cn(
				'inline-flex items-center gap-2 transition-opacity duration-300',
				isLoading ? 'opacity-0' : 'opacity-100'
			)}
		>
			{#if children}{@render children()}{/if}
		</span>

		{#if isLoading && loader}
			<span
				class="animate-in fade-in absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 duration-300"
			>
				{@render loader()}
			</span>
		{/if}
	</button>
{/if}
