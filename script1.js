const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');

async function scrapeSVG() {
    let result = {};

    const DOMParser = require('xmldom').DOMParser;
    const parser = new DOMParser();

    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    await page.goto('https://roadmap.sh/roadmaps', { waitUntil: 'networkidle2' });

    const roadmaps = await page.evaluate(() => {
        const roadmapElements = document.getElementsByClassName('g.clickable-group');
        const roadmapsArray = Array.from(roadmapElements).map(el => {
            const path = el.getAttribute('href');
            const roadmapName = el.textContent;
            return { path, roadmapName };
        });
        return roadmapsArray;
    });

    for (let j = 0; j < roadmaps.length; j++) {
        result[roadmaps[j].roadmapName] = {};

        await page.goto(`https://roadmap.sh${roadmaps[j].path}`, { waitUntil: 'networkidle2' });

        const topics = await page.evaluate(() => {
            const topicElements = document.querySelectorAll('g[data-type="topic"], g[data-type="subtopic"]');
            const topicsArray = Array.from(topicElements).map(el => {
                const dataNodeId = el.getAttribute('data-node-id');
                const dataTitle = el.getAttribute('data-title');
                const dataType = el.getAttribute('data-type');
                return { dataNodeId, dataTitle, dataType };
            });
            return topicsArray;
        });

        for (let i = 0; i < topics.length; i++) {
            if (roadmaps[j].path.includes("?")) {
                roadmaps[j].path = roadmaps[j].path.split('?')[0];
            }

            try {
                const response = await axios.get(`https://roadmap.sh${roadmaps[j].path}/${topics[i].dataTitle.toLowerCase().replace(/[^A-Za-z0-9_\- ]/g, "").trim().replace(/ /g, "-")}@${topics[i].dataNodeId}`);
                const doc = parser.parseFromString(response.data, 'text/html');

                const h1Element = doc.getElementsByTagName('h1')[0];
                const h1Value = h1Element ? h1Element.textContent : 'Untitled';

                const pElements = doc.getElementsByTagName('p');
                const pValues = pElements.length > 0 ? Array.from(pElements).map(p => p.textContent) : [];

                const aElements = doc.getElementsByTagName('a');
                const aHrefs = aElements.length > 0 ? Array.from(aElements).map(a => a.getAttribute('href')) : [];

                let res = {
                    title: h1Value,
                    type: topics[i].dataType,
                    paragraphs: pValues,
                    links: aHrefs,
                };
                result[roadmaps[j].roadmapName][topics[i].dataTitle] = res;
            } catch (err) {
                console.log(err.message, `https://roadmap.sh${roadmaps[j].path}/${topics[i].dataTitle.toLowerCase().replace(/[^A-Za-z0-9_\- ]/g, "").trim().replace(/ /g, "-")}@${topics[i].dataNodeId}`);
            }
        }
    }

    await browser.close();

    fs.writeFile('roadmaps1.json', JSON.stringify(result, null, 2), (err) => {
        if (err) throw err;
        console.log('Data written to file');
    });
}

scrapeSVG();
