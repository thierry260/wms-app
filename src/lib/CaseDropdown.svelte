<script>
  import { onMount, createEventDispatcher } from "svelte";
  import Select from "svelte-select";
  import { writable } from "svelte/store";
  import { fetchWorkspaceFilesData } from "$lib/utils/get";
  import { doc, updateDoc, arrayUnion } from "firebase/firestore"; // Import Firebase Firestore functions
  import { db } from "$lib/firebase"; // Import the Firebase instance

  let dossiersData = [];
  let dossiers = [];
  let selectedDossier;
  let datum = "";
  let tijdsduur = "00:15";
  let assignee = "Toon"; // Default value
  let description = "";
  let billable = true;
  let location = ""; // Default value
  let isAuthenticated = writable(false);
  const dispatch = createEventDispatcher(); // Add event dispatcher

  // Dropdown options for assignee
  const assigneeOptions = [
    { label: "Michel", value: "Michel" },
    { label: "Toon", value: "Toon" },
  ];

  onMount(async () => {
    try {
      // Set datum to today's date
      const today = new Date().toISOString().split("T")[0];
      datum = today;

      dossiersData = await fetchWorkspaceFilesData();

      // Extract and concatenate all timetracking arrays into timetrackingEntries
      dossiers = dossiersData.map((dossier) => ({
        id: dossier.id,
        name: dossier.name, // Ensure that name is set correctly
        label: `${dossier.id} - ${dossier.name}`, // Use both id and name for display in the dropdown
      }));

      console.log("Dossiers:", dossiers);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  });

  async function handleSubmit() {
    if (!selectedDossier) {
      alert("Selecteer een dossier");
      return;
    }

    // Split tijdsduur into uur and min
    const [uur, min] = tijdsduur.split(":").map(Number);
    const totaal = (uur + min / 60).toFixed(2);

    // Prepare the row object to be sent
    const row = {
      date: new Date(datum),
      description,
      minutes: uur * 60 + min,
      totaal,
      billable,
      assignee,
      location,
    };

    try {
      // Get the dossier document reference
      const dossierRef = doc(
        db,
        "workspaces",
        localStorage.getItem("workspace"),
        "files",
        selectedDossier.id,
      );

      // Update the timetracking array in the Firestore document
      await updateDoc(dossierRef, {
        timetracking: arrayUnion(row),
      });

      alert("Urenregistratie succesvol toegevoegd");
      dispatch("rowAdded"); // Dispatch event when row is added
      window.dispatchEvent(new CustomEvent("logUpdated"));

      // Reset form fields
      selectedDossier = null;
      datum = new Date().toISOString().split("T")[0];
      tijdsduur = "00:15";
      assignee = "Toon";
      description = "";
      billable = true;
      location = "";
    } catch (error) {
      console.error("Error submitting form:", error);
      alert("Fout bij verzenden van formulier");
      dispatch("logUpdated");
    }
  }

  function handleFocus(event) {
    event.target.select();
  }
</script>

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
              itemId="id"
            />
          </label>

          <div class="add_row_field_columns">
            <label class="add_row_field">
              <input type="date" bind:value={datum} on:focus={handleFocus} />
              <span>Datum *</span>
            </label>

            <label class="add_row_field">
              <input
                type="time"
                bind:value={tijdsduur}
                on:focus={handleFocus}
              />
              <span>Tijdsduur *</span>
            </label>

            <label class="add_row_field">
              <input type="text" bind:value={location} on:focus={handleFocus} />
              <span>Locatie</span>
            </label>

            <label class="add_row_field spacing_bottom">
              <input type="text" bind:value={assignee} on:focus={handleFocus} />
              <span>Uitvoerder *</span>
            </label>
          </div>

          <label class="add_row_field full-width">
            <textarea bind:value={description} on:focus={handleFocus}
            ></textarea>
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

<style lang="scss"></style>
