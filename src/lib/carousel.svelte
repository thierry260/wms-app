<script>
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';

	const currentIndex = writable(0);
	let xStart = 0;

	export let items = [];

	function swipeLeft() {
		currentIndex.update((n) => (n + 1) % items.length);
	}

	function swipeRight() {
		currentIndex.update((n) => (n - 1 + items.length) % items.length);
	}

	function handleTouchStart(event) {
		xStart = event.touches[0].clientX;
	}

	function handleTouchMove(event) {
		if (!xStart) return;

		let xEnd = event.touches[0].clientX;
		let xDiff = xStart - xEnd;

		if (xDiff > 50) {
			swipeLeft();
		} else if (xDiff < -50) {
			swipeRight();
		}
		xStart = null; // Reset xStart after swipe detection
	}

	function handleMouseDown(event) {
		xStart = event.clientX;
	}

	function handleMouseMove(event) {
		if (!xStart) return;

		let xEnd = event.clientX;
		let xDiff = xStart - xEnd;

		if (xDiff > 50) {
			swipeLeft();
		} else if (xDiff < -50) {
			swipeRight();
		}

		xStart = null; // Reset xStart after swipe detection
	}
</script>

<div
	class="carousel"
	on:touchstart={handleTouchStart}
	on:touchmove={handleTouchMove}
	on:mousedown={handleMouseDown}
	on:mouseup={handleMouseMove}
>
	{#each items as { component: PageComponent, name }, i}
		<div class:active={$currentIndex === i} class="carousel-item">
			<svelte:component this={PageComponent} />
		</div>
	{/each}
</div>

<nav class="bottom-nav">
	{#each items as { name }, i}
		<button on:click={() => currentIndex.set(i)} class:active={$currentIndex === i}>{name}</button>
	{/each}
</nav>

<style>
	.carousel {
		display: flex;
		overflow: hidden;
	}

	.carousel-item {
		min-width: 100%;
		transition: transform 0.5s ease;
	}

	.active {
		transform: translateX(-100%);
	}

	.bottom-nav {
		display: flex;
		justify-content: space-around;
		background-color: #fff;
		padding: 10px 0;
		box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
		position: fixed;
		width: 100%;
		bottom: 0;
		left: 0;
	}

	.bottom-nav button {
		flex: 1;
		border: none;
		background: none;
		font-size: 1.6rem;
		color: var(--text);
		cursor: pointer;
		transition: color 0.3s ease;
	}

	.bottom-nav button.active {
		color: var(--primary);
	}
</style>
