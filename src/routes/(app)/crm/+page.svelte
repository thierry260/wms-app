<script>
  import { db } from "$lib/firebase"; // Import your Firebase instance
  import { collection, addDoc, Timestamp, getDocs } from "firebase/firestore"; // Import Firestore functions
  import { writable } from "svelte/store";
  import { onMount } from "svelte";

  let voornaam = "";
  let tussenvoegsels = "";
  let achternaam = "";
  let bedrijfsnaam = "";
  let functienaam = "";
  let geboortedatum = "";
  let notities = "";
  let email = "";
  let telefoonnummer = "";
  let adres = "";
  let website = "";

  let submitting = writable(false);
  let errorMessage = writable("");
  let successMessage = writable("");

  let clientsList = writable([]);

  let dialogEl = ""; // Reference to the dialog element
  let editingClient = writable(null); // To track if we're editing a client

  onMount(async () => {
    await fetchClients();
  });

  function openModal(client = null) {
    if (client) {
      // If client is provided, set the form data to edit mode
      editingClient.set(client);
      voornaam = client.voornaam || "";
      tussenvoegsels = client.tussenvoegsels || "";
      achternaam = client.achternaam || "";
      bedrijfsnaam = client.bedrijfsnaam || "";
      functienaam = client.functienaam || "";
      geboortedatum = client.geboortedatum
        ? new Date(client.geboortedatum.seconds * 1000)
            .toISOString()
            .substr(0, 10)
        : "";
      notities = client.notities || "";
      email = client.email || "";
      telefoonnummer = client.telefoonnummer || "";
      adres = client.adres || "";
      website = client.website || "";
    } else {
      // Reset form for a new client
      resetForm();
      editingClient.set(null);
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
    console.log(clientsList);
  }

  async function handleSubmit() {
    // Ensure all required fields are filled out
    if (!voornaam) {
      errorMessage.set("Vul alle verplichte velden in.");
      return;
    }

    submitting.set(true);
    errorMessage.set("");
    successMessage.set("");

    try {
      // Convert geboortedatum to a Firestore Timestamp if provided
      const dobTimestamp = geboortedatum
        ? Timestamp.fromDate(new Date(geboortedatum))
        : null;

      // Reference to the clients collection
      const clientsRef = collection(
        db,
        "workspaces",
        localStorage.getItem("workspace"),
        "clients",
      );

      // Add a new document with the client data
      await addDoc(clientsRef, {
        voornaam,
        tussenvoegsels,
        achternaam,
        bedrijfsnaam,
        functienaam,
        geboortedatum: dobTimestamp,
        notities,
        email,
        telefoonnummer,
        adres,
        website,
      });

      successMessage.set("Contact succesvol toegevoegd!");
      resetForm();
      await fetchClients();
    } catch (error) {
      console.error("Error adding client: ", error);
      errorMessage.set("Toevoegen mislukt.");
    } finally {
      submitting.set(false);
    }
  }

  function resetForm() {
    voornaam = "";
    tussenvoegsels = "";
    achternaam = "";
    bedrijfsnaam = "";
    functienaam = "";
    geboortedatum = "";
    notities = "";
    email = "";
    telefoonnummer = "";
    adres = "";
    website = "";
  }
</script>

<main>
  <button on:click={() => openModal()}>Nieuw contact toevoegen</button>

  <dialog id="clientDialog" bind:this={dialogEl}>
    <div class="top">
      <h2>{#if $editingClient}Contact bewerken{#else}Nieuw contact toevoegen{/if}</h2>
      <button class="basic" on:click={closeModal}><X size="16" /></button>
    </div>

    <form on:submit|preventDefault={handleSubmit}>

    <label>
      <span class="legend">Voornaam:</span>
      <input type="text" bind:value={voornaam} placeholder="Voornaam" />
    </label>

    <label>
      <span class="legend">Tussenvoegsels:</span>
      <input
        type="text"
        bind:value={tussenvoegsels}
        placeholder="Tussenvoegsels (optioneel)"
      />
    </label>

    <label>
      <span class="legend">Achternaam:</span>
      <input type="text" bind:value={achternaam} placeholder="Achternaam" />
    </label>

    <label>
      <span class="legend">Bedrijfsnaam:</span>
      <input
        type="text"
        bind:value={bedrijfsnaam}
        placeholder="Bedrijfsnaam (optioneel)"
      />
    </label>

    <label>
      <span class="legend">Functienaam:</span>
      <input
        type="text"
        bind:value={functienaam}
        placeholder="Functienaam (optioneel)"
      />
    </label>

    <label>
      <span class="legend">Geboortedatum:</span>
      <input type="date" bind:value={geboortedatum} />
    </label>

    <label>
      <span class="legend">Notities:</span>
      <textarea bind:value={notities} placeholder="Notities (optioneel)"
      ></textarea>
    </label>

    <label>
      <span class="legend">E-mail adres:</span>
      <input type="email" bind:value={email} placeholder="E-mail adres" />
    </label>

    <label>
      <span class="legend">Telefoonnummer:</span>
      <input
        type="tel"
        bind:value={telefoonnummer}
        placeholder="Telefoonnummer"
      />
    </label>

    <label>
      <span class="legend">Adres:</span>
      <input type="text" bind:value={adres} placeholder="Adres" />
    </label>

    <label>
      <span class="legend">Website:</span>
      <input
        type="text"
        bind:value={website}
        placeholder="Website (optioneel)"
      />
    </label>

   <div class="buttons">
        <button type="button" on:click={closeModal}>Annuleren</button>
        <button type="submit" disabled={$submitting}>
          {#if $editingClient}Opslaan{#else}Toevoegen{/if}
        </button>
      </div>
    </form>
  </dialog>

  <section class="clients_section">
    <h2>Overzicht van contacten</h2>
    <table>
      <thead>
        <tr>
          <th>Voornaam</th>
          <th>Achternaam</th>
          <th>Bedrijfsnaam</th>
          <th>Functienaam</th>
          <th>E-mail</th>
          <th>Telefoonnummer</th>
          <th>Adres</th>
          <th>Website</th>
        </tr>
      </thead>
      <tbody>
        {#each $clientsList as client}
          <tr on:click={() => openModal(client)}>
            <td>{client.voornaam}</td>
            <td>{client.achternaam}</td>
            <td>{client.bedrijfsnaam}</td>
            <td>{client.functienaam}</td>
            <td>{client.email}</td>
            <td>{client.telefoonnummer}</td>
            <td>{client.adres}</td>
            <td
              ><a href={client.website} target="_blank">{client.website}</a></td
            >
          </tr>
        {/each}
      </tbody>
    </table>
  </section>
</main>

<style lang="scss">
  .clients_section {
    margin-top: 60px;
  }
  .legend {
    margin-top: 0;
  }

  dialog .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .buttons {
    display: flex;
    justify-content: space-between;
    margin-top: 20px;
  }
</style>
