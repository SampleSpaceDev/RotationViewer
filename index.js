const fs = require("fs");
const Canvas = require("node-canvas");
const fetch = require("node-fetch");
const maps = require("./maps.json");

const POOLS = Object.freeze({
    BEDWARS_8TEAMS_SLOW: "8 Teams Long & Tactical",
    BEDWARS_8TEAMS_FAST: "8 Teams Quick & Rushy",
    BEDWARS_4TEAMS_SLOW: "4 Teams Long & Tactical",
    BEDWARS_4TEAMS_FAST: "4 Teams Quick & Rushy"
});

const FESTIVALS = Object.freeze({
    NONE: "#AAAAAA",
    LUNAR: "#FF55FF",
    EASTER: "#55FF55",
    SUMMER: "#FFFF55",
    HALLOWEEN: "#FFAA00",
    WINTER: "#FF5555",
});

setImmediate(async () => {
    // const currentRotation = require("./currentRotation.json");
    const newRotation = {};
    const difference = {};

    for (const pool of Object.keys(POOLS)) {
        console.log(pool);
        let poolRotation = await (await fetch(`https://mapapi.cecer1.com/mappool/${pool}`)).json();
        newRotation[pool] = poolRotation.map(id => capitalise(maps[id].name));

        // difference[pool] = getDifference(currentRotation[pool], newRotation[pool]);
    }

    console.log(newRotation);

    fs.writeFile("currentRotation.json", JSON.stringify(newRotation, null, 4), err => {
        if (err) {
            throw err;
        } else {
            console.log("Rotation updated successfully.");
        }
    });

    // Do canvas stuff...
    Canvas.registerFont('minecraft.otf', { family: 'Minecraft' })

    const canvas = Canvas.createCanvas(855, 404);
    const ctx = canvas.getContext('2d');

    // BG IMAGE
    const background = await Canvas.loadImage('background.png');

    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
});

const capitalise = str => str.replace(/\b(?<!['\u2019])[a-z]/g, char => char.toUpperCase());

function getDifference(arr1, arr2) {
    const added = arr2.filter(item => !arr1.includes(item));
    const removed = arr1.filter(item => !arr2.includes(item));

    return { added, removed };
}