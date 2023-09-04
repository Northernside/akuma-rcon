import { inspect } from "node:util";
import prompts from "prompts";
import { RCONClient } from "@minecraft-js/rcon";

const _c = inspect.colors;
Object.keys(_c).forEach(c => global[c] = s => `\x1b[${_c[c][0]}m${s}\x1b[${_c[c][1]}m`);
let versionID, listID;

// <----- Main Menu

const mainMenu = [{
    type: "select",
    name: "value",
    message: "Mode",
    choices: [
        { title: "Client", value: "client" },
        { title: "API Browser", value: "api" },
        { title: "Broadcaster", value: "broadcaster" }
    ],
    initial: 0
}];

const modeChoice = await prompts(mainMenu);

// Main Menu ----->


// <----- Client Mode

if (modeChoice.value === "client") {
    const questions = [
        {
            type: "text",
            name: "host",
            message: "Server Address?"
        },
        {
            type: "text",
            name: "port",
            message: "Server Port?",
            initial: "25575"
        },
        {
            type: "password",
            name: "password",
            message: "Password?",
            initial: "minecraft"
        }
    ];

    const answers = Object.values(await prompts(questions));
    await serverConnection(...answers);
} else if (modeChoice.value === "api") {
    let pageNumber = 1;
    const pageURL = `${Bun.env.API_URL}/api/servers?page=`;
    let jsonResp = await (await fetch(pageURL + 1)).json(), stats = jsonResp.stats, page = jsonResp.page;
    console.log(`Loaded ${yellow("✔")} ${stats.total} servers, ${stats.pages} pages, ${stats.passwords.length} unique passwords`);
    await pageHandler(pageNumber);
} else if (modeChoice.value === "broadcaster") {
    const allServers = await fetch(`${Bun.env.API_URL}/api/servers/all`).then(async r => await r.json());
    console.log(`Loaded ${yellow("✔")} ${allServers.stats.total} servers, ${allServers.stats.pages} pages`);

    const servers = allServers.servers,
        answers = Object.values(await prompts({
            type: "text",
            name: "commands",
            message: `Commands to execute (split with "[;]")`
        })), commands = answers[0].split("[;]");

    console.log(`Executing ${yellow("✔")} ${commands.length} commands`);
    for (const server of servers) {
        try {
            const client = new RCONClient(server.ip, server.password, 25575);
            client.connect();

            client.on("authenticated", async () => {
                for (const command of commands) {
                    client.executeCommand(command);
                    await new Promise(r => setTimeout(r, 75));
                }

                client.disconnect();
            });

            client.on("error", async (_error) => { });
            client.on("response", async (packet, _requestId) => {
                console.log(`${server.ip}: ${packet.payload}`);
            });
        } catch (_e) { }

        await new Promise(r => setTimeout(r, 75));
    }

    console.log(`${yellow("✔")} Done!`);
    process.exit(0);
}

async function pageHandler(pageNumber) {
    const pageURL = `${Bun.env.API_URL}/api/servers?page=${pageNumber}`;
    const { stats, page } = await (await fetch(pageURL)).json();

    let serverMenu = [{
        type: "select",
        name: "value",
        message: "Choose a server",
        choices: [
            ...page.map(_server => ({ title: `${_server.ip}:${_server.password}`, value: _server.ip })),
            { title: "Next Page", value: "next" },
            { title: "Back", value: "back" }
        ],
        initial: 0
    }];

    if (pageNumber <= 1) serverMenu[0].choices.pop();
    if (pageNumber >= stats.pages) serverMenu[0].choices.shift();

    const listChoice = await prompts(serverMenu);
    (async () => {
        if (listChoice.value === "next") {
            pageNumber++;
            pageHandler(pageNumber);
        } else if (listChoice.value === "back") {
            pageNumber--;
            pageHandler(pageNumber);
        } else if (listChoice.value) {
            const server = page.find(s => s.ip === listChoice.value);

            serverMenu = [{
                type: "select",
                name: "value",
                message: `Selected: ${server.ip}:${server.password}`,
                choices: [
                    { title: "Connect?", value: "connect" },
                    { title: "Back", value: "back" }
                ],
                initial: 0
            }];

            const action = await prompts(serverMenu);
            if (action.value === "connect") {
                await serverConnection(server.ip, 25575, server.password);
            } else pageHandler(pageNumber);
        }
    })();
}

// <----- Utils

async function serverConnection(host, port = 25575, password) {
    try {
        const client = new RCONClient(host, password, Number(port));
        client.connect();
        client.on("authenticated", async () => {
            console.log(green("✔ Authenticated"));
            versionID = client.executeCommand("version");
        });

        client.on("response", async (packet, requestId) => {
            if (requestId === versionID) {
                console.log(yellow(`✔ Version: ${versionString(packet.payload)}`));

                listID = client.executeCommand("list");
                versionID = null;
            } else if (requestId === listID) {
                const cleanedMsg = packet.payload.replace(/Â§[0-9a-f]/g, "");
                console.log(yellow(`✔ Players: ${listString(cleanedMsg)}`));
                await newMsg(client, onCancel);
                listID = null;
            } else {
                console.log(convertColors(packet.payload));
                await newMsg(client);
            }
        });
    } catch (error) {
        console.error(red("An error occurred:"), error);
    }
}

async function newMsg(client) {
    const { message } = await prompts({
        type: "text",
        name: "message",
        message: ""
    }, { onCancel });

    client.executeCommand(message);
}

const versionString = raw => {
    if (raw.includes("Unknown"))
        return "Vanilla";
    else return `${raw.split("version ")[1].split(") (")[0]})`;
}

const listString = raw => {
    return raw.includes("/")
        ? `${raw.split("/")[0].split(" ")[2]}/${raw.split("/")[1].split(" ")[0]}`
        : raw.includes("maximum")
            ? `${raw.split("are ")[1].split(" ")[0]}/${raw.split("maximum ")[1].split(" ")[0]}`
            : `${raw.split("are ")[1].split(" ")[0]}/${raw.split("x of ")[1].split(" p")[0]}`;
}

const onCancel = _prompt => {
    console.log(red("✖ Bye!"));
    process.exit(0);
}

const colorMapping = {
    "§0": black,
    "§1": blue,
    "§2": green,
    "§3": cyan,
    "§4": red,
    "§5": magenta,
    "§6": yellow,
    "§7": white,
    "§8": grey,
    "§9": cyan,
    "§a": green,
    "§b": cyan,
    "§c": red,
    "§d": magenta,
    "§e": yellow,
    "§f": white,
    "§k": inverse,
    "§l": bold,
    "§m": underline,
    "§n": underline,
    "§o": italic,
    "§r": white
};


function convertColors(input) {
    const colorRegex = /§[0-9a-fk-lnor]/g,
        colorParts = input.split(colorRegex).slice(1),
        colors = input.match(colorRegex) || [];

    if (colorParts.length === 0) return input;
    return colorParts.reduce((acc, val, index) => {
        const color = colors[index];
        if (colorMapping[color]) acc += colorMapping[color](val);
        else acc += val;
        return acc;
    }, "");
}

// Utils ----->