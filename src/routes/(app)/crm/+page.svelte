<script>
  import { db } from "$lib/firebase";
  import {
    collection,
    doc,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    getDocs,
    Timestamp,
  } from "firebase/firestore";
  import { writable, get, derived } from "svelte/store";
  import { onMount } from "svelte";
  import { X, Plus, TrashSimple, Phone, EnvelopeSimple } from "phosphor-svelte";
  import { format } from "date-fns";
  import { dbTracker } from "$lib/utils/dbTracker"; // Import dbTracker

  const pageName = "Contacts";

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
      console.log("Inside derived store:", $searchQuery);
      const query = $searchQuery.toLowerCase().trim();

      return $clientsList.filter((client) => {
        // Combine voornaam, tussenvoegsels, and achternaam for full name search
        const fullName =
          `${client.voornaam}${client.tussenvoegsels ? ` ${client.tussenvoegsels} ` : " "}${client.achternaam}`
            .toLowerCase()
            .trim();

        return (
          fullName.includes(query) || // Check full name
          client.voornaam.toLowerCase().includes(query) ||
          client.achternaam.toLowerCase().includes(query) ||
          client.bedrijfsnaam.toLowerCase().includes(query) ||
          client.email.toLowerCase().includes(query) ||
          client.telefoonnummer.toLowerCase().includes(query)
        );
      });
    },
  );

  let dialogEl = "";

  onMount(async () => {
    dbTracker.initPage(pageName);
    await fetchClients();
  });

  function openModal(client = null, event = null) {
    // Check if the event is provided and if the click was on .bottom or a child of .bottom
    if (event) {
      const clickedElement = event.target;
      if (clickedElement.closest(".bottom")) {
        // Do nothing if the click happened on .bottom or its children
        return;
      }
    }

    if (client && client.id) {
      currentClient.set({
        ...client,
        geboortedatum: client.geboortedatum
          ? format(client.geboortedatum.toDate(), "yyyy-MM-dd")
          : "", // Convert and format the date
      });
    } else {
      resetForm();
    }
    dialogEl.showModal();
  }

  function closeModal() {
    dialogEl.close();
  }

  async function fetchClients() {
    const clientsRef = collection(
      db,
      "workspaces",
      localStorage.getItem("workspace"),
      "clients",
    );
    const clientSnapshots = await getDocs(clientsRef);
    clientsList.set(
      clientSnapshots.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    );
    dbTracker.trackRead(pageName, clientSnapshots.docs.length);

    console.log(clientsList);
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
      // Convert geboortedatum to a Firestore Timestamp if provided
      const dobTimestamp = clientData.geboortedatum
        ? Timestamp.fromDate(new Date(clientData.geboortedatum))
        : null;

      // Reference to the clients collection
      const clientsRef = collection(
        db,
        "workspaces",
        localStorage.getItem("workspace"),
        "clients",
      );

      if (action === "edit") {
        const clientDocRef = doc(clientsRef, clientData.id);

        delete clientData.id;

        await setDoc(clientDocRef, {
          ...clientData,
          geboortedatum: dobTimestamp,
        });
        dbTracker.trackWrite(pageName);

        successMessage.set("Contact succesvol bijgewerkt!");
      } else if (action === "create") {
        await addDoc(clientsRef, {
          ...clientData,
          geboortedatum: dobTimestamp,
        });
        dbTracker.trackWrite(pageName);
        successMessage.set("Contact succesvol toegevoegd!");
      }

      resetForm();
      dialogEl.close();
      await fetchClients();
    } catch (error) {
      console.error("Error handling client data: ", error);
      errorMessage.set(
        action === "edit" ? "Bijwerken mislukt." : "Toevoegen mislukt.",
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
  }

  async function deleteContact() {
    const contactToDelete = get(currentClient);
    console.log("Log to delete:", contactToDelete);

    if (!confirm("Weet je zeker dat je dit contact wilt verwijderen?")) {
      return;
    }

    const clientRef = doc(
      db,
      "workspaces",
      localStorage.getItem("workspace"),
      "clients",
      contactToDelete.id,
    );

    try {
      await deleteDoc(clientRef);

      clientsList.update((currentClients) =>
        currentClients.filter((client) => client.id !== contactToDelete.id),
      );

      dbTracker.trackDelete(pageName);

      errorMessage.set("");
      successMessage.set("");

      dialogEl.close();
    } catch (error) {
      console.error("Fout bij het verwijderen van dossier:", error);
      alert("Fout bij het verwijderen van dossier");
    }
  }
</script>

<main>
  <section class="client_section">
    <div class="top">
      <h2>Contacten</h2>
      <div class="buttons">
        <button class="mobile_icon_only" on:click={() => openModal()}
          ><Plus size={16} />Contact toevoegen</button
        >
      </div>
    </div>

    <input
      type="text"
      class="search"
      placeholder="Zoek contacten..."
      on:input={(e) => searchQuery.set(e.target.value)}
    />
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
      <p>Geen resultaten</p>
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
          // justify-content: center;
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
          // background-color: var(--gray-100);
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

  input.search.search {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%23a8a8a8' viewBox='0 0 256 256'%3E%3Cpath d='M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z'%3E%3C/path%3E%3C/svg%3E");
    background-position: left 15px center;
    background-repeat: no-repeat;
    background-size: 16px;
    padding: 15px 30px 15px 40px;
    margin-bottom: 30px;
  }
</style>
