<script>
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';
	import Navigation from '$lib/navigation.svelte';

	const logs = writable([]);
	const totalRevenue = writable(0);
	const loading = writable(true); // Voeg een loading state toe

	onMount(async () => {
		try {
			const response = await fetch('http://localhost:3000/getLogs');
			if (!response.ok) {
				throw new Error('Network response was not ok');
			}
			const data = await response.json();
			logs.set(data.logs);
			totalRevenue.set(data.totalRevenue);
		} catch (error) {
			console.error('Error fetching logs:', error);
		} finally {
			loading.set(false); // Zet de loading state naar false wanneer de data is geladen
		}
	});

	function calculateRevenue(log) {
		const uur = parseFloat(log.uur) || 0;
		const min = parseFloat(log.min) || 0;
		const totaalUren = uur + min / 60;
		const revenue = log.billable === 'Ja' ? (totaalUren * 250).toFixed(2) : '0.00';
		return revenue;
	}
</script>

<Navigation />

<main>
	<div class="card">
		{#if $loading}
			<p class="loading-text">Laden...</p>
		{:else}
			<h2>Gelogde gegevens van deze week</h2>
			<div class="logs-container">
				<ul>
					{#each $logs.reverse() as log}
						<li>
							<div class="log-header">
								<strong>{log.dossiernaam}</strong> - {log.uur} uur ({calculateRevenue(log)} euro)
							</div>
							<p>{log.omschrijving}</p>
							{#if log.billable === 'Ja'}
								<span class="billable-icon">€</span>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
			<p>Totaal omzet deze week: €{$totalRevenue}</p>
		{/if}
	</div>
</main>

<style>
	main {
		padding: 20px;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.card {
		background-color: #fff;
		padding: 20px;
		border-radius: 10px;
		box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
		width: 80%;
		max-width: 600px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
	}

	h2 {
		margin-bottom: 20px;
	}

	.logs-container {
		flex-grow: 1;
		width: 100%;
		max-height: 50vh; /* Limiteer de hoogte tot 50% van de viewport hoogte */
		overflow-y: auto; /* Scrollbaar maken */
		margin-bottom: 20px; /* Ruimte tussen de lijst en de tekst */
	}

	ul {
		list-style-type: none;
		padding: 0;
		margin: 0;
	}

	li {
		background-color: #f9f9f9;
		margin-bottom: 10px;
		padding: 10px;
		border: 1px solid #ddd;
		border-radius: 5px;
		position: relative; /* Maak ruimte voor het billable icoon */
	}

	li p {
		margin: 5px 0;
	}

	li strong {
		font-weight: bold;
	}

	.log-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.billable-icon {
		font-weight: bold;
		color: green;
		position: absolute;
		bottom: 10px;
		right: 10px;
	}

	.loading-text {
		font-size: 1.5rem;
		color: var(--text-light);
	}
</style>
