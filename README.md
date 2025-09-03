## Project Structure

- **`src/`**: Contains the TypeScript source code for the application.
- **`public/`**: Contains static assets like `index.html`, `styles.css`, and icons.
- **`dist/`**: The output directory for the built files.
- **`.trunk/`**: Configuration for Trunk-based linting and formatting.

## Prerequisites

Before setting up the project, ensure you have the following installed:

- **Node.js** (v22.16.0 or higher)
- **npm** (comes with Node.js)
- **TypeScript** (installed as a dev dependency)

## Setup Instructions

1. **Clone the Repository**:

   ```bash
   git clone <repository-url>
   cd <repository-folder>
   ```

2. **Install Dependencies**:

   ```bash
   npm install
   ```

3. **Build the Project**:

   ```bash
   npm run build
   ```

   This will:
   - Copy all files from the `public/` folder to the `dist/` folder.
   - Compile TypeScript files from the `src/` folder into JavaScript in the `dist/` folder.

4. **Run the Project**:

   - Open the `dist/index.html` file in your browser to view the application.

5. **Development Mode**:
   To watch for changes and recompile TypeScript files automatically:
   ```bash
   npm run watch
   ```

## Configuration

- **Gemini API Key**: The API key for the Gemini service is managed using a `.env` file. Follow these steps to configure it:

  1. Create a `.env` file in the root of the project:

     ```
     GEMINI_API_KEY=your_actual_api_key_here
     ```

## Linting and Formatting

This project uses Trunk for linting and formatting. To run Trunk checks:

```bash
trunk check
```

## License

This project is licensed under the MIT License. See the LICENSE file for details.
