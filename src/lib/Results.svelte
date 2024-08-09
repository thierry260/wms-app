<script>
  import { onMount } from "svelte";
  import { writable, derived, get } from "svelte/store";
  import Select from "svelte-select"; // Import Select component
  import { fetchWorkspaceFilesData } from "$lib/utils/get";
  import { Timestamp, getDoc, doc, updateDoc } from "firebase/firestore";
  import { db } from "$lib/firebase";

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
  } from "phosphor-svelte";

  const logs = writable([]);
  const totalRevenue = writable(0);
  const loading = writable(true);
  const currentWeek = writable(new Date());

  let allLogs = [];
  let currentLog = writable(null);
  let longPressTimer;

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
        }))
      );
      allLogs = data;
      updateLogsForCurrentWeek();

      // Add event listener for updateLogs event
      window.addEventListener("updateLogs", (event) => {
        allLogs = event.detail;
        updateLogsForCurrentWeek();
      });
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      loading.set(false);
    }
  });

  function updateLogsForCurrentWeek() {
    const currentDate = get(currentWeek);
    const thisWeekLogs = filterLogsForThisWeek(allLogs, currentDate);
    logs.set(thisWeekLogs);
    console.log(thisWeekLogs);
    const revenue = thisWeekLogs.reduce(
      (acc, log) => acc + parseFloat(calculateRevenue(log)),
      0
    );
    totalRevenue.set(revenue.toFixed(2));
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
    // Find the dossier associated with the log
    const dossier = dossiersData.find((dossier) => dossier.name === log.name);

    if (!dossier || !dossier.timetracking) {
      console.error("Dossier or timetracking array not found");
      return;
    }

    // Find the index of the log in the dossier's timetracking array
    const index = dossier.timetracking.findIndex(
      (entry) =>
        entry.date.isEqual(log.date) &&
        entry.description === log.description &&
        entry.assignee === log.assignee &&
        entry.location === log.location
    );

    if (index === -1) {
      console.error("Log entry not found in dossier's timetracking array");
      return;
    }

    const { hours, minutes } = calculateHoursAndMinutes(log.minutes);

    currentLog.set({
      index, // Store the correct index
      dossierId: dossier.id, // Use dossier's ID
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

    document.getElementById("editDialog").showModal();
    console.log("Current log:", get(currentLog)); // Console log the current log to debug
  }

  async function saveLog() {
    const editedLog = get(currentLog);
    console.log("Edited log:", editedLog); // Debug log to see the current state of editedLog

    // Convert the date string back to a Firestore Timestamp
    const [year, month, day] = editedLog.date.split("-").map(Number);
    const dateObj = new Date(year, month - 1, day);
    const firestoreTimestamp = Timestamp.fromDate(dateObj);

    // Get the reference to the specific dossier document in Firestore
    const dossierRef = doc(
      db,
      "workspaces",
      localStorage.getItem("workspace"),
      "files",
      editedLog.dossierId
    );

    try {
      // Fetch the dossier document to retrieve the existing timetracking array
      const docSnap = await getDoc(dossierRef);

      if (docSnap.exists()) {
        const timetracking = docSnap.data().timetracking || [];

        // Update the specific entry at the stored index
        timetracking[editedLog.index] = {
          ...timetracking[editedLog.index],
          ...editedLog,
          date: firestoreTimestamp, // Use the Firestore Timestamp
          minutes: parseInt(editedLog.uur) * 60 + parseInt(editedLog.min),
        };

        // Update the Firestore document with the updated timetracking array
        await updateDoc(dossierRef, {
          timetracking: timetracking,
        });

        alert("Urenregistratie succesvol bijgewerkt");
        // Close the dialog after saving
        closeDialog();
        // Fetch and update logs to reflect the changes
        fetchAndUpdateLogs();
      } else {
        console.error("Dossier document not found");
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

  function filterLogsForThisWeek(logs, currentWeekDate) {
    const startDate = startOfWeek(currentWeekDate, { weekStartsOn: 1 }); // Start of the specified week (Monday)
    const endDate = endOfWeek(currentWeekDate, { weekStartsOn: 1 }); // End of the specified week (Sunday)
    endDate.setHours(23, 59, 59, 999); // Set end of the day for Sunday

    return logs.filter((log) => {
      // Assuming log.date is a Firestore Timestamp
      let logDate = log.date.toDate(); // Convert Firestore Timestamp to JavaScript Date

      if (!isValid(logDate)) {
        console.log("Invalid log date:", log.date);
        return false;
      }

      logDate.setHours(0, 0, 0, 0); // Normalize the log date to midnight for accurate comparison

      // Correct comparison for inclusive date range
      return (
        (isAfter(logDate, startDate) ||
          logDate.getTime() === startDate.getTime()) &&
        (isBefore(logDate, endDate) || logDate.getTime() === endDate.getTime())
      );
    });
  }

  function calculateRevenue(log) {
    const min = parseFloat(log.minutes) || 0;
    const totaalUren = min / 60;
    const revenue = log.billable ? (totaalUren * 250).toFixed(2) : "0.00";
    return revenue;
  }

  function navigateWeek(direction, event) {
    event.stopPropagation(); // Stop the event propagation
    console.log("navigation", direction); // Add this line to see if the function is triggered

    currentWeek.update((currentDate) => {
      const newDate =
        direction === "next"
          ? addWeeks(currentDate, 1)
          : subWeeks(currentDate, 1);
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

  function closeDialog() {
    document.getElementById("editDialog").close();
  }

  const formattedCurrentWeek = derived(currentWeek, ($currentWeek) => {
    updateLogsForCurrentWeek(); // Ensure logs update whenever currentWeek changes
    return `${format(startOfWeek($currentWeek, { weekStartsOn: 1 }), "dd-MM-yyyy")} tot ${format(endOfWeek($currentWeek, { weekStartsOn: 1 }), "dd-MM-yyyy")}`;
  });

  const isCurrentWeek = derived(currentWeek, ($currentWeek) => {
    const now = new Date();
    return isSameWeek($currentWeek, now, { weekStartsOn: 1 });
  });

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
      <h2>Weekomzet: €{$totalRevenue}</h2>
      <p class="legend">Gelogde taken</p>
      <div class="logs-container">
        <ul>
          {#each $logs as log, i}
            <!-- 'i' is the index of the log -->
            <li
              on:pointerdown={() => handleMouseDown(log, i)}
              on:mousedown={() => handleMouseDown(log, i)}
              on:pointerup={handleMouseUp}
              on:mouseup={handleMouseUp}
              on:mouseleave={handleMouseLeave}
            >
              {i}
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

      <div class="week-navigation">
        <span
          class="prev_week"
          on:click={(event) => navigateWeek("prev", event)}
          ><CaretCircleLeft size={20} /></span
        >
        <span class="week-date"
          ><p class="formatted_current_week">{$formattedCurrentWeek}</p></span
        >
        <span
          class="next_week"
          on:click={$isCurrentWeek
            ? null
            : (event) => navigateWeek("next", event)}
          class:disabled={$isCurrentWeek}><CaretCircleRight size={20} /></span
        >
      </div>
    {/if}

    <dialog id="editDialog">
      {#if $currentLog}
        <div class="top">
          <h6>Log bewerken</h6>
          <button class="basic" on:click={deleteLog}
            ><TrashSimple size="16" /></button
          >
        </div>
        <div>
          <label class="legend">Dossiernaam</label>
          <Select
            items={dossiers}
            bind:value={$currentLog}
            getOptionLabel={(option) => option.name}
            getOptionValue={(option) => option.id}
            getSelectionLabel={(option) => option?.name || $currentLog.name}
            placeholder={$currentLog.name}
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
          <button class="outline" on:click={closeDialog}>Annuleren</button>
          <button on:click={saveLog}>Opslaan</button>
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
    max-height: calc(100vh - 350px);
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
</style>
