var pageCount = 0;
var totalPage = -1;
var records = [];

var itemsPerPage = -1;
var profileID = -1;

function processData(source) {
    pageCount = 0;
    records = [];

    // itemsPerPage
    //<option selected="selected" value="100">100</option>
    let regexItems = /<option selected=\"selected\" value=\"(\d+)\">.*<\/option>/g;
    while((info = regexItems.exec(source)) != null) {
        itemsPerPage = parseInt(info[1]);
        console.log('in regex loop', itemsPerPage);
    }
    console.log('final itemsPerPage', itemsPerPage);

    // totalPage
    // id="Input_PurchaseHistoryPage" max="14"
    let regexPage = /id=\"Input_PurchaseHistoryPage\" max=\"(\d*)\"/g;
    while((info = regexPage.exec(source)) != null) {
        totalPage = parseInt(info[1]);
        console.log('in regex loop', totalPage);
    }
    console.log('final totalPage', totalPage);

    // profile
    // historyPurchasesViewService: "/90312/Profile/HistoryPurchasesView",
    let regexProfile = /historyPurchasesViewService: \"\/(\d*)\/Profile\/HistoryPurchasesView\",/g;
    while((info = regexProfile.exec(source)) != null) {
        profileID = parseInt(info[1]);
        console.log('in regex loop', profileID);
    }
    console.log('final profileID', profileID);

    if (itemsPerPage == -1 || totalPage == -1 || profileID == -1) {
        sendResultMessage('Kobo HTML changed');
        return;
    }

    getSinglePageData(pageCount+1);
}

function sendResultMessage(msg) {
    chrome.runtime.sendMessage({
        action: "getSource",
        source: msg,
        url: document.URL
    });
}

function sendProgresstMessage(msg) {
    chrome.runtime.sendMessage({
        action: "progress",
        source: msg,
        url: document.URL
    });
}

function parseHTML(source) {
    /*
    obj = {
        purchase_date: "2018-12-28",
        price: 123
    };
    */

    let dates = [];
    let prices = [];

    let regexDate = /kb_orderDate\">\s+([0-9]{4,4})\/([0-9]{1,})\/([0-9]{1,})/g;
    while((info = regexDate.exec(source)) != null) {
        let y = info[1];
        let m = info[2];
        let d = info[3];

        if (m.length == 1) m = `0${m}`;
        if (d.length == 1) d = `0${d}`;

        dates.push(`${y}-${m}-${d}`);
    }

    let regexPrice = /kb_orderPrice\">\s+.*\$(.*)\s+/g;
    while((info = regexPrice.exec(source)) != null) {
        prices.push(parseInt(info[1].replaceAll(',', '')));
    }

    if (dates.length != prices.length) return false;
    if (dates.length == 0) return false;

    for (let i = 0; i < dates.length; i++) {
        let obj = {
            purchase_date: dates[i],
            price: prices[i]
        }
        records.push(obj);
    }
    return true;
}

function getSinglePageData(page) {
    let progressMsg = 'progress : ' + page.toString() + ' / ' + totalPage.toString();
    sendProgresstMessage(progressMsg);

    let url = `https://secure.kobobooks.com/${profileID}/Profile/HistoryPurchasesView?page=${page}&sortMethod=datepurchased&ipp=${itemsPerPage}`

    $.ajax({
        url: url,
        type: 'GET',
        timeout: 60000,
        processData: false,
        contentType: false,
        success: function(data, result) {
            if (!data) {
                sendResultMessage('Kobo responses no data');
                return;
            }

            if (!parseHTML(data.toString())) {
                sendResultMessage('ParseHTML error');
                return;
            }

            pageCount++;
            if (pageCount == totalPage) {
                sendResultMessage(records);
                return;
            }

            getSinglePageData(pageCount+1);
        },
        error: function(xhr, textStatus, message) {
            sendResultMessage(message);
        }
    });
}

processData(document.documentElement.innerHTML);