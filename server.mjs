import { Elysia } from "elysia";
import rconList from "./rcon.json";
import { inspect } from "node:util";

const _c = inspect.colors;
Object.keys(_c).forEach(c => global[c] = s => `\x1b[${_c[c][0]}m${s}\x1b[${_c[c][1]}m`);

console.log(red("AKUMA"), "-", yellow("RCON"), "-", green("SERVERS"));
console.log(blue("github.com"), "@", cyan(`${underline("northernside")}${grey("/akuma-rcon")}`));
console.log(blue("discord.com"), "@", cyan(underline("northernside")));
console.log(blue("ebio.gg"), "@", cyan(underline("northernside\n")));

let rconPages = rconList.reduce((acc, val, index) => {
    if (index % 10 === 0) acc.push([]);
    acc[acc.length - 1].push(val);
    return acc;
}, []);

const app = new Elysia();

app.get("/api/servers", ({ query }) => {
    const page = Number(query.page || 1);
    return {
        stats: {
            total: rconList.length,
            pages: rconPages.length,
            passwords: Object.entries(rconList.reduce((acc, val) => {
                if (acc[val.password]) acc[val.password]++;
                else acc[val.password] = 1;
                return acc;
            }, {})).map(([password, count]) => ({ password, count }))
        },
        page: rconPages[page - 1]
    }
});

app.get("/api/servers/all", ({ }) => {
    return {
        stats: {
            total: rconList.length,
            pages: rconPages.length
        },
        servers: rconList
    }
});

app.listen({
    port: Bun.env.PORT || 4242,
    hostname: Bun.env.HOST || "127.0.0.1"
});

console.log(green(`✔ Listening on ${underline(`${Bun.env.HOST || "127.0.0.1"}:${Bun.env.PORT || 4242}`)}`));
console.log(green(`✔ Loaded ${underline(rconList.length)} servers into ${underline(rconPages.length)} pages`));