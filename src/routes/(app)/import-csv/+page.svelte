<script>
  import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    arrayUnion,
    Timestamp,
    writeBatch,
    collection,
  } from "firebase/firestore";
  import { db } from "$lib/firebase";
  import Papa from "papaparse";

  let csvInput =
    "Dossiernaam,Datum,Omschrijving,Min,Uur,Totaal,Billable,Uitvoerder,Locatie,KM,Gefactureerd,Opmerking,ID,WMS App"; // Variable to bind to the textarea input
  let isSubmitting = false;
  let importError = null;

  let allClients = [];

  // Function to fetch all clients
  async function fetchAllClients() {
    const workspace = localStorage.getItem("workspace");
    if (!workspace) {
      throw new Error("Workspace not found");
    }
    const clientsRef = collection(db, `workspaces/${workspace}/clients`);
    const querySnapshot = await getDocs(clientsRef);
    allClients = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  }

  // Function to find client ID by name
  function findClientIdByName(name) {
    const trimmedName = name.trim().toLowerCase();

    for (const client of allClients) {
      const clientNameParts = [
        client.voornaam?.trim(),
        client.tussenvoegsels?.trim(),
        client.achternaam?.trim(),
      ]
        .filter((part) => part)
        .join(" ")
        .toLowerCase();

      if (trimmedName.includes(clientNameParts)) {
        return client.id;
      }
    }

    return "";
  }

  // Function to process the parsed CSV data
  async function processCSVData(parsedData) {
    const timetrackingByFileId = {};

    for (const record of parsedData) {
      // Check for WMS App field and skip if true
      if (
        record["WMS App"] &&
        record["WMS App"].trim().toLowerCase() === "true"
      ) {
        continue; // Skip this record
      }

      const dossierID = record["Dossiernaam"].split(".")[0].trim();
      const dossierName = record["Dossiernaam"].split(". ")[1].trim();
      const dossierLabel = `${dossierID} - ${dossierName}`;

      // Convert the date to Firebase timestamp
      const dateParts = record["Datum"].split("-");
      const date = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`);
      const timestamp = Timestamp.fromDate(date);

      const newTimetracking = {
        t_id: record["ID"],
        dossierId: {
          id: dossierID,
          label: dossierLabel,
          name: dossierName,
        },
        date: timestamp,
        description: record["Omschrijving"],
        minutes:
          parseInt(record["Min"] || 0) + parseInt(record["Uur"] || 0) * 60,
        billable: record["Billable"] === "Ja",
        assignee: record["Uitvoerder"] || "Toon",
        isExternal: Boolean(record["Locatie"] || record["KM"]),
        location: record["Locatie"] || "",
        kilometers: record["KM"] ? parseInt(record["KM"]) : "",
        invoiced: record["Gefactureerd"] === "Ja",
      };

      if (!timetrackingByFileId[dossierID]) {
        timetrackingByFileId[dossierID] = [];
      }
      timetrackingByFileId[dossierID].push(newTimetracking);
    }

    // Batch processing
    const batch = writeBatch(db);

    for (const [fileId, timetrackingItems] of Object.entries(
      timetrackingByFileId
    )) {
      const workspace = localStorage.getItem("workspace");
      if (!workspace) {
        alert("workspace not found");
        return;
      }
      const fileRef = doc(db, `workspaces/${workspace}/files`, fileId);
      const fileSnapshot = await getDoc(fileRef);

      if (fileSnapshot.exists()) {
        console.log("EXISTING | processing file: ", fileId);
        const fileData = fileSnapshot.data();
        const existingTimetracking = fileData.timetracking || [];

        // Process each new timetracking item
        const updatedTimetracking = [];
        const existingIds = new Set(
          existingTimetracking.map((item) => item.t_id)
        );

        for (const item of timetrackingItems) {
          const existingIndex = existingTimetracking.findIndex(
            (existingItem) => existingItem.t_id === item.t_id
          );
          if (existingIndex >= 0) {
            existingTimetracking[existingIndex] = item;
          } else {
            existingTimetracking.push(item);
          }
        }

        // Update the document with the new timetracking array
        batch.update(fileRef, { timetracking: existingTimetracking });
      } else {
        console.warn("NEW | processing file: ", fileId);
        // If document doesn't exist, create it with the timetracking array
        // Fetch client ID
        const clientName = timetrackingItems[0].dossierId.name;
        const clientId = await findClientIdByName(
          timetrackingItems[0].dossierId.name
        );

        console.log({
          timetracking: timetrackingItems,
          name: clientName,
          client_id: { id: clientId },
        });
        // return;
        batch.set(fileRef, {
          timetracking: timetrackingItems,
          name: clientName,
          dossierstatus: "Controleren",
          client_id: { id: clientId },
        });
      }
    }

    // Commit the batch
    await batch.commit();
  }

  // Function to handle the form submission
  async function handleSubmit(event) {
    event.preventDefault();
    isSubmitting = true;

    await fetchAllClients(); // Fetch clients before processing CSV

    // Parse the CSV data using PapaParse
    Papa.parse(csvInput, {
      header: true, // Use the first row as headers
      skipEmptyLines: true, // Skip empty lines
      complete: async function (results) {
        try {
          // Process the parsed CSV data
          await processCSVData(results.data);
          alert("CSV data successfully imported!");
        } catch (error) {
          console.error("Error importing CSV:", error);
          alert("Failed to import CSV data");
        } finally {
          isSubmitting = false;
        }
      },
      error: function (error) {
        console.error("Error parsing CSV:", error);
        alert("Failed to parse CSV data");
        isSubmitting = false;
      },
    });
  }
</script>

<div class="form-container">
  <form on:submit={handleSubmit}>
    <label for="csvInput"
      >Plak de CSV data hier. Vergeet niet om de header row te kopiëren</label
    >
    <textarea bind:value={csvInput} id="csvInput" placeholder="Plak de csv hier"
    ></textarea>
    <button type="submit" disabled={isSubmitting}>Verzenden</button>
  </form>
</div>

<style>
  .form-container {
    /* max-width: 600px; */
    width: 100%;
    margin: 0 auto;
    padding: 2rem;
  }
  label {
    margin-bottom: 15px;
    display: block;
  }
  textarea {
    width: 100%;
    height: 60vh;
    padding: 1rem;
    border-radius: 5px;
    border: 1px solid #ccc;
  }
</style>
