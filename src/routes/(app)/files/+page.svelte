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
        where,
        Timestamp,
    } from "firebase/firestore";
    import { onMount } from "svelte";
    import { writable, get, derived } from "svelte/store";
    import Select from "svelte-select";
    import { X, TrashSimple, Plus } from "phosphor-svelte";
    import { format } from "date-fns";

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
    });
    let proposedFileId;

    let clients = [];
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
                    clients
                        .find((client) => client.id === file.client_id)
                        ?.label.toLowerCase()
                        .includes(query)
                );
            });
        },
    );
    let dialogEl = "";

    onMount(async () => {
        const clientsRef = collection(
            db,
            "workspaces",
            localStorage.getItem("workspace"),
            "clients",
        );
        const clientSnapshots = await getDocs(clientsRef);
        clients = clientSnapshots.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                label: `${data.voornaam || ""} ${data.tussenvoegsels || ""} ${data.achternaam || ""} (${data.bedrijfsnaam || ""})`.trim(),
                ...data,
            };
        });

        const filesRef = collection(
            db,
            "workspaces",
            localStorage.getItem("workspace"),
            "files",
        );
        const filesSnapshots = await getDocs(filesRef);

        files.set(
            filesSnapshots.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        );

        const lastFileId = filesSnapshots.docs.reduce(
            (max, doc) => Math.max(max, parseInt(doc.id)),
            0,
        );

        proposedFileId = (lastFileId + 1).toString().padStart(4, "0");

        currentFile.set({
            fileId: (lastFileId + 1).toString().padStart(4, "0"),
        });
    });

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
                "files",
            );

            let timetracking = [];

            // Check if file already exists when creating
            if (action === "create") {
                const existingFileQuery = query(
                    filesRef,
                    where("__name__", "==", fileIdString),
                );
                const existingFileSnap = await getDocs(existingFileQuery);

                if (!existingFileSnap.empty) {
                    errorMessage.set(
                        "Dossiernummer bestaat al. Kies een ander nummer.",
                    );
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

            // Update $files store locally
            if (action === "create") {
                files.update((currentFiles) => [
                    ...currentFiles,
                    { id: fileIdString, ...fileData },
                ]);
            } else if (action === "edit") {
                files.update((currentFiles) =>
                    currentFiles.map((file) =>
                        file.id === fileIdString
                            ? { id: fileIdString, ...fileData }
                            : file,
                    ),
                );
            }

            errorMessage.set("");
            successMessage.set("");

            successMessage.set("Dossier succesvol opgeslagen!");
            resetForm();
            dialogEl.close();
        } catch (error) {
            console.error("Error adding file: ", error);
            errorMessage.set(
                "Er was een fout bij het toevoegen van het dossier.",
            );
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
        });
    }

    function openModal(file) {
        console.log(file);
        if (file && file.id) {
            currentFile.set({
                ...file,
                fileId: file.id,
                opvolgdatum: file.opvolgdatum
                    ? format(file.opvolgdatum.toDate(), "yyyy-MM-dd")
                    : "", // Convert and format the date
            });
        } else {
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
            });
        }

        console.log(get(currentFile));

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
            fileToDelete.id, // Access the id property of dossierId
        );

        try {
            // Fetch the dossier document to retrieve the existing timetracking array
            const docSnap = await deleteDoc(dossierRef);

            // Update $files store locally
            files.update((currentFiles) =>
                currentFiles.filter((file) => file.id !== fileToDelete.id),
            );

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
                <span class="legend">Dossierstatus</span>
                <select bind:value={$currentFile.dossierstatus}>
                    <option value="Actief">Actief</option>
                    <option value="Afgewikkeld">Afgewikkeld</option>
                    <option value="Betwist">Betwist</option>
                    <option value="Controleren">Controleren</option>
                    <option value="Dubieus">Dubieus</option>
                    <option value="In Afronding">In Afronding</option>
                    <option value="Inactief">Inactief</option>
                </select>
            </label>

            <label>
                <span class="legend">Dossiernaam</span>
                <input
                    type="text"
                    bind:value={$currentFile.name}
                    placeholder="Dossiernaam"
                />
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

            <label>
                <span class="legend">Administratiestatus</span>
                <select bind:value={$currentFile.administratiestatus}>
                    <option value="Betaald">Betaald</option>
                    <option value="Factureren">Factureren</option>
                    <option value="Controleren">Controleren</option>
                    <option value="Openstaand">Openstaand</option>
                    <option value="Afwachten">Afwachten</option>
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
                            on:click={dialogEl.close()}>Annuleren</button
                        >
                        <button
                            type="submit"
                            data-action="edit"
                            disabled={$submitting}>Opslaan</button
                        >
                    </div>
                {:else}
                    <button
                        type="submit"
                        data-action="create"
                        disabled={$submitting}>Dossier toevoegen</button
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
                                    ? file.client_id.voornaam +
                                      " " +
                                      file.client_id.achternaam
                                    : "Onbekend"}
                            </td>
                            <td>{file.dossierstatus}</td>
                            <td class="hide_mobile">
                                {file.opvolgdatum
                                    ? new Date(
                                          file.opvolgdatum.seconds * 1000,
                                      ).toLocaleDateString()
                                    : "Geen"}
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
</style>
