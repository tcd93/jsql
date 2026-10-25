const suppressConsoleOutput = (): void => {
    // Suppress console output in the webview test environment
};

console.debug = suppressConsoleOutput;
console.info = suppressConsoleOutput;
console.log = suppressConsoleOutput;
console.warn = suppressConsoleOutput;
