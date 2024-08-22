// src/lib/utils/dbTracker.js

export const dbTracker = (() => {
    const storageKey = "dbUsage";
    const orderedPages = ["Dashboard", "Timetracking", "Contacts", "Files", "Tasks"]; // Define the desired order

    function initPage(pageName) {
        const usageData = getUsageData();

        if (!usageData[pageName]) {
            usageData[pageName] = {
                reads: 0,
                writes: 0,
                deletes: 0,
            };
        }

        saveUsageData(usageData);
    }

    function trackRead(pageName, count = 1) {
        updateUsage(pageName, 'reads', count);
    }

    function trackWrite(pageName, count = 1) {
        updateUsage(pageName, 'writes', count);
    }

    function trackDelete(pageName, count = 1) {
        updateUsage(pageName, 'deletes', count);
    }

    function updateUsage(pageName, operation, count) {
        const usageData = getUsageData();

        if (!usageData[pageName]) {
            usageData[pageName] = {
                reads: 0,
                writes: 0,
                deletes: 0,
            };
        }

        usageData[pageName][operation] += count;
        saveUsageData(usageData);

        console.log(`Current page database reads: ${usageData[pageName].reads}`);
    }

    function getUsageData() {
        const data = localStorage.getItem(storageKey);
        return data ? JSON.parse(data) : {};
    }

    function saveUsageData(data) {
        // Create an ordered object based on the predefined order
        const orderedData = {};
        orderedPages.forEach(page => {
            if (data[page]) {
                orderedData[page] = data[page];
            }
        });

        // Include any additional pages that are not in the predefined order
        Object.keys(data).forEach(page => {
            if (!orderedData[page]) {
                orderedData[page] = data[page];
            }
        });

        localStorage.setItem(storageKey, JSON.stringify(orderedData));
    }

    function clearUsageData() {
        localStorage.removeItem(storageKey);
    }

    return {
        initPage,
        trackRead,
        trackWrite,
        trackDelete,
        clearUsageData,
    };
})();