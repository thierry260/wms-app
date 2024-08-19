<script>
  import { onMount, createEventDispatcher } from "svelte";
  import { fetchWorkspaceData } from "$lib/utils/get";
  import { doc, updateDoc, arrayUnion } from "firebase/firestore";
  import CaseDropdown from "$lib/CaseDropdown.svelte";
  import Result from "$lib/Results.svelte";
  import Filter from "$lib/Filter.svelte";
  import { writable } from "svelte/store";
  import { X, Plus } from "phosphor-svelte";
  import Select from "svelte-select";
  import { fetchWorkspaceFilesData } from "$lib/utils/get";
  import { db } from "$lib/firebase"; // Import the Firebase instance

  const defaults = {
    client_id: "",
    datum: "",
    tijdsduur: "00:15",
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
  let dialogEl = "";

  onMount(async () => {
    try {
      // Set datum to today's date
      const today = new Date().toISOString().split("T")[0];
      $currentTimetracking.datum = today;

      dossiersData = await fetchWorkspaceFilesData();

      // Extract and concatenate all timetracking arrays into timetrackingEntries
      dossiers = dossiersData.map((dossier) => ({
        id: dossier.id,
        name: dossier.name, // Ensure that name is set correctly
        label: `${dossier.id} - ${dossier.name}`, // Use both id and name for display in the dropdown
      }));
    } catch (error) {
      console.error("Error checking authentication status:", error);
    }
  });

  async function handleSubmit() {
    if (!$currentTimetracking.client_id) {
      alert("Selecteer een dossier");
      return;
    }

    console.log("Client ID:", $currentTimetracking.client_id);

    // Split tijdsduur into uur and min
    const [uur, min] = $currentTimetracking.tijdsduur.split(":").map(Number);
    const totaal = (uur + min / 60).toFixed(2);

    // Prepare the row object to be sent
    const row = {
      date: new Date($currentTimetracking.datum),
      description: $currentTimetracking.description,
      minutes: uur * 60 + min,
      totaal: totaal,
      billable: $currentTimetracking.billable,
      assignee: $currentTimetracking.assignee,
      isExternal: $currentTimetracking.isExternal,
      location: $currentTimetracking.isExternal
        ? $currentTimetracking.location
        : "",
      kilometers: $currentTimetracking.isExternal
        ? $currentTimetracking.kilometers
        : "",
    };

    // console.log(row);
    // return;

    try {
      // Get the dossier document reference
      const dossierRef = doc(
        db,
        "workspaces",
        localStorage.getItem("workspace"),
        "files",
        $currentTimetracking.client_id.id,
      );

      // Update the timetracking array in the Firestore document
      await updateDoc(dossierRef, {
        timetracking: arrayUnion(row),
      });

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

  function openModal() {
    currentTimetracking.set(defaults);

    dialogEl.showModal();
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
<Result />
<dialog id="timetrackingDialog" bind:this={dialogEl}>
  {#if $currentTimetracking.id}
    <div class="top">
      <h6>Timetracking bewerken</h6>
      <button class="basic" on:click={() => dialogEl.close()}>
        <X size="16" />
      </button>
    </div>
  {:else}
    <div class="top">
      <h6>Timetracking toevoegen</h6>
      <button class="basic" on:click={() => dialogEl.close()}>
        <X size="16" />
      </button>
    </div>
  {/if}

  <form on:submit|preventDefault={handleSubmit}>
    <div class="content">
      <div class="form">
        <fieldset>
          <label class="add_row_field full-width spacing_bottom">
            <Select
              items={dossiers}
              bind:value={$currentTimetracking.client_id}
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
              <input
                type="date"
                bind:value={$currentTimetracking.datum}
                on:focus={(e) => e.target.select}
              />
              <span>Datum *</span>
            </label>

            <label class="add_row_field">
              <input
                type="time"
                bind:value={$currentTimetracking.tijdsduur}
                on:focus={(e) => e.target.select}
              />
              <span>Tijdsduur *</span>
            </label>

            <label class="add_row_field spacing_bottom">
              <select bind:value={$currentTimetracking.assignee}>
                <option value="Michel">Michel</option>
                <option value="Toon">Toon</option>
              </select>
            </label>

            <label class="add_row_field">
              <input
                type="checkbox"
                bind:checked={$currentTimetracking.isExternal}
                on:change={() => {
                  if (!$currentTimetracking.isExternal) {
                    location = "";
                    kilometers = "";
                  }
                }}
              />
              <span>Extern?</span>
            </label>
          </div>

          <!-- Conditionally render the location and kilometers fields -->
          {#if $currentTimetracking.isExternal}
            <div class="add_row_field_columns spacing_bottom">
              <label class="add_row_field">
                <input
                  type="text"
                  bind:value={$currentTimetracking.location}
                  on:focus={(e) => e.target.select}
                />
                <span>Locatie</span>
              </label>

              <label class="add_row_field">
                <input
                  type="number"
                  min="0"
                  bind:value={$currentTimetracking.kilometers}
                  on:focus={(e) => e.target.select}
                />
                <span>Kilometers</span>
              </label>
            </div>
          {/if}

          <label class="add_row_field full-width">
            <textarea
              bind:value={$currentTimetracking.description}
              on:focus={(e) => e.target.select}
            ></textarea>
            <span>Omschrijving *</span>
          </label>
        </fieldset>
      </div>
    </div>
    <div class="actions">
      <label class="add_row_field consent">
        <input type="checkbox" bind:checked={$currentTimetracking.billable} />
        <span>Facturabel</span>
      </label>
      <button type="submit">Registreren</button>
    </div>
  </form>
</dialog>

<style lang="scss">
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
      margin-bottom: 50px;

      @media (max-width: $md) {
        padding-bottom: 15px;
        margin-bottom: 30px;
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
</style>
