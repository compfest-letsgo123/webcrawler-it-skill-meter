const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const DOMParser = require('xmldom').DOMParser;

async function scrapeSVG() {
    let result = {};

    const parser = new DOMParser();

    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    await page.goto('https://roadmap.sh/graphql', { waitUntil: 'networkidle2' });

    let rowCount = 0; // Counter untuk jumlah row yang telah diproses

    const topics = await page.evaluate(() => {
        const topicElements = document.querySelectorAll('g.clickable-group');
        const topicsArray = Array.from(topicElements).map(el => {
            const dataGroupId = el.getAttribute('data-group-id');
            const dataTitle = el.querySelector('tspan').textContent.trim();
            return { dataGroupId, dataTitle };
        });
        return topicsArray;
    });

    for (let i = 0; i < topics.length; i++) {
        const dataGroupParts = topics[i].dataGroupId.split(':');
        const idAndCategoryParts = dataGroupParts[0].split('-');
        const topicId = idAndCategoryParts.shift(); // ID pertama
        const topicCategory = idAndCategoryParts.join('-'); // Gabungkan kembali sisa bagian sebagai kategori
        const topicName = dataGroupParts[1];

        try {
            const response = await axios.get(`https://roadmap.sh/graphql/${topicCategory}/${topicName}`);
            const doc = parser.parseFromString(response.data, 'text/html');

            const h1Element = doc.getElementsByTagName('h1')[0];
            const h1Value = h1Element ? h1Element.textContent : 'Untitled';

            const pElements = doc.getElementsByTagName('p');
            const pValues = pElements.length > 0 ? Array.from(pElements).map(p => p.textContent) : [];

            const aElements = doc.getElementsByTagName('a');
            const aHrefs = aElements.length > 0 ? Array.from(aElements).map(a => a.getAttribute('href')) : [];

            let res = {
                title: h1Value,
                paragraphs: pValues,
                links: aHrefs,
            };

            if (!result[topics[i].dataTitle]) {
                result[topics[i].dataTitle] = {};
            }

            result[topics[i].dataTitle] = res;

            if (rowCount < 5) {
                console.log(`Topic: ${topics[i].dataTitle}`);
                console.log(`Title: ${res.title}`);
                console.log(`Category: ${topicCategory}`);
                console.log(`Name: ${topicName}`);
                console.log(`Paragraphs: ${res.paragraphs}`);
                console.log(`Links: ${res.links}`);
                console.log('-----------------------------');
                rowCount++;
            }

        } catch (err) {
            console.log(err.message, `https://roadmap.sh/graphql/${topicCategory}/${topicName}`);
        }
    }

    await browser.close();

    fs.writeFile('roadmaps2.json', JSON.stringify(result, null, 2), (err) => {
        if (err) throw err;
        console.log('Data written to file');
    });
}

scrapeSVG();
