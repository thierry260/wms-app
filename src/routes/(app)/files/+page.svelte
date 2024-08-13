<script>
    import { db } from "$lib/firebase"; // Import your Firebase instance
    import {
        collection,
        doc,
        setDoc,
        getDocs,
        query,
        where,
        Timestamp,
    } from "firebase/firestore"; // Import Firestore functions
    import { onMount } from "svelte";
    import { writable } from "svelte/store";
    import Select from "svelte-select";

    let fileId = "";
    let client_id = "";
    let dossierstatus = "Actief"; // Default value
    let name = "";
    let opvolgdatum = "";
    let uurtarief = 250; // Default value
    let projectkosten = 0;
    let administratiestatus = "Afwachten"; // Default value
    let administratieafspraak = "";
    let gekoppelde_facturen = "";
    let clients = [];
    let submitting = writable(false);
    let errorMessage = writable("");
    let successMessage = writable("");
    let files = writable([]);

    onMount(async () => {
        // Fetch all clients to populate the client select box
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

        // Automatically fetch the last file ID and increment for suggestion
        const filesRef = collection(
            db,
            "workspaces",
            localStorage.getItem("workspace"),
            "files",
        );
        const filesSnapshots = await getDocs(filesRef);

        // Store fetched files in the reactive variable
        files.set(
            filesSnapshots.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        );

        const lastFileId = filesSnapshots.docs.reduce(
            (max, doc) => Math.max(max, parseInt(doc.id)),
            0,
        );
        fileId = (lastFileId + 1).toString().padStart(4, "0");
    });

    async function handleSubmit() {
        // Ensure all required fields are filled out
        if (!fileId || !client_id || !name) {
            errorMessage.set("Vul alle verplichte velden in.");
            return;
        }

        submitting.set(true);
        errorMessage.set("");
        successMessage.set("");

        try {
            // Ensure fileId is a string
            const fileIdString = String(fileId);

            // Check if the file ID already exists
            const filesRef = collection(
                db,
                "workspaces",
                localStorage.getItem("workspace"),
                "files",
            );
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

            // Convert opvolgdatum to Firestore Timestamp
            const opvolgdatumTimestamp = opvolgdatum
                ? Timestamp.fromDate(new Date(opvolgdatum))
                : null;

            // Set the active status based on dossierstatus
            const active =
                dossierstatus !== "Afgewikkeld" && dossierstatus !== "Inactief";

            // Add the new file document with the specified ID (using setDoc instead of addDoc)
            const fileDocRef = doc(filesRef, fileIdString);
            await setDoc(fileDocRef, {
                client_id,
                dossierstatus,
                name,
                active,
                opvolgdatum: opvolgdatumTimestamp,
                uurtarief,
                projectkosten,
                administratiestatus,
                administratieafspraak,
                gekoppelde_facturen: gekoppelde_facturen.split("\n"), // Assuming multiple invoices separated by lines
                created_at: Timestamp.now(), // Automatically set the current timestamp
                updated_at: Timestamp.now(),
                log: [],
                timetracking: [],
            });

            successMessage.set("Dossier succesvol toegevoegd!");
            resetForm();
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
        name = "";
        client_id = "";
        dossierstatus = "Actief"; // Reset to default value
        opvolgdatum = "";
        uurtarief = 250; // Reset to default value
        projectkosten = 0;
        administratiestatus = "Betaald"; // Reset to default value
        administratieafspraak = "";
        gekoppelde_facturen = "";
        // Keep fileId for next entry, or reset if desired
    }
</script>

<main>
    <h1>Voeg dossier toe</h1>

    {#if $errorMessage}
        <p style="color: red;">{$errorMessage}</p>
    {/if}

    {#if $successMessage}
        <p style="color: green;">{$successMessage}</p>
    {/if}

    <form on:submit|preventDefault={handleSubmit}>
        <label>
            <span class="legend">Dossiernummer (Voorstel: {fileId})</span>
            <input
                type="number"
                bind:value={fileId}
                placeholder="Dossiernummer"
            />
        </label>

        <label>
            <span class="legend">Contact</span>
            <Select
                items={clients}
                bind:value={client_id}
                getOptionValue={(option) => option.id}
                getOptionLabel={(option) => option.label}
                placeholder="Zoek een contact"
                itemId="id"
                clearable={false}
            />
        </label>

        <label>
            <span class="legend">Dossierstatus</span>
            <select bind:value={dossierstatus}>
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
            <input type="text" bind:value={name} placeholder="Dossiernaam" />
        </label>

        <label>
            <span class="legend">Opvolgdatum</span>
            <input type="date" bind:value={opvolgdatum} />
        </label>

        <label>
            <span class="legend">Uurtarief</span>
            <input
                type="number"
                bind:value={uurtarief}
                placeholder="Uurtarief"
            />
        </label>

        <label>
            <span class="legend">Projectkosten</span>
            <input
                type="number"
                bind:value={projectkosten}
                placeholder="Projectkosten"
            />
        </label>

        <label>
            <span class="legend">Administratiestatus</span>
            <select bind:value={administratiestatus}>
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
                bind:value={administratieafspraak}
                placeholder="Administratieafspraak"
            ></textarea>
        </label>

        <label>
            <span class="legend">Gekoppelde facturen</span>
            <textarea
                bind:value={gekoppelde_facturen}
                placeholder="Gekoppelde facturen (elke factuur op een nieuwe regel)"
            ></textarea>
        </label>

        <button type="submit" disabled={$submitting}>Voeg dossier toe</button>
    </form>

    <section class="files_section">
        <h2>Dossiers</h2>
        <table>
            <thead>
                <tr>
                    <th>Dossiernummer</th>
                    <th>Naam</th>
                    <th>Status</th>
                    <th>Contact</th>
                    <th>Opvolgdatum</th>
                    <th>Uurtarief</th>
                    <th>Projectkosten</th>
                </tr>
            </thead>
            <tbody>
                {#each $files as file}
                    <tr>
                        <td>{file.id}</td>
                        <td>{file.name}</td>
                        <td>{file.dossierstatus}</td>
                        <td
                            >{clients.find(
                                (client) => client.id === file.client_id,
                            )?.label || "Onbekend"}</td
                        >
                        <td
                            >{file.opvolgdatum
                                ? new Date(
                                      file.opvolgdatum.seconds * 1000,
                                  ).toLocaleDateString()
                                : "Geen"}</td
                        >
                        <td>€{file.uurtarief}</td>
                        <td>€{file.projectkosten}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </section>
</main>

<style lang="scss">
    .files_section {
        margin-top: 60px;
    }
    .legend {
        margin-top: 0;
    }
</style>
