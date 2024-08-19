<script>
  import { onMount } from "svelte";
  import { writable, derived, get } from "svelte/store";
  import Select from "svelte-select"; // Import Select component
  import { fetchWorkspaceFilesData } from "$lib/utils/get";

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
    isSameWeek,
  } from "date-fns";
  import {
    CaretCircleLeft,
    CaretCircleRight,
    TrashSimple,
    Funnel,
    X,
  } from "phosphor-svelte";

  const searchQuery = writable(""); // Store for the search query
  const searchQueryFrom = writable(""); // Store for the search query
  const searchQueryTo = writable(""); // Store for the search query

  const logs = writable([]);
  const totalRevenue = writable(0);
  const loading = writable(true);
  const currentWeek = writable(new Date());
  let allLogs = [];
  let currentLog = writable(null);
  let longPressTimer;
  let showFilters = false;

  let dossiers = []; // Define dossiers array
  let dossiersData = [];

  onMount(async () => {
    try {
      dossiersData = await fetchWorkspaceFilesData();
      dossiers = dossiersData.map((dossier) => ({
        id: dossier.id,
        label: `${dossier.id} - ${dossier.name}`,
      }));
      const data = dossiersData.flatMap((dossier) =>
        (dossier.timetracking || []).map((entry) => ({
          ...entry,
          name: dossier.name, // Add the dossier's name to each timetracking entry
        })),
      );
      allLogs = data;
      updateLogsForSearch();

      // Add event listener for updateLogs event
      window.addEventListener("updateLogs", (event) => {
        allLogs = event.detail;
        updateLogsForSearch();
      });
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      loading.set(false);
    }
  });

  function updateLogsForSearch(data = allLogs) {
    const searchValue = get(searchQuery).trim().toLowerCase();
    const fromDate = get(searchQueryFrom);
    const toDate = get(searchQueryTo);

    if (searchValue) {
      data = data.filter(
        (log) =>
          log.name.toLowerCase().includes(searchValue) ||
          log.description.toLowerCase().includes(searchValue) ||
          log.assignee.toLowerCase().includes(searchValue) ||
          log.location.toLowerCase().includes(searchValue),
      );
    }

    // Filter based on date range
    if (fromDate || toDate) {
      data = data.filter((log) => {
        // Parse log date in YYYY-MM-DD format for comparison
        const logDate = new Date(format(log.date.toDate(), "yyyy-MM-dd"));

        let isValidLog = true;
        if (fromDate) {
          const from = new Date(fromDate);
          from.setHours(0, 0, 0, 0); // Ensure the time part is zeroed out
          isValidLog = isValidLog && logDate >= from;
        }
        if (toDate) {
          const to = new Date(toDate);
          to.setHours(23, 59, 59, 999); // Ensure the time part includes the full day
          isValidLog = isValidLog && logDate <= to;
        }
        return isValidLog;
      });
    }

    data.sort((a, b) => {
      let dateA = new Date(format(a.date.toDate(), "yyyy-MM-dd"));
      let dateB = new Date(format(b.date.toDate(), "yyyy-MM-dd"));
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
      searchQueryTo.set(today.toISOString().split("T")[0]); // Reset "To" date to today
    }

    updateLogsForSearch();
  }

  function calculateHoursAndMinutes(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return {
      hours: hours,
      minutes: minutes,
    };
  }

  function handleLongPress(log) {
    const dossier = dossiersData.find((dossier) => dossier.name === log.name);

    if (!dossier || !dossier.timetracking) {
      console.error("Dossier or timetracking array not found");
      return;
    }

    const index = dossier.timetracking.findIndex(
      (entry) =>
        entry.date.isEqual(log.date) &&
        entry.description === log.description &&
        entry.assignee === log.assignee &&
        entry.location === log.location,
    );

    if (index === -1) {
      console.error("Log entry not found in dossier's timetracking array");
      return;
    }

    const { hours, minutes } = calculateHoursAndMinutes(log.minutes);

    currentLog.set({
      index, // Store the correct index
      dossierId: dossier.id, // Use dossier's ID
      originalDossierId: dossier.id, // Track the original dossier ID
      name: dossier.name,
      date: format(log.date.toDate(), "yyyy-MM-dd"), // Keep the string format for the UI
      description: log.description,
      min: minutes, // Use calculated minutes
      uur: hours, // Use calculated hours
      totaal: log.totaal,
      billable: log.billable,
      assignee: log.assignee,
      location: log.location,
    });
    document.getElementById("editDialogInFilter").showModal();
    console.log("Current log:", log); // Console log the current log to debug
  }

  async function saveLog() {
    const editedLog = get(currentLog);
    console.log("Edited log:", editedLog); // Debug log to see the current state of editedLog
    // Ensure that the billable and uitvoerder fields are correctly set
    editedLog.billable = editedLog.billable === "Ja" ? "Ja" : "Nee";

    // Ensure the ID is present in the request body
    if (!editedLog.id) {
      alert("ID ontbreekt");
      return;
    }

    // Send the updated log to the server to save in Google Sheets
    try {
      const response = await fetch("https://www.wms.conceptgen.nl/updateRow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editedLog),
      });
      if (response.ok) {
        alert("Urenregistratie succesvol bijgewerkt");
        // Close the dialog after saving
        closeDialog();
        // Fetch and update logs to reflect the changes
        fetchAndUpdateLogs();
      } else {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        alert("Fout bij het updaten van urenregistratie");
      }
    } catch (error) {
      console.error("Fout bij het updaten van urenregistratie:", error);
      alert("Fout bij het updaten van urenregistratie");
    }
  }

  async function fetchAndUpdateLogs() {
    try {
      const response = await fetch("https://www.wms.conceptgen.nl/getLogs");
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const data = await response.json();
      // Dispatch an event or use a store to update logs in Result component
      const event = new CustomEvent("updateLogs", {
        detail: data.logs.reverse(),
      });
      window.dispatchEvent(event);
    } catch (error) {
      console.error("Error fetching logs:", error);
    }
  }

  async function deleteLog() {
    const logToDelete = get(currentLog);
    console.log("Log to delete:", logToDelete);

    if (!confirm("Weet je zeker dat je deze log wilt verwijderen?")) {
      return;
    }

    try {
      const response = await fetch("https://www.wms.conceptgen.nl/deleteRow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(logToDelete),
      });
      if (response.ok) {
        alert("Urenregistratie succesvol verwijderd");
        closeDialog();
        fetchAndUpdateLogs();
      } else {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        alert("Fout bij het verwijderen van urenregistratie");
      }
    } catch (error) {
      console.error("Fout bij het verwijderen van urenregistratie:", error);
      alert("Fout bij het verwijderen van urenregistratie");
    }
  }

  function calculateRevenue(log) {
    const min = parseFloat(log.minutes) || 0;
    const totaalUren = min / 60;
    const revenue = log.billable ? (totaalUren * 250).toFixed(2) : "0.00";
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
    document.getElementById("editDialogInFilter").close();
  }

  const isCurrentWeek = derived(currentWeek, ($currentWeek) => {
    const now = new Date();
    return isSameWeek($currentWeek, now, { weekStartsOn: 1 });
  });

  const convertToISODate = (dmyDate) => {
    // Split the input string by the hyphen
    const [day, month, year] = dmyDate.split("-");

    // Pad the day and month with leading zeros if needed
    const paddedDay = day.padStart(2, "0");
    const paddedMonth = month.padStart(2, "0");

    // Return the date in the YYYY-MM-DD format
    return `${year}-${paddedMonth}-${paddedDay}`;
  };

  function formatMinutesToHHMM(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  $: if ($currentLog && $currentLog.date) {
    $currentLog.date = new Date($currentLog.date).toISOString().split("T")[0];
  }
</script>

<main>
  <div class="card">
    {#if $loading}
      <p class="loading-text">Laden...</p>
    {:else}
      <div class="search_filter">
        <input
          type="text"
          class="search"
          placeholder="Zoek op urenregistratie..."
          on:input={handleSearchInput}
          bind:value={$searchQuery}
        />
        <button class="basic" on:click={() => (showFilters = !showFilters)}>
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
            <input
              type="date"
              bind:value={$searchQueryFrom}
              on:input={handleSearchInputFrom}
            />
          </div>
          <div class="date_input">
            <label class="legend">Tot</label>
            <input
              type="date"
              bind:value={$searchQueryTo}
              on:input={handleSearchInputTo}
            />
          </div>
        </div>
      {/if}
      <div class="logs-container">
        <ul>
          {#each $logs as log}
            <li on:click={() => handleLongPress(log)}>
              <div class="log-header">
                <strong>{log.name}</strong>
                <div class="total-revenue">
                  <span>{formatMinutesToHHMM(log.minutes)}</span>
                  <span class="total-revenue-single"
                    >(€{calculateRevenue(log)})</span
                  >
                </div>
              </div>
              <p class="description">{log.description}</p>
              {#if log.billable}
                <span class="billable-icon">€</span>
              {/if}
              <p class="date">{format(log.date.toDate(), "dd-MM-yyyy")}</p>
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    <dialog id="editDialogInFilter">
      {#if $currentLog}
        <div class="top">
          <h6>Log bewerken</h6>
          <button class="basic" on:click={closeDialog}><X size="16" /></button>
        </div>
        <div>
          <label class="legend">Dossiernaam</label>
          <Select
            items={dossiers}
            bind:value={$currentLog.dossierId}
            getOptionLabel={(option) => option.label}
            getOptionValue={(option) => option.id}
            getSelectionLabel={(option) => option?.label || $currentLog.name}
            placeholder="Select dossier"
            itemId="id"
            clearable={false}
          />
        </div>
        <div>
          <label class="legend">Datum</label>
          <input type="date" bind:value={$currentLog.date} />
        </div>
        <div>
          <label class="legend">Omschrijving</label>
          <textarea bind:value={$currentLog.description}></textarea>
        </div>
        <div>
          <label class="legend">Uitvoerder</label>
          <select bind:value={$currentLog.assignee}>
            <option value="Michel">Michel</option>
            <option value="Toon">Toon</option>
          </select>
        </div>
        <div>
          <label class="legend">Locatie</label>
          <input type="text" bind:value={$currentLog.location} />
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
          <button class="basic" on:click={deleteLog}
            ><TrashSimple size="16" /></button
          >
          <div>
            <button class="basic" type="button" on:click={closeDialog}
              >Annuleren</button
            >
            <button on:click={saveLog}>Opslaan</button>
          </div>
        </div>
      {/if}
    </dialog>
  </div>
</main>

<style lang="scss">
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
    cursor: pointer;
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
    // min-width: 50px;
  }
  @media (max-width: 575px) {
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

  .buttons {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    border-top: 1px solid var(--border);
    padding-top: 20px;
    margin-top: 20px;
    div {
      display: flex;
      gap: inherit;

      .basic {
        @media (max-width: $sm) {
          display: none;
        }
      }
    }
  }
  input.search.search {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%23a8a8a8' viewBox='0 0 256 256'%3E%3Cpath d='M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z'%3E%3C/path%3E%3C/svg%3E");
    background-position: left 15px center;
    background-repeat: no-repeat;
    background-size: 16px;
    padding: 15px 30px 15px 40px;
    margin-bottom: 30px;

    @media (max-width: $sm) {
      padding-block: 13px;
    }
  }
</style>
