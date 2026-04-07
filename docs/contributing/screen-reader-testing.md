# Screen Reader Testing

## Why Manual Screen Reader Testing Matters

Automated accessibility testing with axe-core and Playwright catches structural issues like missing labels, incorrect ARIA attributes, and color contrast violations. However, automated tools cannot evaluate:

- **Focus management** -- whether focus moves logically after user actions (e.g., opening a modal, submitting a form, navigating between pages)
- **Live region announcements** -- whether dynamic content updates (alerts, status messages, loading indicators) are announced at the right time with appropriate urgency
- **Reading order** -- whether the screen reader reads content in an order that makes sense, especially in multi-column layouts or reordered flex/grid items
- **Interactive widget behavior** -- whether custom components (date pickers, combo boxes, accordions) follow expected keyboard and announcement patterns
- **Context and meaning** -- whether the announced text is understandable without visual context (e.g., "Edit" button without knowing what it edits)

Manual screen reader testing fills these gaps and is essential for WCAG 2.1 AA compliance.

## Testing Environment Setup

CAMS developers on Apple Silicon Macs can test with Windows screen readers by running a local Windows 11 ARM VM. The app runs on macOS; the VM just provides the Windows browser and screen reader.

### Architecture

```
macOS (host)                          Windows 11 VM
+----------------------------+        +----------------------------+
| CAMS dev server            |        | Chrome / Edge              |
| localhost:3000             | <----- | http://<host-ip>:3000      |
|                            |        |                            |
| npm run test:screen-reader |        | NVDA / Narrator            |
+----------------------------+        +----------------------------+
```

### VM Tool Options

All recommended VM tools are free. No paid software is required for screen reader testing.

| Tool | License | Notes |
|------|---------|-------|
| **UTM** | Free, open source ([Apache 2.0](https://github.com/utmapp/UTM)) | Recommended free option for Apple Silicon |
| **VMware Fusion** | Free for all users | Good performance, slightly more manual setup |

VirtualBox is not recommended -- it has experimental and unstable ARM support.

### Windows Licensing

During Windows 11 installation, select **"I don't have a product key"** and choose **Windows 11 Home**. An unactivated Windows installation is fully functional for screen reader testing. The only limitations are a desktop watermark and restricted personalization settings (wallpaper, themes), which do not affect testing.

### VM Setup: UTM (Recommended)

1. Download [UTM](https://mac.getutm.app/) or install via `brew install --cask utm`
   - UTM is free and open source. It is available at no cost from [GitHub](https://github.com/utmapp/UTM/releases) and Homebrew. A Mac App Store version exists as an optional way to support the developers, but the application is identical.
2. Download a Windows 11 ARM ISO from [Microsoft](https://www.microsoft.com/software-download/windows11arm64) (select "Windows 11 (multi-edition ISO for Arm64)", choose English, then click the download button)
   - [CrystalFetch](https://apps.apple.com/app/crystalfetch-iso-downloader/id6454431289) can also download ISOs from Microsoft's CDN, but may hang during download -- use the Microsoft page as a fallback
3. Open UTM and click **"+"** to create a new VM
4. Select **Virtualize** > **Windows**
5. Check **"Install Windows 10 or higher"** and **"Install drivers and SPICE tools"**
6. Browse and select the downloaded ISO
7. Recommended VM specs:
   - **RAM:** 4 GB (4096 MB)
   - **CPU:** 2 cores
   - **Disk:** 40 GB
8. Skip the shared directory step
9. Save the VM and click the play button to boot
10. Press any key when prompted to boot from the ISO, then complete the Windows setup wizard (select "I don't have a product key" and choose Windows 11 Home)
11. After Windows boots, install the SPICE guest tools from the mounted CD drive in File Explorer (improves display, clipboard, and networking)

### VM Setup: VMware Fusion (Alternative)

1. Download [VMware Fusion](https://www.vmware.com/products/desktop-hypervisor/workstation-and-fusion) (free for all users)
2. Download a Windows 11 ARM ISO from [Microsoft](https://www.microsoft.com/software-download/windows11arm64)
3. Create a new VM using the ISO
4. Recommended VM specs:
   - **RAM:** 4 GB
   - **CPU:** 2 cores
   - **Disk:** 40 GB
5. Complete the Windows setup wizard (select "I don't have a product key" and choose Windows 11 Home)
6. Install VMware Tools for improved integration

### Installing Screen Readers

**NVDA** (free, open source -- [GPL v2](https://github.com/nvaccess/nvda/)):

Run the automated setup script inside the VM (see [VM Setup Script](#vm-setup-script) below), or install manually:

1. Open PowerShell in the VM
2. Run: `winget install --id=NVAccess.NVDA -e`
3. Alternatively, download from [nvaccess.org](https://www.nvaccess.org/download/)

**Narrator** is built into Windows -- no installation needed. Press `Win + Ctrl + Enter` to toggle it.

### Installing a Browser

Chrome ARM64 (free) is recommended for consistency with how most users access CAMS:

```powershell
winget install --id=Google.Chrome -e
```

Edge is pre-installed on Windows 11 and also works well with screen readers.

## VM Setup Script

A PowerShell script is provided to automate the VM setup. Inside the Windows VM:

1. Open PowerShell as Administrator
2. Run:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
# Copy the script from the repo or download it:
# ops/scripts/screen-reader-testing/setup-windows-vm.ps1
.\setup-windows-vm.ps1
```

The script installs Chrome and NVDA, configures NVDA defaults for testing, and prints instructions for connecting to the host dev server.

## Running CAMS for Screen Reader Testing

### 1. Start the dev server on macOS

From the repository root:

```sh
cd user-interface
npm run test:screen-reader
```

This starts the Vite dev server on `0.0.0.0:3000` with the fake API and login provider disabled, making it accessible from the VM.

### 2. Find your host IP

The `test:screen-reader` script binds to all interfaces, so the VM can reach it. Find your macOS IP:

```sh
# On macOS
ipconfig getifaddr en0
```

For VMware Fusion, check `ifconfig vmnet8` or the VM's network settings. For UTM, use your Mac's local network IP from the command above (`ipconfig getifaddr en0`).

### 3. Open CAMS in the VM browser

In the Windows VM, open Chrome or Edge and navigate to:

```
http://<host-ip>:3000
```

Replace `<host-ip>` with the IP from the previous step.

### 4. Start the screen reader

- **NVDA:** Launch from the Start menu or desktop shortcut. Press `Insert + Q` to quit.
- **Narrator:** Press `Win + Ctrl + Enter` to toggle on/off.

## Testing Checklist

Use this checklist when testing a page or component:

### Focus and Navigation
- [ ] Tab order follows a logical sequence through the page
- [ ] Focus is visible at all times (no "lost" focus)
- [ ] After a user action (form submit, modal open/close, navigation), focus moves to an appropriate element
- [ ] Skip navigation link works and moves focus to the main content
- [ ] No keyboard traps -- Tab and Shift+Tab always allow moving away

### Announcements
- [ ] Page title is announced on navigation
- [ ] Headings are announced with correct level (h1, h2, etc.)
- [ ] Form fields announce their label, required state, and any error messages
- [ ] Buttons and links announce their purpose clearly
- [ ] Status messages and alerts are announced via live regions without requiring focus
- [ ] Loading states are communicated

### Landmarks and Structure
- [ ] Main landmark is present and contains primary content
- [ ] Navigation landmark is present for nav menus
- [ ] Tables have proper headers and captions
- [ ] Lists are marked up as lists and announce item count

### Interactive Components
- [ ] Modal dialogs trap focus and announce their title on open
- [ ] Dropdown menus can be navigated with arrow keys
- [ ] Date pickers and custom widgets follow ARIA authoring practices
- [ ] Expandable sections announce their expanded/collapsed state

## Keyboard Shortcut Quick Reference

### NVDA

| Action | Shortcut |
|--------|----------|
| Start/Stop speech | `Ctrl` |
| Read next item | `Insert + Down Arrow` |
| Next heading | `H` |
| Next landmark | `D` |
| Next form field | `F` |
| Next table | `T` |
| Next link | `K` |
| Next list | `L` |
| Elements list (headings, links, landmarks) | `Insert + F7` |
| Toggle forms/browse mode | `Insert + Space` |
| Quit NVDA | `Insert + Q` |

> **Note:** The "Insert" key is the NVDA modifier. In NVDA settings, you can also configure Caps Lock as the modifier.

### Narrator

| Action | Shortcut |
|--------|----------|
| Start/Stop Narrator | `Win + Ctrl + Enter` |
| Stop reading | `Ctrl` |
| Read next item | `Caps Lock + Right Arrow` |
| Next heading | `Caps Lock + H` |
| Next landmark | `Caps Lock + D` |
| Next form field | `Caps Lock + F` |
| Next table | `Caps Lock + T` |
| Next link | `Caps Lock + K` |
| Open Narrator settings | `Caps Lock + Ctrl + N` |

> **Note:** Narrator uses Caps Lock as its modifier key by default.

## Reporting Screen Reader Issues

When you find a screen reader issue, open a GitHub issue with the following information:

1. **Screen reader and version** (e.g., NVDA 2024.4.1, Narrator on Windows 11 24H2)
2. **Browser and version** (e.g., Chrome 131 ARM64)
3. **Page/component** where the issue occurs
4. **Steps to reproduce** -- specific keyboard/SR commands used
5. **Expected announcement/behavior**
6. **Actual announcement/behavior** (quote the SR output if possible)
7. **WCAG success criterion** that is violated, if known (e.g., 4.1.3 Status Messages)

Label the issue with `accessibility`.
