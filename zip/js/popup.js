const messageID = '#message';
const loadingImgID = '#loading';
const progressBarID = '#progressbar';
const reportID = '#report';

let $messagePanel = null;
let $loadingImg = null;
let $progressBar = null;
let $reportTable = null;

let tabID;

function showMessage(msg) {
    disableLoadingImg(true);
    $progressBar.text('');
    $messagePanel.text(msg);
}

function disableLoadingImg(status) {
    if (status) {
        $loadingImg.hide();
    } else {
        $loadingImg.show();
    }
}

function clearTableRows() {
    $('tr').remove();
}

function getPageHTML() {
    showMessage('');
    disableLoadingImg(false);
    $progressBar.text('');
    clearTableRows();

    chrome.scripting.executeScript(
        {
            target: {tabId: tabID},
            files: ['js/gethtml.js']
        },
        function() {
            if (chrome.runtime.lastError) {
                let errorMsg = chrome.runtime.lastError.message;
                showMessage('error : \n' + errorMsg);
            }
        }
    );
}

async function getCurrentTabID() {
    let queryOptions = { active: true, currentWindow: true };
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab.id;
}

async function start() {
    tabID = await getCurrentTabID();
    chrome.scripting.executeScript(
        {
            target: {tabId: tabID},
            files: ['js/jquery.min.js']
        },
        function() {
            if (chrome.runtime.lastError) {
                let errorMsg = chrome.runtime.lastError.message;
                console.log('error : \n' + errorMsg);
                return;
            }

            $messagePanel = $(messageID);
            $loadingImg = $(loadingImgID);
            $progressBar = $(progressBarID);
            $reportTable = $(reportID);

            getPageHTML();
        }
    );
}

function onWindowLoad() {
    start();
}

function getFormatExpense(expense) {
    let s = expense.toString();
    let ans = '';

    while (s.length > 0) {
        if ((s.length % 3) == 0) {
            if (ans != '') {
                ans += ',';
            }
        }
        ans += s.slice(0, 1);
        s = s.slice(1);
    }

    return ans;
}

function getMonthExpense(monthObj, year, month) {
    let sum = 0;
    let key = year.toString() + '-';
    if (month.toString().length == 1) {
        key += '0';
    }
    key += month.toString();

    if (monthObj[key]) {
        sum = monthObj[key];
    }

    return sum;
}

function renderReportTable(monthObj) {
    let today = new Date();
    let nowYear = today.getFullYear();
    let max = 5;

    let s = '<tr class="tableHeader">';
    s += '<td>&nbsp;&nbsp;</td>';
    for (let i = 0; i < max; i++) {
        s += '<td class="centerData">' + (nowYear - i).toString() + '</td>';
    }
    s += '</tr>';
    $reportTable.append(s);

    let yearsSum = Array(max).fill(0);

    for (let month = 1; month <= 12; month++) {
        s = '<tr>';
        s += '<td class="month">' + month.toString() + '</td>';
        for (let i = 0; i < max; i++) {
            s += '<td class="leftData">';
            let monthExpense = getMonthExpense(monthObj, nowYear - i, month);
            yearsSum[i] += monthExpense;
            s += getFormatExpense(monthExpense);
            s += '</td>';
        }
        s += '</tr>';
        $reportTable.append(s);
    }

    s = '<tr class="yearSum">';
    s += '<td class="centerData">Total</td>';
    for (let i = 0; i < max; i++) {
        s += '<td class="leftData">' + getFormatExpense(yearsSum[i]) + '</td>';
    }
    s += '</tr>';
    $reportTable.append(s);
}

function processReport(items) {
    let monthObj = [];
    for (let i = 0; i < items.length; i++) {
        let dateStr = items[i].purchase_date.slice(0, 7);
        if (!monthObj[dateStr]) {
            monthObj[dateStr] = items[i].price;
        } else {
            monthObj[dateStr] += items[i].price;
        }
    }

    renderReportTable(monthObj);

    disableLoadingImg(true);
    $progressBar.text('');
}

chrome.runtime.onMessage.addListener(function(request, sender) {
    if (request.action == "getSource") {
        if (Array.isArray(request.source)) {
            processReport(request.source);
        } else {
            showMessage(request.source);
        }
    } else if (request.action == "progress") {
        $progressBar.text(request.source);
    }
});

window.onload = onWindowLoad;