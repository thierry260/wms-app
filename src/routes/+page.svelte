<script>
	import Navigation from '$lib/navigation.svelte';
	import CaseDropdown from '$lib/CaseDropdown.svelte';
	import Result from '$lib/results.svelte';
	import { writable } from 'svelte/store';
	import { onMount } from 'svelte';

	const currentIndex = writable(0);
	let dragging = false;
	let xStart = 0;
	let translateX = writable(0);
	let isAuthenticated = writable(true);
	let updateLogs = writable(false); // Add writable store to trigger logs update

	const pages = [
		{ component: CaseDropdown, name: 'Urenregistratie' },
		{ component: Result, name: 'Resultaten' }
	];

	onMount(async () => {
		try {
			const authResponse = await fetch('http://localhost:3000/auth/status');
			const authData = await authResponse.json();
			isAuthenticated.set(authData.loggedIn);
			// Add event listener for updateLogs event
			window.addEventListener('updateLogs', (event) => {
				updateLogs.set(true);
			});
		} catch (error) {
			console.error('Error checking authentication status:', error);
		}
	});

	function swipeLeft() {
		currentIndex.update((n) => (n < pages.length - 1 ? n + 1 : n));
	}

	function swipeRight() {
		currentIndex.update((n) => (n > 0 ? n - 1 : n));
	}

	function handleTouchStart(event) {
		startDragging(event.touches[0].clientX);
	}

	function handleMouseDown(event) {
		startDragging(event.clientX);
	}

	function startDragging(position) {
		xStart = position;
		dragging = true;
	}

	function handleTouchMove(event) {
		if (!dragging) return;
		moveDragging(event.touches[0].clientX);
	}

	function handleMouseMove(event) {
		if (!dragging) return;
		moveDragging(event.clientX);
	}

	function moveDragging(currentPosition) {
		translateX.set(currentPosition - xStart);
	}

	function handleTouchEnd() {
		endDragging();
	}

	function handleMouseUp() {
		endDragging();
	}

	function handleMouseLeave() {
		if (dragging) endDragging();
	}

	function endDragging() {
		dragging = false;
		const moveThreshold = 100;
		const movedBy = $translateX;

		if (movedBy < -moveThreshold) {
			swipeLeft();
		} else if (movedBy > moveThreshold) {
			swipeRight();
		}

		translateX.set(0);
	}

	function handleRowAdded() {
		updateLogs.set(true); // Trigger logs update
		const event = new CustomEvent('rowAdded');
		window.dispatchEvent(event); // Dispatch event when row is added
	}

	$: carouselStyle = `transform: translateX(calc(-${$currentIndex * 100}% + ${$translateX}px)); transition: ${dragging ? 'none' : 'transform 0.3s ease-in-out'}`;

	$: $currentIndex; // Ensure reactivity
</script>

<main
	on:touchstart={handleTouchStart}
	on:touchmove={handleTouchMove}
	on:touchend={handleTouchEnd}
	on:mousedown={handleMouseDown}
	on:mousemove={handleMouseMove}
	on:mouseup={handleMouseUp}
	on:mouseleave={handleMouseLeave}
>
	<Navigation />
	<div class="carousel" style={carouselStyle}>
		{#each pages as { component: PageComponent }, i}
			<div class="carousel-item">
				{#if $isAuthenticated}
					<svelte:component this={PageComponent} {updateLogs} on:rowAdded={handleRowAdded} />
				{:else}
					<p>Please log in to view this page.</p>
				{/if}
			</div>
		{/each}
	</div>
</main>

<nav class="bottom-nav">
	{#each pages as { name }, i}
		<button on:click={() => currentIndex.set(i)} class:active={$currentIndex === i}>{name}</button>
	{/each}
</nav>

<style>
	main {
		height: 100vh;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		overflow: hidden; /* Ensure overflow is hidden to manage swipes */
	}

	.carousel {
		display: flex;
		width: 100%;
		flex: 1;
	}

	.carousel-item {
		flex: 0 0 100%;
		width: 100%;
	}

	.bottom-nav {
		display: flex;
		justify-content: space-around;
		background-color: #fff;
		/* padding: 10px 0; */
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
		font-size: 1.4rem;
		color: var(--text);
		cursor: pointer;
		transition: color 0.3s ease;
		padding-block: 20px;
		border-bottom: 2px solid transparent;
		border-radius: 0;
		font-weight: 500;
	}

	.bottom-nav button.active {
		color: var(--primary);
		border-color: var(--primary);
	}
</style>
