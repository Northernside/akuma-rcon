import { inspect } from "node:util";
import { existsSync } from "node:fs";

const _c = inspect.colors;
Object.keys(_c).forEach(c => global[c] = s => `\x1b[${_c[c][0]}m${s}\x1b[${_c[c][1]}m`);

const [inputFile, outputFile] = process.argv.slice(2);

if (!inputFile) errorHandler("No input file specified");
if (!outputFile) errorHandler("No output file specified");
if (!existsSync(inputFile)) errorHandler("Input file does not exist");
if (existsSync(outputFile)) errorHandler("Output file already exists");

const input = Buffer.from(await Bun.file("rcon.txt").arrayBuffer()).toString().replaceAll("\r", "");

let output = input.split("\n").map(line => {
    const [ip, password] = line.split(":");
    return { ip, password };
});

output = output.filter((line, index, self) => self.findIndex(_line => _line.ip === line.ip && _line.password === line.password) === index);

console.log(green("✔"), `Writing ${output.length} servers...`);
await Bun.write(outputFile, JSON.stringify(output, null, 2));

function errorHandler(message) {
    console.error(red("✖"), message);
    process.exit(1);
}