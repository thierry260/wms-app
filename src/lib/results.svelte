<script>
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';
	import { parse, startOfWeek, endOfWeek, isAfter, isBefore, isValid } from 'date-fns';

	const logs = writable([]);
	const totalRevenue = writable(0);
	const loading = writable(true);

	onMount(async () => {
		try {
			const response = await fetch('http://localhost:3000/getLogs');
			if (!response.ok) {
				throw new Error('Network response was not ok');
			}
			const data = await response.json();

			const thisWeekLogs = filterLogsForThisWeek(data.logs);
			logs.set(thisWeekLogs);

			const revenue = thisWeekLogs.reduce((acc, log) => acc + parseFloat(calculateRevenue(log)), 0);
			totalRevenue.set(revenue.toFixed(2));
		} catch (error) {
			console.error('Error fetching logs:', error);
		} finally {
			loading.set(false);
		}
	});

	function filterLogsForThisWeek(logs) {
		const now = new Date();
		const startDate = startOfWeek(now, { weekStartsOn: 1 }); // Start of this week (Monday)
		const endDate = endOfWeek(now, { weekStartsOn: 1 }); // End of this week (Sunday)
		endDate.setHours(23, 59, 59, 999); // Set end of the day for Sunday

		console.log('Start of week:', startDate); // Log the start date of the week
		console.log('End of week:', endDate); // Log the end date of the week

		return logs.filter((log) => {
			let logDate = parse(log.datum, 'dd-MM-yyyy', new Date());
			if (!isValid(logDate)) {
				logDate = parse(log.datum, 'yyyy-MM-dd', new Date());
			}
			if (!isValid(logDate)) {
				console.log('Invalid log date:', log.datum);
				return false;
			}
			logDate.setHours(0, 0, 0, 0); // Normalize the log date to midnight for accurate comparison

			console.log('Log date:', logDate, 'Start date:', startDate, 'End date:', endDate); // Log each log date and start/end date

			// Correct comparison for inclusive date range
			return (
				(isAfter(logDate, startDate) || logDate.getTime() === startDate.getTime()) &&
				(isBefore(logDate, endDate) || logDate.getTime() === endDate.getTime())
			);
		});
	}

	function calculateRevenue(log) {
		const uur = parseFloat(log.uur) || 0;
		const min = parseFloat(log.min) || 0;
		const totaalUren = uur + min / 60;
		const revenue = log.billable === 'Ja' ? (totaalUren * 250).toFixed(2) : '0.00';
		return revenue;
	}
</script>

<main>
	<div class="card">
		{#if $loading}
			<p class="loading-text">Laden...</p>
		{:else}
			<h2>Gelogde gegevens van deze week</h2>
			<div class="logs-container">
				<ul>
					{#each $logs as log}
						<li>
							<div class="log-header">
								<strong>{log.dossiernaam}</strong>
								{log.uur}:{log.min} (€{calculateRevenue(log)})
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
		border-radius: var(--border-radius);
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
