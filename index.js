const fs = require("fs");
const Canvas = require("node-canvas");
const fetch = require("node-fetch");
const FormData = require("form-data");

const maps = require("./maps.json");
const webhooks = require("./webhooks.json");

const colours = Object.freeze({
    BLACK: "#000000",
    DARK_BLUE: "#0000AA",
    DARK_GREEN: "#00AA00",
    DARK_AQUA: "#00AAAA",
    DARK_RED: "#AA0000",
    DARK_PURPLE: "#AA00AA",
    GOLD: "#FFAA00",
    GRAY: "#AAAAAA",
    DARK_GRAY: "#555555",
    BLUE: "#5555FF",
    GREEN: "#55FF55",
    AQUA: "#55FFFF",
    RED: "#FF5555",
    LIGHT_PURPLE: "#FF55FF",
    YELLOW: "#FFFF55",
    WHITE: "#FFFFFF"
});

const shadows = new Map([
    [colours.BLACK, "#000000"],
    [colours.DARK_BLUE, "#00002A"],
    [colours.DARK_GREEN, "#002A00"],
    [colours.DARK_AQUA, "#002A2A"],
    [colours.DARK_RED, "#2A0000"],
    [colours.DARK_PURPLE, "#2A002A"],
    [colours.GOLD, "#2A2A00"],
    [colours.GRAY, "#2A2A2A"],
    [colours.DARK_GRAY, "#151515"],
    [colours.BLUE, "#15153F"],
    [colours.GREEN, "#153F15"],
    [colours.AQUA, "#153F3F"],
    [colours.RED, "#3F1515"],
    [colours.LIGHT_PURPLE, "#3F153F"],
    [colours.YELLOW, "#3F3F15"],
    [colours.WHITE, "#3F3F3F"]
]);

const POOLS = Object.freeze({
    BEDWARS_8TEAMS_SLOW: "8 Teams\nLong & Tactical",
    BEDWARS_8TEAMS_FAST: "8 Teams\nQuick & Rushy",
    BEDWARS_4TEAMS_SLOW: "4 Teams\nLong & Tactical",
    BEDWARS_4TEAMS_FAST: "4 Teams\nQuick & Rushy"
});

const FESTIVALS = Object.freeze({
    NONE: "#AAAAAA",
    LUNAR: "#AAAAAA",
    EASTER: "#55FF55",
    SUMMER: "#FFFF55",
    HALLOWEEN: "#FFAA00",
    WINTER: "#FF5555",
});

let latestRotationId = "";

checkForUpdates();
setInterval(checkForUpdates, 15 * 60 * 1000);

async function checkForUpdates() {
    console.log("Checking for updates...");
    let response = await (await fetch(`https://mapapi.cecer1.com/rotation/latest`)).json();

    if (response.id !== latestRotationId) {
        console.log("Changes detected. Updating...")
        await updateRotation(response.id);
        latestRotationId = response.id;
    } else {
        console.log("No changes detected...");
    }
}

async function updateRotation(rotationId) {
    const currentRotation = require("./currentRotation.json");
    const newRotation = {};
    const difference = {};

    if (currentRotation.rotationId === rotationId) {
        console.log("Rotation ID is unchanged. Perhaps a restart?");
        return;
    }

    for (const pool of Object.keys(POOLS)) {
        let poolRotation = await (await fetch(`https://mapapi.cecer1.com/mappool/${pool}`)).json();
        newRotation[pool] = poolRotation.map(id => capitalise(maps[id].name));

        difference[pool] = getDifference(currentRotation[pool], newRotation[pool]);
    }

    newRotation.rotationId = rotationId;

    fs.writeFile("currentRotation.json", JSON.stringify(newRotation, null, 4), err => {
        if (err) {
            throw err;
        } else {
            console.log("Rotation updated successfully.");
        }
    });

    // Do canvas stuff...
    Canvas.registerFont('minecraft.otf', { family: 'Minecraft' });

    const canvas = Canvas.createCanvas(1300, 800);
    const ctx = canvas.getContext('2d');

    const background = await Canvas.loadImage('background.png');
    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

    const rect = {
        width: 250,
        height: 600,
        radius: 30,
        spacing: 50
    };

    let x = (canvas.width - (Object.keys(POOLS).length * (rect.width + rect.spacing) - rect.spacing)) / 2;
    let y = 100;

    // Draw rotation boxes and titles
    for (const [pool, title] of Object.entries(POOLS)) {
        drawRoundedRect(ctx, x, y, rect.width, rect.height, rect.radius);

        let index = 0;
        title.split("\n").forEach(part => {
            ctx.font = index % 2 === 0 ? "32px Minecraft" : "20px Minecraft";
            shadowText(part, x + (rect.width / 2 - ctx.measureText(part).width / 2), y + (36 * (index + 1)), colours.BLUE);
            index++;
        });

        x += 20;
        y = 200;

        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(`Changes:`, x, 200);

        y += 30;

        let diff = difference[pool];

        const offsets = {
            add: ctx.measureText(`+ `).width,
            remove: ctx.measureText(`- `).width
        }

        if (diff.added.length === 0 && diff.removed.length === 0) {
            ctx.fillStyle = "#55FFFF";
            ctx.fillText(`No changes.`, x, y);

            y += 32;
        }

        for (let add of diff.added.sort()) {
            const map = maps[idFromName(add.toLowerCase())];

            ctx.fillStyle = "#55FF55";
            ctx.fillText(`+ `, x, y);

            ctx.fillStyle = FESTIVALS[map.festival];
            ctx.fillText(capitalise(map.name), x + offsets.add, y);

            y += 32;
        }

        for (let remove of diff.removed.sort()) {
            const map = maps[idFromName(remove.toLowerCase())];

            ctx.fillStyle = "#FF5555";
            ctx.fillText(`- `, x, y);

            ctx.fillStyle = FESTIVALS[map.festival];
            ctx.fillText(capitalise(map.name), x + offsets.add, y);

            y += 32;
        }

        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(`Current Rotation:`, x, y);
        ctx.font = "20px Minecraft";
        y += 32;

        for (let poolMap of newRotation[pool].sort()) {
            const map = maps[idFromName(poolMap.toLowerCase())];

            ctx.fillStyle = FESTIVALS[map.festival];
            ctx.fillText(capitalise(map.name), x, y);

            y += 20;
        }

        x += rect.width + rect.spacing - 20;
        y = 100;
    }

    const out = fs.createWriteStream(__dirname + '/rotation.png');
    const stream = canvas.createPNGStream();
    stream.pipe(out);
    out.on('finish', () => console.log('The PNG file was created.'));

    for (let webhook of webhooks) {
        await sendWebhook(webhook);
    }
}

const sendWebhook = async (url) => {
    const form = new FormData();
    form.append('file', fs.createReadStream(__dirname + "/rotation.png"));

    try {
        const response = await fetch(url, {
            method: "POST",
            body: form,
            headers: form.getHeaders()
        });
        console.log("Image sent to Discord webhook");
    } catch (error) {
        console.error("Error sending image to Discord webhook: ", error);
    }
};

const capitalise = str => str.replace(/\b(?<!['\u2019])[a-z]/g, char => char.toUpperCase());

const idFromName = id => Object.entries(maps).find(([key, value]) => value.name === id.toLowerCase())[0];

function getDifference(arr1, arr2) {
    const added = arr2.filter(item => !arr1.includes(item));
    const removed = arr1.filter(item => !arr2.includes(item));

    return { added, removed };
}

function drawRoundedRect(ctx, x, y, width, height, borderRadius) {
    ctx.beginPath();
    ctx.moveTo(x + borderRadius, y);
    ctx.lineTo(x + width - borderRadius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + borderRadius);
    ctx.lineTo(x + width, y + height - borderRadius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - borderRadius, y + height);
    ctx.lineTo(x + borderRadius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - borderRadius);
    ctx.lineTo(x, y + borderRadius);
    ctx.quadraticCurveTo(x, y, x + borderRadius, y);
    ctx.closePath();

    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fill();
}

function shadowText(text, x, y, color) {
    ctx.fillStyle = shadows.get(color);
    ctx.fillText(text, x + 6, y + 6);

    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
}