<script>
  import { db } from "$lib/firebase"; // Import your Firebase instance
  import { collection, addDoc, Timestamp } from "firebase/firestore"; // Import Firestore functions
  import { writable } from "svelte/store";

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

  async function handleSubmit() {
    // Ensure all required fields are filled out
    if (!voornaam || !achternaam || !email || !telefoonnummer || !adres) {
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
  <h1>Contact toevoegen</h1>

  {#if $errorMessage}
    <p style="color: red;">{$errorMessage}</p>
  {/if}

  {#if $successMessage}
    <p style="color: green;">{$successMessage}</p>
  {/if}

  <form on:submit|preventDefault={handleSubmit}>
    <label>
      Voornaam:
      <input type="text" bind:value={voornaam} placeholder="Voornaam" />
    </label>

    <label>
      Tussenvoegsels:
      <input
        type="text"
        bind:value={tussenvoegsels}
        placeholder="Tussenvoegsels (optioneel)"
      />
    </label>

    <label>
      Achternaam:
      <input type="text" bind:value={achternaam} placeholder="Achternaam" />
    </label>

    <label>
      Bedrijfsnaam:
      <input
        type="text"
        bind:value={bedrijfsnaam}
        placeholder="Bedrijfsnaam (optioneel)"
      />
    </label>

    <label>
      Functienaam:
      <input
        type="text"
        bind:value={functienaam}
        placeholder="Functienaam (optioneel)"
      />
    </label>

    <label>
      Geboortedatum:
      <input type="date" bind:value={geboortedatum} />
    </label>

    <label>
      Notities:
      <textarea bind:value={notities} placeholder="Notities (optioneel)"
      ></textarea>
    </label>

    <label>
      E-mail adres:
      <input type="email" bind:value={email} placeholder="E-mail adres" />
    </label>

    <label>
      Telefoonnummer:
      <input
        type="tel"
        bind:value={telefoonnummer}
        placeholder="Telefoonnummer"
      />
    </label>

    <label>
      Adres:
      <input type="text" bind:value={adres} placeholder="Adres" />
    </label>

    <label>
      Website:
      <input
        type="url"
        bind:value={website}
        placeholder="Website (optioneel)"
      />
    </label>

    <button type="submit" disabled={$submitting}>Contact toevoegen</button>
  </form>
</main>

<style lang="scss">
</style>
