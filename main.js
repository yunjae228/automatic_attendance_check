const puppeteer = require("puppeteer");
const {WebClient} = require('@slack/web-api')
const cheerio = require("cheerio");
const token = process.env.SLACK_TOKEN
const channel = process.env.SLACK_CHANNEL
const slackBot = new WebClient(token)

const gonghuil = ['2023-03-01', '2023-05-01', '2023-05-05', '2023-05-29', '2023-06-06', '2023-08-15', '2023-09-28', '2023-09-29', '2023-10-03', '2023-10-09', '2023-12-25']


function setKST(date = new Date()) {
    const timezoneOffset = date.getTimezoneOffset() / 60;
    date.setHours(date.getHours() - timezoneOffset);
    return date;
}

const ACCOUNTLIST = [
    {id: process.env.YUNJAE_ID, pw: process.env.YUNJAE_PASSWORD, name: "윤재"}
];

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms * 1000));
}

async function login(page, {id, pw, name}) {
    try {
        await delay(1);
        if (await page.$("#login_input")) {

            await page.type("#login_input", "unionc.co.kr");

            await page.keyboard.press("Enter");
        }

        await page.waitForSelector("#cid")
            .then(async () => await page.type("#cid", id)
            );

        await page.type("#cpw", pw);

        await page.keyboard.press("Enter");
        try {
            await page.waitForSelector('div.profile-detail', {timeout: 5000});
        } catch (e) {
            await Promise.all([
                page.$eval(`button#nextChangeBtn`, element =>
                    element.click()
                ),
            ]);
        }
    } catch (e) {
        console.log(e);
        throw new Error(`${name} 로그인 실패`);
    }
}

async function chulseok(page, account) {
    await page.goto('https://m109.mailplug.com/ra/worknote/users/check/');

    await page.waitForSelector("div.today-commute > button:nth-child(1)");

    const $ = cheerio.load(await page.content());

    const check = $('.today-intro').html();

    if (check.includes('휴가')) {
        await slackBot.chat.postMessage({
            channel: channel,
            text: `알림 : ${account.name}님은 휴가중이당 !`
        });
        return;
    }
    ;
    const todayCommuteButton = $('.today-commute').html().split('</button>')[0];

    if (todayCommuteButton.includes('commute-button disable')) {

        await slackBot.chat.postMessage({
            channel: channel,
            text: `알림 : ${account.name}님은 이미 출석체크 했당 !`
        })

        return;
    }
    ;
    await page.click("div.today-commute > button:nth-child(1)");

    const $1 = cheerio.load(await page.content());

    const huga = $1('.mp-cont').text();

    if (huga.includes('휴가 취소')) {
        await slackBot.chat.postMessage({
            channel: channel,
            text: `알림 : ${account.name}님은 휴가중이당 !`
        });

        await page.click("div.mp-btn > button:nth-child(2)");

        return;
    }
    await page.click("div.mp-btn > button:nth-child(1)");

    await page.click("div.mp-btn > button:nth-child(1)");

    await slackBot.chat.postMessage({
        channel: channel,
        text: `알림 : ${account.name}님 출석체크 성공!`
    });
}

async function main() {
    const today = setKST().toISOString().split('T')[0]
    if (gonghuil.includes(today)) {
        await slackBot.chat.postMessage({
            channel: channel,
            text: `알림 : 오늘은 공휴일 ! `
        });
        return;
    }
    const accountList = process.argv[2] != 'sub' ? ACCOUNTLIST : SUB_ACCOUNTLIST;

    for (let account of accountList) {
        const browser = await puppeteer.launch({
            headless: false,
        });
        try {
            const page = (await browser.pages())[0];
            await page.goto("https://m109.mailplug.com/member/login");
            await login(page, account);
            await chulseok(page, account);
        } catch (e) {
            await slackBot.chat.postMessage({
                channel: channel,
                text: `알림 error : ${e}`
            });
        } finally {
            await browser.close();
        }
    }
    process.exit();
}

main();