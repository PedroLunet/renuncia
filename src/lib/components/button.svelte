<script lang="ts" module>
	import { cva, type VariantProps } from 'class-variance-authority';

	export const buttonStyle = cva(
		'font-family-switzer group relative inline-flex items-center justify-center gap-2 whitespace-nowrap select-none transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0c0c] disabled:pointer-events-none disabled:opacity-50 active:duration-75',
		{
			variants: {
				variant: {
					primary: 'bg-primary text-bg',
					destructive:
						'inset_0_-1px_2px_rgba(0,0,0,0.7),_0_0px_0_0_#0d0101,_0_0px_0px_rgba(0,0,0,0)] focus-visible:ring-red-500',

					outline: 'border border-primary text-text',
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
		size = 'lg',
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
