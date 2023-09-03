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
        { title: "API Browser", value: "api" }
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
                console.log(yellow(`✔ Players: ${packet.payload.split("are ")[1].split(" ")[0]}/${packet.payload.split("x of ")[1].split(" p")[0]}`));
                await newMsg(client, onCancel);
                listID = null;
            } else {
                console.log(packet.payload);
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

const onCancel = _prompt => {
    console.log(red("✖ Bye!"));
    process.exit(0);
}

// Utils ----->