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
	import { CaretCircleLeft, CaretCircleRight, TrashSimple, Funnel, X } from 'phosphor-svelte';

    const searchQuery = writable('');  // Store for the search query
    const searchQueryFrom = writable('');  // Store for the search query
    const searchQueryTo = writable('');  // Store for the search query

    const logs = writable([]);
    const totalRevenue = writable(0);
	const loading = writable(true);
	const currentWeek = writable(new Date());
	let allLogs = [];
	let currentLog = writable(null);
	let longPressTimer;
    let showFilters = false;

	let dossiers = []; // Define dossiers array

	onMount(async () => {
		try {
			const response = await fetch('https://www.wms.conceptgen.nl/getLogs');
			if (!response.ok) {
				throw new Error('Network response was not ok');
			}
			const data = await response.json();
			allLogs = data.logs.reverse();
			updateLogsForSearch();

			// Add event listener for updateLogs event
			window.addEventListener('updateLogs', (event) => {
				allLogs = event.detail;
				updateLogsForSearch();
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

	function updateLogsForSearch(data = allLogs) {
		const searchValue = get(searchQuery).trim().toLowerCase();
        const fromDate = get(searchQueryFrom);
        const toDate = get(searchQueryTo);

		if (searchValue) {
			data = data.filter(log => 
				log.dossiernaam.toLowerCase().includes(searchValue) ||
				log.omschrijving.toLowerCase().includes(searchValue) ||
				log.uitvoerder.toLowerCase().includes(searchValue) ||
				log.locatie.toLowerCase().includes(searchValue)
			);
		}

        // Filter based on date range
        if (fromDate || toDate) {
        data = data.filter(log => {
            // Parse log date in YYYY-MM-DD format for comparison
            const logDate = new Date(log.datum.split('-').reverse().join('-'));

            let isValidLog = true;
            if (fromDate) {
                const from = new Date(fromDate);
                from.setHours(0, 0, 0, 0);  // Ensure the time part is zeroed out
                isValidLog = isValidLog && logDate >= from;
            }
            if (toDate) {
                const to = new Date(toDate);
                to.setHours(23, 59, 59, 999);  // Ensure the time part includes the full day
                isValidLog = isValidLog && logDate <= to;
            }
            return isValidLog;
        });
    }

        data.sort((a, b) => {
            let dateA = new Date(a.datum.split('-').reverse().join('-'));
            let dateB = new Date(b.datum.split('-').reverse().join('-'));
            return dateB - dateA;
        });

        data = data.slice(0, 50);

        logs.set(data);
	}

	function handleSearchInput(event) {
        searchQuery.set(event.target.value);
		updateLogsForSearch();
    }

    function handleSearchInputFrom() {
    const fromDate = new Date(get(searchQueryFrom));
    const toDate = get(searchQueryTo);
    
    // Check if "From" date is after the "To" date
    if (toDate && fromDate > new Date(toDate)) {
        searchQueryFrom.set(toDate); // Reset "From" date to "To" date
    }
    
    updateLogsForSearch();
}

function handleSearchInputTo() {
    const toDate = new Date(get(searchQueryTo));
    const fromDate = get(searchQueryFrom);
    
    // Check if "To" date is before the "From" date
    if (fromDate && toDate < new Date(fromDate)) {
        searchQueryTo.set(fromDate); // Reset "To" date to "From" date
    }
    
    // Check if "To" date is in the future and set to today's date if so
    const today = new Date();
    if (toDate > today) {
        searchQueryTo.set(today.toISOString().split('T')[0]); // Reset "To" date to today
    }
    
    updateLogsForSearch();
}


	function handleLongPress(log) {
		currentLog.set({
			id: log.id, // Ensure the id is set
			dossiernaam: log.dossiernaam,
			datum: convertToISODate(log.datum),
			omschrijving: log.omschrijving,
			min: log.min,
			uur: log.uur,
			totaal: log.totaal,
			billable: log.billable,
			uitvoerder: log.uitvoerder,
			locatie: log.locatie
		});
		document.getElementById('editDialogInFilter').showModal();
		console.log('Current log:', log); // Console log the current log to debug
	}

	function parseCSV(text) {
		const rows = text.trim().split('\n').slice(1); // Remove empty rows and header
		return rows
			.map((row) => {
				const cols = row.split(',');
				return {
					id: cols[12]?.trim(), // Ensure the ID is included
					dossiernaam: cols[0]?.trim(),
					datum: cols[1]?.trim(),
					omschrijving: cols[2]?.trim(),
					min: cols[3]?.trim(),
					uur: cols[4]?.trim(),
					totaal: cols[5]?.trim(),
					billable: cols[6]?.trim(),
					uitvoerder: cols[7]?.trim(),
					locatie: cols[8]?.trim()
				};
			})
			.filter((log) => log.id && log.dossiernaam); // Filter out logs without ID and dossiernaam
	}

	async function saveLog() {
		const editedLog = get(currentLog);
		console.log('Edited log:', editedLog); // Debug log to see the current state of editedLog
		// Ensure that the billable and uitvoerder fields are correctly set
		editedLog.billable = editedLog.billable === 'Ja' ? 'Ja' : 'Nee';

		// Ensure the ID is present in the request body
		if (!editedLog.id) {
			alert('ID ontbreekt');
			return;
		}

		// Send the updated log to the server to save in Google Sheets
		try {
			const response = await fetch('https://www.wms.conceptgen.nl/updateRow', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(editedLog)
			});
			if (response.ok) {
				alert('Urenregistratie succesvol bijgewerkt');
				// Close the dialog after saving
				closeDialog();
				// Fetch and update logs to reflect the changes
				fetchAndUpdateLogs();
			} else {
				const errorText = await response.text();
				console.error('Error response:', errorText);
				alert('Fout bij het updaten van urenregistratie');
			}
		} catch (error) {
			console.error('Fout bij het updaten van urenregistratie:', error);
			alert('Fout bij het updaten van urenregistratie');
		}
	}

	async function fetchAndUpdateLogs() {
		try {
			const response = await fetch('https://www.wms.conceptgen.nl/getLogs');
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

	async function deleteLog() {
		const logToDelete = get(currentLog);
		console.log('Log to delete:', logToDelete);

		if (!confirm("Weet je zeker dat je deze log wilt verwijderen?")){
			return;
		}

		try {
			const response = await fetch('https://www.wms.conceptgen.nl/deleteRow', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(logToDelete)
			});
			if (response.ok) {
				alert('Urenregistratie succesvol verwijderd');
				closeDialog();
				fetchAndUpdateLogs();
			} else {
				const errorText = await response.text();
				console.error('Error response:', errorText);
				alert('Fout bij het verwijderen van urenregistratie');
			}
		} catch (error) {
			console.error('Fout bij het verwijderen van urenregistratie:', error);
			alert('Fout bij het verwijderen van urenregistratie');
		}
	}


	function calculateRevenue(log) {
		const uur = parseFloat(log.uur) || 0;
		const min = parseFloat(log.min) || 0;
		const totaalUren = uur + min / 60;
		const revenue = log.billable === 'Ja' ? (totaalUren * 250).toFixed(2) : '0.00';
		return revenue;
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

	function closeDialog() {
		document.getElementById('editDialogInFilter').close();
	}

	const isCurrentWeek = derived(currentWeek, ($currentWeek) => {
		const now = new Date();
		return isSameWeek($currentWeek, now, { weekStartsOn: 1 });
	});

	const convertToISODate = (dmyDate) => {
		// Split the input string by the hyphen
		const [day, month, year] = dmyDate.split('-');

		// Pad the day and month with leading zeros if needed
		const paddedDay = day.padStart(2, '0');
		const paddedMonth = month.padStart(2, '0');

		// Return the date in the YYYY-MM-DD format
		return `${year}-${paddedMonth}-${paddedDay}`;
	}

	$: if ($currentLog && $currentLog.datum) {
		$currentLog.datum = new Date($currentLog.datum).toISOString().split('T')[0];
	}
</script>

<main>
	<div class="card">
		{#if $loading}
			<p class="loading-text">Laden...</p>
		{:else}
            <div class="search_filter">
                <input type="text" placeholder="Zoek op dossiernaam, omschrijving, uitvoerder of locatie" on:input={handleSearchInput}
                bind:value={$searchQuery} />
                <button class="basic" on:click={() => showFilters = !showFilters}>
                    {#if !showFilters}
                        <Funnel size="18" />
                    {:else}
                        <X size="18" />
                    {/if}
                </button>
            </div>
    		{#if showFilters}
                <div class="columns" data-col="2">
                    <div class="date_input">
                        <label class="legend">Van</label>
                        <input type="date" bind:value={$searchQueryFrom} on:input={handleSearchInputFrom} />
                    </div>
                    <div class="date_input">
                        <label class="legend">Tot</label>
                        <input type="date" bind:value={$searchQueryTo} on:input={handleSearchInputTo} />
                    </div>
                </div>
            {/if}
			<div class="logs-container">
				<ul>
					{#each $logs as log}
						<li
							on:pointerdown={() => handleMouseDown(log)}
							on:mousedown={() => handleMouseDown(log)}
							on:pointerup={handleMouseUp}
							on:mouseup={handleMouseUp}
							on:mouseleave={handleMouseLeave}
						>
							<div class="log-header">
								<strong>{log.dossiernaam}</strong>
								<div class="total-revenue">
									<span>{log.uur}:{log.min}</span>
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
		{/if}

		<dialog id="editDialogInFilter">
			{#if $currentLog}
				<div class="top">
					<h6>Log bewerken</h6>
					<button class="basic" on:click={deleteLog}><TrashSimple size="16"/></button>
				</div>
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

		/* padding-bottom: 80px;
		height: 100%; */
	}

	.card {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		/* min-height: 100%; */
		min-height: 1px;
		height: 100%;
	}

	h2 {
		margin-bottom: 20px;
	}

	.logs-container {
		flex-grow: 1;
		width: 100%;
		max-height: calc(100vh - 385px);
		overflow-y: auto; /* Scrollbaar maken */
		margin-top: 20px; /* Ruimte tussen de lijst en de tekst */
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
		font-size: 1.3rem;
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

	.total-revenue {
		display: flex;
		justify-content: flex-end;
		text-align: right;
		flex-wrap: wrap;
		column-gap: 5px;
		row-gap: 2px;
		align-items: center;
	}
	.total-revenue-single {
		color: var(--text);
		font-style: italic;
		font-size: 0.8em;
		vertical-align: top;
	}

	dialog .top {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
    .date_input {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 15px;
    }
    .date_input label {
        margin-bottom: 0;
    }
    .card > input, 
    .card > .columns input {
        padding: 12px 15px;
        font-size: 1.4rem;
    }

    .search_filter {
        display: flex;
        width: 100%;
        justify-content: space-between;
        gap: 10px;
        align-items: stretch;
    }
    .search_filter input {
        flex-grow: 1;
        font-size: 1.4rem;
    }
    .search_filter button {
        min-width: 50px; 
    }
    @media (max-width: 575px){
        .search_filter button {
            min-width: 42px; 
        }
        .card > .columns {
            grid-template-columns: 100%;
            padding-top: 20px;
        }
        .date_input {
            margin-top: 0;
        }
    }
</style>
