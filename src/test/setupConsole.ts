const suppressConsoleOutput = (): void => {};

console.debug = suppressConsoleOutput;
console.info = suppressConsoleOutput;
console.log = suppressConsoleOutput;
console.warn = suppressConsoleOutput;
