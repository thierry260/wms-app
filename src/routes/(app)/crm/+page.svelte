<script>
  import { db } from "$lib/firebase";
  import {
    collection,
    doc,
    addDoc,
    setDoc,
    deleteDoc,
    getDocs,
    getDoc,
    Timestamp,
  } from "firebase/firestore";
  import { writable, get, derived } from "svelte/store";
  import { onMount } from "svelte";
  import {
    X,
    Plus,
    TrashSimple,
    Phone,
    EnvelopeSimple,
    ArrowClockwise,
  } from "phosphor-svelte";
  import { format } from "date-fns";
  import { dbTracker } from "$lib/utils/dbTracker"; // Import dbTracker
  import {
    updateWorkspaceArray,
    updateDocsArray,
    getCachedDocs,
  } from "$lib/utils/cache"; // Import cache functions
  import { page } from "$app/stores";
  import Header from "$lib/components/Header.svelte";

  const pageName = "Contacts";
  let refreshTooltip = "Data vernieuwen";
  let searchEl;

  // Writable store for contact form data
  let currentClient = writable({
    voornaam: "",
    tussenvoegsels: "",
    achternaam: "",
    bedrijfsnaam: "",
    functienaam: "",
    geboortedatum: "",
    notities: "",
    email: "",
    telefoonnummer: "",
    adres: "",
    website: "",
  });

  let submitting = writable(false);
  let errorMessage = writable("");
  let successMessage = writable("");
  let clientsList = writable([]);
  let searchQuery = writable("");

  let filteredClientsList = derived(
    [clientsList, searchQuery],
    ([$clientsList, $searchQuery]) => {
      const query = $searchQuery.toLowerCase().trim();

      return $clientsList.filter((client) => {
        const fullName =
          `${client.voornaam}${client.tussenvoegsels ? ` ${client.tussenvoegsels} ` : " "}${client.achternaam}`
            .toLowerCase()
            .trim();

        return (
          fullName.includes(query) ||
          client.voornaam.toLowerCase().includes(query) ||
          client.achternaam.toLowerCase().includes(query) ||
          client.bedrijfsnaam.toLowerCase().includes(query) ||
          client.email.toLowerCase().includes(query) ||
          client.telefoonnummer.toLowerCase().includes(query)
        );
      });
    }
  );
  // Create the resultCount derived store
  let resultCount = derived(filteredClientsList, ($filteredClientsList) => {
    return $filteredClientsList.length;
  });

  let dialogEl = "";

  $: {
    if (dialogEl) {
      dialogEl.addEventListener("click", function (event) {
        const rect = dialogEl.getBoundingClientRect();
        const isInDialog =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (!isInDialog) {
          dialogEl.close();
        }
      });
    }
  }

  onMount(async () => {
    dbTracker.initPage(pageName);
    await fetchClients();

    const unsubscribe = page.subscribe(async ($page) => {
      const params = $page.url.searchParams;
      if (params.has("load_clients")) {
        console.log("load clients");
        try {
          const updatedData = await updateDocsArray("clients");
          console.log("Updated Workspace Data:", updatedData);
        } catch (error) {
          console.error("Error updating workspace document:", error);
        }
      }
    });

    window.addEventListener("keydown", handleShortcut);
    return () => {
      window.removeEventListener("keydown", handleShortcut);
      unsubscribe();
    };
  });

  // Add event listener for keyboard shortcut
  function handleShortcut(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === "f") {
      event.preventDefault(); // Prevent the default browser search
      searchEl?.focus(); // Focus on the search input element
    } else if (event.key === "Escape") {
      if (document.activeElement === searchEl) {
        if (searchEl) searchEl.value = "";
        searchEl?.dispatchEvent(new Event("input", { bubbles: true }));
        searchEl?.blur(); // Remove focus from the search input element
      }
    }
  }

  async function fetchClients() {
    let clients = await getCachedDocs("clients");
    clients.sort((a, b) => {
      // Place clients without achternaam after those with achternaam
      if (!a.achternaam) return 1;
      if (!b.achternaam) return -1;

      if (a.achternaam < b.achternaam) return -1;
      if (a.achternaam > b.achternaam) return 1;
      // If achternaam is the same, compare voornaam
      if (a.voornaam < b.voornaam) return -1;
      if (a.voornaam > b.voornaam) return 1;
      return 0;
    });

    // console.log(clients);
    clientsList.set(clients);
  }

  function handleRefreshClick() {
    refreshTooltip = "Aan het vernieuwen"; // Change the tooltip text

    // Call your refresh function
    fetchClients(false).then(() => {
      refreshTooltip = "Vernieuwd!"; // Update tooltip text after refresh
      setTimeout(function () {
        refreshTooltip = "Data vernieuwen";
      }, 4000);
    });
  }

  async function openModal(client = null, event = null) {
    if (event) {
      const clickedElement = event.target;
      if (clickedElement.closest(".bottom")) {
        return;
      }
    }

    if (client && client.id) {
      let geboortedatumFormatted = "";

      if (client.geboortedatum) {
        const geboortedatum = client.geboortedatum;

        // Determine if geboortedatum is a Firestore Timestamp or a plain object
        const dateObj = geboortedatum.toDate
          ? geboortedatum.toDate() // Firestore Timestamp
          : geboortedatum.seconds
            ? new Date(
                geboortedatum.seconds * 1000 +
                  geboortedatum.nanoseconds / 1000000
              ) // Plain object
            : new Date(geboortedatum); // Assuming geboortedatum is a date string or other formats

        geboortedatumFormatted = format(dateObj, "yyyy-MM-dd");
      }

      currentClient.set({
        ...client,
        geboortedatum: geboortedatumFormatted,
      });

      console.log($currentClient);
    } else {
      resetForm();
    }
    dialogEl.showModal();
  }

  function closeModal() {
    dialogEl.close();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const button = event.submitter;
    const action = button.dataset.action;

    const clientData = get(currentClient);

    // Validate required fields
    if (!clientData.voornaam) {
      errorMessage.set("Vul alle verplichte velden in.");
      return;
    }

    submitting.set(true);
    errorMessage.set("");
    successMessage.set("");

    try {
      const dobTimestamp = clientData.geboortedatum
        ? Timestamp.fromDate(new Date(clientData.geboortedatum))
        : null;

      const workspaceId = localStorage.getItem("workspace");
      const clientsRef = collection(db, "workspaces", workspaceId, "clients");

      let updatedClientsList = get(clientsList);

      if (action === "edit") {
        const clientDocRef = doc(clientsRef, clientData.id);
        delete clientData.id;

        await setDoc(clientDocRef, {
          ...clientData,
          geboortedatum: dobTimestamp,
        });

        updatedClientsList = updatedClientsList.map((client) =>
          client.id === clientDocRef.id
            ? { id: clientDocRef.id, ...clientData }
            : client
        );

        // Update the workspace document
        await updateWorkspaceArray(workspaceId, "clients", clientDocRef.id);

        successMessage.set("Contact succesvol bijgewerkt!");
      } else if (action === "create") {
        const newDocRef = await addDoc(clientsRef, {
          ...clientData,
          geboortedatum: dobTimestamp,
        });

        updatedClientsList = [
          ...updatedClientsList,
          { id: newDocRef.id, ...clientData },
        ];

        // Update the workspace document
        await updateWorkspaceArray(workspaceId, "clients", newDocRef.id);

        successMessage.set("Contact succesvol toegevoegd!");
      }

      clientsList.set(updatedClientsList);

      resetForm();
      dialogEl.close();
    } catch (error) {
      console.error("Error handling client data: ", error);
      errorMessage.set(
        action === "edit" ? "Bijwerken mislukt." : "Toevoegen mislukt."
      );
    } finally {
      submitting.set(false);
    }
  }

  function resetForm() {
    currentClient.set({
      voornaam: "",
      tussenvoegsels: "",
      achternaam: "",
      bedrijfsnaam: "",
      functienaam: "",
      geboortedatum: "",
      notities: "",
      email: "",
      telefoonnummer: "",
      adres: "",
      website: "",
    });
    errorMessage.set("");
    successMessage.set("");
  }

  async function deleteContact() {
    const contactToDelete = get(currentClient);

    if (!confirm("Weet je zeker dat je dit contact wilt verwijderen?")) {
      return;
    }

    const workspaceId = localStorage.getItem("workspace");
    const clientRef = doc(
      db,
      "workspaces",
      workspaceId,
      "clients",
      contactToDelete.id
    );

    try {
      await deleteDoc(clientRef);

      let updatedClientsList = get(clientsList).filter(
        (client) => client.id !== contactToDelete.id
      );
      clientsList.set(updatedClientsList);

      // Update the workspace document
      await updateWorkspaceArray(
        workspaceId,
        "clients",
        contactToDelete.id,
        true
      );

      successMessage.set("Contact succesvol verwijderd!");
      dialogEl.close();
    } catch (error) {
      console.error("Fout bij het verwijderen van dossier:", error);
      alert("Fout bij het verwijderen van dossier");
    }
  }
</script>

<main>
  <section class="client_section">
    <Header
      title="Contacten"
      {resultCount}
      {searchQuery}
      searchPlaceholder={"Zoek contacten..."}
    >
      <button slot="action" class="mobile_icon_only" on:click={openModal}>
        <Plus size={16} />Contact toevoegen
      </button>
    </Header>

    {#if $filteredClientsList.length}
      <div class="contact_items">
        {#each $filteredClientsList as client}
          <div class="contact_item" on:click={() => openModal(client, event)}>
            <div class="header">
              <h2>
                {client.voornaam}
                {client.tussenvoegsels}
                {client.achternaam}
              </h2>
              <span class="company"
                >{client.functienaam
                  ? `${client.functienaam} - `
                  : ""}{client.bedrijfsnaam
                  ? `${client.bedrijfsnaam}`
                  : "Bedrijfsnaam onbekend"}</span
              >
            </div>
            <div class="bottom">
              {#if client.telefoonnummer}
                <a href="tel:{client.telefoonnummer}"
                  ><Phone
                    size={20}
                    color="var(--primary)"
                  />{client.telefoonnummer}</a
                >
              {:else}
                <div><Phone size={20} color="var(--gray-400)" />Onbekend</div>
              {/if}
              {#if client.email}
                <a href="mailto:{client.email}"
                  ><EnvelopeSimple
                    size={20}
                    color="var(--primary)"
                  />{client.email}</a
                >
              {:else}
                <div>
                  <EnvelopeSimple size={20} color="var(--gray-400)" />Onbekend
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <p class="empty">Geen resultaten</p>
    {/if}
  </section>

  <dialog id="clientDialog" bind:this={dialogEl}>
    {#if $currentClient.id}
      <div class="top">
        <h6>Contact bewerken</h6>
        <button class="basic" on:click={closeModal}><X size="16" /></button>
      </div>
    {:else}
      <div class="top">
        <h6>Contact toevoegen</h6>
        <button class="basic" on:click={closeModal}><X size="16" /></button>
      </div>
    {/if}

    <form on:submit|preventDefault={handleSubmit}>
      <label>
        <span class="legend">Voornaam:</span>
        <input
          type="text"
          bind:value={$currentClient.voornaam}
          placeholder="Voornaam"
        />
      </label>

      <label>
        <span class="legend">Tussenvoegsels:</span>
        <input
          type="text"
          bind:value={$currentClient.tussenvoegsels}
          placeholder="Tussenvoegsels (optioneel)"
        />
      </label>

      <label>
        <span class="legend">Achternaam:</span>
        <input
          type="text"
          bind:value={$currentClient.achternaam}
          placeholder="Achternaam"
        />
      </label>

      <label>
        <span class="legend">Bedrijfsnaam:</span>
        <input
          type="text"
          bind:value={$currentClient.bedrijfsnaam}
          placeholder="Bedrijfsnaam (optioneel)"
        />
      </label>

      <div class="modal_columns">
        <label>
          <span class="legend">Functienaam:</span>
          <input
            type="text"
            bind:value={$currentClient.functienaam}
            placeholder="Functienaam (optioneel)"
          />
        </label>

        <label>
          <span class="legend">Geboortedatum:</span>
          <input type="date" bind:value={$currentClient.geboortedatum} />
        </label>

        <label>
          <span class="legend">E-mail adres:</span>
          <input
            type="email"
            bind:value={$currentClient.email}
            placeholder="E-mail adres"
          />
        </label>

        <label>
          <span class="legend">Telefoonnummer:</span>
          <input
            type="tel"
            bind:value={$currentClient.telefoonnummer}
            placeholder="Telefoonnummer"
          />
        </label>

        <label>
          <span class="legend">Adres:</span>
          <input
            type="text"
            bind:value={$currentClient.adres}
            placeholder="Adres"
          />
        </label>

        <label>
          <span class="legend">Website:</span>
          <input
            type="text"
            bind:value={$currentClient.website}
            placeholder="Website (optioneel)"
          />
        </label>
      </div>

      <label>
        <span class="legend">Notities:</span>
        <textarea
          bind:value={$currentClient.notities}
          placeholder="Notities (optioneel)"
        ></textarea>
      </label>

      {#if $errorMessage}
        <p style="color: red;">{$errorMessage}</p>
      {/if}

      {#if $successMessage}
        <p style="color: green;">{$successMessage}</p>
      {/if}

      <div class="buttons">
        {#if $currentClient.id}
          <button type="button" class="basic" on:click={deleteContact}>
            <TrashSimple size="16" />
          </button>
          <div>
            <button class="basic" type="button" on:click={closeModal}
              >Annuleren</button
            >
            <button type="submit" data-action="edit" disabled={$submitting}
              >Opslaan</button
            >
          </div>
        {:else}
          <button type="submit" data-action="create" disabled={$submitting}>
            Contact toevoegen
          </button>
        {/if}
      </div>
    </form>
  </dialog>
</main>

<style lang="scss">
  .client_section {
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
        padding-bottom: 30px;
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

  .contact_items {
    display: grid;
    gap: 15px;
    grid-template-columns: repeat(auto-fit, minmax(min(520px, 100%), 1fr));

    .contact_item {
      --padding: 20px;
      border: 1px solid var(--border);
      padding: var(--padding);
      border-radius: var(--border-radius, 10px);
      background-color: #fff;
      display: flex;
      flex-direction: column;
      gap: 40px;
      @media (max-width: $xs) {
        gap: 20px;
      }
      cursor: pointer;
      .header {
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
      .bottom {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        gap: 0;
        margin-bottom: calc(var(--padding, 20px) * -1);
        margin-inline: calc(var(--padding, 20px) * -1);
        padding: 0;
        border-top: 1px solid var(--border);
        cursor: initial;

        > * {
          flex-grow: 1;
          padding: 20px;
          &:first-child {
            border-right: 1px solid var(--border);
            border-bottom-left-radius: var(--border-radius, 10px);
          }
          &:last-child {
            border-bottom-right-radius: var(--border-radius, 10px);
          }
        }

        @media (max-width: $xs) {
          flex-direction: column;

          > * {
            padding: 15px;
          }
          > *:first-child {
            border-right: 0;
            border-bottom: 1px solid var(--border);
            border-bottom-left-radius: 0;
          }
          > *:last-child {
            border-bottom: 0;
            border-bottom-left-radius: var(--border-radius, 10px);
          }
        }
        a {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: inherit;
          text-decoration: none;
          font-size: 1.3rem;
        }
        div {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: inherit;
          text-decoration: none;
          font-size: 1.3rem;
          color: var(--gray-400);
        }
      }
    }
  }

  dialog .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  dialog .buttons {
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

  .result-count {
    font-size: 1.4rem;
    color: var(--gray-500);
  }

  input.search.search {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%23a8a8a8' viewBox='0 0 256 256'%3E%3Cpath d='M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z'%3E%3C/path%3E%3C/svg%3E");
    background-position: left 15px center;
    background-repeat: no-repeat;
    background-size: 16px;
    padding: 15px 30px 15px 40px;
    margin-bottom: 30px;
  }
</style>
