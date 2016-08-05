var map;
var postcodeLayer;

var located = false;
function onLocationError(e) {
    if(!located){
	var map = L.map('map').setView([55.950, -3.203], 16);
	located = true;
    }
    alert(e.message);
}

// === Some cookie parameters === 
var cookiename = "mapinfo"; // name for this cookie 
var expiredays = 7; // number of days before cookie expiry 

function setCookie(){
    if (typeof map === 'undefined')return;

    var mapcenter = map.getCenter();
    var cookietext = cookiename+"="+mapcenter.lat+"|"+mapcenter.lng+"|"+map.getZoom(); 
    if (expiredays) { 
	var exdate=new Date(); 
	exdate.setDate(exdate.getDate()+expiredays); 
	cookietext += ";expires="+exdate.toGMTString(); 
    } 
    // == write the cookie == 
    document.cookie=cookietext; 
}
function getParam(val) {
      var paramData = location.hash.substr(1);
      if(typeof paramData === 'undefined' || paramData === ''){
	paramData = location.search.substr(1);
      }
      var params = paramData.split("&");
      for(param of params){
	var kv = param.split("=");
	if(kv[0] === val) return kv[1];
      }
}
function mapFromCookie(){
    var localmap;
    if (document.cookie.length>0) { 
    	cookieStart = document.cookie.indexOf(cookiename + "="); 
	if (cookieStart!=-1) { 
    	    cookieStart += cookiename.length+1; 
	    cookieEnd=document.cookie.indexOf(";",cookieStart); 
	    if (cookieEnd==-1) { 
    		cookieEnd=document.cookie.length; 
	    } 
	    cookietext = document.cookie.substring(cookieStart,cookieEnd); 
                    
	    // == split the cookie text and create the variables == 
	    bits = cookietext.split("|"); 
	    lat = parseFloat(bits[0]); 
	    lon = parseFloat(bits[1]); 
	    zoom = parseInt(bits[2]); 
	    localmap = L.map('map').setView([lat, lon], zoom);

	} 
    } 
    if (typeof localmap === 'undefined'){
	localmap = L.map('map').setView([55.950, -3.203 ], 16);
	localmap.locate({setView: true, maxZoom: 16});
    }

    return localmap;
}

function onNewPostcode(feature, layer) {
    // does this feature have a property named popupContent?
    if (feature.properties && feature.properties.popupContent) {
        layer.bindPopup(feature.properties.popupContent);
    }
}

var lastLevel = "init";
var postcodeCacheData = {};

function receivePostcodeDataList(data){
    if(data.readyState == 4) {
	if(data.status != 200) {
	    console.log("AJAX response was "+data.status+" so bailing on this one.");
	    return;
	}
	var postcodeData = JSON.parse(data.responseText);
	for(var i = 0; i< postcodeData.length;i++){
	    var stuff = postcodeData[i];

	    var feature = stuff.feature;
	    var level = stuff.level;
	    var popupText = "<p>Level: "+level+
			    "<br/>Location: " + stuff.name + 
			    "<br/>Look, a banana!</p>";
	    feature.properties = { popupContent: popupText};
	    postcodeLayer.addData(feature);
	    postcodeCacheData[stuff.name] = feature;
	}
	console.log("Feature cache now contains "+Object.keys(postcodeCacheData).length+" entries.");
    }
}

function fireAJAXForPostcodeList(codes){
    var url = 'http://www.rasilon.net/postcode_data_list.php';
    var post = 'codes='+encodeURIComponent(codes.join(","))
    console.log("Requesting postcode list from ["+url+"]")
    var xhrobj = new XMLHttpRequest();
    xhrobj.open('post', url);
    xhrobj.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    xhrobj.onreadystatechange = function(){receivePostcodeDataList(xhrobj);};
    xhrobj.send(post);
}


function receiveMarkers(data){
    if(data.readyState == 4) {
	var stuff = JSON.parse(data.responseText);
	if(typeof stuff == 'undefined' || stuff.status != 'OK'){
	    return;
	}
	var level = stuff.level;

	var addFromCache = false;
	if(level !== lastLevel){
	    postcodeLayer.clearLayers();
	    addFromCache = true;
	}

	var codeList = stuff.codes;
	console.log(codeList);
	var codesNeeded = [];
	for(var i = 0;i<codeList.length;i++){
	    var code = codeList[i];
	    var codeData = postcodeCacheData[code];

	    if(typeof codeData == 'undefined'){
		// It's not in the cache, so fetch it
		//fireAJAXForPostcode(code);
		codesNeeded.push(code);
	    }else{
		//console.log("Found cache data for "+code);
		if(addFromCache)postcodeLayer.addData(codeData);
	    }
	}
	fireAJAXForPostcodeList(codesNeeded);

	/*
	if(level !== lastLevel){
	    postcodeLayer.clearLayers();
	    console.log("Clearing layer. Was "+lastLevel+" now "+level);
	    lastLevel = level;
	}
	*/
    }
}

function onMove(e){
    var bounds = map.getBounds();
    var params=
	"w="+bounds.getWest() +
	"&s="+ bounds.getSouth() +
	"&e=" + bounds.getEast() +
	"&n="+bounds.getNorth() +
	"&zoom="+map.getZoom()
	;
    var xhrobj = new XMLHttpRequest();
    xhrobj.onreadystatechange = function(){receiveMarkers(xhrobj);};
    var url = 'http://www.rasilon.net/postcode_list_for_bounds.php?'+params;
    console.log("Requested ["+url+"]");
    xhrobj.open('get', url);
    xhrobj.send(null);
}

function initMaps(){
    var paramLat = getParam("lat");
    if(typeof paramLat  === 'undefined'){
	map = mapFromCookie();
	if (typeof map === 'undefined'){
	    alert("No Map!");
	    return;
	}
    }else{
	// We're using the URL to override
	paramLon = getParam("lon");
	paramZoom = getParam("zoom");
	map =  L.map('map').setView([paramLat,  paramLon],  paramZoom);
    }


    var simplified = L.tileLayer('/tiles/simplified/{z}/{x}/{y}.png', {
	maxZoom: 17,
	minZoom: 5,
	attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
		'<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ',
	id: 'bear.mapnik'
    });

    var osm = L.tileLayer('/osm/{z}/{x}/{y}.png', {
	maxZoom: 17,
	minZoom: 5,
	attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
		'<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ',
	id: 'bear.mapnik'
    });

    postcodeLayer = L.geoJson(null,{
     	onEachFeature: onNewPostcode
	}).addTo(map);
    onMove(null); // Init the postcodes.

    L.control.search({
	url: 'http://www.rasilon.net/find_postcode.php?q={s}',
	textPlaceholder: 'Postcode...',
	collapsed: false,
	//markerIcon: new L.Icon({iconUrl:'data/custom-icon.png', iconSize: [20,20]}),
	markerLocation: true
    }).addTo(map);


    osm.addTo(map);

    var baseMaps = {
	"Local Simplified OSM": simplified,
	"Local Base OSM": osm
    };
    var overlayMaps = {
	"Postcodes": postcodeLayer
    };

    var layers = L.control.layers(baseMaps, overlayMaps);
    layers.addTo(map);
    map.addControl(new L.Control.Permalink({text: 'Permalink', layers: layers}));
    map.on('moveend', onMove);

}
