<script>
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
  import { X, TrashSimple, Plus, Clock } from "phosphor-svelte";
  import { format } from "date-fns";
  import Tabs from "$lib/components/Tabs.svelte";
  import { dbTracker } from "$lib/utils/dbTracker";
  const pageName = "Files";

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
  });

  const specs = derived(currentFile, ($currentFile) => {
    const rate = $currentFile.uurtarief;
    const taxRate = 0.21;
    const kmRate = 0.4;

    // Ensure timetracking is an array before reducing
    const timetracking = Array.isArray($currentFile.timetracking)
      ? $currentFile.timetracking
      : [];

    // Calculate total minutes
    const minutes = timetracking.reduce((acc, entry) => acc + entry.minutes, 0);

    // Convert total minutes to hours
    const hours = minutes / 60;

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
    const total = subtotal + tax;

    return {
      hours,
      minutes,
      rate,
      subtotal,
      km,
      kmRate,
      mileageAllowance,
      total: subtotal + mileageAllowance,
      tax,
      taxRate,
      total: total + mileageAllowance,
    };
  });

  $: console.log("specs", $specs);

  let proposedFileId;

  let clients = [];
  let contacts = [
    { name: "", role: "" }, // Initial contact row
  ];

  let filterText = "";
  let tasks = writable([]);
  let activeTab = "";

  let taskStatuses = writable([]);

  onMount(async () => {
    dbTracker.initPage(pageName);
    const clientsRef = collection(
      db,
      "workspaces",
      localStorage.getItem("workspace"),
      "clients"
    );
    const clientSnapshots = await getDocs(clientsRef);
    clients = clientSnapshots.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        label:
          `${data.voornaam || ""} ${data.tussenvoegsels || ""} ${data.achternaam || ""} ${data.bedrijfsnaam ? `(${data.bedrijfsnaam})` : ""}`.trim(),
        ...data,
      };
    });

    dbTracker.trackRead(pageName, clientSnapshots.docs.length);

    const filesRef = collection(
      db,
      "workspaces",
      localStorage.getItem("workspace"),
      "files"
    );
    const filesSnapshots = await getDocs(filesRef);

    files.set(
      filesSnapshots.docs
        .filter((doc) => doc.id !== "0000")
        .map((doc) => ({ id: doc.id, ...doc.data() }))
    );

    const lastFileId = filesSnapshots.docs.reduce(
      (max, doc) => Math.max(max, parseInt(doc.id)),
      0
    );

    proposedFileId = (lastFileId + 1).toString().padStart(4, "0");

    currentFile.set({
      fileId: (lastFileId + 1).toString().padStart(4, "0"),
    });

    dbTracker.trackRead(pageName, filesSnapshots.docs.length);
  });

  function handleTabChange(event) {
    console.log("handleTabChange", event.detail);
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

  function handleFilter(e) {
    if (e.detail.length === 0 && filterText.length > 0) {
      const prev = clients.filter((i) => !i.created);
      clients = [
        ...prev,
        { value: filterText, label: filterText, created: true },
      ];
    }
  }

  function handleChange(e) {
    clients = clients.map((i) => {
      delete i.created;
      return i;
    });
  }

  // Add a new contact row
  function addContact() {
    contacts = [...contacts, { name: "", role: "" }];
  }

  // Remove a contact row by index
  function removeContact(index) {
    contacts = contacts.filter((_, i) => i !== index);
  }

  // Update the selected contact name
  function handleSelect(index, selected) {
    if (selected) {
      contacts[index].name = selected.label;
    } else {
      // Handle cases where the user types a new contact
      contacts[index].name = ""; // Set to an empty string or handle new contact logic
    }
  }

  // Update the role of the contact
  function handleRoleChange(index, event) {
    contacts[index].role = event.target.value;
  }
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
          file.dossierstatus.toLowerCase().includes(query) ||
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

    // Extract current file data
    const fileData = $currentFile;

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

      successMessage.set("Dossier succesvol opgeslagen!");
      resetForm();
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
    });
  }

  function openModal(file) {
    console.log(file);
    if (file && file.id) {
      currentFile.set({
        ...file,
        fileId: file.id,
        timetracking: file.timetracking,
        opvolgdatum: file.opvolgdatum
          ? format(
              // Check if file.opvolgdatum is a Firebase Timestamp
              file.opvolgdatum instanceof Timestamp
                ? file.opvolgdatum.toDate()
                : file.opvolgdatum,
              "yyyy-MM-dd"
            )
          : "", // Convert and format the date
      });
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
  function formatToEuro(amount) {
    return new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  }
</script>

<main>
  <dialog id="addDossier" bind:this={dialogEl}>
    {#if $currentFile.id}
      <div class="top">
        <h6>Dossier bewerken</h6>
        <button class="basic" on:click={dialogEl.close()}
          ><X size="16" /></button
        >
      </div>
    {:else}
      <div class="top">
        <h6>Dossier toevoegen</h6>
        <button class="basic" on:click={dialogEl.close()}
          ><X size="16" /></button
        >
      </div>
    {/if}
    <form on:submit|preventDefault={handleSubmit}>
      <Tabs
        tabs={[
          { label: "Algemeen" },
          { label: "Contacten" },
          { label: "Taken" },
          { label: "Tijdregistratie" },
          { label: "Specificatie" },
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
            <span class="legend">Contact</span>
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
          <p></p>
          <!-- <div class="contact-list">
            {#each contacts as contact, index}
              <div class="contact-row">
                <label>
                  <Select
                    items={clients}
                    bind:value={contact.name}
                    getOptionValue={(option) => option.id}
                    getOptionLabel={(option) => option.label}
                    placeholder="Selecteer of typ een contact"
                    itemId="id"
                    clearable={true}
                    on:change={handleChange}
                    on:filter={handleFilter}
                    bind:filterText
                  >
                    <div slot="item" let:item>
                      {item.created ? "Nieuw: " : ""}
                      {item.label}
                    </div>
                  </Select>
                </label>
                <label class="input_wrapper">
                  <input
                    type="text"
                    bind:value={contact.role}
                    placeholder="&nbsp;"
                    on:input={(e) => handleRoleChange(index, e)}
                  />
                  <span>Rol</span>
                </label>
                {#if contacts.length > 1}
                  <button
                    type="button"
                    class="basic"
                    on:click={() => removeContact(index)}
                    ><TrashSimple size="16" /></button
                  >
                {/if}
              </div>
            {/each}
            <button type="button" class="basic" on:click={addContact}
              ><Plus size="16" />Contact toevoegen</button
            >
          </div> -->
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
                    <li>
                      <h6>{task.title}</h6>
                      <span
                        ><Clock size="18" />{format(
                          task.deadline.toDate(),
                          "dd-MM-yyyy"
                        )}</span
                      >
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
          <!-- Facturatie -->
          {#if $specs && $specs.minutes > 0}
            <table>
              <tbody>
                <tr>
                  <th>Uren conform specificatie</th>
                  <td>{formatMinutesToHHMM($specs.minutes)}</td>
                  <td>uur</td>
                </tr>
                <tr>
                  <th>Uurtarief</th>
                  <td>{formatToEuro($specs.rate)}</td>
                  <td>x</td>
                </tr>
                <tr>
                  <th>Subtotaal</th>
                  <td>{formatToEuro($specs.subtotal)}</td>
                  <td>Exclusief BTW</td>
                </tr>
                {#if $specs.km > 0}
                  <tr>
                    <th>Kilometervergoeding (a € {$specs.kmRate})</th>
                    <th>{formatToEuro($specs.subtotal)} exclusief</th>
                    <td>Exclusief BTW</td>
                  </tr>
                {/if}
                <tr>
                  <th>BTW ({$specs.taxRate})</th>
                  <th>{formatToEuro($specs.tax)}</th>
                  <td>+</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <th>Totaal</th>
                  <th>{formatToEuro($specs.total)}</th>
                  <td>Inclusief BTW</td>
                </tr>
              </tfoot>
            </table>
          {/if}
          <button
            type="button"
            on:click={() => {
              console.log($specs);
            }}>Data</button
          >
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
            <button class="basic" type="button" on:click={dialogEl.close()}
              >Annuleren</button
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
      <h2>Dossiers</h2>
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
      bind:value={$searchQuery}
    />
    {#if $filteredFiles.length}
      <table>
        <thead>
          <tr>
            <th>Dossier</th>
            <th>Contact</th>
            <th>Status</th>
            <th>Administratiestatus</th>
            <th class="hide_mobile">Opvolgdatum</th>
          </tr>
        </thead>
        <tbody>
          {#each $filteredFiles as file}
            <tr
              on:click={(event) => {
                // console.log("Clicked", file);
                openModal(file);
              }}
            >
              <td class="limit_width">{file.id}. {file.name}</td>
              <td class="limit_width">
                {file.client_id.voornaam
                  ? file.client_id.voornaam + " " + file.client_id.achternaam
                  : "Onbekend"}
              </td>
              <td>{file.dossierstatus}</td>
              <td>{file.administratiestatus}</td>
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

  .contact-list {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 15px;
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

  .file_logs {
    li {
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
</style>
