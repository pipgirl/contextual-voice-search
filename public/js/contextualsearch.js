//Using Azure Search REST API https://docs.microsoft.com/en-us/azure/search/search-query-rest-api
//https://[service name].search.windows.net/indexes/[index name]/docs?[query string]&api-version=2016-09-01

/*EXAMPLE
GET https://[service name].search.windows.net/indexes/hotels/docs?search=budget&$select=hotelName&api-version=2016-09-01

POST https://[service name].search.windows.net/indexes/hotels/docs/search?api-version=2016-09-01
{
    "search": "budget",
    "select": "hotelName"
}
*/


function sendText() {
    var searchQuery = document.getElementById("search").value;
    searchParams(searchQuery);
}

var client;
var request;

function useMic() {
    return document.getElementById("useMic").checked;
}

function getMode() {
    return Microsoft.CognitiveServices.SpeechRecognition.SpeechRecognitionMode.shortPhrase;
}

function getKey() {
    //Sign up for Bing Speech API here: https://www.microsoft.com/cognitive-services/en-us/speech-api
    var key = "{SPEECH TO TEXT KEY HERE}";
    return key;
}

function getLanguage() {
    return "en-us";
}

function clearText() {
    document.getElementById("output").value = "";
    document.getElementById("displayLuisResults").value = "";
    document.getElementById("displayAzureSearchResults").value = "";
}

function setText(text) {
    document.getElementById("output").value += text;
}

function getLuisConfig() {
    //create a LUIS app to receive subscription and app id here: https://www.luis.ai/
    var appid = "{PLACE LUIS APPLICATION ID FROM LUIS.AI HERE}";
    var subid = "{PLACE LUIS SUBSCRIPTION ID HERE}";

    if (appid.length > 0 && subid.length > 0) {
        return { appid: appid, subid: subid };
    }

    return null;
}

function start() {
    var mode = getMode();
    var luisCfg = getLuisConfig();

    clearText();

    if (useMic()) {
        if (luisCfg) {
            client = Microsoft.CognitiveServices.SpeechRecognition.SpeechRecognitionServiceFactory.createMicrophoneClientWithIntent(
                getLanguage(),
                getKey(),
                luisCfg.appid,
                luisCfg.subid);
        } else {
            client = Microsoft.CognitiveServices.SpeechRecognition.SpeechRecognitionServiceFactory.createMicrophoneClient(
                mode,
                getLanguage(),
                getKey());
        }
        client.startMicAndRecognition();
        setTimeout(function () {
            client.endMicAndRecognition();
        }, 5000);
    } else {
        if (luisCfg) {
            client = Microsoft.CognitiveServices.SpeechRecognition.SpeechRecognitionServiceFactory.createDataClientWithIntent(
                getLanguage(),
                getKey(),
                luisCfg.appid,
                luisCfg.subid);
        } else {
            client = Microsoft.CognitiveServices.SpeechRecognition.SpeechRecognitionServiceFactory.createDataClient(
                mode,
                getLanguage(),
                getKey());
        }
        request = new XMLHttpRequest();
        request.open(
            'GET',
            //BELOW USES FILE NOT INCLUDED, PLEASE REMOVE OR REPLACE WITH OWN LOCAL TEST FILE
            (mode == Microsoft.CognitiveServices.SpeechRecognition.SpeechRecognitionMode.shortPhrase) ? "whatstheweatherlike.wav" : "batman.wav",
            true);
        request.responseType = 'arraybuffer';
        request.onload = function () {
            if (request.status !== 200) {
                setText("unable to receive audio file");
            } else {
                client.sendAudio(request.response, request.response.length);
            }
        };

        request.send();
    }

    client.onPartialResponseReceived = function (response) {
        setText(response);
    }

    client.onFinalResponseReceived = function (response) {
        setText(JSON.stringify(response));
         q = response[0].display;
         //SEND SPEECH DESCRIPTION TO LUIS FOR NATURAL LANGUAGE PROCESSING
        searchParams(q);
    }

    client.onIntentReceived = function (response) {
        setText(response);

    };
}

function searchParams(q) {
  
    var params = {
        // Request parameters
        q
    };

    $.ajax({
        //Create an app at LUIS at: http://luis.ai, replace app and subscription keys below
        url: "https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/APP-ID-GOES-HERE?subscription-key=SUBSCRIPTION-ID-GOES-HERE&timezoneOffset=0.0&verbose=true",
        beforeSend: function (xhrObj) {
            // Request headers
            xhrObj.setRequestHeader("Content-Type", "application/json");
        },
        type: "GET",
        // Request body
        data: params,
    })
        .done(function (luisdata) {
            setText(JSON.stringify(luisdata));
            var topIntent = luisdata.topScoringIntent.intent;
            if (luisdata.entities.length == 0) {
                document.getElementById("displayLuisResults").innerHTML = "Looks like you want to " + luisdata.query;
            }
            else {
                var topEntity = luisdata.entities[0].entity;
                var topEntityType = luisdata.entities[0].type;
                document.getElementById("displayLuisResults").innerHTML =  topIntent + " " + topEntityType + " " + topEntity + "<br>";
            }

            //QUERY AZURE SEARCH WITH LUIS RESULTS, USE YOUR OWN AZURE SEARCH DATA OR REPLACE SECTION WITH YOUR OWN DATA API CALLS
            azureSearchData = "";
            for (i = 0; i < luisdata.entities.length; i++) {
                //CHECKING FOR LUIS ENTITIES, REPLACE EACH ENTITY NAME BELOW WITH YOUR OWN
                if (luisdata.entities[i].type == "album" || "artist" || "genre" || "lyric" || "song") {
                    azureSearchData = azureSearchData + luisdata.entities[i].entity + " ";
                    //SEARCH COLUMNS FROM AZURE SEARCH, REPLACE NAMES WITH YOUR OWN
                    var searchCol = "TRACK_NAME, ARTIST_NAME, ALBUM_NAME";
                    $.ajax({
                        //begin request for Azure Search API
                        url: "https://SEARCH-SERVICE.search.windows.net/indexes/INDEX-NAME/docs/search?api-version=2016-09-01",
                        beforeSend: function (xhrObj) {
                            // Request headers
                            xhrObj.setRequestHeader("Content-Type", "application/json");
                            xhrObj.setRequestHeader("api-key", "{YOUR-API-KEY-HERE}");
                            xhrObj.setRequestHeader("Accept", "application/json");
                        },
                        type: "POST",
                        // Request body
                        data: "{'search': '" + azureSearchData + "' }"

                    })
                        .done(function (data) {
                            //IF SUCCESSFUL CALL TO AZURE SEARCH, THEN ITERATE THROUGH RESULTS
                            var dataString = JSON.stringify(data);
                            var searchResults = JSON.parse(dataString);
                            var resultsArray = searchResults.value;
                            var displayResultsArray = [];
                            for (i = 0; i < resultsArray.length; i++) {
                                //CHANGE SEARCH SCORE THRESHOLD AS NEEDED
                                if (resultsArray[i]["@search.score"] > .2) {
                                    //REPLACE ARRAY ITEMS WITH YOUR OWN SEARCH COLUMNS
                                    displayResultsArray.push(resultsArray[i].TRACK_NAME + "<br>" + resultsArray[i].ARTIST_NAME + "<br>" + resultsArray[i].ALBUM_NAME + " <br><br>")
                                }
                            }
                            document.getElementById("displayAzureSearchResults").innerHTML = "We found results you may be interested in: <br><br>" + displayResultsArray;
                        })
                        .fail(function (e) {
                            $("#displayAzureSearchResults").text("Sorry there was an error with your search. Please try again. Error: " + e);
                        })
                }
            }

        })
        .fail(function () {
            alert("error");

        });
};