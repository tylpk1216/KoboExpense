var pageCount = 0;
var totalPage = -1;
var records = [];

var itemsPerPage = -1;
var profileID = -1;

function processData(source) {
    pageCount = 0;
    records = [];

    // itemsPerPage
    //<span>顯示： </span><span translate="no">10</span>
    let regexItems = /<span>顯示： <\/span><span translate=\"no\">(\d+)<\/span>/g;
    while((info = regexItems.exec(source)) != null) {
        itemsPerPage = parseInt(info[1]);
        console.log('in regex loop', itemsPerPage);
    }
    console.log('final itemsPerPage', itemsPerPage);

    // totalPage
    //<a href="/tw/zh/purchasehistory?pageNumber=24" class="page-link final">24</a>
    let regexPage = /class=\"page-link final\">(\d*)<\/a>/g;
    while((info = regexPage.exec(source)) != null) {
        totalPage = parseInt(info[1]);
        console.log('in regex loop', totalPage);
    }
    console.log('final totalPage', totalPage);
    
    // It isn't used now, just keep it.
    let regexProfile = /historyPurchasesViewService: \"\/(\d*)\/Profile\/HistoryPurchasesView\",/g;
    while((info = regexProfile.exec(source)) != null) {
        profileID = parseInt(info[1]);
        console.log('in regex loop', profileID);
    }
    console.log('final profileID', profileID);

    if (itemsPerPage == -1 || totalPage == -1) {
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
    
    //<span class="purchase-item-title bold" translate="no">2023/4/14</span>
    let regexDate = /<span class=\"purchase-item-title.*\" translate=\"no\">([0-9]{4,4})\/([0-9]{1,})\/([0-9]{1,})<\/span>/g;
    while((info = regexDate.exec(source)) != null) {
        let y = info[1];
        let m = info[2];
        let d = info[3];

        if (m.length == 1) m = `0${m}`;
        if (d.length == 1) d = `0${d}`;

        dates.push(`${y}-${m}-${d}`);
    }
    
    //<span class="purchase-item-title bold" translate="no">NT$99</span>
    let regexPrice = /<span class=\"purchase-item-title.*\" translate=\"no\">NT\$(.*)<\/span>/g;
    while((info = regexPrice.exec(source)) != null) {
        prices.push(parseInt(info[1].replaceAll(',', '')));
    }
    
    //console.log(dates);
    //console.log(prices);

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
    
    //https://www.kobo.com/tw/zh/purchasehistory?pageNumber=3&pageSize=50
    let url = `https://www.kobo.com/tw/zh/purchasehistory?pageNumber=${page}&pageSize=${itemsPerPage}`

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
