<script>
  import { onMount, createEventDispatcher } from "svelte";
  import { writable, derived, get } from "svelte/store";
  import Select from "svelte-select"; // Import Select component
  import {
    doc,
    getDoc,
    updateDoc,
    Timestamp,
    arrayUnion,
  } from "firebase/firestore";
  import { fetchWorkspaceFilesData } from "$lib/utils/get";
  import { auth, db } from "$lib/firebase";
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
    isToday,
    isYesterday,
  } from "date-fns";
  import {
    CaretCircleLeft,
    CaretCircleRight,
    TrashSimple,
    Funnel,
    X,
    Plus,
  } from "phosphor-svelte";
  import { dbTracker } from "$lib/utils/dbTracker";
  const pageName = "Timetracking";

  const defaults = {
    client_id: "",
    datum: "",
    hhmm: "00:15",
    assignee: "Toon",
    description: "",
    billable: true,
    location: "",
    isExternal: false,
    kilometers: "",
  };

  const dispatch = createEventDispatcher();
  let currentTimetracking = writable(defaults);
  let dossiers = [];
  let dossiersData = [];
  let dialogEl;

  const searchQuery = writable("");
  const searchQueryFrom = writable("");
  const searchQueryTo = writable("");

  const logs = writable([]);
  const totalRevenue = writable(0);
  const loading = writable(true);
  const currentWeek = writable(new Date());
  let allLogs = [];
  let longPressTimer;
  let showFilters = false;

  export let updateLogs; // Receive the updateLogs prop

  $: if ($currentTimetracking && $currentTimetracking.date) {
    $currentTimetracking.date = new Date($currentTimetracking.date)
      .toISOString()
      .split("T")[0];
  }

  $: if (updateLogs) {
    console.log("updateLogs triggered"); // Add this for debugging
    updateLogsForSearch(); // Re-fetch and update the logs when updateLogs changes
  }

  onMount(async () => {
    dbTracker.initPage(pageName);
    try {
      // Set datum to today's date
      const today = new Date().toISOString().split("T")[0];
      $currentTimetracking.datum = today;

      dossiersData = await fetchWorkspaceFilesData(false);
      dbTracker.trackRead(pageName, dossiersData.length); // Track the read operation

      // Extract and concatenate all timetracking arrays into timetrackingEntries
      dossiers = dossiersData.map((dossier) => ({
        id: dossier.id,
        name: dossier.name, // Ensure that name is set correctly
        label: `${dossier.id} - ${dossier.name}`, // Use both id and name for display in the dropdown
      }));

      const data = dossiersData.flatMap((dossier) =>
        (dossier.timetracking || []).map((entry, index) => ({
          ...entry,
          name: dossier.name, // Add the dossier's name to each timetracking entry
          id: dossier.id,
          index: index,
        })),
      );
      allLogs = data;
      updateLogsForSearch();

      // Add event listener for updateLogs event
      window.addEventListener("updateLogs", (event) => {
        updateLogsForSearch(dossiersData); // Re-fetch and update the logs
      });
    } catch (error) {
      console.error("Error checking authentication status:", error);
    } finally {
      loading.set(false);
    }
  });

  async function handleSubmit() {
    const timetrackingData = get(currentTimetracking);

    if (!timetrackingData.client_id) {
      alert("Selecteer een dossier");
      return;
    }

    console.log("Client ID:", timetrackingData.client_id);

    // Split tijdsduur into uur and min
    const [uur, min] = timetrackingData.hhmm.split(":").map(Number);
    const totaal = (uur + min / 60).toFixed(2);

    // Prepare the row object to be sent
    const row = {
      date: new Date(timetrackingData.datum),
      description: timetrackingData.description,
      minutes: uur * 60 + min,
      totaal: totaal,
      billable: timetrackingData.billable,
      assignee: timetrackingData.assignee,
      isExternal: timetrackingData.isExternal,
      location: timetrackingData.isExternal ? timetrackingData.location : "",
      kilometers: timetrackingData.isExternal
        ? timetrackingData.kilometers
        : "",
    };

    try {
      const dossierRef = doc(
        db,
        "workspaces",
        localStorage.getItem("workspace"),
        "files",
        timetrackingData.client_id.id,
      );

      if (timetrackingData.id) {
        // If an ID exists, update the existing entry
        const dossierSnap = await getDoc(dossierRef);
        if (dossierSnap.exists()) {
          const timetracking = dossierSnap.data().timetracking || [];
          const existingIndex = timetracking.findIndex(
            (entry) => entry.id === timetrackingData.id,
          );

          if (existingIndex !== -1) {
            timetracking[existingIndex] = row;
          } else {
            alert("Entry not found.");
            return;
          }

          await updateDoc(dossierRef, { timetracking });
          dbTracker.trackWrite(pageName); // Track the write operation
        }
      } else {
        // Add new entry
        await updateDoc(dossierRef, {
          timetracking: arrayUnion(row),
        });
        dbTracker.trackWrite(pageName); // Track the write operation
      }

      window.dispatchEvent(new CustomEvent("logUpdated"));

      dialogEl.close();

      // Reset form fields
      currentTimetracking.set(defaults);
    } catch (error) {
      console.error("Error submitting form:", error);
      alert("Fout bij verzenden van formulier");
      dispatch("logUpdated");
    }
  }

  function updateLogsForSearch(data = allLogs) {
    const searchValue = get(searchQuery).trim().toLowerCase();
    const fromDate = get(searchQueryFrom);
    const toDate = get(searchQueryTo);

    if (searchValue) {
      data = data.filter((log) => {
        const dossier = dossiersData.find(
          (dossier) => dossier.id === log.id, // Adjusted to use log.id to find the dossier
        );
        const dossierName = dossier?.name?.toLowerCase() || "";
        const dossierId = dossier?.id?.toLowerCase() || "";

        return (
          dossierName.includes(searchValue) ||
          dossierId.includes(searchValue) ||
          log.description.toLowerCase().includes(searchValue) ||
          log.assignee.toLowerCase().includes(searchValue) ||
          log.location.toLowerCase().includes(searchValue)
        );
      });
    }

    // Filter based on date range
    if (fromDate || toDate) {
      data = data.filter((log) => {
        const logDate = new Date(format(log.date.toDate(), "yyyy-MM-dd"));
        let isValidLog = true;
        if (fromDate) {
          const from = new Date(fromDate);
          from.setHours(0, 0, 0, 0);
          isValidLog = isValidLog && logDate >= from;
        }
        if (toDate) {
          const to = new Date(toDate);
          to.setHours(23, 59, 59, 999);
          isValidLog = isValidLog && logDate <= to;
        }
        return isValidLog;
      });
    }

    // Sort logs by date and time
    data.sort((a, b) => b.date.toDate() - a.date.toDate());

    // data = data.slice(0, 50);

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
    console.log("Log received:", log); // Debug log

    // Use dossierId directly from the log
    const dossier = dossiersData.find((dossier) => dossier.id === log.id);
    console.log(dossier);

    if (!dossier) {
      console.error("Dossier not found for ID:", log.id);
      return;
    }

    // Ensure the timetracking array exists
    if (!dossier.timetracking || dossier.timetracking.length === 0) {
      console.error(
        "Timetracking array not found or empty for dossier ID:",
        dossier.id,
      );
      return;
    }

    // Using index of the timetracking entry for accuracy
    const index = dossier.timetracking.findIndex(
      (entry) =>
        entry.date.isEqual(log.date) &&
        entry.description === log.description &&
        entry.assignee === log.assignee &&
        entry.location === log.location,
    );

    if (index === -1) {
      console.error(
        "Log entry not found in dossier's timetracking array for dossier ID:",
        dossier.id,
      );
      return;
    }

    const { hours, minutes } = calculateHoursAndMinutes(log.minutes);

    const hhmm = formatMinutesToHHMM(log.minutes);

    currentTimetracking.set({
      index, // Store the correct index
      dossierId: dossier.id, // Use dossier's ID
      originalDossierId: dossier.id, // Track the original dossier ID
      name: dossier.name,
      date: format(log.date.toDate(), "yyyy-MM-dd"), // Keep the string format for the UI
      description: log.description,
      hhmm: hhmm,
      totaal: log.totaal,
      billable: log.billable,
      assignee: log.assignee,
      location: log.location,
    });

    setTimeout(() => {
      if (dialogEl) {
        dialogEl.showModal();
      }
    }, 0);
    console.log("Current log after setting:", get(currentTimetracking)); // Debug log to check currentTimetracking state
  }

  async function saveLog() {
    const editedLog = get(currentTimetracking);
    const dossierId = editedLog.dossierId ? editedLog.dossierId.id : "0000";
    const originalDossierId = editedLog.originalDossierId || dossierId;

    // console.log("dossierId", dossierId);
    // return;

    // Get the date from the form
    const [year, month, day] = editedLog.date.split("-").map(Number);

    const today = new Date();
    const isToday =
      year === today.getFullYear() &&
      month === today.getMonth() + 1 &&
      day === today.getDate();

    let dateObj;
    if (isToday) {
      // 1. If the date is today, use the current time
      dateObj = new Date();
    } else {
      // 2. If the date is not today, set the time to the end of the day
      dateObj = new Date(year, month - 1, day, 23, 59, 59);

      // 3. Check if there's already a log with the time at the end of the day
      const newDossierRef = doc(
        db,
        "workspaces",
        localStorage.getItem("workspace"),
        "files",
        dossierId,
      );
      const newDocSnap = await getDoc(newDossierRef);

      if (newDocSnap.exists()) {
        const existingLogs = newDocSnap.data().timetracking || [];
        const lastLog = existingLogs
          .filter((log) => {
            const logDate = log.date.toDate();
            return (
              logDate.getFullYear() === year &&
              logDate.getMonth() + 1 === month &&
              logDate.getDate() === day
            );
          })
          .sort((a, b) => b.date.toDate() - a.date.toDate())[0];

        if (lastLog) {
          // If the last log is at 23:59:59, increment by 1 second
          const lastLogTime = lastLog.date.toDate();
          if (
            lastLogTime.getHours() === 23 &&
            lastLogTime.getMinutes() === 59 &&
            lastLogTime.getSeconds() === 59
          ) {
            dateObj.setSeconds(dateObj.getSeconds() + 1);
          }
        }
      }
    }

    const firestoreTimestamp = Timestamp.fromDate(dateObj);

    const originalDossierRef = doc(
      db,
      "workspaces",
      localStorage.getItem("workspace"),
      "files",
      originalDossierId,
    );

    const newDossierRef = doc(
      db,
      "workspaces",
      localStorage.getItem("workspace"),
      "files",
      dossierId,
    );

    try {
      const originalDocSnap = await getDoc(originalDossierRef);
      let originalTimetracking = [];

      if (originalDocSnap.exists()) {
        originalTimetracking = originalDocSnap.data().timetracking || [];

        if (originalDossierId !== dossierId) {
          originalTimetracking = originalTimetracking.filter(
            (entry, index) => index !== editedLog.index,
          );

          await updateDoc(originalDossierRef, {
            timetracking: originalTimetracking,
          });
        }
      } else {
        console.warn(
          `Original dossier (ID: ${originalDossierId}) does not exist.`,
        );
      }

      const newDocSnap = await getDoc(newDossierRef);
      let newTimetracking = [];

      if (newDocSnap.exists()) {
        newTimetracking = newDocSnap.data().timetracking || [];
      } else {
        console.error("New Dossier document not found, creating a new one.");
        await setDoc(newDossierRef, {
          timetracking: newTimetracking,
        });
        dbTracker.trackWrite(pageName);
      }

      const existingIndex = newTimetracking.findIndex(
        (entry, idx) => idx === editedLog.index,
      );

      if (existingIndex !== -1) {
        // If log exists, update it
        newTimetracking[existingIndex] = {
          ...editedLog,
          date: firestoreTimestamp,
          minutes: timeToMinutes(editedLog.hhmm),
        };
      } else {
        // Otherwise, add it as a new entry
        newTimetracking.push({
          ...editedLog,
          date: firestoreTimestamp,
          minutes: timeToMinutes(editedLog.hhmm),
        });
      }

      await updateDoc(newDossierRef, {
        timetracking: newTimetracking,
      });
      dbTracker.trackWrite(pageName);

      alert("Urenregistratie succesvol bijgewerkt");
      window.dispatchEvent(new CustomEvent("logUpdated"));
      closeDialog();
    } catch (error) {
      console.error("Fout bij het bijwerken van urenregistratie:", error);
      alert("Fout bij het bijwerken van urenregistratie");
    }
  }

  async function deleteLog() {
    const logToDelete = get(currentTimetracking);
    console.log("Log to delete:", logToDelete);

    if (!confirm("Weet je zeker dat je deze log wilt verwijderen?")) {
      return;
    }

    // Get the reference to the specific dossier document in Firestore
    const dossierRef = doc(
      db,
      "workspaces",
      localStorage.getItem("workspace"),
      "files",
      logToDelete.dossierId.id, // Access the id property of dossierId
    );

    try {
      // Fetch the dossier document to retrieve the existing timetracking array
      const docSnap = await getDoc(dossierRef);

      if (docSnap.exists()) {
        let timetracking = docSnap.data().timetracking || [];

        // Remove the specific log entry by filtering out the one that matches the index
        timetracking = timetracking.filter(
          (entry, index) => index !== logToDelete.index,
        );

        // Update the Firestore document with the updated timetracking array
        await updateDoc(dossierRef, {
          timetracking: timetracking,
        });
        dbTracker.trackDelete(pageName);

        alert("Urenregistratie succesvol verwijderd");

        // Dispatch the 'logUpdated' event to update the results list
        window.dispatchEvent(new CustomEvent("logUpdated"));

        closeDialog();
      } else {
        console.error("Dossier document not found");
        alert("Fout bij het verwijderen van urenregistratie");
      }
    } catch (error) {
      console.error("Fout bij het verwijderen van urenregistratie:", error);
      alert("Fout bij het verwijderen van urenregistratie");
    }
  }

  function formatDateWithTodayOrYesterday(date) {
    const logDate = date.toDate();
    if (isToday(logDate)) {
      return ""; // Skip "Today (date)" for the first entry
    } else if (isYesterday(logDate)) {
      return `Gisteren (${format(logDate, "dd-MM-yyyy")})`;
    } else {
      return format(logDate, "dd-MM-yyyy");
    }
  }

  function calculateRevenue(log) {
    const min = parseFloat(log.minutes) || 0;
    const totaalUren = min / 60;
    const revenue = log.billable ? (totaalUren * 250).toFixed(2) : "0.00";
    return revenue;
  }

  function closeDialog() {
    document.getElementById("timetrackingDialog").close();
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

  function timeToMinutes(time) {
    // Split the time string by the colon
    const [hours, minutes] = time.split(":").map(Number);

    // Convert hours to minutes and add the minutes
    return hours * 60 + minutes;
  }

  function openModal() {
    // Ensure store is reset before showing the modal
    const newDefaults = {
      ...defaults,
      datum: new Date().toISOString().split("T")[0], // Set today's date as default
    };

    console.log("Setting defaults for modal:", newDefaults); // Debugging line

    currentTimetracking.set(newDefaults);

    // Wait a tick to ensure state update before showing modal
    setTimeout(() => {
      if (dialogEl) {
        dialogEl.showModal();
      }
    }, 0);
  }
</script>

<section class="timetracking_section">
  <div class="top">
    <h2>Urenregistratie</h2>
    <div class="buttons">
      <button class="mobile_icon_only" on:click={() => openModal()}
        ><Plus size={16} />Uren registreren</button
      >
    </div>
  </div>
</section>
<main>
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
        {#if $logs.length > 0}
          {#each $logs as log, index}
            {#if index !== 0 && formatDateWithTodayOrYesterday(log.date) !== "" && (index === 1 || format(log.date.toDate(), "dd-MM-yyyy") !== format($logs[index - 1].date.toDate(), "dd-MM-yyyy"))}
              <div class="date-divider">
                <hr class="date-line" />
                <span class="date-text"
                  >{formatDateWithTodayOrYesterday(log.date)}</span
                >
                <hr class="date-line" />
              </div>
            {/if}
            <li on:click={() => handleLongPress(log)}>
              <div class="log-header">
                <h2>{log.id}. {log.name}</h2>
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
              <p class="date">
                {format(log.date.toDate(), "dd-MM-yyyy")}
              </p>
            </li>
          {/each}
        {:else}
          Geen logs gevonden
        {/if}
      </ul>
    </div>
  {/if}
  <dialog id="timetrackingDialog" bind:this={dialogEl}>
    {#if $currentTimetracking}
      <div class="top">
        <h6>Log bewerken</h6>
        <button class="basic" on:click={closeDialog}><X size="16" /></button>
      </div>
      <div>
        <label class="legend">Dossiernaam</label>
        <Select
          items={dossiers}
          bind:value={$currentTimetracking.dossierId}
          getOptionLabel={(option) => option.label}
          getOptionValue={(option) => option.id}
          getSelectionLabel={(option) =>
            option?.label || $currentTimetracking.name}
          placeholder="Select dossier"
          itemId="id"
          clearable={false}
        />
      </div>
      <div>
        <label class="legend">Datum</label>
        <input type="date" bind:value={$currentTimetracking.date} />
      </div>
      <div>
        <label class="legend">Omschrijving</label>
        <textarea bind:value={$currentTimetracking.description}></textarea>
      </div>
      <div class="modal_columns" data-col="2">
        <div>
          <label class="legend">Uitvoerder</label>
          <select bind:value={$currentTimetracking.assignee}>
            <option value="Michel">Michel</option>
            <option value="Toon">Toon</option>
          </select>
        </div>
        <div>
          <label class="legend">Tijdsduur</label>
          <input type="time" bind:value={$currentTimetracking.hhmm} />
        </div>
      </div>
      <div>
        <label class="legend">Extern?</label>
        <input
          type="checkbox"
          bind:checked={$currentTimetracking.isExternal}
          on:change={() => {
            if (!$currentTimetracking.isExternal) {
              $currentTimetracking.location = ""; // Clear location if not external
              $currentTimetracking.kilometers = ""; // Clear kilometers if not external
            }
          }}
        />
      </div>

      {#if $currentTimetracking.isExternal}
        <div class="columns" data-col="2">
          <div>
            <label class="legend">Locatie</label>
            <input type="text" bind:value={$currentTimetracking.location} />
          </div>
          <div>
            <label class="legend">Kilometers</label>
            <input
              type="number"
              bind:value={$currentTimetracking.kilometers}
              min="0"
            />
          </div>
        </div>
      {/if}
      <div>
        <label class="legend">Facturabel</label>
        <input type="checkbox" bind:checked={$currentTimetracking.billable} />
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
</main>

<style lang="scss">
  @media (max-width: $md) {
    .mobile_icon_only {
      position: fixed;
      bottom: 80px;
      right: 40px;
      z-index: 1;

      right: unset;
      left: 50%;
      transform: translateX(-50%);
      border-radius: 50%;
      bottom: 55px;
      z-index: 9999;
      background: #258ad4;
    }
  }
  section {
    .top {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 10px 30px;
      flex-wrap: wrap;
      padding-bottom: 30px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 30px;

      @media (max-width: $md) {
        padding-bottom: 15px;
        margin-bottom: 10px;
      }

      h2 {
        margin-bottom: 0;
      }

      // position: sticky;
      // top: 0px;
      // z-index: 1;
      // background-color: #f8f8f8;
    }
  }
  .legend {
    margin-top: 0;
  }

  dialog .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  dialog .buttons {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    border-top: 1px solid var(--border);
    padding-top: 20px;
    margin-top: 20px;

    &:has(> :first-child:last-child) {
      justify-content: flex-end;
    }
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
    margin-top: 10px; /* Ruimte tussen de lijst en de tekst */
    ul {
      list-style-type: none;
      padding: 0;
      margin: 0;
    }

    li {
      background-color: #f9f9f9;
      margin-bottom: 10px;
      padding: 15px;
      border: 1px solid #ddd;
      border-radius: 5px;
      position: relative;
      cursor: pointer;

      --padding: 20px;
      border: 1px solid var(--border);
      padding: var(--padding);
      border-radius: var(--border-radius, 10px);
      background-color: #fff;
      display: flex;
      flex-direction: column;

      cursor: pointer;
      .log-header {
        h2 {
          font-size: 1.6rem;
          margin-bottom: 0;
        }
        .company {
          opacity: 0.6;
          font-size: 1.3rem;
          margin-top: 0.35em;
          display: block;
          max-width: 100%;
          text-overflow: ellipsis;
          overflow: hidden;
          white-space: nowrap;
        }
      }
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
  }

  .date-divider {
    display: flex;
    align-items: center;
    text-align: center;
    margin: 20px 0; /* Adjust spacing as needed */
  }

  .date-line {
    flex-grow: 1;
    height: 1px;
    background-color: var(--border);
    border: none;

    &:first-child {
      margin-inline: 0 15px;
    }
    &:last-child {
      margin-inline: 15px 0;
    }
  }

  .date-text {
    font-weight: light;
    color: var(--text);
    font-size: 1.4rem;
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

    opacity: 0.8;
    font-size: 1.3rem;
    margin-top: 0.35em;
    display: block;
    max-width: 100%;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
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
    padding-block: 20px;
    .basic {
      min-width: 48px;
    }
  }
  .search_filter input {
    flex-grow: 1;
    // font-size: 1.4rem;
  }
  .search_filter button {
    // min-width: 50px;
  }
  @media (max-width: $md) {
    .search_filter {
      position: sticky;
      top: -30px;
      background-color: var(--body-background, #f8f8f8);
      z-index: 1;
    }
    .search_filter button {
      min-width: 42px;
    }
    main > .columns {
      grid-template-columns: 100%;
      padding-top: 20px;
    }
    .date_input {
      margin-top: 0;
    }
  }

  .buttons {
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

    @media (max-width: $sm) {
      padding-block: 13px;
    }
  }
</style>
