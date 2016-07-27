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

function receivePostcodeData(data){
    if(data.readyState == 4) {
	var stuff = JSON.parse(data.responseText);
	var feature = stuff.feature;
	var level = stuff.level;
	var popupText = "<p>Level: "+level+
    			"<br/>Location: " + stuff.name + 
			"<br/>Look, a banana!</p>";
	feature.properties = { popupContent: popupText};
	postcodeLayer.addData(feature);
	postcodeCacheData[stuff.name] = feature;
    }
}

function fireAJAXForPostcode(code){
    // This needs to stay a function so the context gets re-evaluated
    // for every xhrobj.
    var url = 'http://www.rasilon.net/postcode_data.php?code='+encodeURIComponent(code);
    var xhrobj = new XMLHttpRequest();
    xhrobj.open('get', url);
    xhrobj.onreadystatechange = function(){receivePostcodeData(xhrobj);};
    xhrobj.send(null);
}

function receiveMarkers(data){
    if(data.readyState == 4) {
	var stuff = JSON.parse(data.responseText);
	console.log(stuff);
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
	for(var i = 0;i<codeList.length;i++){
	    var code = codeList[i];
	    var codeData = postcodeCacheData[code];

	    if(typeof codeData == 'undefined'){
		// It's not in the cache, so fetch it
		fireAJAXForPostcode(code);
	    }else{
		//console.log("Found cache data for "+code);
		if(addFromCache)postcodeLayer.addData(codeData);
	    }
	}

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

    osm.addTo(map);

    var baseMaps = {
	"Mapnik": osm
    };
    var overlayMaps = {
	"Postcodes": postcodeLayer
    };

    var layers = L.control.layers(baseMaps, overlayMaps);
    layers.addTo(map);
    map.addControl(new L.Control.Permalink({text: 'Permalink', layers: layers}));
    map.on('moveend', onMove);

}
