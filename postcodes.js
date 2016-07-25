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

var xhrobj;

function onNewPostcode(feature, layer) {
    // does this feature have a property named popupContent?
    if (feature.properties && feature.properties.popupContent) {
        layer.bindPopup(feature.properties.popupContent);
    }
}

var lastLevel = "init";
function receiveMarkers(){
    if(xhrobj.readyState == 4) {
	//console.log(xhrobj.responseText);
	var stuff = JSON.parse(xhrobj.responseText);
	//console.log(stuff);
	if(typeof stuff == 'undefined' || stuff.status != 'OK'){
	    return;
	}
	var level = stuff.level;
	if(level !== lastLevel){
	    postcodeLayer.clearLayers();
	    console.log("Clearing layer. Was "+lastLevel+" now "+level);
	    lastLevel = level;
	}
	for (var prop in stuff) {
	    // skip loop if the property is from prototype
	    if(!stuff.hasOwnProperty(prop)) continue;
	    if(prop == 'status') continue;
	    if(prop == 'level') continue;

	    var feature = stuff[prop];
	    var popupText = "<p>Level: "+level+
			    "<br/>Location: " + prop + 
			    "<br/>Look, a banana!</p>";
    	    feature.properties = { popupContent: popupText};
	    postcodeLayer.addData(stuff[prop]);
	}
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
    xhrobj = new XMLHttpRequest();
    xhrobj.onreadystatechange = receiveMarkers;
    var url = 'http://www.rasilon.net/postcodes_for_bounds.php?'+params;
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
	maxZoom: 16,
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
