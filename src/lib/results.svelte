<script>
	import { onMount } from 'svelte';
	import { writable, derived, get } from 'svelte/store';
	import Select from 'svelte-select'; // Import Select component

	import {
		parse,
		startOfWeek,
		endOfWeek,
		isAfter,
		isBefore,
		isValid,
		addWeeks,
		subWeeks,
		format,
		isSameWeek
	} from 'date-fns';
	import { CaretCircleLeft, CaretCircleRight } from 'phosphor-svelte';

	const logs = writable([]);
	const totalRevenue = writable(0);
	const loading = writable(true);
	const currentWeek = writable(new Date());
	let allLogs = [];
	let currentLog = writable(null);
	let longPressTimer;

	let dossiers = []; // Define dossiers array

	onMount(async () => {
		try {
			const response = await fetch('http://localhost:3000/getLogs');
			if (!response.ok) {
				throw new Error('Network response was not ok');
			}
			const data = await response.json();
			allLogs = data.logs.reverse();
			updateLogsForCurrentWeek();

			// Add event listener for updateLogs event
			window.addEventListener('updateLogs', (event) => {
				allLogs = event.detail;
				updateLogsForCurrentWeek();
			});

			// Fetch dossiers data
			const dossiersResponse = await fetch(
				'https://docs.google.com/spreadsheets/d/e/2PACX-1vQJheaG4HkZVUiDn_YR7Q1-SbgLlI7avzNZViruBlCKVp9G6KC8FPP4gT1sxBI4LhlL46cD1QvhOfCK/pub?gid=1197686602&single=true&output=csv'
			);
			const csvText = await dossiersResponse.text();
			dossiers = parseCSV(csvText);
		} catch (error) {
			console.error('Error fetching logs:', error);
		} finally {
			loading.set(false);
		}
	});

	function parseCSV(text) {
		const rows = text.trim().split('\n').slice(1); // Remove empty rows and header
		return rows
			.map((row) => {
				const cols = row.split(',');
				return {
					id: cols[0]?.trim(),
					name: cols[2]?.trim()
				};
			})
			.filter((dossier) => dossier.id && dossier.name);
	}

	async function saveLog() {
		const editedLog = get(currentLog);
		// Ensure that the billable and uitvoerder fields are correctly set
		editedLog.billable = editedLog.billable === 'Ja' ? 'Ja' : 'Nee';
		// Send the updated log to the server to save in Google Sheets
		try {
			const response = await fetch('http://localhost:3000/updateRow', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(editedLog)
			});
			if (response.ok) {
				alert('Row updated successfully');
				// Close the dialog after saving
				closeDialog();
				// Fetch and update logs to reflect the changes
				fetchAndUpdateLogs();
			} else {
				alert('Error updating row');
			}
		} catch (error) {
			console.error('Error updating row:', error);
			alert('Error updating row');
		}
	}

	// Add the new function to fetch and update logs after saving
	async function fetchAndUpdateLogs() {
		try {
			const response = await fetch('http://localhost:3000/getLogs');
			if (!response.ok) {
				throw new Error('Network response was not ok');
			}
			const data = await response.json();
			// Dispatch an event or use a store to update logs in Result component
			const event = new CustomEvent('updateLogs', { detail: data.logs.reverse() });
			window.dispatchEvent(event);
		} catch (error) {
			console.error('Error fetching logs:', error);
		}
	}

	function updateLogsForCurrentWeek() {
		const currentDate = get(currentWeek);
		const thisWeekLogs = filterLogsForThisWeek(allLogs, currentDate);
		logs.set(thisWeekLogs);
		const revenue = thisWeekLogs.reduce((acc, log) => acc + parseFloat(calculateRevenue(log)), 0);
		totalRevenue.set(revenue.toFixed(2));
	}

	function filterLogsForThisWeek(logs, currentWeekDate) {
		const startDate = startOfWeek(currentWeekDate, { weekStartsOn: 1 }); // Start of the specified week (Monday)
		const endDate = endOfWeek(currentWeekDate, { weekStartsOn: 1 }); // End of the specified week (Sunday)
		endDate.setHours(23, 59, 59, 999); // Set end of the day for Sunday

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

	function navigateWeek(direction, event) {
		event.stopPropagation(); // Stop the event propagation
		console.log('navigation', direction); // Add this line to see if the function is triggered

		currentWeek.update((currentDate) => {
			const newDate = direction === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1);
			updateLogsForCurrentWeek(); // Update logs after setting the new week
			return newDate;
		});
	}

	function handleMouseDown(log) {
		longPressTimer = setTimeout(() => handleLongPress(log), 1000);
	}

	function handleMouseUp() {
		clearTimeout(longPressTimer);
	}

	function handleMouseLeave() {
		clearTimeout(longPressTimer);
	}

	function handleLongPress(log) {
		currentLog.set(log);
		document.getElementById('editDialog').showModal();
		console.log('Current log:', log); // Console log the current log data
	}

	function closeDialog() {
		document.getElementById('editDialog').close();
	}

	const formattedCurrentWeek = derived(currentWeek, ($currentWeek) => {
		updateLogsForCurrentWeek(); // Ensure logs update whenever currentWeek changes
		return `${format(startOfWeek($currentWeek, { weekStartsOn: 1 }), 'dd-MM-yyyy')} tot ${format(endOfWeek($currentWeek, { weekStartsOn: 1 }), 'dd-MM-yyyy')}`;
	});

	const isCurrentWeek = derived(currentWeek, ($currentWeek) => {
		const now = new Date();
		return isSameWeek($currentWeek, now, { weekStartsOn: 1 });
	});
</script>

<main>
	<div class="card">
		{#if $loading}
			<p class="loading-text">Laden...</p>
		{:else}
			<h2>Week: €{$totalRevenue}</h2>
			<p>Gelogde taken:</p>
			<div class="logs-container">
				<ul>
					{#each $logs as log}
						<li
							on:mousedown={() => handleMouseDown(log)}
							on:mouseup={handleMouseUp}
							on:mouseleave={handleMouseLeave}
						>
							<div class="log-header">
								<strong>{log.dossiernaam}</strong>
								<div>
									{log.uur}:{log.min}
									<span class="total-revenue-single">(€{calculateRevenue(log)})</span>
								</div>
							</div>
							<p class="description">{log.omschrijving}</p>
							{#if log.billable === 'Ja'}
								<span class="billable-icon">€</span>
							{/if}
							<p class="date">{log.datum}</p>
						</li>
					{/each}
				</ul>
			</div>

			<div class="week-navigation">
				<span class="prev_week" on:click={(event) => navigateWeek('prev', event)}
					><CaretCircleLeft size={20} /></span
				>
				<span class="week-date"><p class="formatted_current_week">{$formattedCurrentWeek}</p></span>
				<span
					class="next_week"
					on:click={$isCurrentWeek ? null : (event) => navigateWeek('next', event)}
					class:disabled={$isCurrentWeek}><CaretCircleRight size={20} /></span
				>
			</div>
		{/if}

		<dialog id="editDialog">
			{#if $currentLog}
				<h6>Log bewerken</h6>
				<div>
					<label class="legend">Dossiernaam</label>
					<Select
						items={dossiers}
						bind:value={$currentLog}
						getOptionLabel={(option) => option.name}
						getOptionValue={(option) => option.id}
						getSelectionLabel={(option) => option?.name || $currentLog.dossiernaam}
						placeholder={$currentLog.dossiernaam}
						optionIdentifier="id"
						isClearable={false}
					/>
				</div>
				<div>
					<label class="legend">Datum</label>
					<input type="date" bind:value={$currentLog.datum} />
				</div>
				<div>
					<label class="legend">Omschrijving</label>
					<textarea bind:value={$currentLog.omschrijving}></textarea>
				</div>
				<div>
					<label class="legend">Uitvoerder</label>
					<select bind:value={$currentLog.uitvoerder}>
						<option value="Michel">Michel</option>
						<option value="Toon">Toon</option>
					</select>
				</div>
				<div>
					<label class="legend">Locatie</label>
					<input type="text" bind:value={$currentLog.locatie} />
				</div>
				<div class="columns" data-col="2">
					<div>
						<label class="legend">Minuten</label>
						<input type="text" bind:value={$currentLog.min} />
					</div>
					<div>
						<label class="legend">Uren</label>
						<input type="text" bind:value={$currentLog.uur} />
					</div>
				</div>
				<div>
					<label class="legend">Facturabel</label>
					<input type="checkbox" bind:checked={$currentLog.billable} />
				</div>
				<div class="buttons">
					<button class="outline" on:click={closeDialog}>Annuleren</button>
					<button on:click={saveLog}>Opslaan</button>
				</div>
			{/if}
		</dialog>
	</div>
</main>

<style>
	main {
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.card {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		min-height: 100%;
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
		position: relative;
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
		color: var(--text);
		position: absolute;
		bottom: 10px;
		right: 10px;
		font-size: 0.8em;
	}

	.loading-text {
		font-size: 1.5rem;
		color: var(--text-light);
	}

	.week-navigation {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		align-items: center;
	}

	.week-date {
		font-size: 1.2rem;
		font-weight: bold;
	}

	.disabled {
		color: #ccc;
		cursor: not-allowed;
	}

	.date {
		color: var(--text);
		font-size: 0.8em;
	}

	.description {
		margin-top: 0;
		padding: 0;
	}

	.formatted_current_week {
		color: var(--text);
	}
	.total-revenue-single {
		color: var(--text);
		font-style: italic;
		font-size: 0.8em;
		vertical-align: top;
	}
</style>
