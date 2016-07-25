var map;
var postcodeMarkers = {};
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
	console.log(stuff);
	if(typeof stuff == 'undefined' || stuff.status != 'OK'){
	    return;
	}
	var level;
	for (var prop in stuff) {
	    // skip loop if the property is from prototype
	    if(!stuff.hasOwnProperty(prop)) continue;
	    if(prop == 'status') continue;
	    if(prop == 'level'){
		level = stuff.level;
		if(level !== lastLevel){
		    postcodeLayer.clearLayers();
		    console.log("Clearing layer");
		    lastLevel = level;
		}
		continue;
	    }

	    //console.log(prop + " = " + stuff[prop]);
	    if(typeof postcodeMarkers[prop] == 'undefined'){
		// Add it to the list, and to the map
		postcodeMarkers[prop] = stuff[prop];
		var feature = stuff[prop];
		feature.properties = { popupContent: "<p>Level: "+level+"<br/>Location: " + prop + "<br/>Look, a banana!</p>"};
		postcodeLayer.addData(stuff[prop]);
	    }
	}
    }
}

function onMove(e){
    console.log(e);
    var bounds = map.getBounds();
    console.log(bounds);
    var params=
	"w="+bounds.getWest() +
	"&s="+ bounds.getSouth() +
	"&e=" + bounds.getEast() +
	"&n="+bounds.getNorth() +
	"&zoom="+map.getZoom()
	;
    console.log(params);
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

    var contours = L.tileLayer('/tiles/contours/{z}/{x}/{y}.png', {
	maxZoom: 16,
	minZoom: 8,
	id: 'bear.contours',
	opacity: 0.3
    });

    var osgb = L.tileLayer('/tiles/grid/{z}/{x}/{y}.png', {
	maxZoom: 16,
	minZoom: 12,
	id: 'bear.osgb'
    });

    var dykes = L.tileLayer('/tiles/dykes/{z}/{x}/{y}.png', {
	maxZoom: 16,
	id: 'bear.dykes',
	opacity: 0.5,
	attribution: '| Geology layers: Based upon DiGMapGB-625, with the permission of the British Geological Survey'
    });

    var faults = L.tileLayer('/tiles/faults/{z}/{x}/{y}.png', {
	maxZoom: 16,
	id: 'bear.faults',
	opacity: 0.5,
	attribution: '| Geology layers: Based upon DiGMapGB-625, with the permission of the British Geological Survey'
    });

    var solid = L.tileLayer('/tiles/solid/{z}/{x}/{y}.png', {
	maxZoom: 16,
	id: 'bear.solid',
	opacity: 1.0,
	attribution: '| Geology layers: Based upon DiGMapGB-625, with the permission of the British Geological Survey'
    });

    var newMarilynLayer = new L.MarkerClusterGroup({
    	iconCreateFunction: function(cluster) {
    	    var n = '<b>' + cluster.getChildCount() + '</b>';
	    return new L.DivIcon({ 
		html: n,
		className: 'mycluster',
		iconSize: L.point(40, 40)
	    });
	}
    });

    for(i=0;i<marilynsArray.length;i++){
	var m = L.marker([marilynsArray[i].lat, marilynsArray[i].lng]).bindPopup(marilynsArray[i].hill_name);
	newMarilynLayer.addLayer(m);
    }

    postcodeLayer = L.geoJson(null,{
     	onEachFeature: onNewPostcode
	}).addTo(map);
    onMove(null); // Init the postcodes.

    osm.addTo(map);
    contours.addTo(map);
    osgb.addTo(map);

    if(getParam("marilyns")){
	newMarilynLayer.addTo(map);
    }

    if(getParam("solid")){
	solid.addTo(map);
    }

    if(getParam("dykes")){
	dykes.addTo(map);
    }

    if(getParam("faults")){
	faults.addTo(map);
    }


    var baseMaps = {
	"Mapnik": osm
    };
    var overlayMaps = {
	"Contours": contours,
	"OS Grid": osgb,
	"Solid": solid,
	"Dykes": dykes,
	"Faults": faults,
	"Marilyn Markers": newMarilynLayer,
	"Postcodes": postcodeLayer
    };

    var layers = L.control.layers(baseMaps, overlayMaps);

    layers.addTo(map);

    map.addControl(new L.Control.Permalink({text: 'Permalink', layers: layers}));


    var solidExplanationMarker = L.marker([0.0,0.0]).bindPopup("No popup content yet!");

    map.on('click', function(e) {
	if(map.hasLayer(solid)){
	    var popupData = "Not Implemented Yet.<br>At "+e.latlng.lng+" "+e.latlng.lat;

	    var xmlhttp = new XMLHttpRequest();
	    xmlhttp.onreadystatechange = function() {
		if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
		    var r = JSON.parse(xmlhttp.responseText);

		    var groupName = decodeURI(r.lex_d);
		    var descr = decodeURI(r.rcs_d);
		    var minMY = decodeURI(r.min_my);
		    var maxMY = decodeURI(r.max_my);
		    var maxPeriod = decodeURI(r.max_period);
		    var minPeriod = decodeURI(r.min_period);

		    var popupData = "";
		    if(typeof groupName == "undefined" || groupName === ""){
			popupData = "Unknown bedrock.";
		    }else{
			popupData = "<table class=\"descrTable\">"+
				    "<tr><td>Name</td><td> "+groupName+"</td></tr>"+
				    "<tr><td>Description</td><td>"+descr+"</td></tr>"+
				    "<tr><td>Deposited between</td><td>"+
					maxMY+
					" million years ago ("+
					maxPeriod+
					"),<br>and<br>"+
					minMY+
					" million years ago ("+
					minPeriod+
					").</td></tr>\n</table>"
				    ;
		    }
		    solidExplanationMarker
			.setLatLng(e.latlng)
			.addTo(map)
			.setPopupContent(popupData)
			.openPopup();
		}
	    }
	    xmlhttp.open("GET", "http://www.rasilon.net/descr_for_location.cgi?lat="+e.latlng.lat+"&lng="+e.latlng.lng, true);
	    xmlhttp.send();

	}else{
	    //alert("No solid");
	}
    });
    map.on('moveend', onMove);

}
