<script lang="ts" module>
	import { cva, type VariantProps } from 'class-variance-authority';

	export const inputStyle = cva(
		'font-switzer flex w-full transition-all duration-150 ease-in-out focus-visible:outline-none ring-3 ring-transparent ring-offset-transparent focus-visible:ring-primary/50 focus-visible:ring-offset-[#0c0c0c] disabled:cursor-not-allowed disabled:opacity-50 placeholder:text-neutral-700',
		{
			variants: {
				variant: {
					default:
						'border border-neutral-800 bg-[#0c0c0c] text-text hover:border-neutral-600 focus-visible:border-primary',
					filled:
						'border border-transparent bg-neutral-900 text-text hover:bg-neutral-800 focus-visible:border-primary focus-visible:bg-[#0c0c0c]',
					error:
						'border border-red-900 bg-[#0c0c0c] text-red-500 placeholder:text-red-900/50 hover:border-red-700 focus-visible:border-red-500 focus-visible:ring-red-500/50',
					ghost:
						'border border-transparent bg-transparent text-text hover:bg-neutral-900/30 focus-visible:bg-neutral-900/30'
				},
				size: {
					// Precisely matches the Button component's heights, radii, and typography
					xs: 'rounded-xl px-6 py-2',
					sm: 'rounded-2xl px-6 py-3',
					md: 'rounded-3xl px-6 py-4 text-xl font-light',
					lg: 'rounded-3xl h-17.5 px-6 text-2xl font-extralight'
				}
			},
			defaultVariants: {
				variant: 'default',
				size: 'lg'
			}
		}
	);

	export type InputVariantProps = VariantProps<typeof inputStyle>;
</script>

<script lang="ts">
	import { clsx, type ClassValue } from 'clsx';
	import { twMerge } from 'tailwind-merge';

	function cn(...inputs: ClassValue[]) {
		return twMerge(clsx(inputs));
	}

	let {
		value = $bindable(),
		type = 'text',
		class: className,
		variant = 'default',
		size = 'lg',
		...restProps
	}: {
		value?: string | number;
		type?: 'text' | 'password' | 'email' | 'number' | 'search' | 'tel' | 'url';
		class?: string;
		variant?: InputVariantProps['variant'];
		size?: InputVariantProps['size'];
		[key: string]: any;
	} = $props();
</script>

<input {type} bind:value class={cn(inputStyle({ variant, size }), className)} {...restProps} />
