<script>
  import { page } from "$app/stores"; // Import the page store from SvelteKit
  import { db } from "$lib/firebase";
  import {
    collection,
    doc,
    addDoc,
    setDoc,
    getDoc,
    deleteDoc,
    getDocs,
    query,
    Timestamp,
    where,
  } from "firebase/firestore";
  import { onMount } from "svelte";
  import { writable, get, derived } from "svelte/store";
  import Select from "svelte-select";
  import { X, TrashSimple, Plus, Clock, ArrowSquareOut } from "phosphor-svelte";
  import { format } from "date-fns";
  import Tabs from "$lib/components/Tabs.svelte";
  import { dbTracker } from "$lib/utils/dbTracker";
  import Log from "$lib/components/Log.svelte";
  import { debounce } from "$lib/utils/debounce.js";
  import { browser } from "$app/environment";
  const pageName = "Files";

  let html2pdf;

  $: console.log("isEdited: ", isEdited);

  if (typeof window !== "undefined") {
    // Import html2pdf.js only in a browser environment
    import("html2pdf.js").then((module) => {
      html2pdf = module.default;
    });
  }
  // Initialize writable store for currentFile
  let currentFile = writable({
    client_id: "",
    dossierstatus: "Actief",
    name: "",
    opvolgdatum: "",
    uurtarief: 250,
    projectkosten: 0,
    administratiestatus: "Afwachten",
    administratieafspraak: "",
    gekoppelde_facturen: "",
    fileId: "",
    timetracking: false,
    log: [],
    contacts: [],
  });
  let isEdited = false;
  let isExitIntent = false;
  let searchEl = "";

  const specs = derived(currentFile, ($currentFile) => {
    const rate = $currentFile.uurtarief || 250;
    const taxRate = 0.21;
    const kmRate = 0.4;

    // Ensure timetracking is an array before reducing
    const timetracking = Array.isArray($currentFile.timetracking)
      ? $currentFile.timetracking
      : [];

    // Calculate total minutes
    const totalMinutes = timetracking.reduce(
      (acc, entry) => acc + entry.minutes,
      0
    );

    // Convert total minutes to hours
    const hours = totalMinutes / 60;

    // Calculate total cost (billable hours * hourly rate)
    const subtotal = hours * rate;

    // Calculate total kilometers
    const km = timetracking.reduce(
      (acc, entry) =>
        acc + (entry.kilometers ? parseFloat(entry.kilometers) : 0),
      0
    );

    // Calculate mileage allowance
    const mileageAllowance = km * kmRate;

    // Calculate tax and total including tax
    const tax = subtotal * taxRate;
    const total = subtotal + mileageAllowance;

    return {
      hours,
      minutes: totalMinutes, // Ensure minutes is defined
      rate,
      subtotal,
      km,
      kmRate,
      mileageAllowance,
      total,
      tax,
      taxRate,
      totalTax: total + tax,
    };
  });

  $: {
    if (specs) {
      console.log(specs);
    }
  }

  let proposedFileId;

  let clients = [];

  let tasks = writable([]);
  let activeTab = "";

  let taskStatuses = writable([]);

  let submitting = writable(false);
  let errorMessage = writable("");
  let successMessage = writable("");
  let files = writable([]);
  let searchQuery = writable("");
  let filteredFiles = derived(
    [files, searchQuery],
    ([$files, $searchQuery]) => {
      const query = $searchQuery.toLowerCase().trim();
      return $files.filter((file) => {
        return (
          file.id.toLowerCase().includes(query) ||
          file.name.toLowerCase().includes(query) ||
          (file.dossierstatus &&
            file.dossierstatus.toLowerCase().includes(query)) ||
          (file.administratiestatus &&
            file.administratiestatus.toLowerCase().includes(query)) ||
          clients
            .find((client) => client.id === file.client_id)
            ?.label.toLowerCase()
            .includes(query)
        );
      });
    }
  );
  let dialogEl = "";
  let dialogElEventsAdded = false;
  const resultCount = derived(
    filteredFiles,
    ($filteredFiles) => $filteredFiles.length
  );
  $: {
    if (dialogEl && !dialogElEventsAdded) {
      dialogEl.addEventListener("close", (event) => {
        event.preventDefault();
        document.querySelector(".tabs .tab:first-child")?.click();
        const url = new URL(window.location);
        url.searchParams.delete("id");
        window.history.replaceState({}, "", url);
        isEdited = false;
        isExitIntent = false;
      });
      dialogEl.addEventListener("click", function (event) {
        const rect = dialogEl.getBoundingClientRect();
        const isInDialog =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (!isInDialog) {
          if (
            !isEdited ||
            isExitIntent ||
            confirm(
              "Weet je zeker dat je dit dossier wilt sluiten? De wijzigingen zijn nog niet opgeslagen."
            )
          ) {
            isEdited = false;
            dialogEl.close();
          }
        }
      });

      dialogElEventsAdded = true;
    }
  }

  onMount(async () => {
    // Initialize the page tracking
    dbTracker.initPage(pageName);

    // Fetch clients
    const clientsRef = collection(
      db,
      "workspaces",
      localStorage.getItem("workspace"),
      "clients"
    );
    const clientSnapshots = await getDocs(clientsRef);

    // Create a map of client data keyed by client ID
    const clientsMap = new Map();
    clientSnapshots.docs.forEach((doc) => {
      const data = doc.data();
      clientsMap.set(doc.id, {
        id: doc.id,
        voornaam: data.voornaam || "",
        achternaam: data.achternaam || "",
        tussenvoegsels: data.tussenvoegsels || "",
        label:
          `${data.voornaam || ""} ${data.tussenvoegsels || ""} ${data.achternaam || ""} ${data.bedrijfsnaam ? `(${data.bedrijfsnaam})` : ""}`.trim(),
        filterText: "",
      });
    });

    // Update the clients reactive variable
    clients = Array.from(clientsMap.values());

    // Track the read operation for clients
    dbTracker.trackRead(pageName, clientSnapshots.docs.length);

    // Fetch files
    const filesRef = collection(
      db,
      "workspaces",
      localStorage.getItem("workspace"),
      "files"
    );
    const filesSnapshots = await getDocs(filesRef);

    // Process files and add corresponding client data
    const processedFiles = filesSnapshots.docs
      .filter((doc) => doc.id !== "0000")
      .map((doc) => {
        const fileData = doc.data();
        const clientData = clientsMap.get(fileData.client_id?.id);

        // Add client data to the file object
        return {
          id: doc.id,
          ...fileData,
          client_id: {
            ...fileData.client_id,
            voornaam: clientData?.voornaam || "",
            tussenvoegsels: clientData?.tussenvoegsels || "",
            achternaam: clientData?.achternaam || "",
          },
        };
      });

    // Update the files reactive variable
    files.set(processedFiles);

    // Calculate and set the proposed file ID
    const lastFileId = filesSnapshots.docs.reduce(
      (max, doc) => Math.max(max, parseInt(doc.id)),
      0
    );
    proposedFileId = (lastFileId + 1).toString().padStart(4, "0");

    // Update the current file reactive variable
    currentFile.set({
      fileId: (lastFileId + 1).toString().padStart(4, "0"),
    });

    // Track the read operation for files
    dbTracker.trackRead(pageName, filesSnapshots.docs.length);

    // Reactive statement to watch for URL parameter changes
    const id = $page.url.searchParams.get("id");
    if (id && browser) {
      openModal(id.toString());
    }

    window.addEventListener("keydown", handleShortcut);
    return () => {
      window.removeEventListener("keydown", handleShortcut);
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

  function handleTabChange(event) {
    const { tabLabel } = event.detail;
    activeTab = tabLabel;
    if (tabLabel === "Taken") {
      fetchTasks();
    }
  }

  async function fetchTaskStatuses() {
    const workspaceRef = doc(
      db,
      "workspaces",
      localStorage.getItem("workspace")
    );
    const workspaceSnap = await getDoc(workspaceRef);
    const workspaceData = workspaceSnap.data();

    // Assumes statuses are stored in a field named "taskStatuses" which is an array
    const statuses = workspaceData.taskStatuses || [];
    taskStatuses.set(statuses);
    return statuses;
  }

  async function fetchTasks() {
    if ($taskStatuses.length == 0) {
      await fetchTaskStatuses();
    }
    try {
      const tasksRef = collection(
        db,
        "workspaces",
        localStorage.getItem("workspace"),
        "tasks"
      );
      const q = query(tasksRef, where("file_id.id", "==", $currentFile.fileId));
      const querySnapshot = await getDocs(q);
      const fetchedTasks = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Combine mapping and grouping in one step
      const groupedTasks = fetchedTasks.reduce((acc, task) => {
        const statusName = $taskStatuses.find(
          (status) => status.id === task.status_id
        )?.name;

        if (statusName) {
          acc[statusName] = acc[statusName] || [];
          acc[statusName].push(task);
        }
        return acc;
      }, {});

      tasks.set(groupedTasks);

      // Store the grouped tasks in a writable store or process as needed
      tasks.set(groupedTasks);
      console.log(groupedTasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  }

  function handleFilter(e, filterText) {
    if (e.detail.length === 0 && filterText.length > 0) {
      filterText = filterText.toLowerCase().trim();
      // Check if the input matches any existing client
      const existingClient = clients.some(
        (client) => client.label.toLowerCase() === filterText
      );

      // If the filter text is not empty and no match is found, add the new item
      if (filterText.length > 0 && !existingClient) {
        // Add a new "Custom: [input]" option to the list
        clients = [
          ...clients.filter((client) => !client.created),
          {
            id: Math.random().toString(36).substr(2, 9), // Identifiable ID for custom entries
            label: `${filterText.charAt(0).toUpperCase() + filterText.slice(1)}`,
            created: true,
          },
        ];
        console.log("Custom contact added:", clients);
      }
    }
  }

  // Create a debounced version of handleFilter
  const debouncedHandleFilter = debounce(
    (e, filterText) => handleFilter(e, filterText),
    400
  ); // 400ms delay

  // Bind the debounced function to the filter event
  function onFilter(e, filterText) {
    debouncedHandleFilter(e, filterText);
  }

  function handleChange(e, index) {
    const selectedValue = e.detail ? e.detail.label : null;
    const selectedId = e.detail ? e.detail.id : null;

    let updatedContact = {
      ...$currentFile.contacts[index], // Ensure a new instance
      id: selectedId,
      name: selectedValue || "",
    };

    // if (selectedId === "custom") {
    //   const customName = selectedValue.replace("Custom: ", "");
    //   updatedContact = {
    //     id: Math.random().toString(36).substr(2, 9), // Generate a unique ID
    //     label: customName,
    //     role: $currentFile.contacts[index].role || "",
    //   };
    // }

    $currentFile.contacts = [
      ...$currentFile.contacts.slice(0, index),
      updatedContact,
      ...$currentFile.contacts.slice(index + 1),
    ];

    console.log("Contact updated:", $currentFile.contacts[index]);
  }

  function handleClear(e, index) {
    // Prevent contact from being undefined
    console.log("handle clear");

    $currentFile.contacts[index] = {
      id: null,
      name: "",
      role: "",
    };

    // Ensure the reactive update works
    $currentFile.contacts = [...$currentFile.contacts];
  }

  function addContact() {
    const newContact = {
      id: null, // Use null to indicate no selection
      name: "", // Use null to indicate no selection
      role: "",
      filterText: "",
    };

    console.log("Adding new contact:", newContact);

    const currentContacts =
      $currentFile.contacts && $currentFile.contacts.length > 0
        ? $currentFile.contacts
        : [];

    $currentFile.contacts = [...currentContacts, newContact];

    console.log("Updated contacts:", $currentFile.contacts);
    isEdited = true;
  }

  // Remove a contact row by index
  function removeContact(index) {
    if (!confirm("Weet je zeker dat je dit contact wilt verwijderen?")) return;
    $currentFile.contacts = $currentFile.contacts.filter((_, i) => i !== index);
  }

  function handleRoleChange(event, index) {
    const updatedRole = event.target.value;

    const updatedContact = {
      ...$currentFile.contacts[index], // Ensure a new instance
      role: updatedRole,
    };

    $currentFile.contacts = [
      ...$currentFile.contacts.slice(0, index),
      updatedContact,
      ...$currentFile.contacts.slice(index + 1),
    ];
  }

  async function handleSubmit(event) {
    // Prevent form submission
    event.preventDefault();

    // Find the clicked button
    const button = event.submitter; // This gives the clicked submit button

    const action = button.dataset.action;

    if (action === "edit") {
      console.log("Editing existing document:", $currentFile);
      // Add your update logic here
    } else if (action === "create") {
      console.log("Creating new document:", $currentFile);
      // Add your creation logic here
    }

    const fileIdString = String($currentFile.fileId).padStart(4, "0");

    console.log(fileIdString);

    // Transform contacts to remove filterText and ensure id is a string
    const transformedContacts = Array.isArray($currentFile.contacts)
      ? $currentFile.contacts.map((contact) => ({
          name:
            contact.name &&
            typeof contact.name === "object" &&
            contact.name !== null
              ? contact.name.label || "" // Default to empty string if name is undefined
              : contact.name || "", // Default to empty string if name is undefined or not an object
          role: contact.role || "", // Default to empty string if role is undefined
          id:
            contact.id && typeof contact.id === "object" && contact.id !== null
              ? contact.id.id || "" // Default to empty string if id is undefined
              : contact.id || "", // Default to empty string if id is undefined or not an object
        }))
      : [];

    console.log("$currentFile.contacts", $currentFile.contacts);
    // Extract current file data
    const fileData = {
      ...$currentFile,
      contacts: transformedContacts,
      client_id: { id: $currentFile.client_id?.id || $currentFile.client_id },
    };

    console.log("fileData.contacts", fileData.contacts);

    if (!fileData.fileId || !fileData.client_id || !fileData.name) {
      errorMessage.set("Vul alle verplichte velden in.");
      return;
    }

    submitting.set(true);
    errorMessage.set("");
    successMessage.set("");

    try {
      const filesRef = collection(
        db,
        "workspaces",
        localStorage.getItem("workspace"),
        "files"
      );

      let timetracking = [];

      // Check if file already exists when creating
      if (action === "create") {
        const existingFileQuery = query(
          filesRef,
          where("__name__", "==", fileIdString)
        );
        const existingFileSnap = await getDocs(existingFileQuery);

        if (!existingFileSnap.empty) {
          errorMessage.set("Dossiernummer bestaat al. Kies een ander nummer.");
          submitting.set(false);
          return;
        }
      } else if (action === "edit") {
        const fileDocRef = doc(filesRef, fileIdString);
        const fileDocSnap = await getDoc(fileDocRef);
        if (fileDocSnap.exists()) {
          timetracking = fileDocSnap.data().timetracking || [];
        }
      }

      const opvolgdatumTimestamp = fileData.opvolgdatum
        ? Timestamp.fromDate(new Date(fileData.opvolgdatum))
        : null;

      const active =
        fileData.dossierstatus !== "Afgewikkeld" &&
        fileData.dossierstatus !== "Inactief";

      const fileDocRef = doc(filesRef, fileIdString);

      let existingFileData = {};
      if (action === "edit") {
        const fileDocSnap = await getDoc(fileDocRef);
        if (fileDocSnap.exists()) {
          existingFileData = fileDocSnap.data();
        }
      }

      // Merge the existing data with the new data
      const updatedFileData = {
        ...fileData,
        timetracking, // Ensure timetracking is set
        opvolgdatum: fileData.opvolgdatum
          ? Timestamp.fromDate(new Date(fileData.opvolgdatum))
          : null,
        gekoppelde_facturen:
          typeof fileData.gekoppelde_facturen === "string"
            ? fileData.gekoppelde_facturen.split("\n")
            : Array.isArray(fileData.gekoppelde_facturen)
              ? fileData.gekoppelde_facturen
              : [],
        active,
        updated_at: Timestamp.now(),
        ...(action === "create" && { created_at: Timestamp.now() }),
      };

      // Use setDoc to save the merged data
      await setDoc(fileDocRef, updatedFileData);
      dbTracker.trackWrite(pageName);

      // Update $files store locally
      if (action === "create") {
        files.update((currentFiles) => [
          ...currentFiles,
          { id: fileIdString, ...fileData },
        ]);
      } else if (action === "edit") {
        files.update((currentFiles) =>
          currentFiles.map((file) =>
            file.id === fileIdString ? { id: fileIdString, ...fileData } : file
          )
        );
      }

      errorMessage.set("");
      successMessage.set("");
      resetForm();

      isEdited = false;
      dialogEl.close();
    } catch (error) {
      console.error("Error adding file: ", error);
      errorMessage.set("Er was een fout bij het toevoegen van het dossier.");
    } finally {
      submitting.set(false);
    }
  }

  function resetForm() {
    currentFile.set({
      client_id: "",
      dossierstatus: "Actief",
      name: "",
      opvolgdatum: "",
      uurtarief: 250,
      projectkosten: 0,
      administratiestatus: "Afwachten",
      administratieafspraak: "",
      gekoppelde_facturen: "",
      proposedFileId: proposedFileId,
      fileId: proposedFileId,
      timetracking: false,
      log: [],
      contacts: [],
    });
  }

  function openModal(fileId) {
    // console.log("fileId: ", fileId);
    // console.log("filteredFiles: ", get(filteredFiles));
    const file = fileId
      ? get(filteredFiles).find((f) => f.id === fileId.toString())
      : null;
    // console.log("file: ", file);
    if (file) {
      currentFile.set({
        ...file,
        uurtarief: file.uurtarief || 250,
        fileId: file.id,
        opvolgdatum: file.opvolgdatum
          ? format(
              file.opvolgdatum instanceof Timestamp
                ? file.opvolgdatum.toDate()
                : file.opvolgdatum,
              "yyyy-MM-dd"
            )
          : "",
      });

      const url = new URL(window.location);
      if (
        !url.searchParams.get("id") ||
        url.searchParams.get("id") !== fileId
      ) {
        url.searchParams.set("id", $currentFile.id);
        window.history.replaceState({}, "", url);
      }

      console.log("Modal opened with file:", $currentFile);
    } else {
      resetForm();
    }

    tasks.set([]);
    if (activeTab === "Taken") {
      fetchTasks();
    }

    dialogEl.showModal();
  }

  async function deleteFile() {
    const fileToDelete = get(currentFile);
    console.log("Log to delete:", fileToDelete);

    if (!confirm("Weet je zeker dat je dit dossier wilt verwijderen?")) {
      return;
    }

    // Get the reference to the specific dossier document in Firestore
    const dossierRef = doc(
      db,
      "workspaces",
      localStorage.getItem("workspace"),
      "files",
      fileToDelete.id // Access the id property of dossierId
    );

    try {
      // Fetch the dossier document to retrieve the existing timetracking array
      const docSnap = await deleteDoc(dossierRef);

      // Update $files store locally
      files.update((currentFiles) =>
        currentFiles.filter((file) => file.id !== fileToDelete.id)
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

  function calculateRevenue(log) {
    const min = parseFloat(log.minutes) || 0;
    const totaalUren = min / 60;
    const revenue = log.billable ? (totaalUren * 250).toFixed(2) : "0.00";
    return revenue;
  }
  function formatMinutesToHHMM(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(1, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  function generatePDF(specs) {
    if (!html2pdf) {
      console.error("html2pdf is not loaded yet");
      return; // Exit if html2pdf is not loaded
    }

    // Create a container for the PDF content
    const pdfContent = document.querySelector(".spec");

    // Generate the PDF
    const options = {
      margin: 0.5, // Adjust as needed
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: {
        unit: "in",
        format: "letter",
        orientation: "portrait",
        compress: true,
      },
    };

    html2pdf()
      .from(pdfContent)
      .set(options)
      .outputPdf("blob")
      .then((blob) => {
        // Create a URL for the blob
        const pdfUrl = URL.createObjectURL(blob);

        // Open the PDF in a new tab for preview
        const previewWindow = window.open(pdfUrl, "_blank");

        // Optionally, you can add a button to allow the user to save the PDF from the preview window
        if (previewWindow) {
          previewWindow.focus();
        } else {
          alert("Please allow popups for this website to preview the PDF.");
        }
      });
  }

  function formatToEuro(amount) {
    return new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  }

  function formatDate(timestamp) {
    if (!timestamp || !timestamp.seconds) return "";

    // Convert seconds to milliseconds and create a Date object
    const date = new Date(timestamp.seconds * 1000);

    // Extract day, month, year
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    // Return formatted date in dd-mm-yyyy format
    return `${day}-${month}-${year}`;
  }
</script>

<main>
  <dialog id="addDossier" bind:this={dialogEl}>
    {#if $currentFile.id}
      <div class="top">
        <h6>Dossier bewerken</h6>
        <button
          class="basic"
          on:click={() => {
            isExitIntent = true;
            if (
              !isEdited ||
              confirm(
                "Weet je zeker dat je dit dossier wilt sluiten? De wijzigingen zijn nog niet opgeslagen."
              )
            ) {
              dialogEl.close();
            }
          }}><X size="16" /></button
        >
      </div>
    {:else}
      <div class="top">
        <h6>Dossier toevoegen</h6>
        <button
          class="basic"
          on:click={() => {
            isExitIntent = true;
            if (
              !isEdited ||
              confirm(
                "Weet je zeker dat je dit dossier wilt sluiten? De wijzigingen zijn nog niet opgeslagen."
              )
            ) {
              dialogEl.close();
            }
          }}><X size="16" /></button
        >
      </div>
    {/if}
    <form
      on:submit|preventDefault={handleSubmit}
      on:input={() => (isEdited = true)}
    >
      <Tabs
        tabs={[
          { label: "Algemeen" },
          { label: "Contacten" },
          { label: "Taken" },
          { label: "Tijdregistratie" },
          { label: "Specificatie" },
          { label: "Logboek" },
        ]}
        on:tabChange={handleTabChange}
      >
        <div slot="tab-0">
          <!-- Algemeen -->
          <label>
            {#if $currentFile.id}
              <span class="legend">Dossiernummer</span>
              <input
                type="number"
                bind:value={$currentFile.fileId}
                placeholder="Dossiernummer"
                disabled
              />
            {:else}
              <span class="legend"
                >Dossiernummer (Voorstel: {$currentFile.proposedFileId})</span
              >
              <input
                type="number"
                bind:value={$currentFile.fileId}
                placeholder="Dossiernummer"
              />
            {/if}
          </label>

          <label>
            <span class="legend">Dossiernaam</span>
            <input
              type="text"
              bind:value={$currentFile.name}
              placeholder="Dossiernaam"
            />
          </label>

          <div class="modal_columns">
            <label>
              <span class="legend">Dossierstatus</span>
              <select bind:value={$currentFile.dossierstatus}>
                <option value="Actief">Actief</option>
                <option value="Controleren">Controleren</option>
                <option value="Inactief">Inactief</option>
              </select>
            </label>
            <label>
              <span class="legend">Opvolgdatum</span>
              <input type="date" bind:value={$currentFile.opvolgdatum} />
            </label>
            <label>
              <span class="legend">Uurtarief</span>
              <input
                type="number"
                bind:value={$currentFile.uurtarief}
                placeholder="Uurtarief"
              />
            </label>

            <label>
              <span class="legend">Projectkosten</span>
              <input
                type="number"
                bind:value={$currentFile.projectkosten}
                placeholder="Projectkosten"
              />
            </label>
          </div>

          <label>
            <span class="legend">Administratiestatus</span>
            <select bind:value={$currentFile.administratiestatus}>
              <option value="Betaald">Betaald</option>
              <option value="Factureren">Factureren</option>
              <option value="Controleren">Controleren</option>
              <option value="Gefactureerd">Gefactureerd</option>
              <option value="Openstaand">Openstaand</option>
              <option value="Onder handen">Onder handen</option>
              <option value="Betwist">Betwist</option>
              <option value="Pro bono">Pro bono</option>
            </select>
          </label>

          <label>
            <span class="legend">Administratieafspraak</span>
            <textarea
              bind:value={$currentFile.administratieafspraak}
              placeholder="Administratieafspraak"
            ></textarea>
          </label>

          <label>
            <span class="legend">Gekoppelde facturen</span>
            <textarea
              bind:value={$currentFile.gekoppelde_facturen}
              placeholder="Gekoppelde facturen (elke factuur op een nieuwe regel)"
            ></textarea>
          </label>
        </div>

        <div slot="tab-1">
          <label>
            <span class="legend">Cliënt/contactpersoon</span>
            <Select
              items={clients}
              bind:value={$currentFile.client_id}
              getOptionValue={(option) => option.id}
              getOptionLabel={(option) => option.label}
              placeholder="Zoek een contact"
              itemId="id"
              clearable={false}
            />
          </label>
          <div class="contact-list">
            <span class="legend">Overige contacten</span>
            {#if $currentFile.contacts && $currentFile.contacts.length > 0}
              {#each $currentFile.contacts as contact, index}
                {#if contact}
                  <div class="contact-row">
                    <label>
                      {#if contact.id}
                        <Select
                          items={clients}
                          bind:value={contact.name}
                          name="contact_input_{index}"
                          placeholder="Selecteer of typ een contact"
                          itemId="label"
                          clearable={true}
                          on:change={(e) => handleChange(e, index)}
                          on:clear={(e) => handleClear(e, index)}
                          on:filter={(e) => onFilter(e, contact.filterText)}
                          bind:filterText={contact.filterText}
                          clearFilterTextOnBlur={false}
                          ><div slot="item" let:item>
                            {item.label}
                          </div></Select
                        >
                      {:else}
                        <Select
                          items={clients}
                          name="contact_input_{index}"
                          placeholder="Selecteer of typ een contact"
                          itemId="id"
                          clearable={true}
                          on:change={(e) => handleChange(e, index)}
                          on:clear={(e) => handleClear(e, index)}
                          on:filter={(e) => onFilter(e, contact.filterText)}
                          bind:filterText={contact.filterText}
                          clearFilterTextOnBlur={false}
                          ><div slot="item" let:item>
                            {item.label}
                          </div></Select
                        >
                      {/if}
                    </label>
                    <label class="input_wrapper">
                      <input
                        type="text"
                        name="{$currentFile.id}_role_input_{index}"
                        bind:value={contact.role}
                        placeholder="&nbsp;"
                        on:input={(e) => handleRoleChange(e, index)}
                      />
                      <span>Rol</span>
                    </label>
                    {#if $currentFile.contacts.length > 1}
                      <button
                        type="button"
                        class="basic"
                        on:click={() => removeContact(index)}
                        ><TrashSimple size="16" /></button
                      >
                    {/if}
                  </div>
                {/if}
              {/each}
            {/if}

            <button type="button" class="basic" on:click={addContact}
              ><Plus size="16" />Contact toevoegen</button
            >
          </div>
        </div>

        <div slot="tab-2">
          {#if Object.keys($tasks).length > 0}
            <!-- Render grouped tasks by status -->
            {#each Object.entries($tasks) as [statusLabel, tasks]}
              <div data-status={statusLabel}>
                <span class="legend">{statusLabel}</span>
                <!-- Display the status label -->
                <ul class="file_tasks">
                  {#each tasks as task}
                    <li
                      on:click={() => {
                        window.open(`/tasks?id=${task.id}`, "_blank");
                      }}
                    >
                      <div>
                        <h6>{task.title}</h6>
                        <span
                          ><Clock size="18" />{format(
                            task.deadline.toDate(),
                            "dd-MM-yyyy"
                          )}</span
                        >
                      </div>
                      <ArrowSquareOut color={"var(--gray-400)"} size={18} />
                    </li>
                    <!-- Display each task's description -->
                  {/each}
                </ul>
              </div>
            {/each}
          {:else}
            <p>Geen taken aan dit dossier gekoppeld.</p>
          {/if}
        </div>

        <div slot="tab-3">
          <!-- Tijdregistratie -->
          {#if $currentFile.timetracking && $currentFile.timetracking.length > 0}
            <ul class="file_tasks file_logs">
              {#each $currentFile.timetracking as log}
                <li>
                  <div class="log-header">
                    <h6>{log.description}</h6>
                    <div class="total-revenue">
                      <span>{formatMinutesToHHMM(log.minutes)}</span>
                      <span class="total-revenue-single"
                        >(€{calculateRevenue(log)})</span
                      >
                    </div>
                  </div>
                  {#if log.billable}
                    <span class="billable-icon">€</span>
                  {/if}
                  <p class="date">
                    {format(
                      log.date instanceof Date ? log.date : log.date.toDate(),
                      "dd-MM-yyyy"
                    )}
                  </p>
                </li>
              {/each}
            </ul>
          {:else}
            <p>Geen tijdregistratie gevonden.</p>
          {/if}
        </div>

        <div slot="tab-4">
          {#if $specs && $specs.minutes > 0}
            <div class="spec">
              <div class="spec_top">
                <div>
                  <h6>Specificatie factuur</h6>
                  <p>{$currentFile.id}. {$currentFile.name}</p>
                  <p>{new Date().toLocaleDateString()}</p>
                </div>
                <img
                  class="logo"
                  width="100px"
                  height="auto"
                  src="/img/wms-logo.png"
                  alt="WMS logo"
                />
              </div>
              <table class="timetracking">
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Omschrijving</th>
                    <th>Totaal</th>
                    <th>Plaats</th>
                    <th>km</th>
                  </tr>
                </thead>
                <tbody>
                  {#each $currentFile.timetracking as item}
                    <tr>
                      <td>{formatDate(item.date)}</td>
                      <td>{item.description || ""}</td>
                      <td
                        >{item.minutes
                          ? formatMinutesToHHMM(item.minutes)
                          : "0,00"}</td
                      >
                      <td>{item.location || ""}</td>
                      <td>{item.kilometers || ""}</td>
                    </tr>
                  {/each}
                  <tr class="totals">
                    <td></td>
                    <td>Subtotaal</td>
                    <td>{formatMinutesToHHMM($specs.minutes)}</td>
                    <td></td>
                    <td
                      >{$currentFile.timetracking.reduce((sum, item) => {
                        const kmValue = parseFloat(item.kilometers) || 0; // Convert to number, use 0 if empty or NaN
                        return sum + kmValue;
                      }, 0)}</td
                    >
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td></td>
                    <td class="align_right">Uren conform specificatie</td>
                    <td>{formatMinutesToHHMM($specs.minutes)}</td>
                    <td>uur</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td></td>
                    <td class="align_right">Uurtarief</td>
                    <td>{formatToEuro($specs.rate)}</td>
                    <td>x</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td></td>
                    <td class="align_right">Subtotaal</td>
                    <td class="border">{formatToEuro($specs.subtotal)}</td>
                    <td class="border">Exclusief BTW</td>
                    <td></td>
                  </tr>
                  {#if $specs.km > 0}
                    <tr>
                      <td></td>
                      <td class="align_right"
                        >Kilometervergoeding (a {formatToEuro(
                          $specs.kmRate
                        )})</td
                      >
                      <td>{formatToEuro($specs.mileageAllowance)}</td>
                      <td>Exclusief BTW</td>
                      <td></td>
                    </tr>
                  {/if}
                  <tr>
                    <td></td>
                    <td class="align_right">Totaal</td>
                    <td class="border">{formatToEuro($specs.total)}</td>
                    <td class="border">Exclusief BTW</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td></td>
                    <td class="align_right">BTW ({$specs.taxRate * 100}%)</td>
                    <td>{formatToEuro($specs.tax)}</td>
                    <td>+</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td></td>
                    <td class="align_right">Totaal</td>
                    <td class="border">{formatToEuro($specs.totalTax)}</td>
                    <td class="border">Inclusief BTW</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
              <!-- Facturatie
                <table class="specs">
                  <tbody>
                    <tr>
                      <td>Uren conform specificatie</td>
                      <td>{formatMinutesToHHMM($specs.minutes)}</td>
                      <td>uur</td>
                    </tr>
                    <tr>
                      <td>Uurtarief</td>
                      <td>{formatToEuro($specs.rate)}</td>
                      <td>x</td>
                    </tr>
                    <tr>
                      <td>Subtotaal</td>
                      <td class="border">{formatToEuro($specs.subtotal)}</td>
                      <td class="border">Exclusief BTW</td>
                    </tr>
                    {#if $specs.km > 0}
                      <tr>
                        <td
                          >Kilometervergoeding (a {formatToEuro(
                            $specs.kmRate,
                          )})</td
                        >
                        <td>{formatToEuro($specs.mileageAllowance)}</td>
                        <td>Exclusief BTW</td>
                      </tr>
                    {/if}
                    <tr>
                      <td>Totaal</td>
                      <td class="border">{formatToEuro($specs.total)}</td>
                      <td class="border">Exclusief BTW</td>
                    </tr>
                    <tr>
                      <td>BTW ({$specs.taxRate * 100}%)</td>
                      <td>{formatToEuro($specs.tax)}</td>
                      <td>+</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>Totaal</td>
                      <td class="border">{formatToEuro($specs.totalTax)}</td>
                      <td class="border">Inclusief BTW</td>
                    </tr>
                  </tfoot>
                </table> -->
            </div>
            <button
              type="button"
              class="basic"
              on:click={() => {
                generatePDF($specs);
              }}><ArrowSquareOut size={20} />PDF aanmaken</button
            >
          {:else}
            <p>Geen specificatie beschikbaar</p>
          {/if}
        </div>
        <div slot="tab-5">
          <Log bind:logItems={$currentFile.log} />
        </div>
      </Tabs>

      {#if $errorMessage}
        <p style="color: red;">{$errorMessage}</p>
      {/if}

      {#if $successMessage}
        <p style="color: green;">{$successMessage}</p>
      {/if}

      <div class="buttons">
        {#if $currentFile.id}
          <button type="button" class="basic" on:click={deleteFile}
            ><TrashSimple size="16" /></button
          >
          <div>
            <button
              class="basic"
              type="button"
              on:click={() => {
                isExitIntent = true;
                if (
                  !isEdited ||
                  confirm(
                    "Weet je zeker dat je dit dossier wilt sluiten? De wijzigingen zijn nog niet opgeslagen."
                  )
                ) {
                  dialogEl.close();
                }
              }}>Annuleren</button
            >
            <button type="submit" data-action="edit" disabled={$submitting}
              >Opslaan</button
            >
          </div>
        {:else}
          <button type="submit" data-action="create" disabled={$submitting}
            >Dossier toevoegen</button
          >
        {/if}
      </div>
    </form>
  </dialog>

  <section class="files_section">
    <div class="top">
      <div class="module-info">
        <h2>Dossiers</h2>
        <div class="result-count">
          <small>{$resultCount} resultaten</small>
        </div>
      </div>

      <div class="buttons">
        <button class="mobile_icon_only" on:click={() => openModal()}
          ><Plus size={16} />Dossier toevoegen</button
        >
      </div>
    </div>

    <input
      type="text"
      class="search"
      placeholder="Zoek dossiers..."
      bind:this={searchEl}
      bind:value={$searchQuery}
    />
    {#if $filteredFiles.length}
      <table>
        <thead>
          <tr>
            <th>Dossier</th>
            <th>Contact</th>
            <th>Status</th>
            <th class="limit_width">Administratiestatus</th>
            <th class="hide_mobile">Opvolgdatum</th>
          </tr>
        </thead>
        <tbody>
          {#each $filteredFiles as file}
            <tr
              on:click={(event) => {
                // console.log("Clicked", file);
                openModal(file.id);
              }}
            >
              <td class="limit_width">{file.id}. {file.name}</td>
              <td class="limit_width">
                {file.client_id.voornaam
                  ? `${file.client_id.voornaam}` +
                    `${file.client_id.tussenvoegsels ? ` ${file.client_id.tussenvoegsels} ` : " "}` +
                    file.client_id.achternaam
                  : "Onbekend"}
              </td>
              <td class="limit_width"
                ><span class="label" data-status={file.dossierstatus}
                  >{file.dossierstatus}</span
                ></td
              >
              <td class="limit_width"
                ><span class="label" data-status={file.administratiestatus}
                  >{file.administratiestatus}</span
                ></td
              >
              <td class="hide_mobile">
                {#if file.opvolgdatum}
                  {#if file.opvolgdatum instanceof Timestamp}
                    {new Date(
                      file.opvolgdatum.seconds * 1000
                    ).toLocaleDateString()}
                  {:else}
                    {new Date(file.opvolgdatum).toLocaleDateString()}
                  {/if}
                {:else}
                  Geen
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <p>Geen resultaten</p>
    {/if}
  </section>
</main>

<style lang="scss">
  .files_section {
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

      .result-count {
        font-size: 1.4rem;
        color: var(--gray-500);
      }

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
  input.search.search {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%23a8a8a8' viewBox='0 0 256 256'%3E%3Cpath d='M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z'%3E%3C/path%3E%3C/svg%3E");
    background-position: left 15px center;
    background-repeat: no-repeat;
    background-size: 16px;
    padding: 15px 30px 15px 40px;
    margin-bottom: 30px;
  }

  .contact-list {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 15px;

    .legend {
      align-self: flex-start;
      margin-bottom: -10px;
      margin-top: 10px;
    }
  }

  .contact-row {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 10px;
    width: 100%;
    --height: 47px;
    --font-size: 1.4rem;
    .input_wrapper {
      input:not(:is([type="checkbox"], [type="radio"])) {
        width: 100%;
        padding: 20px 15px 8px;
        + span {
          left: 15px;
        }
      }

      &:has(input:focus) > span,
      &:focus-within > span,
      input:not(:placeholder-shown) + span {
        top: 1.4em;
      }
    }
  }

  .contact-row label {
    flex-grow: 1;
  }

  .file_tasks {
    list-style-type: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    li {
      border: 1px solid var(--border);
      padding: 15px;
      border-radius: var(--border-radius);
      font-size: 1.4rem;
      background-color: var(--background);
      cursor: pointer;

      gap: 5px;
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;

      > div:not(.log-header) {
        gap: 5px;
        display: flex;
        flex-direction: column;

        h6 {
          font-size: inherit;
        }
        span {
          display: flex;
          align-items: center;
          gap: 5px;
          color: var(--gray-400);
        }
      }
    }
  }

  .file_logs {
    li {
      cursor: unset;
      position: relative;
      gap: 5px;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      .log-header {
        h2,
        h6 {
          font-size: inherit;
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

    .date {
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

    .disabled {
      color: #ccc;
      cursor: not-allowed;
    }

    .date {
      color: var(--text);
      font-size: 0.8em;
      margin-bottom: 0;
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
  }

  //   .contact-row button {
  //     background: red;
  //     color: white;
  //     border: none;
  //     padding: 5px;
  //     cursor: pointer;
  //   }

  .spec {
    display: flex;
    flex-direction: column;
    .spec_top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      div {
        h6 {
          font-size: 1.6rem;
          font-weight: 500;
          margin-bottom: 0.5em;
        }
        p {
          line-height: 1.2;
          font-size: 1.4rem;
        }
      }
    }
    table.timetracking {
      border: none;
      padding: 0;
      border-radius: 0;
      margin-block: 30px;
      tr {
        height: 30px;
        cursor: unset;
        background-color: transparent;
        &:nth-of-type(even) {
          background-color: #f3f5f9;
        }
        td {
          font-size: 1.3rem;
          padding: 0 10px;
        }
      }
      thead {
        * {
          font-weight: 600;
          text-transform: none;
        }
      }
      thead {
        th {
          background-color: var(--gray-350, #eaedf0);
          border-radius: 0;
          color: var(--gray-600);
          font-size: 1.4rem;
        }
      }
      .totals.totals {
        background-color: transparent;
        td {
          border-top: 1px solid var(--border);
          color: var(--gray-600);
          font-size: 1.4rem;
          font-weight: 600;
          padding-bottom: 30px;
          padding-top: 10px;
        }
      }
      tfoot {
        .align_right {
          text-align: right;
        }
        tr {
          background-color: transparent !important;
          height: 25px;
          td {
            color: var(--gray-800);
            padding-inline: 10px;
            // font-size: 1.3rem;
          }
          .border {
            border-top: 1px solid var(--border);
          }
          td {
            padding-block: 5px;
            border-radius: 0 !important;
          }
          &:first-child td {
            border-top: 1px solid var(--border);
            padding-block: 30px 5px;
          }
          &:last-child td {
            border-bottom: 1px solid var(--border);
            padding-block: 5px 30px;
          }
          td:first-child {
            border-left: 1px solid var(--border);
          }
          td:last-child {
            border-right: 1px solid var(--border);
          }
        }
      }
    }
    table.specs {
      background-color: var(--background-table, #f3f5f9);
      padding: 10px;
      tr {
        height: 30px;
        background-color: transparent;
        cursor: unset;

        td:first-child {
          text-align: right;
        }
        td {
          color: var(--gray-800);
          padding-inline: 10px;
        }
        .border {
          border-top: 1px solid var(--border);
        }
      }
      tfoot {
        td {
          font-weight: 600;
        }
      }
    }
  }
  dialog {
    .spec_top.spec_top,
    table.timetracking thead,
    table.timetracking tbody {
      display: none;
    }
    .spec table.timetracking {
      margin-block: 0;
      background-color: var(--background);

      tr td {
        font-size: 1.4rem;
      }

      tfoot {
        tr {
          &:first-child td {
            padding-block: 20px 5px;
          }
          &:last-child td {
            padding-block: 5px 20px;
          }
        }
      }
    }
  }
</style>
