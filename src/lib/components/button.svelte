<script lang="ts" module>
	import { cva, type VariantProps } from 'class-variance-authority';

	export const buttonStyle = cva(
		'shrink-0 relative whitespace-nowrap inline-flex items-center justify-center gap-1.5 font-medium shadow-xs transition focus-visible:outline-none focus-visible:ring-4 disabled:opacity-40 enabled:cursor-pointer h-(--button-height) ring-ring active:scale-98 text-(--button-text-color) [--button-text-color:var(--color-foreground)]',
		{
			variants: {
				variant: {
					primary: 'bg-accent [--button-text-color:var(--color-accent-foreground)]',
					outline: 'border border-border bg-background focus-visible:border-accent',
					ghost: 'border-none bg-transparent ring-0 shadow-none hover:bg-foreground/5',
					destructive:
						'bg-red-600 [--button-text-color:var(--color-white)] ring-red-600/50 hover:bg-red-700'
				},
				size: {
					xs: 'rounded-lg px-2 text-sm [--button-height:--spacing(6)]',
					sm: 'rounded-lg px-3 text-sm [--button-height:--spacing(8)]',
					md: 'rounded-xl px-4 text-base [--button-height:--spacing(10)]',
					lg: 'rounded-2xl px-5 text-base [--button-height:--spacing(12)]'
				},
				square: {
					true: 'w-(--button-height) px-0',
					false: ''
				}
			},
			defaultVariants: {
				variant: 'primary',
				size: 'md',
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
		loader, // The new slot/snippet for custom loading icons
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
	<a
		{href}
		class={cn(
			buttonStyle({ variant, size, square }),
			isLoading && 'text-transparent transition-none',
			className
		)}
		{...restProps}
	>
		{#if children}{@render children()}{/if}
		{#if isLoading && loader}
			<span
				class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-(--button-text-color)"
			>
				{@render loader()}
			</span>
		{/if}
	</a>
{:else}
	<button
		{type}
		disabled={isLoading || restProps.disabled}
		class={cn(
			buttonStyle({ variant, size, square }),
			isLoading && 'text-transparent transition-none',
			className
		)}
		{...restProps}
	>
		{#if children}{@render children()}{/if}
		{#if isLoading && loader}
			<span
				class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-(--button-text-color)"
			>
				{@render loader()}
			</span>
		{/if}
	</button>
{/if}
