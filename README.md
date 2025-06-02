# Dev Port Storage

A Chrome extension that helps frontend developers manage local storage and cookies across different development ports.

## Features

- Automatically detects and manages storage contexts for different localhost ports
- Isolates localStorage and cookies for each port
- Provides a user-friendly interface to view and manage storage items
- Allows clearing storage for specific ports
- Real-time updates of storage changes

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the extension:
   ```bash
   npm run build
   ```
4. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` directory from this project

## Development

1. Start the development build with watch mode:
   ```bash
   npm run dev
   ```
2. The extension will automatically rebuild when you make changes
3. Refresh the extension in Chrome to see your changes

## Usage

1. Start your local development projects on different ports
2. Click the extension icon to open the popup
3. View all active ports and their storage items
4. Click on a port to view its storage details
5. Use the "Clear" button to remove all storage items for a specific port

## How it Works

The extension:
1. Monitors web requests to localhost
2. Creates separate storage contexts for each port
3. Tracks localStorage and cookie changes
4. Provides an interface to manage storage items

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT 