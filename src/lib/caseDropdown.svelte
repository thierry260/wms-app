<script>
	import { onMount, createEventDispatcher } from 'svelte';
	import Select from 'svelte-select';
	import { writable } from 'svelte/store';

	let dossiers = [];
	let selectedDossier;
	let datum = '';
	let tijdsduur = '00:15';
	let uitvoerder = 'Toon'; // Default value
	let omschrijving = '';
	let billable = true;
	let locatie = ''; // Default value
	let isAuthenticated = writable(false);
	const dispatch = createEventDispatcher(); // Add event dispatcher

	// Dropdown options for uitvoerder
	const uitvoerderOptions = [
		{ label: 'Michel', value: 'Michel' },
		{ label: 'Toon', value: 'Toon' }
	];

	onMount(async () => {
		try {
			// Set datum to today's date
			const today = new Date().toISOString().split('T')[0];
			datum = today;

			const authResponse = await fetch('http://localhost:3000/auth/status');
			const authData = await authResponse.json();
			isAuthenticated.set(authData.loggedIn);

			if (authData.loggedIn) {
				const response = await fetch(
					'https://docs.google.com/spreadsheets/d/e/2PACX-1vQJheaG4HkZVUiDn_YR7Q1-SbgLlI7avzNZViruBlCKVp9G6KC8FPP4gT1sxBI4LhlL46cD1QvhOfCK/pub?gid=1197686602&single=true&output=csv'
				);
				const csvText = await response.text();
				dossiers = parseCSV(csvText);
				console.log('Dossiers:', dossiers);
			}
		} catch (error) {
			console.error('Error fetching data:', error);
		}
	});

	function parseCSV(text) {
		const rows = text.trim().split('\n').slice(1); // Remove empty rows and header
		return rows
			.map((row) => {
				const cols = row.split(',');
				return {
					id: cols[0]?.trim(), // Use optional chaining and trim
					name: cols[2]?.trim() // Use optional chaining and trim
				};
			})
			.filter((dossier) => dossier.id && dossier.name); // Filter out empty dossiers and ids
	}

	$: console.log('Selected Dossier:', selectedDossier);

	async function handleSubmit() {
		if (!selectedDossier) {
			alert('Selecteer een dossier');
			return;
		}

		// Split tijdsduur into uur and min
		const min = tijdsduur.split(':')[1];
		const uur = tijdsduur.split(':')[0];
		const totaal = (parseInt(min) / 60 + parseInt(uur)).toFixed(2);

		// Convert the date to the desired format (dd-MM-yyyy)
		const date = new Date(datum);
		const formattedDate = `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;

		// Prepare the row object to be sent
		const row = {
			dossiernaam: selectedDossier.name,
			datum: formattedDate,
			omschrijving,
			min,
			uur,
			totaal,
			billable: billable ? 'Ja' : 'Nee',
			uitvoerder,
			locatie
		};

		// Log the row object to be sent to the server
		console.log('Sending row data to server:', row);

		try {
			// Send the POST request to the server
			const response = await fetch('http://localhost:3000/addRow', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(row)
			});

			if (response.ok) {
				alert('Urenregistratie succesvol toegevoegd');
				dispatch('rowAdded'); // Dispatch event when row is added

				// Reset form fields
				selectedDossier = null;
				datum = new Date().toISOString().split('T')[0];
				tijdsduur = '00:15';
				uitvoerder = 'Toon';
				omschrijving = '';
				billable = true;
				locatie = '';
			} else {
				// Capture and log error text from server response
				const errorText = await response.text();
				console.error('Error response:', errorText);
				alert('Fout bij toevoegen van rij');
			}
		} catch (error) {
			console.error('Error submitting form:', error);
			alert('Fout bij verzenden van formulier');
		}
	}

	function handleLogin() {
		window.location.href = 'http://localhost:3000/auth/google';
	}

	function handleLogout() {
		window.location.href = 'http://localhost:3000/logout';
	}

	function handleFocus(event) {
		event.target.select();
	}
</script>

{#if $isAuthenticated}
	<!-- <button on:click={handleLogout}>Logout</button> -->
	<div class="card hour_specs" id="caseDropdown">
		<div class="head">
			<h2 class="mb_0 text_center">Urenregistratie</h2>
		</div>
		<form on:submit|preventDefault={handleSubmit}>
			<div class="content">
				<div class="form">
					<fieldset>
						<legend class="text_center">Data invoeren</legend>
						<label class="add_row_field full-width spacing_bottom">
							<Select
								items={dossiers}
								bind:value={selectedDossier}
								getOptionLabel={(option) => option.name}
								getOptionValue={(option) => option.id}
								getSelectionLabel={(option) =>
									option?.name || `No name found for dossier ${option.id}`}
								placeholder="Dossier zoeken"
								optionIdentifier="id"
							/>
						</label>

						<div class="add_row_field_columns">
							<label class="add_row_field">
								<input type="date" bind:value={datum} on:focus={handleFocus} />
								<span>Datum *</span>
							</label>

							<label class="add_row_field">
								<input type="time" bind:value={tijdsduur} on:focus={handleFocus} />
								<span>Tijdsduur *</span>
							</label>

							<label class="add_row_field">
								<input type="text" bind:value={locatie} on:focus={handleFocus} />
								<span>Locatie</span>
							</label>

							<label class="add_row_field spacing_bottom">
								<input type="text" bind:value={uitvoerder} on:focus={handleFocus} />
								<span>Uitvoerder *</span>
							</label>
						</div>

						<label class="add_row_field full-width">
							<textarea bind:value={omschrijving} on:focus={handleFocus}></textarea>
							<span>Omschrijving *</span>
						</label>
					</fieldset>
				</div>
			</div>
			<div class="actions">
				<label class="add_row_field consent">
					<input type="checkbox" bind:checked={billable} />
					<span>Facturabel</span>
				</label>
				<button type="submit">Registreren</button>
			</div>
		</form>
	</div>
{:else}
	<!-- <button on:click={handleLogin}>Login with Google</button> -->
{/if}
