# Google Drive Dashboard Sync

This small Apps Script stores dashboard progress in your Google Drive as:

```text
career-ops-dashboard-progress.json
```

## Setup

1. Open [script.google.com](https://script.google.com/).
2. Create a new project named `career-ops-dashboard-sync`.
3. Paste `Code.gs` into the project.
4. Click **Deploy > New deployment**.
5. Choose **Web app**.
6. Set **Execute as** to `Me`.
7. Set **Who has access** to `Anyone with the link`.
8. Deploy and copy the Web App URL.
9. Open `static-dashboard/index.html`, paste that URL into **Drive Sync URL**, then click **Load Drive**.

After that, dashboard status, notes, and skill progress can be saved to and loaded from Drive.
