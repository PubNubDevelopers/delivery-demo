/**
 * Logic to handle drawing the map and the markers.
 */

var map = null
var userLocationMarker = null

var initialize = function () {
  var myLatlng = new google.maps.LatLng(30.0, 0.0)
  map = new google.maps.Map(document.getElementById('map-canvas'), {
    zoom: 2,
    minZoom: 2,
    center: myLatlng,
    streetViewControl: false
  })
  //  User location marker is only shown for the user's physical location.  For manually entered addresses, the marker is handled by the same logic that draws the route
  userLocationMarker = new google.maps.Marker({
    draggable: false,
    animation: google.maps.Animation.DROP,
    position: {
      lat: 0.0,
      lng: 0.0
    }
  })
  userLocationMarker.addListener('click', () => {
    zoomOnPosition(userLocationMarker.getPosition());
  })
}

//  Draw the line on the map between the current vehicle and the vehicle's destination.  Depends on the delivery route (received in a PN message when the delivery is first requested).  Colour can be configured in the themes.js file
function drawMapRoute (vehicleId) {
  if (vehicles[vehicleId] != null) {
    if (vehicles[vehicleId].deliveryPath != null) {
      vehicles[vehicleId].deliveryPath.setMap(null)
      vehicles[vehicleId].deliveryPath = null
    }
    //  Only draw the route of pending distance
    vehicles[vehicleId].deliveryPath = new google.maps.Polyline({
      path: vehicles[vehicleId].route.slice(
        vehicles[vehicleId].driverProgress,
        vehicles[vehicleId].route.length - 1
      ),
      geodesic: true,
      strokeColor: theme_routeColours[vehicles[vehicleId].theme],
      strokeOpacity: 1.0,
      strokeWeight: 2
    })
    vehicles[vehicleId].deliveryPath.setMap(map)
  }
}

//  Logic called when a route is first created (i.e. when a PN message is received from a vehicle telling us a new route is happening).  Create an item in the global vehicles variable.
function initializeDeliveryRoute (vehicleId, route, theme, themeSpecificData, originalChannel) {
  var icon = {
    path: theme_driverIcons[theme],
    fillColor: theme_driverIconColours[theme],
    fillOpacity: 0.9,
    strokeWeight: 0,
    scale: 0.05,
    anchor: new google.maps.Point(250, 200)
  }
  vehicles[vehicleId] = {
    route: route,
    theme: theme,
    themeSpecificData: themeSpecificData,
    selected: false,
    driverProgress: 0 //  Number of steps the driver has travelled
  }
  vehicles[vehicleId].destinationMarker = new google.maps.Marker({
    map,
    custom_id: vehicleId,
    draggable: false,
    position: {
      lat: route[route.length - 1].lat,
      lng: route[route.length - 1].lng
    }
  })
  vehicles[vehicleId].destinationMarker.addListener('click', () => {
    zoomOnPosition(vehicles[vehicleId].destinationMarker.getPosition());
  })
  vehicles[vehicleId].vehicleMarker = new google.maps.Marker({
    map,
    custom_id: 'v' + vehicleId,
    draggable: false,
    icon: icon,
    position: {
      lat: route[0].lat,
      lng: route[0].lng
    }
  })
  vehicles[vehicleId].vehicleMarker.addListener('click', () => {
    //zoomOnPosition(vehicles[vehicleId].vehicleMarker.getPosition());
    actionCompleted({ action: 'Click on a Delivery Driver', debug: false }) //  Only used for interactive demo
    for (var vehicle in vehicles) {
      vehicles[vehicle].selected = false;
    }
    vehicles[vehicleId].selected = true;
    populateVehicleBox(vehicleId);
  })

  //  Draw the Route on the map including end marker
  drawMapRoute(vehicleId)
  //  Only zoom in on the vehicle if we created it ourselves
  if (channelName == originalChannel)
    zoomOnPosition(vehicles[vehicleId].destinationMarker.getPosition())
}

//  Moves the vehicle marker whenever a location update is received
function moveVehicleMarker (vehicleId, lat, lng) {
  if (vehicles[vehicleId].vehicleMarker != null) {
    vehicles[vehicleId].vehicleMarker.setPosition({
      lat: lat,
      lng: lng
    })
  }
}

//  Called whenever a location update is received, either via PN message or PN signal
function locationUpdateReceived (vehicleId, lat, lng, progress) {
  if (vehicles[vehicleId] != null) {
    vehicles[vehicleId].driverProgress = progress
    drawMapRoute(vehicleId)
    moveVehicleMarker(vehicleId, lat, lng)
  }
}

//  When the final location update is received, a specific PN message is received from the vehicle.  This function hides the destination marker in response to that.
//  This does NOT clear the user location marker, which corresponds to the user's physical location.
function clearDestinationMarker (vehicleId) {
  if (vehicles[vehicleId] != null) {
    vehicles[vehicleId].destinationMarker.setMap(null)
    vehicles[vehicleId].destinationMarker = null
  }
}

//  When the final location update is received, a specific PN message is received from the vehicle.  This function hides the vehicle marker in response to that.
function clearVehicleMarker (vehicleId) {
  if (vehicles[vehicleId] != null) {
    vehicles[vehicleId].vehicleMarker.setMap(null)
    vehicles[vehicleId].vehicleMarker = null
  }
}

//  Show the marker associated with the user's physical location
function showUserLocationMarker(position)
{
  userLocationMarker.setPosition(position);
  userLocationMarker.setMap(map);
}

//  Hide the marker associated with the user's physical location
function hideUserLocationMarker()
{
  userLocationMarker.setMap(null);
}

function zoomOnPosition (position) {
  map.setZoom(11)
  map.setCenter(position)
}

//  The Marker info window is used to display messages sent from the dashboard (in the vehicle info pane).
//  This message is sent over the PN network twice (once to the simulated vehicle, and once back to the dashboard)
function showInfoWindow(vehicleId, message)
{
  var infoMessage = "<img src='./pn_small.png'> <b>Message delivered via PubNub</b> <br/><br/>"
  infoMessage += moderate(message);
  if (vehicles[vehicleId].infoWindow != null)
    vehicles[vehicleId].infoWindow.close();

  vehicles[vehicleId].infoWindow = new google.maps.InfoWindow({
    content: infoMessage
  })

  vehicles[vehicleId].infoWindow.open({
    anchor: vehicles[vehicleId].vehicleMarker,
    map: map
  })

  //  Google Maps always seems to steal focus when you create a marker info window so take it back (this was easier than creating a custom marker)
  setTimeout(
    "document.getElementById('txtMessageDriver').focus()",
    200
  )
}

//  You can hide the info window by sending a blank message to the vehicle, or it is removed along with the vehicle marker once the journey is complete
function hideInfoWindow(vehicleId)
{
  if (vehicles[vehicleId].infoWindow != null)
    vehicles[vehicleId].infoWindow.close();
}
