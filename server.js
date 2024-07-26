import express from 'express';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 3000;

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SHEET_ID = '1bNgNJkLMarP85MclxNYQzzEzQGUCGTstduZh4XZ1b9Q';
const SHEET_RANGE = 'Urenregistratie!A:I';

const oAuth2Client = new OAuth2Client(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URI
);

let authClient;

// Middleware
app.use(bodyParser.json());
app.use(cors());

app.get('/auth/google', (req, res) => {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    res.redirect(authUrl);
});

app.get('/auth/google/callback', async (req, res) => {
    const code = req.query.code;

    if (!code) {
        return res.status(400).send('Missing authorization code');
    }

    try {
        const response = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(response.tokens);
        authClient = oAuth2Client;
        res.redirect('http://localhost:5173/');
    } catch (error) {
        console.error('Error retrieving access token', error);
        res.status(500).send('Authentication failed');
    }
});

app.get('/auth/status', async (req, res) => {
    if (authClient && authClient.credentials.access_token) {
        // Refresh the access token if needed
        if (new Date().getTime() >= authClient.credentials.expiry_date) {
            try {
                const newTokens = await oAuth2Client.refreshAccessToken();
                authClient.setCredentials(newTokens.credentials);
            } catch (error) {
                console.error('Error refreshing access token', error);
                return res.json({ loggedIn: false });
            }
        }
        res.json({ loggedIn: true });
    } else {
        res.json({ loggedIn: false });
    }
});

app.post('/addRow', async (req, res) => {
    if (!authClient) {
        return res.status(401).send('Not authorized');
    }

    const { dossiernaam, datum, omschrijving, min, uur, totaal, billable, uitvoerder, locatie } = req.body;
    console.log('Request body:', req.body);

    try {
        const sheets = google.sheets({ version: 'v4', auth: authClient });

        // Prepare the row data
        const rowData = [
            dossiernaam || 'N/A',
            datum || 'N/A',
            omschrijving || 'N/A',
            min || '0',
            uur || '0',
            totaal || '0.00',
            billable || 'N/A',
            uitvoerder || 'N/A',
            locatie || 'N/A'
        ];

        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: SHEET_ID,
            range: SHEET_RANGE,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [rowData],
            },
        });

        console.log('Google Sheets API response:', response.data);

        res.status(200).send('Row added successfully');
    } catch (error) {
        if (error.response) {
            console.error('API Error details:', error.response.data);
            res.status(500).send(`Error adding row: ${error.response.data.error.message}`);
        } else {
            console.error('General Error details:', error.message);
            res.status(500).send('Error adding row');
        }
    }
});

function getStartOfWeek() {
    const now = new Date();
    const firstDay = now.getDate() - now.getDay() + 1; // +1 to start from Monday
    return new Date(now.setDate(firstDay));
}

app.get('/getLogs', async (req, res) => {
    if (!authClient) {
        return res.status(401).send('Not authorized');
    }

    try {
        const sheets = google.sheets({ version: 'v4', auth: authClient });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: SHEET_RANGE,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            return res.status(404).send('No data found.');
        }

        const startOfWeek = getStartOfWeek();
        let logs = [];
        let totalRevenue = 0;

        // Loop through the rows and filter the logs from this week
        rows.forEach(row => {
            const datum = new Date(row[1]);
            if (datum >= startOfWeek) {
                logs.push({
                    dossiernaam: row[0],
                    datum: row[1],
                    omschrijving: row[2],
                    min: row[3] || '0',
                    uur: row[4] || '0',
                    totaal: row[5] || '0.00',
                    billable: row[6],
                    uitvoerder: row[7],
                    locatie: row[8],
                });

                if (row[6] === 'Ja') {
                    totalRevenue += parseFloat(row[5]);
                }
            }
        });

        res.json({ logs, totalRevenue });
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).send('Error fetching logs');
    }
});

app.get('/logout', (req, res) => {
    authClient = null;
    res.redirect('http://localhost:5173/');
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

