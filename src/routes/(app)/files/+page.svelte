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

    let fileId = "";
    let client_id = "";
    let dossierstatus = "Actief"; // Default value
    let description = "";
    let opvolgdatum = "";
    let uurtarief = 250; // Default value
    let projectkosten = 0;
    let administratiestatus = "Betaald"; // Default value
    let administratieafspraak = "";
    let gekoppelde_facturen = "";
    let clients = [];
    let submitting = writable(false);
    let errorMessage = writable("");
    let successMessage = writable("");

    onMount(async () => {
        // Fetch all clients to populate the client select box
        const clientsRef = collection(
            db,
            "workspaces",
            localStorage.getItem("workspace"),
            "clients",
        );
        const clientSnapshots = await getDocs(clientsRef);
        clients = clientSnapshots.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));

        // Automatically fetch the last file ID and increment for suggestion
        const filesRef = collection(
            db,
            "workspaces",
            localStorage.getItem("workspace"),
            "files",
        );
        const filesSnapshots = await getDocs(filesRef);
        const lastFileId = filesSnapshots.docs.reduce(
            (max, doc) => Math.max(max, parseInt(doc.id)),
            0,
        );
        fileId = (lastFileId + 1).toString().padStart(4, "0");
    });

    async function handleSubmit() {
        // Ensure all required fields are filled out
        if (!fileId || !client_id || !description) {
            errorMessage.set("Vul alle verplichte velden in.");
            return;
        }

        submitting.set(true);
        errorMessage.set("");
        successMessage.set("");

        try {
            // Check if the file ID already exists
            const filesRef = collection(
                db,
                "workspaces",
                localStorage.getItem("workspace"),
                "files",
            );
            const existingFileQuery = query(
                filesRef,
                where("__name__", "==", fileId),
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
            const fileDocRef = doc(filesRef, fileId);
            await setDoc(fileDocRef, {
                client_id,
                dossierstatus,
                description,
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
        description = "";
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
            Dossiernummer (Voorstel: {fileId}):
            <input
                type="number"
                bind:value={fileId}
                placeholder="Dossiernummer"
            />
        </label>

        <label>
            Contact:
            <select bind:value={client_id}>
                <option value="" disabled selected>Selecteer een contact</option
                >
                {#each clients as client}
                    <option value={client.id}>{client.name}</option>
                {/each}
            </select>
        </label>

        <label>
            Dossierstatus:
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
            Dossiernaam:
            <input
                type="text"
                bind:value={description}
                placeholder="Dossiernaam"
            />
        </label>

        <label>
            Opvolgdatum:
            <input type="date" bind:value={opvolgdatum} />
        </label>

        <label>
            Uurtarief:
            <input
                type="number"
                bind:value={uurtarief}
                placeholder="Uurtarief"
            />
        </label>

        <label>
            Projectkosten:
            <input
                type="number"
                bind:value={projectkosten}
                placeholder="Projectkosten"
            />
        </label>

        <label>
            Administratiestatus:
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
            Administratieafspraak:
            <textarea
                bind:value={administratieafspraak}
                placeholder="Administratieafspraak"
            ></textarea>
        </label>

        <label>
            Gekoppelde facturen:
            <textarea
                bind:value={gekoppelde_facturen}
                placeholder="Gekoppelde facturen (elke factuur op een nieuwe regel)"
            ></textarea>
        </label>

        <button type="submit" disabled={$submitting}>Voeg dossier toe</button>
    </form>
</main>

<style lang="scss">
</style>
