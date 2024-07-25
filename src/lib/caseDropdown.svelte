<script>
	import { onMount } from 'svelte';

	let dossiers = [];
	let selectedDossier = '';

	// Dit is een barebones manier om data te fetchen
	onMount(async () => {
		try {
			const response = await fetch('URL_TO_YOUR_GOOGLE_SHEET_API');
			const data = await response.json();
			dossiers = data; // Pas dit aan naar de juiste datavorm
		} catch (error) {
			console.error('Error fetching dossiers:', error);
		}
	});

	function handleSelect(event) {
		selectedDossier = event.target.value;
	}
</script>

<div>
	<label for="dossier-dropdown">Select a Dossier:</label>
	<select
		id="dossier-dropdown"
		class="dropdown"
		bind:value={selectedDossier}
		on:change={handleSelect}
	>
		<option value="" disabled selected>Select a dossier</option>
		{#each dossiers as dossier}
			<option value={dossier.id}>{dossier.name}</option>
		{/each}
	</select>
</div>

<style lang="scss">
	/* Voeg hier je SASS/CSS styling toe */
	.dropdown {
		width: 100%;
		padding: 0.5em;
		font-size: 1em;
	}
</style>
